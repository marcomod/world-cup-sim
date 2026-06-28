import { compareCodePoints, GROUP_IDS } from "../constants";
import type {
  FairPlayByTeamId,
  FifaRankingByTeamId,
  GroupId,
  GroupTableRow,
  RankedGroupTeam,
  RankingMode,
  ThirdPlacedTeam,
  TieBreakCriterion,
} from "../types";
import {
  getFairPlayDeductionsForTie,
  isDevelopmentFallbackEnabled,
} from "./fairPlay";
import { getFifaRankingsForTie } from "./fifaRanking";

export interface RankThirdPlacedTeamsOptions {
  fairPlayByTeamId?: FairPlayByTeamId;
  fifaRankingByTeamId?: FifaRankingByTeamId;
  rankingMode?: RankingMode;
  allowDeterministicFallback?: boolean;
}

function groupByKey<T>(items: readonly T[], getKey: (item: T) => string): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let currentKey: string | null = null;

  for (const item of items) {
    const key = getKey(item);
    if (currentKey === null || key === currentKey) {
      current.push(item);
      currentKey = key;
      continue;
    }

    groups.push(current);
    current = [item];
    currentKey = key;
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function sortAndSplit(
  teams: readonly GroupTableRow[],
  compare: (left: GroupTableRow, right: GroupTableRow) => number,
  key: (team: GroupTableRow) => string,
): GroupTableRow[][] {
  return groupByKey([...teams].sort(compare), key);
}

function applyCriterion(
  groups: readonly GroupTableRow[][],
  split: (teams: readonly GroupTableRow[]) => GroupTableRow[][] | null,
): { groups: GroupTableRow[][]; splitOccurred: boolean } {
  const nextGroups: GroupTableRow[][] = [];
  let splitOccurred = false;

  for (const subset of groups) {
    if (subset.length <= 1) {
      nextGroups.push([...subset]);
      continue;
    }

    const result = split(subset);
    if (!result) {
      nextGroups.push([...subset]);
      continue;
    }

    if (result.length > 1) {
      splitOccurred = true;
    }
    nextGroups.push(...result);
  }

  return { groups: nextGroups, splitOccurred };
}

function getThirdPlacedRows(
  groupTables: Readonly<Record<GroupId, readonly RankedGroupTeam[]>>,
): readonly RankedGroupTeam[] {
  return GROUP_IDS.map((groupId) => {
    const table = groupTables[groupId];
    if (!table || table.length !== 4) {
      throw new Error(`Group ${groupId} must contain exactly four ranked teams.`);
    }

    const row = table.find((team) => team.position === 3);
    if (!row) {
      throw new Error(`Group ${groupId} is missing a third-placed team.`);
    }

    return row;
  });
}

export function rankThirdPlacedTeams(
  groupTables: Readonly<Record<GroupId, readonly RankedGroupTeam[]>>,
  options: RankThirdPlacedTeamsOptions = {},
): readonly ThirdPlacedTeam[] {
  const thirdPlaced = getThirdPlacedRows(groupTables);
  const uniqueTeamIds = new Set(thirdPlaced.map((team) => team.teamId));
  if (uniqueTeamIds.size !== thirdPlaced.length) {
    throw new Error("Third-place ranking contains duplicate team IDs.");
  }

  let groups: GroupTableRow[][] = [[...thirdPlaced]];
  const usedCriteria: TieBreakCriterion[] = [];

  const criteria = [
    [
      "overall_points",
      (teams: readonly GroupTableRow[]) =>
        sortAndSplit(
          teams,
          (left, right) => right.points - left.points || compareCodePoints(left.teamId, right.teamId),
          (team) => String(team.points),
        ),
    ],
    [
      "overall_goal_difference",
      (teams: readonly GroupTableRow[]) =>
        sortAndSplit(
          teams,
          (left, right) =>
            right.goalDifference - left.goalDifference || compareCodePoints(left.teamId, right.teamId),
          (team) => String(team.goalDifference),
        ),
    ],
    [
      "overall_goals_for",
      (teams: readonly GroupTableRow[]) =>
        sortAndSplit(
          teams,
          (left, right) => right.goalsFor - left.goalsFor || compareCodePoints(left.teamId, right.teamId),
          (team) => String(team.goalsFor),
        ),
    ],
  ] as const;

  for (const [criterion, split] of criteria) {
    const result = applyCriterion(groups, split);
    groups = result.groups;
    if (result.splitOccurred) {
      usedCriteria.push(criterion);
    }
  }

  const fairPlayResult = applyCriterion(groups, (teams) => {
    const deductions = getFairPlayDeductionsForTie(
      teams,
      options.fairPlayByTeamId,
      options,
      "Third-place ranking",
    );
    if (!deductions) {
      return null;
    }

    return sortAndSplit(
      teams,
      (left, right) =>
        (deductions.get(left.teamId) ?? 0) -
          (deductions.get(right.teamId) ?? 0) || compareCodePoints(left.teamId, right.teamId),
      (team) => String(deductions.get(team.teamId) ?? 0),
    );
  });
  groups = fairPlayResult.groups;
  if (fairPlayResult.splitOccurred) {
    usedCriteria.push("fair_play");
  }

  const fifaRankingResult = applyCriterion(groups, (teams) => {
    if (
      (!options.fifaRankingByTeamId || Object.keys(options.fifaRankingByTeamId).length === 0) &&
      isDevelopmentFallbackEnabled(options)
    ) {
      return null;
    }

    const rankings = getFifaRankingsForTie(teams, options.fifaRankingByTeamId, "Third-place ranking");
    return sortAndSplit(
      teams,
      (left, right) =>
        (rankings.get(left.teamId) ?? Number.POSITIVE_INFINITY) -
          (rankings.get(right.teamId) ?? Number.POSITIVE_INFINITY) ||
        compareCodePoints(left.teamId, right.teamId),
      (team) => String(rankings.get(team.teamId)),
    );
  });
  groups = fifaRankingResult.groups;
  if (fifaRankingResult.splitOccurred) {
    usedCriteria.push("fifa_ranking");
  }

  if (groups.some((subset) => subset.length > 1)) {
    if (!isDevelopmentFallbackEnabled(options)) {
      const unresolved = groups
        .filter((subset) => subset.length > 1)
        .flatMap((subset) => subset.map((row) => row.teamId))
        .sort(compareCodePoints);
      throw new Error(
        `Third-place ranking requires official FIFA ranking tie-break data for ${unresolved.join(", ")}.`,
      );
    }

    groups = groups.flatMap((subset) =>
      subset.length <= 1
        ? [subset]
        : [[...subset].sort((left, right) => compareCodePoints(left.teamId, right.teamId))],
    );
    usedCriteria.push("deterministic_fallback");
  }

  const sorted = groups.flat() as RankedGroupTeam[];
  const ranked = sorted.map((team, index) => ({
    ...team,
    appliedTieBreakers: [...team.appliedTieBreakers, ...usedCriteria],
    thirdPlaceRank: index + 1,
    qualified: index < 8,
  }));

  if (ranked.filter((team) => team.qualified).length !== 8) {
    throw new Error("Third-place ranking did not produce exactly eight qualifiers.");
  }

  return ranked;
}
