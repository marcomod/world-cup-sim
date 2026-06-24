import type {
  HistoricalOutcomeStatus,
  HistoricalStage,
  HistoricalTeamId,
} from "../../historical-pipeline/schemas.ts";

export const SEQUENTIAL_ELO_MODEL_VERSION = "sequential-elo-v1" as const;

export interface SequentialEloConfig {
  initialRating: number;
  kFactor: number;
  divisor: number;
  homeAdvantage: number;
  penaltyUpdateOutcome: "draw";
  nonDecisiveUpdateOutcome: "draw";
}

export interface TeamRatingState {
  teamId: HistoricalTeamId;
  rating: number;
  matchesPlayed: number;
}

export interface PreMatchEloSnapshot {
  homeTeamId: HistoricalTeamId;
  awayTeamId: HistoricalTeamId;
  homeRating: number;
  awayRating: number;
}

export interface HistoricalEloUpdate {
  matchId: string;
  date: string;
  homeTeamId: HistoricalTeamId;
  awayTeamId: HistoricalTeamId;
  observedHomeScore: 0 | 0.5 | 1;
  expectedHomeScore: number;
  preMatchHomeRating: number;
  preMatchAwayRating: number;
  postMatchHomeRating: number;
  postMatchAwayRating: number;
}

export interface HistoricalPredictionObservation {
  matchId: string;
  tournamentYear: number;
  date: string;
  stage: HistoricalStage;
  homeTeamId: HistoricalTeamId;
  awayTeamId: HistoricalTeamId;
  preMatchHomeRating: number;
  preMatchAwayRating: number;
  predictedHomeScore: number;
  observedHomeScore: 0 | 0.5 | 1;
  outcomeStatus: HistoricalOutcomeStatus;
  winnerTeamId: HistoricalTeamId | null;
  decidedByPenalties: boolean;
}

export interface ReconstructionMetadata {
  modelVersion: typeof SEQUENTIAL_ELO_MODEL_VERSION;
  matchCount: number;
  teamCount: number;
  firstDate: string | null;
  lastDate: string | null;
  multiMatchDateCount: number;
  matchesOnMultiMatchDates: number;
  maxMatchesOnSingleDate: number;
  sameDayOrderingPolicy: string;
  config: Readonly<SequentialEloConfig>;
}

export interface SequentialEloReconstructionResult {
  observations: HistoricalPredictionObservation[];
  updates: HistoricalEloUpdate[];
  finalRatings: TeamRatingState[];
  metadata: ReconstructionMetadata;
}

export interface HistoricalEloGeneratedMetadata extends ReconstructionMetadata {
  generatedFileWarning: "Do not edit manually.";
  sourceFile: string;
  sourceChecksumSha256: string;
  numericPrecision: number;
  numericSerializationPolicy: string;
  generationTimestampPolicy: string;
}
