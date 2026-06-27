import { compareCodePoints } from "../constants";
import type {
  FairPlayByTeamId,
  GroupTableRow,
  RankingMode,
  TeamId,
} from "../types";

export interface RankingModeOptions {
  rankingMode?: RankingMode;
  allowDeterministicFallback?: boolean;
}

export const FAIR_PLAY_CARD_DEDUCTION_POINTS = {
  yellowCard: 1,
  indirectRedCard: 3,
  directRedCard: 4,
  yellowAndDirectRedCard: 5,
} as const;

export function isDevelopmentFallbackEnabled(options: RankingModeOptions): boolean {
  return options.rankingMode === "development_fallback" || options.allowDeterministicFallback === true;
}

function assertValidFairPlayRecords(fairPlayByTeamId: FairPlayByTeamId | undefined): void {
  if (!fairPlayByTeamId) {
    return;
  }

  const seen = new Set<TeamId>();
  for (const [key, record] of Object.entries(fairPlayByTeamId)) {
    if (record.teamId !== key) {
      throw new Error(`Fair-play record key "${key}" does not match team "${record.teamId}".`);
    }

    if (seen.has(record.teamId)) {
      throw new Error(`Duplicate fair-play record for team "${record.teamId}".`);
    }
    seen.add(record.teamId);

    if (!Number.isInteger(record.deductionPoints) || record.deductionPoints < 0) {
      throw new Error(`Fair-play deductions for team "${record.teamId}" must be a non-negative integer.`);
    }
  }
}

export function getFairPlayDeductionsForTie(
  teams: readonly GroupTableRow[],
  fairPlayByTeamId: FairPlayByTeamId | undefined,
  options: RankingModeOptions,
  context: string,
): Map<TeamId, number> | null {
  assertValidFairPlayRecords(fairPlayByTeamId);

  const deductions = new Map<TeamId, number>();
  const missing = teams
    .filter((team) => !fairPlayByTeamId?.[team.teamId])
    .map((team) => team.teamId)
    .sort(compareCodePoints);

  if (missing.length > 0) {
    if (isDevelopmentFallbackEnabled(options)) {
      return null;
    }

    throw new Error(
      `${context} requires complete fair-play data; missing records for ${missing.join(", ")}.`,
    );
  }

  for (const team of teams) {
    const record = fairPlayByTeamId?.[team.teamId];
    if (!record) {
      throw new Error(`${context} requires complete fair-play data; missing records for ${team.teamId}.`);
    }
    deductions.set(team.teamId, record.deductionPoints);
  }

  return deductions;
}
