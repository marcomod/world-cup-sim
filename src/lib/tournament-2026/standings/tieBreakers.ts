import { compareCodePoints } from "../constants";
import type {
  FairPlayByTeamId,
  FifaRankingByTeamId,
  GroupId,
  GroupStageMatch,
  GroupTableRow,
  RankingMode,
  TeamId,
  TieBreakCriterion,
} from "../types";
import {
  getFairPlayDeductionsForTie,
  isDevelopmentFallbackEnabled,
} from "./fairPlay";
import { getFifaRankingsForTie } from "./fifaRanking";

export interface TieBreakOptions {
  fairPlayByTeamId?: FairPlayByTeamId;
  fifaRankingByTeamId?: FifaRankingByTeamId;
  rankingMode?: RankingMode;
  allowDeterministicFallback?: boolean;
}

interface HeadToHeadStats {
  teamId: TeamId;
  points: number;
  goalDifference: number;
  goalsFor: number;
}

interface TieResolution {
  groups: GroupTableRow[][];
  criteria: TieBreakCriterion[];
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

function calculateHeadToHeadStats(
  teams: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
): Map<TeamId, HeadToHeadStats> {
  const tiedIds = new Set(teams.map((team) => team.teamId));
  const stats = new Map<TeamId, HeadToHeadStats>(
    teams.map((team) => [
      team.teamId,
      { teamId: team.teamId, points: 0, goalDifference: 0, goalsFor: 0 },
    ]),
  );

  for (const match of matches) {
    if (
      match.status !== "completed" ||
      !match.result ||
      !tiedIds.has(match.homeTeamId) ||
      !tiedIds.has(match.awayTeamId)
    ) {
      continue;
    }

    const home = stats.get(match.homeTeamId);
    const away = stats.get(match.awayTeamId);
    if (!home || !away) {
      continue;
    }

    home.goalsFor += match.result.homeGoals;
    away.goalsFor += match.result.awayGoals;
    home.goalDifference += match.result.homeGoals - match.result.awayGoals;
    away.goalDifference += match.result.awayGoals - match.result.homeGoals;

    if (match.result.homeGoals > match.result.awayGoals) {
      home.points += 3;
    } else if (match.result.homeGoals < match.result.awayGoals) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return stats;
}

function splitByPoints(teams: readonly GroupTableRow[]): GroupTableRow[][] {
  return sortAndSplit(
    teams,
    (left, right) => right.points - left.points || compareCodePoints(left.teamId, right.teamId),
    (team) => String(team.points),
  );
}

function splitByOverallCriterion(
  teams: readonly GroupTableRow[],
  criterion: "overall_goal_difference" | "overall_goals_for",
): GroupTableRow[][] {
  if (criterion === "overall_goal_difference") {
    return sortAndSplit(
      teams,
      (left, right) =>
        right.goalDifference - left.goalDifference || compareCodePoints(left.teamId, right.teamId),
      (team) => String(team.goalDifference),
    );
  }

  return sortAndSplit(
    teams,
    (left, right) => right.goalsFor - left.goalsFor || compareCodePoints(left.teamId, right.teamId),
    (team) => String(team.goalsFor),
  );
}

function splitByHeadToHeadCriterion(
  teams: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
  criterion:
    | "head_to_head_points"
    | "head_to_head_goal_difference"
    | "head_to_head_goals_for",
): GroupTableRow[][] {
  const stats = calculateHeadToHeadStats(teams, matches);

  if (criterion === "head_to_head_points") {
    return sortAndSplit(
      teams,
      (left, right) =>
        (stats.get(right.teamId)?.points ?? 0) -
          (stats.get(left.teamId)?.points ?? 0) || compareCodePoints(left.teamId, right.teamId),
      (team) => String(stats.get(team.teamId)?.points ?? 0),
    );
  }

  if (criterion === "head_to_head_goal_difference") {
    return sortAndSplit(
      teams,
      (left, right) =>
        (stats.get(right.teamId)?.goalDifference ?? 0) -
          (stats.get(left.teamId)?.goalDifference ?? 0) ||
        compareCodePoints(left.teamId, right.teamId),
      (team) => String(stats.get(team.teamId)?.goalDifference ?? 0),
    );
  }

  return sortAndSplit(
    teams,
    (left, right) =>
      (stats.get(right.teamId)?.goalsFor ?? 0) -
        (stats.get(left.teamId)?.goalsFor ?? 0) || compareCodePoints(left.teamId, right.teamId),
    (team) => String(stats.get(team.teamId)?.goalsFor ?? 0),
  );
}

function splitByFairPlay(
  groupId: GroupId,
  teams: readonly GroupTableRow[],
  options: TieBreakOptions,
): GroupTableRow[][] | null {
  const deductions = getFairPlayDeductionsForTie(
    teams,
    options.fairPlayByTeamId,
    options,
    `Group ${groupId} ranking`,
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
}

function splitByFifaRanking(
  groupId: GroupId,
  teams: readonly GroupTableRow[],
  options: TieBreakOptions,
): GroupTableRow[][] | null {
  if (
    (!options.fifaRankingByTeamId || Object.keys(options.fifaRankingByTeamId).length === 0) &&
    isDevelopmentFallbackEnabled(options)
  ) {
    return null;
  }

  const rankings = getFifaRankingsForTie(
    teams,
    options.fifaRankingByTeamId,
    `Group ${groupId} ranking`,
  );

  return sortAndSplit(
    teams,
    (left, right) =>
      (rankings.get(left.teamId) ?? Number.POSITIVE_INFINITY) -
        (rankings.get(right.teamId) ?? Number.POSITIVE_INFINITY) ||
      compareCodePoints(left.teamId, right.teamId),
    (team) => String(rankings.get(team.teamId)),
  );
}

export function resolveHeadToHeadTie(
  tiedTeams: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
): TieResolution {
  if (tiedTeams.length <= 1) {
    return { groups: [[...tiedTeams]], criteria: [] };
  }

  const criteria = [
    "head_to_head_points",
    "head_to_head_goal_difference",
    "head_to_head_goals_for",
  ] as const;

  for (const criterion of criteria) {
    const split = splitByHeadToHeadCriterion(tiedTeams, matches, criterion);
    if (split.length === 1) {
      continue;
    }

    const groups: GroupTableRow[][] = [];
    const usedCriteria: TieBreakCriterion[] = [criterion];

    for (const subset of split) {
      if (subset.length <= 1) {
        groups.push(subset);
        continue;
      }

      const restarted = resolveHeadToHeadTie(subset, matches);
      groups.push(...restarted.groups);
      for (const used of restarted.criteria) {
        if (!usedCriteria.includes(used)) {
          usedCriteria.push(used);
        }
      }
    }

    return { groups, criteria: usedCriteria };
  }

  return { groups: [[...tiedTeams]], criteria: [] };
}

function applyGroupCriterion(
  groups: readonly GroupTableRow[][],
  split: (subset: readonly GroupTableRow[]) => GroupTableRow[][] | null,
): { groups: GroupTableRow[][]; splitOccurred: boolean; skipped: boolean } {
  const nextGroups: GroupTableRow[][] = [];
  let splitOccurred = false;
  let skipped = false;

  for (const subset of groups) {
    if (subset.length <= 1) {
      nextGroups.push([...subset]);
      continue;
    }

    const result = split(subset);
    if (!result) {
      skipped = true;
      nextGroups.push([...subset]);
      continue;
    }

    if (result.length > 1) {
      splitOccurred = true;
    }
    nextGroups.push(...result);
  }

  return { groups: nextGroups, splitOccurred, skipped };
}

function resolveEqualPointsGroup(
  groupId: GroupId,
  teams: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
  options: TieBreakOptions,
): TieResolution {
  const headToHead = resolveHeadToHeadTie(teams, matches);
  let groups = headToHead.groups;
  const usedCriteria = [...headToHead.criteria];

  if (groups.every((subset) => subset.length === 1)) {
    return { groups, criteria: usedCriteria };
  }

  for (const criterion of ["overall_goal_difference", "overall_goals_for"] as const) {
    const result = applyGroupCriterion(groups, (subset) => splitByOverallCriterion(subset, criterion));
    groups = result.groups;
    if (result.splitOccurred) {
      usedCriteria.push(criterion);
    }

    if (groups.every((subset) => subset.length === 1)) {
      return { groups, criteria: usedCriteria };
    }
  }

  const fairPlayResult = applyGroupCriterion(groups, (subset) => splitByFairPlay(groupId, subset, options));
  groups = fairPlayResult.groups;
  if (fairPlayResult.splitOccurred) {
    usedCriteria.push("fair_play");
  }

  if (groups.every((subset) => subset.length === 1)) {
    return { groups, criteria: usedCriteria };
  }

  const fifaRankingResult = applyGroupCriterion(groups, (subset) =>
    splitByFifaRanking(groupId, subset, options),
  );
  groups = fifaRankingResult.groups;
  if (fifaRankingResult.splitOccurred) {
    usedCriteria.push("fifa_ranking");
  }

  return { groups, criteria: usedCriteria };
}

function flattenResolved(
  groupId: GroupId,
  groups: readonly GroupTableRow[][],
  criteria: readonly TieBreakCriterion[],
  options: TieBreakOptions,
): { row: GroupTableRow; criteria: readonly TieBreakCriterion[] }[] {
  if (groups.every((subset) => subset.length === 1)) {
    return groups.flatMap((subset) => subset.map((row) => ({ row, criteria })));
  }

  if (!isDevelopmentFallbackEnabled(options)) {
    const unresolved = groups
      .filter((subset) => subset.length > 1)
      .flatMap((subset) => subset.map((row) => row.teamId))
      .sort(compareCodePoints);
    throw new Error(
      `Group ${groupId} ranking still requires official FIFA ranking tie-break data for ${unresolved.join(", ")}.`,
    );
  }

  return groups.flatMap((subset) =>
    [...subset]
      .sort((left, right) => compareCodePoints(left.teamId, right.teamId))
      .map((row) => ({
        row,
        criteria: [...criteria, "deterministic_fallback" as const],
      })),
  );
}

export function rankGroupTableRows(
  groupId: GroupId,
  rows: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
  options: TieBreakOptions = {},
): { row: GroupTableRow; criteria: readonly TieBreakCriterion[] }[] {
  const pointGroups = splitByPoints(rows);
  const criteria: TieBreakCriterion[] = pointGroups.length > 1 ? ["overall_points"] : [];
  const groups: GroupTableRow[][] = [];

  for (const pointGroup of pointGroups) {
    if (pointGroup.length <= 1) {
      groups.push(pointGroup);
      continue;
    }

    const resolved = resolveEqualPointsGroup(groupId, pointGroup, matches, options);
    groups.push(...resolved.groups);
    for (const used of resolved.criteria) {
      if (!criteria.includes(used)) {
        criteria.push(used);
      }
    }
  }

  return flattenResolved(groupId, groups, criteria, options);
}
