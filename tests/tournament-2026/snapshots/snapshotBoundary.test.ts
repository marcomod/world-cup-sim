import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as browserSnapshots from "@/src/data/world-cup-2026/snapshots";
import * as nodeSnapshots from "@/src/data/world-cup-2026/snapshots/node";

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("snapshot module boundaries", () => {
  it("keeps the browser-safe barrel free of Node-only exports and imports", () => {
    const indexSource = readRepoFile("src/data/world-cup-2026/snapshots/index.ts");

    expect(indexSource).not.toMatch(/loadSnapshot|snapshotChecksum|node:/);
    expect(browserSnapshots).not.toHaveProperty("loadTournamentSnapshot");
    expect(browserSnapshots).not.toHaveProperty("computeTournamentSnapshotChecksum");
    expect(browserSnapshots).toHaveProperty("validateTournamentSnapshot");
    expect(browserSnapshots).toHaveProperty("normalizeTournamentSnapshot");
  });

  it("exposes loader and checksum APIs only through the Node entry point", () => {
    const nodeSource = readRepoFile("src/data/world-cup-2026/snapshots/node.ts");

    expect(nodeSource).toMatch(/Node-only snapshot utilities/);
    expect(nodeSnapshots).toHaveProperty("loadTournamentSnapshot");
    expect(nodeSnapshots).toHaveProperty("computeTournamentSnapshotChecksum");
  });

  it("does not make Node built-ins reachable through browser-safe snapshot modules", () => {
    for (const path of [
      "src/data/world-cup-2026/snapshots/index.ts",
      "src/data/world-cup-2026/snapshots/validateSnapshot.ts",
      "src/data/world-cup-2026/snapshots/normalizeSnapshot.ts",
      "src/data/world-cup-2026/snapshots/schema.ts",
      "src/lib/tournament-2026/snapshot/buildTournamentState.ts",
    ]) {
      expect(readRepoFile(path), path).not.toMatch(/node:fs|node:path|node:crypto/);
    }
  });

  it("keeps client-compatible tournament modules away from the Node-only entry point", () => {
    for (const path of [
      "src/lib/tournament-2026/snapshot/buildTournamentState.ts",
      "src/lib/tournament-2026/snapshot/adaptSnapshotTeams.ts",
      "src/lib/tournament-2026/snapshot/adaptSnapshotMatches.ts",
      "src/lib/tournament-2026/snapshot/adaptFairPlay.ts",
      "src/lib/tournament-2026/snapshot/adaptFifaRanking.ts",
    ]) {
      expect(readRepoFile(path), path).not.toMatch(/world-cup-2026\/snapshots\/node|loadTournamentSnapshot/);
    }
  });
});
