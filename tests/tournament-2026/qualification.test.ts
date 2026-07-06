import { describe, expect, it } from "vitest";
import { worldCup2026Groups } from "@/src/data/world-cup-2026/groups";
import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import { worldCup2026Tournament } from "@/src/data/world-cup-2026/tournament";
import {
  compareCodePoints,
  generateRoundOf32,
  GROUP_IDS,
  qualifyTeams,
  rankThirdPlacedTeams,
} from "@/src/lib/tournament-2026";
import type { GroupId, RankedGroupTeam, TeamId } from "@/src/lib/tournament-2026";
import { buildRankedTables, toGroupRecord } from "./helpers";

interface ThirdPlaceFixtureRow {
  group: GroupId;
  teamId: TeamId;
  points: number;
  goalDifference?: number;
  goalsFor?: number;
}

function rankedRow(
  group: GroupId,
  teamId: TeamId,
  position: RankedGroupTeam["position"],
  points: number,
  goalDifference = 0,
  goalsFor = 0,
): RankedGroupTeam {
  return {
    teamId,
    group,
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
    position,
    appliedTieBreakers: [],
  };
}

function buildThirdPlaceFixtureTables(
  thirdPlaceRows: readonly ThirdPlaceFixtureRow[],
): Record<GroupId, readonly RankedGroupTeam[]> {
  const thirdByGroup = new Map(thirdPlaceRows.map((row) => [row.group, row]));

  return toGroupRecord(
    GROUP_IDS.map<[GroupId, RankedGroupTeam[]]>((group) => {
      const third = thirdByGroup.get(group);
      if (!third) {
        throw new Error(`Missing test third-place row for Group ${group}.`);
      }

      return [
        group,
        [
          rankedRow(group, `${group.toLowerCase()}1`, 1, 9, 4, 6),
          rankedRow(group, `${group.toLowerCase()}2`, 2, 6, 2, 4),
          rankedRow(
            group,
            third.teamId,
            3,
            third.points,
            third.goalDifference ?? 0,
            third.goalsFor ?? 0,
          ),
          rankedRow(group, `${group.toLowerCase()}4`, 4, 0, -6, 0),
        ],
      ];
    }),
  );
}

