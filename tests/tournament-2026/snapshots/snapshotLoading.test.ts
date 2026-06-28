import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";
import { completeSnapshot, fixturePath } from "./helpers";

describe("tournament snapshot loading", () => {
  it("loads, validates, normalizes, and checksums a local JSON snapshot", () => {
    const loaded = loadTournamentSnapshot(fixturePath("synthetic-complete.snapshot.json"));
    expect(loaded.snapshot.fixtures).toHaveLength(72);
    expect(loaded.snapshot.fixtures.map((fixture) => fixture.fifaMatchNumber)).toEqual(
      Array.from({ length: 72 }, (_, index) => index + 1),
    );
    expect(loaded.metadata.snapshotChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(loaded.metadata)).not.toContain(process.cwd());
  });

  it("fails deterministically for malformed JSON and schema-invalid files", () => {
    const tmpDir = join(tmpdir(), "world-cup-sim-snapshot-loader-tests");
    mkdirSync(tmpDir, { recursive: true });

    const malformed = join(tmpDir, "malformed.snapshot.json");
    writeFileSync(malformed, "{ not json", "utf8");
    expect(() => loadTournamentSnapshot(malformed)).toThrow(/Unable to parse tournament snapshot/);

    const invalid = join(tmpDir, "invalid.snapshot.json");
    const snapshot = completeSnapshot();
    snapshot.schemaVersion = "bad";
    writeFileSync(invalid, JSON.stringify(snapshot), "utf8");
    expect(() => loadTournamentSnapshot(invalid)).toThrow(/Unsupported snapshot schemaVersion/);

    const invalidState = join(tmpDir, "invalid-state.snapshot.json");
    writeFileSync(
      invalidState,
      JSON.stringify({ ...completeSnapshot(), state: "structure_only" }),
      "utf8",
    );
    expect(() => loadTournamentSnapshot(invalidState)).toThrow(/does not match derived state/);
  });

  it("keeps local loading single-read and network-free by construction", () => {
    const source = readFileSync(join(process.cwd(), "src/data/world-cup-2026/snapshots/loadSnapshot.ts"), "utf8");
    expect(source.match(/readFileSync/g)).toHaveLength(2);
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest|https?\.request/);
  });
});
