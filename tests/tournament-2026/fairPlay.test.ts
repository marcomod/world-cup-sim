import { describe, expect, it } from "vitest";
import { rankGroupTeams, rankThirdPlacedTeams } from "@/src/lib/tournament-2026";
import type { FairPlayByTeamId, GroupId, GroupTableRow, RankedGroupTeam, TeamId } from "@/src/lib/tournament-2026";
import { createMatch, groupRows } from "./helpers";

function row(teamId: TeamId): GroupTableRow {
  return {
    teamId,
    group: "A",
    played: 3,
    wins: 0,
    draws: 3,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 3,
  };
}

function allDraws(): ReturnType<typeof createMatch>[] {
  return [
    createMatch("m1", "A", "a", "b", 0, 0),
    createMatch("m2", "A", "c", "d", 0, 0),
    createMatch("m3", "A", "a", "c", 0, 0),
    createMatch("m4", "A", "d", "b", 0, 0),
    createMatch("m5", "A", "d", "a", 0, 0),
    createMatch("m6", "A", "b", "c", 0, 0),
  ];
}

describe("fair-play completeness", () => {
  it("resolves ties with complete fair-play data and accepts explicit zero", () => {
    const fairPlay: FairPlayByTeamId = {
      a: { teamId: "a", deductionPoints: 4 },
      b: { teamId: "b", deductionPoints: 0 },
      c: { teamId: "c", deductionPoints: 2 },
      d: { teamId: "d", deductionPoints: 6 },
    };

    const ranked = rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws(), {
      fairPlayByTeamId: fairPlay,
    });

    expect(ranked.map((team) => team.teamId)).toEqual(["b", "c", "a", "d"]);
    expect(ranked[0].appliedTieBreakers).toContain("fair_play");
  });

  it("fails in official mode when one or all tied teams are missing fair-play records", () => {
    expect(() =>
      rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws(), {
        fairPlayByTeamId: {
          a: { teamId: "a", deductionPoints: 0 },
          b: { teamId: "b", deductionPoints: 0 },
          c: { teamId: "c", deductionPoints: 0 },
        },
      }),
    ).toThrow(/missing records for d/);

    expect(() => rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws())).toThrow(
      /missing records/,
    );
  });

  it("uses development fallback only when explicitly enabled", () => {
    expect(() =>
      rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws(), {
        rankingMode: "development_fallback",
      }),
    ).not.toThrow();
  });

  it("does not consult fair play when earlier criteria resolve the tie", () => {
    expect(() =>
      rankGroupTeams(
        "A",
        [row("a"), row("b"), row("c"), row("d")],
        [
          createMatch("m1", "A", "a", "b", 1, 0),
          createMatch("m2", "A", "a", "c", 1, 0),
          createMatch("m3", "A", "a", "d", 1, 0),
          createMatch("m4", "A", "b", "c", 1, 0),
          createMatch("m5", "A", "b", "d", 1, 0),
          createMatch("m6", "A", "c", "d", 1, 0),
        ],
      ),
    ).not.toThrow();
  });

  it("rejects invalid fair-play records", () => {
    expect(() =>
      rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws(), {
        fairPlayByTeamId: {
          a: { teamId: "x", deductionPoints: 0 },
          b: { teamId: "b", deductionPoints: 0 },
          c: { teamId: "c", deductionPoints: 0 },
          d: { teamId: "d", deductionPoints: 0 },
        },
      }),
    ).toThrow(/does not match/);

    expect(() =>
      rankGroupTeams("A", [row("a"), row("b"), row("c"), row("d")], allDraws(), {
        fairPlayByTeamId: {
          a: { teamId: "a", deductionPoints: 0.5 },
          b: { teamId: "b", deductionPoints: 0 },
          c: { teamId: "c", deductionPoints: 0 },
          d: { teamId: "d", deductionPoints: 0 },
        },
      }),
    ).toThrow(/non-negative integer/);
  });

  it("fails a third-place cutoff tie with incomplete fair-play data", () => {
    const tables = Object.fromEntries(
      "ABCDEFGHIJKL".split("").map((groupId, index) => {
        const third = groupRows([`${groupId.toLowerCase()}3`])[0];
        const table: RankedGroupTeam[] = [
          { ...third, teamId: `${groupId.toLowerCase()}1`, position: 1, points: 9 },
          { ...third, teamId: `${groupId.toLowerCase()}2`, position: 2, points: 6 },
          { ...third, position: 3, points: index < 7 ? 5 : 4 },
          { ...third, teamId: `${groupId.toLowerCase()}4`, position: 4, points: 0 },
        ];
        return [groupId, table];
      }),
    ) as Record<GroupId, readonly RankedGroupTeam[]>;

    expect(() => rankThirdPlacedTeams(tables)).toThrow(/Third-place ranking requires complete fair-play data/);
  });
});
