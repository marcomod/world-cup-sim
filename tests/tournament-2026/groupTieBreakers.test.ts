import { describe, expect, it } from "vitest";
import { rankGroupTeams } from "@/src/lib/tournament-2026";
import type { GroupTableRow, TeamId } from "@/src/lib/tournament-2026";
import { createMatch } from "./helpers";

function row(teamId: TeamId, overrides: Partial<GroupTableRow> = {}): GroupTableRow {
  return {
    teamId,
    group: "A",
    played: 3,
    wins: 1,
    draws: 1,
    losses: 1,
    goalsFor: 3,
    goalsAgainst: 3,
    goalDifference: 0,
    points: 4,
    ...overrides,
  };
}

describe("group tie-breakers", () => {
  it("uses head-to-head to resolve a two-team tie", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("c", { points: 9 }), row("a"), row("b"), row("d", { points: 0 })],
      [createMatch("m1", "A", "a", "b", 1, 0)],
      { allowDeterministicFallback: true },
    );

    expect(ranked[1].teamId).toBe("a");
    expect(ranked[2].teamId).toBe("b");
    expect(ranked[1].appliedTieBreakers).toContain("head_to_head_points");
  });

  it("restarts head-to-head for a residual subset after one team separates", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("a"), row("b"), row("c"), row("d", { points: 0 })],
      [
        createMatch("m1", "A", "a", "b", 3, 0),
        createMatch("m2", "A", "a", "c", 1, 1),
        createMatch("m3", "A", "b", "c", 1, 0),
      ],
      { allowDeterministicFallback: true },
    );

    expect(ranked.map((team) => team.teamId).slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(ranked[0].appliedTieBreakers).toContain("head_to_head_points");
  });

  it("handles a four-team tie with a residual two-team subset", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("a"), row("b"), row("c"), row("d")],
      [
        createMatch("m1", "A", "a", "b", 1, 0),
        createMatch("m2", "A", "a", "c", 0, 0),
        createMatch("m3", "A", "a", "d", 1, 0),
        createMatch("m4", "A", "b", "c", 1, 0),
        createMatch("m5", "A", "b", "d", 0, 0),
        createMatch("m6", "A", "c", "d", 2, 0),
      ],
      { allowDeterministicFallback: true },
    );

    expect(ranked.map((team) => team.teamId)).toEqual(["a", "b", "c", "d"]);
  });

  it("continues to head-to-head goal difference when all teams remain tied on head-to-head points", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("a"), row("b"), row("c"), row("d", { points: 0 })],
      [
        createMatch("m1", "A", "a", "b", 3, 0),
        createMatch("m2", "A", "b", "c", 1, 0),
        createMatch("m3", "A", "c", "a", 1, 0),
      ],
      { allowDeterministicFallback: true },
    );

    expect(ranked.map((team) => team.teamId).slice(0, 3)).toEqual(["a", "c", "b"]);
    expect(ranked[0].appliedTieBreakers).toContain("head_to_head_goal_difference");
  });

  it("is deterministic for reversed team and match order", () => {
    const rows = [row("a"), row("b"), row("c"), row("d")];
    const matches = [
      createMatch("m1", "A", "a", "b", 1, 0),
      createMatch("m2", "A", "a", "c", 0, 0),
      createMatch("m3", "A", "a", "d", 1, 0),
      createMatch("m4", "A", "b", "c", 1, 0),
      createMatch("m5", "A", "b", "d", 0, 0),
      createMatch("m6", "A", "c", "d", 2, 0),
    ];

    expect(rankGroupTeams("A", rows, matches, { allowDeterministicFallback: true })).toEqual(
      rankGroupTeams("A", [...rows].reverse(), [...matches].reverse(), {
        allowDeterministicFallback: true,
      }),
    );
  });

  it("does not use team IDs before official criteria are exhausted", () => {
    expect(() =>
      rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], [], {
        rankingMode: "official",
      }),
    ).toThrow(/fair-play data/);
  });
});