describe("qualification", () => {
  it("qualifies 12 winners, 12 runners-up, and eight third-placed teams", () => {
    const tables = buildRankedTables();
    const qualification = qualifyTeams(tables, { allowDeterministicFallback: true });

    expect(Object.values(qualification.groupWinners)).toHaveLength(12);
    expect(Object.values(qualification.groupRunnersUp)).toHaveLength(12);
    expect(qualification.thirdPlacedTeams).toHaveLength(12);
    expect(qualification.qualifiedThirdPlacedTeams).toHaveLength(8);
    expect([...qualification.qualifiedThirdPlacedTeams.map((team) => team.group)].sort(compareCodePoints)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
    ]);
  });

  it("fails qualification for incomplete group stages", () => {
    const tables = buildRankedTables(worldCup2026Groups, worldCup2026Tournament.groupStageMatches);

    expect(() => qualifyTeams(tables, { allowDeterministicFallback: true })).toThrow(/incomplete/);
  });

  it("ranks third-placed teams deterministically from reversed group inputs", () => {
    const tables = buildRankedTables();
    const reversedTables = Object.fromEntries(Object.entries(tables).reverse()) as Record<
      GroupId,
      readonly RankedGroupTeam[]
    >;

    expect(rankThirdPlacedTeams(reversedTables, { allowDeterministicFallback: true })).toEqual(
      rankThirdPlacedTeams(tables, { allowDeterministicFallback: true }),
    );
  });

  it("qualifies unresolved tied third-place teams when both are above the cutoff", () => {
    const tables = buildThirdPlaceFixtureTables([
      { group: "A", teamId: "a3", points: 12 },
      { group: "B", teamId: "b3", points: 11 },
      { group: "C", teamId: "c3", points: 10 },
      { group: "D", teamId: "d3", points: 10 },
      { group: "E", teamId: "e3", points: 9 },
      { group: "F", teamId: "f3", points: 8 },
      { group: "G", teamId: "g3", points: 7 },
      { group: "H", teamId: "h3", points: 6 },
      { group: "I", teamId: "i3", points: 5 },
      { group: "J", teamId: "j3", points: 4 },
      { group: "K", teamId: "k3", points: 3 },
      { group: "L", teamId: "l3", points: 2 },
    ]);

    const qualification = qualifyTeams(tables, { rankingMode: "official" });

    expect(qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId)).toEqual([
      "a3",
      "b3",
      "c3",
      "d3",
      "e3",
      "f3",
      "g3",
      "h3",
    ]);
    expect(qualification.thirdPlacedTeams.find((team) => team.teamId === "c3")?.thirdPlaceRank).toBe(3);
    expect(qualification.thirdPlacedTeams.find((team) => team.teamId === "d3")?.thirdPlaceRank).toBe(3);
  });

  it("allows unresolved tied third-place teams when both are below the cutoff", () => {
    const tables = buildThirdPlaceFixtureTables([
      { group: "A", teamId: "a3", points: 12 },
      { group: "B", teamId: "b3", points: 11 },
      { group: "C", teamId: "c3", points: 10 },
      { group: "D", teamId: "d3", points: 9 },
      { group: "E", teamId: "e3", points: 8 },
      { group: "F", teamId: "f3", points: 7 },
      { group: "G", teamId: "g3", points: 6 },
      { group: "H", teamId: "h3", points: 5 },
      { group: "I", teamId: "i3", points: 4 },
      { group: "J", teamId: "j3", points: 3 },
      { group: "K", teamId: "k3", points: 3 },
      { group: "L", teamId: "l3", points: 2 },
    ]);

    const qualification = qualifyTeams(tables, { rankingMode: "official" });

    expect(qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId)).not.toContain("j3");
    expect(qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId)).not.toContain("k3");
    expect(qualification.thirdPlacedTeams.find((team) => team.teamId === "j3")?.qualified).toBe(false);
    expect(qualification.thirdPlacedTeams.find((team) => team.teamId === "k3")?.qualified).toBe(false);
  });

  it("keeps third-place qualification unresolved when a tie spans eighth and ninth", () => {
    const tables = buildThirdPlaceFixtureTables([
      { group: "A", teamId: "a3", points: 12 },
      { group: "B", teamId: "b3", points: 11 },
      { group: "C", teamId: "c3", points: 10 },
      { group: "D", teamId: "d3", points: 9 },
      { group: "E", teamId: "e3", points: 8 },
      { group: "F", teamId: "f3", points: 7 },
      { group: "G", teamId: "g3", points: 6 },
      { group: "H", teamId: "h3", points: 5 },
      { group: "I", teamId: "i3", points: 5 },
      { group: "J", teamId: "j3", points: 4 },
      { group: "K", teamId: "k3", points: 3 },
      { group: "L", teamId: "l3", points: 2 },
    ]);

    expect(() => qualifyTeams(tables, { rankingMode: "official" })).toThrow(
      /Third-place ranking requires complete fair-play data; missing records for h3, i3/,
    );
  });

  it("generates the bracket when tied qualified teams leave the Annex C group set unchanged", () => {
    const tables = buildThirdPlaceFixtureTables([
      { group: "K", teamId: "k3", points: 12 },
      { group: "F", teamId: "f3", points: 11 },
      { group: "E", teamId: "e3", points: 10 },
      { group: "L", teamId: "l3", points: 10 },
      { group: "B", teamId: "b3", points: 9 },
      { group: "J", teamId: "j3", points: 8 },
      { group: "D", teamId: "d3", points: 7 },
      { group: "I", teamId: "i3", points: 6 },
      { group: "G", teamId: "g3", points: 5 },
      { group: "A", teamId: "a3", points: 4 },
      { group: "C", teamId: "c3", points: 3 },
      { group: "H", teamId: "h3", points: 2 },
    ]);

    const qualification = qualifyTeams(tables, { rankingMode: "official" });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);

    expect([...qualification.qualifiedThirdPlacedTeams.map((team) => team.group)].sort(compareCodePoints)).toEqual([
      "B",
      "D",
      "E",
      "F",
      "I",
      "J",
      "K",
      "L",
    ]);
    expect(roundOf32).toHaveLength(16);
    expect(roundOf32.map((match) => [match.homeTeamId, match.awayTeamId]).flat()).toEqual(
      expect.arrayContaining(["e3", "l3"]),
    );
  });

  it("blocks qualification when an unresolved tie can change the qualifying third-place group set", () => {
    const tables = buildThirdPlaceFixtureTables([
      { group: "K", teamId: "k3", points: 12 },
      { group: "F", teamId: "f3", points: 11 },
      { group: "E", teamId: "e3", points: 10 },
      { group: "L", teamId: "l3", points: 9 },
      { group: "B", teamId: "b3", points: 8 },
      { group: "J", teamId: "j3", points: 7 },
      { group: "D", teamId: "d3", points: 6 },
      { group: "I", teamId: "i3", points: 5 },
      { group: "G", teamId: "g3", points: 5 },
      { group: "A", teamId: "a3", points: 4 },
      { group: "C", teamId: "c3", points: 3 },
      { group: "H", teamId: "h3", points: 2 },
    ]);

    expect(() => {
      const qualification = qualifyTeams(tables, { rankingMode: "official" });
      generateRoundOf32(qualification, roundOf32SlotDefinitions);
    }).toThrow(/Third-place ranking requires complete fair-play data; missing records for g3, i3/);
  });
});
