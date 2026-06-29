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

const QUALIFIED_THIRD_PLACE_COUNT = 8;

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

function hasCompleteFairPlayRecords(
  teams: readonly GroupTableRow[],
  fairPlayByTeamId: FairPlayByTeamId | undefined,
): boolean {
  return teams.every((team) => Boolean(fairPlayByTeamId?.[team.teamId]));
}

function hasCompleteFifaRankingRecords(
  teams: readonly GroupTableRow[],
  fifaRankingByTeamId: FifaRankingByTeamId | undefined,
): boolean {
  return teams.every((team) => Boolean(fifaRankingByTeamId?.[team.teamId]));
}

function spansQualificationCutoff(startIndex: number, teamCount: number): boolean {
  return startIndex < QUALIFIED_THIRD_PLACE_COUNT && startIndex + teamCount > QUALIFIED_THIRD_PLACE_COUNT;
}

function applyDecisionCriterion(
  groups: readonly GroupTableRow[][],
  split: (teams: readonly GroupTableRow[], requiredForQualification: boolean) => GroupTableRow[][] | null,
): { groups: GroupTableRow[][]; splitOccurred: boolean } {
  const nextGroups: GroupTableRow[][] = [];
  let splitOccurred = false;
  let startIndex = 0;

  for (const subset of groups) {
    if (subset.length <= 1) {
      nextGroups.push([...subset]);
      startIndex += subset.length;
      continue;
    }

    const result = split(subset, spansQualificationCutoff(startIndex, subset.length));
    if (!result) {
      nextGroups.push([...subset]);
      startIndex += subset.length;
      continue;
    }

    if (result.length > 1) {
      splitOccurred = true;
    }
    nextGroups.push(...result);
    startIndex += subset.length;
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

  const fairPlayResult = applyDecisionCriterion(groups, (teams, requiredForQualification) => {
    if (!requiredForQualification && !hasCompleteFairPlayRecords(teams, options.fairPlayByTeamId)) {
      return null;
    }

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

  const fifaRankingResult = applyDecisionCriterion(groups, (teams, requiredForQualification) => {
    if (
      (!options.fifaRankingByTeamId || Object.keys(options.fifaRankingByTeamId).length === 0) &&
      isDevelopmentFallbackEnabled(options)
    ) {
      return null;
    }

    if (!requiredForQualification && !hasCompleteFairPlayRecords(teams, options.fairPlayByTeamId)) {
      return null;
    }

    if (!requiredForQualification && !hasCompleteFifaRankingRecords(teams, options.fifaRankingByTeamId)) {
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
      let startIndex = 0;
      const unresolvedAcrossCutoff: GroupTableRow[] = [];
      for (const subset of groups) {
        if (subset.length > 1 && spansQualificationCutoff(startIndex, subset.length)) {
          unresolvedAcrossCutoff.push(...subset);
        }
        startIndex += subset.length;
      }

      if (unresolvedAcrossCutoff.length > 0) {
        const unresolved = unresolvedAcrossCutoff
          .map((row) => row.teamId)
          .sort(compareCodePoints);
        throw new Error(
          `Third-place qualification requires official FIFA ranking tie-break data for ${unresolved.join(", ")}.`,
        );
      }
    }

    groups = groups.flatMap((subset) =>
      subset.length <= 1
        ? [subset]
        : [[...subset].sort((left, right) => compareCodePoints(left.teamId, right.teamId))],
    );
    if (isDevelopmentFallbackEnabled(options)) {
      usedCriteria.push("deterministic_fallback");
    }
  }

  let groupStartIndex = 0;
  const ranked = groups.flatMap((subset) => {
    const rank = groupStartIndex + 1;
    const qualified = groupStartIndex < QUALIFIED_THIRD_PLACE_COUNT;
    groupStartIndex += subset.length;

    return subset.map((team) => {
      const rankedTeam = team as RankedGroupTeam;
      return {
        ...rankedTeam,
        appliedTieBreakers: [...rankedTeam.appliedTieBreakers, ...usedCriteria],
        thirdPlaceRank: rank,
        qualified,
      };
    });
  });

  if (ranked.filter((team) => team.qualified).length !== 8) {
    throw new Error("Third-place ranking did not produce exactly eight qualifiers.");
  }

  return ranked;
}
