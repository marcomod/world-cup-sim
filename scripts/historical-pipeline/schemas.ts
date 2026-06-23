export type HistoricalTeamId = string;

export const HISTORICAL_STAGES = [
  "group_stage",
  "first_group_stage",
  "second_group_stage",
  "final_group_stage",
  "group_stage_playoff",
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
] as const;

export type HistoricalStage = (typeof HISTORICAL_STAGES)[number];
export type HistoricalCalibrationScope = "all_matches" | "knockout_only";
export type HistoricalOutcomeStatus = "decisive" | "draw" | "non_decisive";

export interface RawHistoricalMatch {
  tournamentYear: number;
  date: string;
  stage: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  extraTime: boolean;
  penalties: boolean;
  homePenaltyGoals?: number;
  awayPenaltyGoals?: number;
  neutralVenue?: boolean | null;
  sourceMatchId?: string;
  outcomeStatus?: HistoricalOutcomeStatus;
}

interface NormalizedHistoricalMatchBase {
  matchId: string;
  sourceMatchId?: string;
  tournamentYear: number;
  date: string;
  stage: HistoricalStage;
  teamAId: HistoricalTeamId;
  teamBId: HistoricalTeamId;
  teamAGoals: number;
  teamBGoals: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  teamAPenaltyGoals?: number;
  teamBPenaltyGoals?: number;
  source: string;
}

export interface DecisiveNormalizedHistoricalMatch
  extends NormalizedHistoricalMatchBase {
  outcomeStatus: "decisive";
  winnerTeamId: HistoricalTeamId;
}

export interface DrawnNormalizedHistoricalMatch extends NormalizedHistoricalMatchBase {
  outcomeStatus: "draw";
  winnerTeamId: null;
}

export interface NonDecisiveNormalizedHistoricalMatch
  extends NormalizedHistoricalMatchBase {
  outcomeStatus: "non_decisive";
  winnerTeamId: null;
}

export type NormalizedHistoricalMatch =
  | DecisiveNormalizedHistoricalMatch
  | DrawnNormalizedHistoricalMatch
  | NonDecisiveNormalizedHistoricalMatch;

export interface HistoricalDatasetMetadata {
  sourceName: string;
  sourceUrl: string;
  accessDate: string;
  licence: string;
  attribution: string;
  redistributionStatus: string;
  recordCount: number;
  yearRange: {
    start: number;
    end: number;
  };
  generatedFileWarning: "Do not edit manually.";
}

export interface HistoricalTeamAliasEntry {
  teamId: HistoricalTeamId;
  aliases: readonly string[];
}
