import type {
  EvaluationCohortName,
  EvaluationSplitName,
} from "../evaluation/types.ts";
import type {
  SequentialEloConfig,
  SequentialEloReconstructionResult,
} from "../sequential-elo/types.ts";

export type DivisorComparisonCohort = Extract<
  EvaluationCohortName,
  "knockout_decisive_only" | "decisive_only" | "all_matches" | "knockout_only"
>;

export type DivisorComparisonSplit = Extract<
  EvaluationSplitName,
  "development" | "validation"
>;

export interface DivisorCandidateMetrics {
  selectedSampleSize: number;
  scoredSampleSize: number;
  brierScore: number | null;
  logLoss: number | null;
  accuracy: number | null;
  meanPredictedProbability: number | null;
  observedHomeWinRate: number | null;
}

export interface DivisorCohortSplitResult extends DivisorCandidateMetrics {
  cohort: DivisorComparisonCohort;
  split: DivisorComparisonSplit;
}

export interface DivisorReconstructionSummary {
  sourceChecksumSha256: string;
  observationIdentityChecksumSha256: string;
  matchCount: number;
  observationCount: number;
  teamCount: number;
  firstDate: string | null;
  lastDate: string | null;
  multiMatchDateCount: number;
  matchesOnMultiMatchDates: number;
  maxMatchesOnSingleDate: number;
}

export interface DivisorCandidate {
  divisor: number;
  reconstructionConfig: SequentialEloConfig;
  reconstruction: DivisorReconstructionSummary;
  development: DivisorCandidateMetrics;
  validation: DivisorCandidateMetrics;
  supportingDiagnostics: DivisorCohortSplitResult[];
}

export interface DivisorCandidateReconstruction {
  divisor: number;
  config: SequentialEloConfig;
  result: SequentialEloReconstructionResult;
  summary: DivisorReconstructionSummary;
}

export interface DivisorRankingCandidate {
  divisor: number;
  development: DivisorCandidateMetrics;
  validation: DivisorCandidateMetrics;
}

export interface DivisorComparisonKeys {
  validationBrierScore: number;
  validationLogLoss: number;
  developmentBrierScore: number;
  developmentLogLoss: number;
  distanceFromCurrentDivisor: number;
  divisor: number;
}

export interface DivisorRankingEntry {
  rank: number;
  divisor: number;
  validation: DivisorCandidateMetrics;
  development: DivisorCandidateMetrics;
  comparisonKeys: DivisorComparisonKeys;
  deltaFromCurrentDivisor: {
    validationBrierScore: number;
    validationLogLoss: number;
  };
  deltaFromBestValidationBrierScore: number;
}

export interface SelectionProtocol {
  primaryCohort: "knockout_decisive_only";
  primaryMetric: "validation_brier_score";
  secondaryMetric: "validation_log_loss";
  tieBreakRules: readonly [
    "development_brier_score",
    "development_log_loss",
    "distance_from_current_divisor_400",
    "smaller_numeric_divisor",
  ];
  rankingPrecision: "full_precision";
  eligibleSplits: readonly ["development", "validation"];
  excludedSplits: readonly ["holdout", "full_history"];
  accuracyUsedForSelection: false;
}

export interface SelectionDecision {
  provisionalSelectedDivisor: number;
  selectedRank: 1;
  productionDivisor: 400;
  productionChangeApplied: false;
  holdoutStatus: "sealed_unopened";
  status: "provisional_validation_selection";
}

export interface DivisorComparisonMetadata {
  generatedFileWarning: "Do not edit manually.";
  comparisonModelVersion: string;
  historicalReconstructionModelVersion: string;
  evaluationModelVersion: string;
  sourceDatasetChecksumSha256: string;
  observationIdentityChecksumSha256: string;
  candidateGrid: readonly number[];
  fixedBaselineParameters: Omit<SequentialEloConfig, "divisor">;
  productionDivisor: 400;
  selectionProtocol: SelectionProtocol;
  holdoutStatus: "sealed_unopened";
  numericPrecision: 6;
  numericSerializationPolicy: string;
  generationTimestampPolicy: string;
  baselineCompatibilityPolicy: string;
  developmentAccuracyCompatibility: Record<
    DivisorComparisonCohort,
    {
      comparison: number;
      standaloneBaseline: number;
    }
  >;
}

export interface DivisorComparisonResult {
  candidates: DivisorCandidate[];
  ranking: DivisorRankingEntry[];
  selectionDecision: SelectionDecision;
  metadata: DivisorComparisonMetadata;
}

export interface DivisorComparisonArtifacts {
  rankingJson: string;
  candidatesJson: string;
  metadataJson: string;
}
