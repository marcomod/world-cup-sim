import { worldCup2026Groups } from "@/src/data/world-cup-2026/groups";
import { worldCup2026Tournament } from "@/src/data/world-cup-2026/tournament";
import {
  calculateGroupTable,
  compareCodePoints,
  GROUP_IDS,
  rankGroupTeams,
} from "@/src/lib/tournament-2026";
import type {
  GroupId,
  GroupStageMatch,
  RankedGroupTeam,
  TeamId,
  TournamentGroup,
} from "@/src/lib/tournament-2026";

export function completeOfficialMatchesForFixture(): GroupStageMatch[] {
  const preferredThirdGroups = new Set<GroupId>(["A", "B", "C", "D", "E", "F", "G", "H"]);

  return worldCup2026Tournament.groupStageMatches.map((match, index) => {
    const groupIsPreferredThird = preferredThirdGroups.has(match.group);
    const pattern = index % 6;
    const scores = groupIsPreferredThird
      ? [
          [2, 0],
          [1, 0],
          [2, 0],
          [0, 2],
          [0, 3],
          [1, 0],
        ]
      : [
          [2, 0],
          [0, 0],
          [3, 0],
          [0, 2],
          [0, 3],
          [1, 0],
        ];

    const [homeGoals, awayGoals] = scores[pattern];

    return {
      ...match,
      status: "completed",
      result: { homeGoals, awayGoals },
    };
  });
}

export function buildRankedTables(
  groups: readonly TournamentGroup[] = worldCup2026Groups,
  matches: readonly GroupStageMatch[] = completeOfficialMatchesForFixture(),
): Record<GroupId, readonly RankedGroupTeam[]> {
  return Object.fromEntries(
    groups.map((group) => {
      const table = calculateGroupTable(group.id, group.teamIds, matches);
      return [
        group.id,
        rankGroupTeams(group.id, table, matches, { allowDeterministicFallback: true }),
      ];
    }),
  ) as Record<GroupId, readonly RankedGroupTeam[]>;
}

/**
 * Builds an exhaustive per-group record from `[groupId, value]` entries.
 *
 * `Object.fromEntries` widens keys to `string`, so TypeScript cannot assert the result to the
 * finite `GroupId` key set directly (TS2352). The third-place ranking tests always emit exactly
 * one entry per group, so narrowing here is safe. This is the single audit point for that
 * `RankedGroupTeam`-keyed group-table construction — a future change to `RankedGroupTeam` or the
 * `GroupId` key set surfaces in one place rather than four inline casts.
 */
export function toGroupRecord<V>(
  entries: Iterable<readonly [string, V]>,
): Record<GroupId, V> {
  return Object.fromEntries(entries) as unknown as Record<GroupId, V>;
}

export function createMatch(
  id: string,
  group: GroupId,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
  homeGoals: number,
  awayGoals: number,
): GroupStageMatch {
  return {
    id,
    group,
    homeTeamId,
    awayTeamId,
    status: "completed",
    result: { homeGoals, awayGoals },
  };
}

export function groupRows(teamIds: readonly TeamId[]): RankedGroupTeam[] {
  return teamIds.map((teamId, index) => ({
    teamId,
    group: GROUP_IDS[index] ?? "A",
    played: 3,
    wins: 1,
    draws: 1,
    losses: 1,
    goalsFor: 3,
    goalsAgainst: 3,
    goalDifference: 0,
    points: 4,
    position: 3,
    appliedTieBreakers: [],
  }));
}

export function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }

  if (items.length < size) {
    return [];
  }

  const [head, ...tail] = items;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
}

export function canonicalGroups(groups: readonly GroupId[]): string {
  return [...groups].sort(compareCodePoints).join("");
}
