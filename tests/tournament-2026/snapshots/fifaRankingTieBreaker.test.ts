import { describe, expect, it } from "vitest";
import {
  rankGroupTeams,
  rankThirdPlacedTeams,
  type FifaRankingByTeamId,
  type GroupStageMatch,
  type GroupTableRow,
  type RankedGroupTeam,
} from "@/src/lib/tournament-2026";

const fairPlayByTeamId = {
  mex: { teamId: "mex", deductionPoints: 0 },
  rsa: { teamId: "rsa", deductionPoints: 0 },
  kor: { teamId: "kor", deductionPoints: 0 },
  cze: { teamId: "cze", deductionPoints: 0 },
  can: { teamId: "can", deductionPoints: 0 },
  bih: { teamId: "bih", deductionPoints: 0 },
} as const;

const fifaRankingByTeamId: FifaRankingByTeamId = {
  mex: { teamId: "mex", rank: 10, rankingDate: "2026-06-18" },
  rsa: { teamId: "rsa", rank: 20, rankingDate: "2026-06-18" },
  kor: { teamId: "kor", rank: 30, rankingDate: "2026-06-18" },
  cze: { teamId: "cze", rank: 40, rankingDate: "2026-06-18" },
  can: { teamId: "can", rank: 50, rankingDate: "2026-06-18" },
  bih: { teamId: "bih", rank: 60, rankingDate: "2026-06-18" },
};

function row(teamId: string, points: number): GroupTableRow {
  return {
    teamId,
    group: "A",
    played: 3,
    wins: points === 4 ? 1 : 0,
    draws: points === 4 ? 1 : 0,
    losses: points === 4 ? 1 : 3,
    goalsFor: points === 4 ? 2 : 0,
    goalsAgainst: points === 4 ? 2 : 3,
    goalDifference: points === 4 ? 0 : -3,
    points,
  };
}

function drawMatch(id: string, homeTeamId: string, awayTeamId: string): GroupStageMatch {
  return {
    id,
    group: "A",
    homeTeamId,
    awayTeamId,
    status: "completed",
    result: { homeGoals: 1, awayGoals: 1 },
  };
}

