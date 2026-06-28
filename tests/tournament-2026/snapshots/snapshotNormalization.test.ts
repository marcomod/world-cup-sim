import { describe, expect, it } from "vitest";
import { normalizeTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { cloneSnapshot, completeSnapshot } from "./helpers";

describe("tournament snapshot normalization", () => {
  it("produces stable normalized output under arbitrary input ordering", () => {
    const snapshot = completeSnapshot();
    const reordered = cloneSnapshot(snapshot);
    reordered.teams = [...reordered.teams].reverse();
    reordered.fixtures = [...reordered.fixtures].reverse();
    reordered.fairPlay = [...reordered.fairPlay].reverse();
    reordered.fifaRanking = [...reordered.fifaRanking].reverse();

    expect(normalizeTournamentSnapshot(reordered)).toEqual(normalizeTournamentSnapshot(snapshot));
  });

  it("orders teams by group then ID, fixtures by match number, and records by team ID", () => {
    const normalized = normalizeTournamentSnapshot(completeSnapshot());

    expect(normalized.teams.map((team) => `${team.group}:${team.id}`).slice(0, 4)).toEqual([
      "A:cze",
      "A:kor",
      "A:mex",
      "A:rsa",
    ]);
    expect(normalized.fixtures.map((fixture) => fixture.fifaMatchNumber)).toEqual(
      Array.from({ length: 72 }, (_, index) => index + 1),
    );
    expect(normalized.fairPlay.map((record) => record.teamId)).toEqual(
      [...normalized.fairPlay.map((record) => record.teamId)].sort(),
    );
  });
});
