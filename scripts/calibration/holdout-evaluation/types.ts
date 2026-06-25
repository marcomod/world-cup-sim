import type { EvaluationCohortName } from "../evaluation/types.ts";
import type { SequentialEloConfig } from "../sequential-elo/types.ts";

export type HoldoutEvaluationCohort = Extract<
  EvaluationCohortName,
  "all_matches" | "decisive_only" | "knockout_only" | "knockout_decisive_only"
>;

export interface FrozenHoldoutProtocol {
  selectedDivisor: 200;
  referenceDivisor: 400;
  primaryCohort: "knockout_decisive_only";
  primaryMetric: "brierScore";
  secondaryMetric: "logLoss";
  holdoutSplit: "holdout";
  holdoutTournamentYear: 2022;
}

export interface HoldoutCohortMetrics {
  brierScore: number;
  logLoss: number;
  accuracy: number;
  meanPredictedProbability: number;
  observedHomeWinRate: number;
}

export interface HoldoutCohortResult {
  cohort: HoldoutEvaluationCohort;
  split: "holdout";
  selectedSampleSize: number;
  scoredSampleSize: number;
  excludedFromBinaryScoring: number;
  metrics: HoldoutCohortMetrics | null;
}

export interface HoldoutReconstructionSummary {
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

export interface HoldoutCandidateResult {
  divisor: 200 | 400;
  reconstructionConfig: SequentialEloConfig;
  reconstruction: HoldoutReconstructionSummary;
  cohorts: HoldoutCohortResult[];
}

export interface HoldoutMetricComparison {
  selectedDivisor: 200;
  referenceDivisor: 400;
  cohort: "knockout_decisive_only";
  split: "holdout";
  selectedSampleSize: number;
  scoredSampleSize: number;
  selected: HoldoutCohortMetrics;
  reference: HoldoutCohortMetrics;
  deltas: {
    brierScore: number;
    logLoss: number;
  };
  deltaDirection: {
    brierScore: "favors_selected" | "favors_reference" | "tied";
    logLoss: "favors_selected" | "favors_reference" | "tied";
  };
  accuracyPolicy: "secondary_not_used_for_selection";
}

export interface HoldoutDecisionSummary {
  status: "opened_once_evaluated";
  conclusion:
    | "holdout_favors_selected_divisor"
    | "holdout_favors_reference_divisor"
    | "holdout_effectively_tied_at_reported_precision";
  conclusionBasis: "primary_holdout_brier_score_delta";
  primarySampleSize: 11;
  selectedDivisor: 200;
  referenceDivisor: 400;
  productionDivisor: 400;
  productionChangeApplied: false;
  protocolRetuned: false;
  gridExpanded: false;
  significanceClaimed: false;
  furtherTuningOnHoldoutAllowed: false;
  note: string;
}

export interface HoldoutEvaluationMetadata {
  generatedFileWarning: "Do not edit manually.";
  holdoutStatus: "opened_once_evaluated";
  projectRecordDate: "2026-06-24";
  projectRecordDatePolicy: string;
  sourceDatasetChecksumSha256: string;
  divisorComparisonMetadataChecksumSha256: string;
  frozenProtocolChecksumSha256: string;
  historicalReconstructionModelVersion: string;
  evaluationModelVersion: string;
  holdoutEvaluationModelVersion: "historical-elo-holdout-evaluation-v1";
  candidateDivisors: readonly [200, 400];
  fixedCandidateGrid: readonly [200, 250, 300, 350, 400, 450, 500, 600];
  fixedBaselineParameters: Omit<SequentialEloConfig, "divisor">;
  frozenProtocol: FrozenHoldoutProtocol;
  previouslySealedHoldoutStatus: "sealed_unopened";
  openingReason: string;
  numericPrecision: 6;
  numericSerializationPolicy: string;
  generationTimestampPolicy: string;
  noRetuningPolicy: string;
}

export interface HoldoutEvaluationResult {
  frozenProtocol: FrozenHoldoutProtocol;
  primaryComparison: HoldoutMetricComparison;
  decisionSummary: HoldoutDecisionSummary;
  candidates: HoldoutCandidateResult[];
  metadata: HoldoutEvaluationMetadata;
}

export interface HoldoutEvaluationArtifacts {
  resultJson: string;
  byCohortJson: string;
  metadataJson: string;
}