describe("FIFA ranking tie-breaker", () => {
  it("resolves a two-team group tie only after football and fair-play criteria remain tied", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("rsa", 4), row("mex", 4), row("kor", 1), row("cze", 0)],
      [drawMatch("a", "mex", "rsa")],
      { fairPlayByTeamId, fifaRankingByTeamId, rankingMode: "official" },
    );

    expect(ranked.map((team) => team.teamId).slice(0, 2)).toEqual(["mex", "rsa"]);
    expect(ranked[0].appliedTieBreakers).toContain("fifa_ranking");
  });

  it("resolves a three-team residual tie with lower numerical FIFA rank first", () => {
    const ranked = rankGroupTeams(
      "A",
      [row("kor", 4), row("rsa", 4), row("mex", 4), row("cze", 0)],
      [
        drawMatch("a", "mex", "rsa"),
        drawMatch("b", "mex", "kor"),
        drawMatch("c", "rsa", "kor"),
      ],
      { fairPlayByTeamId, fifaRankingByTeamId, rankingMode: "official" },
    );

    expect(ranked.map((team) => team.teamId).slice(0, 3)).toEqual(["mex", "rsa", "kor"]);
    expect(ranked[0].appliedTieBreakers).toContain("fifa_ranking");
  });

  it("resolves a third-place cutoff tie by FIFA ranking", () => {
    const tables = Object.fromEntries(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map((groupId, index) => {
        const teamId = index < 7 ? `q${index}` : index === 7 ? "mex" : index === 8 ? "rsa" : `nq${index}`;
        const third: RankedGroupTeam = {
          ...row(teamId, index < 7 ? 4 : index < 9 ? 3 : 1),
          group: groupId as RankedGroupTeam["group"],
          position: 3,
          appliedTieBreakers: [],
        };
        return [
          groupId,
          [
            { ...third, teamId: `${teamId}-winner`, position: 1, points: 9 },
            { ...third, teamId: `${teamId}-runner`, position: 2, points: 6 },
            third,
            { ...third, teamId: `${teamId}-fourth`, position: 4, points: 0 },
          ],
        ];
      }),
    ) as Parameters<typeof rankThirdPlacedTeams>[0];

    const allThirdIds = Object.values(tables).map((table) => table[2].teamId);
    const fairPlayAll = Object.fromEntries(
      allThirdIds.map((teamId) => [teamId, { teamId, deductionPoints: 0 }]),
    );
    const rankings = {
      ...Object.fromEntries(
        allThirdIds.map((teamId, index) => [teamId, { teamId, rank: index + 10, rankingDate: "2026-06-18" }]),
      ),
      mex: { teamId: "mex", rank: 1, rankingDate: "2026-06-18" },
      rsa: { teamId: "rsa", rank: 2, rankingDate: "2026-06-18" },
    } as FifaRankingByTeamId;

    const ranked = rankThirdPlacedTeams(tables, {
      fairPlayByTeamId: fairPlayAll,
      fifaRankingByTeamId: rankings,
      rankingMode: "official",
    });

    expect(ranked.find((team) => team.teamId === "mex")?.qualified).toBe(true);
    expect(ranked.find((team) => team.teamId === "rsa")?.qualified).toBe(false);
  });

  it("fails only when required ranking data is missing", () => {
    expect(() =>
      rankGroupTeams("A", [row("mex", 4), row("rsa", 4), row("kor", 0), row("cze", 0)], [], {
        fairPlayByTeamId,
        fifaRankingByTeamId: { mex: fifaRankingByTeamId.mex },
        rankingMode: "official",
      }),
    ).toThrow(/missing records for rsa/);

    expect(() =>
      rankGroupTeams("A", [row("mex", 6), row("rsa", 4), row("kor", 3), row("cze", 0)], [], {
        fairPlayByTeamId,
        fifaRankingByTeamId: { mex: fifaRankingByTeamId.mex },
        rankingMode: "official",
      }),
    ).not.toThrow();
  });

  it("does not consult fair play or FIFA ranking when football criteria resolve the group", () => {
    expect(() =>
      rankGroupTeams("A", [row("mex", 9), row("rsa", 6), row("kor", 3), row("cze", 0)], [], {
        rankingMode: "official",
      }),
    ).not.toThrow();
  });

  it("does not consult FIFA ranking when fair play resolves the group", () => {
    const fairPlayResolves = {
      ...fairPlayByTeamId,
      mex: { teamId: "mex", deductionPoints: 0 },
      rsa: { teamId: "rsa", deductionPoints: 1 },
    };

    const ranked = rankGroupTeams(
      "A",
      [row("rsa", 4), row("mex", 4), row("kor", 1), row("cze", 0)],
      [drawMatch("a", "mex", "rsa")],
      { fairPlayByTeamId: fairPlayResolves, rankingMode: "official" },
    );

    expect(ranked.map((team) => team.teamId).slice(0, 2)).toEqual(["mex", "rsa"]);
    expect(ranked[0].appliedTieBreakers).toContain("fair_play");
    expect(ranked[0].appliedTieBreakers).not.toContain("fifa_ranking");
  });

  it("does not consult FIFA ranking for third-place teams separated before the cutoff", () => {
    const tables = Object.fromEntries(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map((groupId, index) => {
        const third: RankedGroupTeam = {
          ...row(`third-${index}`, 12 - index),
          group: groupId as RankedGroupTeam["group"],
          position: 3,
          appliedTieBreakers: [],
        };
        return [
          groupId,
          [
            { ...third, teamId: `${third.teamId}-winner`, position: 1, points: 20 },
            { ...third, teamId: `${third.teamId}-runner`, position: 2, points: 16 },
            third,
            { ...third, teamId: `${third.teamId}-fourth`, position: 4, points: 0 },
          ],
        ];
      }),
    ) as Parameters<typeof rankThirdPlacedTeams>[0];

    expect(() => rankThirdPlacedTeams(tables, { rankingMode: "official" })).not.toThrow();
  });

  it("does not use team-ID fallback in official mode when FIFA ranking is required", () => {
    expect(() =>
      rankGroupTeams("A", [row("mex", 4), row("rsa", 4), row("kor", 0), row("cze", 0)], [], {
        fairPlayByTeamId,
        rankingMode: "official",
      }),
    ).toThrow(/requires FIFA ranking data/);
  });
});
