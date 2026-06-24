import type {
  HistoricalPredictionObservation,
  HistoricalEloGeneratedMetadata,
} from "../sequential-elo/types.ts";
import type {
  HistoricalStage,
  HistoricalTeamId,
} from "../../historical-pipeline/schemas.ts";

export const EVALUATION_MODEL_VERSION = "historical-elo-evaluation-v1" as const;

export const EVALUATION_COHORT_NAMES = [
  "all_matches",
  "knockout_only",
  "decisive_only",
  "knockout_decisive_only",
  "penalties_only",
  "extra_time_only",
] as const;

export const EVALUATION_SPLIT_NAMES = [
  "development",
  "validation",
  "holdout",
  "full_history",
] as const;

export type EvaluationCohortName = (typeof EVALUATION_COHORT_NAMES)[number];
export type EvaluationSplitName = (typeof EVALUATION_SPLIT_NAMES)[number];

export interface EvaluationObservation {
  matchId: string;
  tournamentYear: number;
  date: string;
  stage: HistoricalStage;
  homeTeamId: HistoricalTeamId;
  awayTeamId: HistoricalTeamId;
  predictedProbability: number;
  observedOutcome: 0 | 1;
}

export interface CalibrationBucket {
  lowerBound: number;
  upperBound: number;
  includesUpperBound: boolean;
  sampleSize: number;
  meanPredictedProbability: number | null;
  observedHomeWinRate: number | null;
  absoluteCalibrationError: number | null;
}

export interface EvaluationMetrics {
  sampleSize: number;
  brierScore: number;
  logLoss: number;
  accuracy: number;
  meanPredictedProbability: number;
  observedHomeWinRate: number;
  calibrationBuckets: CalibrationBucket[];
}

export interface EvaluationResult {
  cohort: EvaluationCohortName;
  split: EvaluationSplitName;
  selectedSampleSize: number;
  scoredSampleSize: number;
  excludedFromBinaryScoring: number;
  metrics: EvaluationMetrics | null;
}

export interface EvaluationReportMetadata {
  generatedFileWarning: "Do not edit manually.";
  evaluationModelVersion: typeof EVALUATION_MODEL_VERSION;
  sourceObservationFile: string;
  sourceObservationChecksumSha256: string;
  sourceReconstructionMetadata: HistoricalEloGeneratedMetadata;
  cohorts: readonly EvaluationCohortName[];
  splits: readonly EvaluationSplitName[];
  numericPrecision: number;
  numericSerializationPolicy: string;
  generationTimestampPolicy: string;
  binaryTargetPolicy: string;
  sampleSizePolicy: string;
  knockoutStagePolicy: string;
  holdoutPolicy: string;
}

export interface EvaluationReport {
  results: EvaluationResult[];
  metadata: EvaluationReportMetadata;
}

export interface CohortSelection {
  cohort: EvaluationCohortName;
  split: EvaluationSplitName;
  selectedObservations: HistoricalPredictionObservation[];
  scoredObservations: EvaluationObservation[];
}
