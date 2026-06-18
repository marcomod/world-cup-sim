import type { Team, TeamId } from "../../src/lib/simulator/types.ts";

export const MIN_SOURCE_ELO = 1200;
export const MAX_SOURCE_ELO = 2200;
export const DEFAULT_STALE_AFTER_DAYS = 365;

export interface RawTeamRatingRecord {
  sourceName: string;
  sourceElo: number;
  sourceDate: string;
  sourceNote?: string;
}

export interface NormalizedTeamRatingRecord {
  teamId: TeamId;
  sourceName: string;
  overall: number;
  sourceDate: string;
  sourceNote?: string;
}

export interface TeamAliasEntry {
  teamId: TeamId;
  aliases: string[];
}

export interface ValidationWarning {
  code: "STALE_SOURCE_DATE";
  message: string;
  teamId?: TeamId;
  sourceName?: string;
}

export interface NormalizeTeamRatingsOptions {
  teams?: Team[];
  aliasEntries?: TeamAliasEntry[];
  asOfDate?: Date;
  staleAfterDays?: number;
}

export interface NormalizeTeamRatingsResult {
  records: NormalizedTeamRatingRecord[];
  warnings: ValidationWarning[];
}
