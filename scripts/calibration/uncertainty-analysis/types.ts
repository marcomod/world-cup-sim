import type { DivisorComparisonCohort } from "../divisor-comparison/types.ts";
import type { EvaluationSplitName } from "../evaluation/types.ts";
import type { SequentialEloConfig } from "../sequential-elo/types.ts";

export type UncertaintySplit = Extract<
  EvaluationSplitName,
  "development" | "validation" | "holdout"
>;
export type UncertaintyMetric = "brierScore" | "logLoss";
export type EvidenceClassification =
  | "supports_adoption_review"
  | "mixed_or_uncertain"
  | "supports_retaining_reference";

export interface FrozenUncertaintyProtocol {
  selectedDivisor: 200;
  referenceDivisor: 400;
  cohort: Extract<DivisorComparisonCohort, "knockout_decisive_only">;
  metrics: readonly ["brierScore", "logLoss"];
  deltaDirection: "selected_minus_reference";
  bootstrapMethod: "paired_match_percentile";
  bootstrapReplications: 100000;
  confidenceLevel: 0.95;
  seed: 2026200400;
  splits: readonly ["development", "validation", "holdout"];
}

export interface CandidateObservationSummary {
  divisor: 200 | 400;
  reconstructionConfig: SequentialEloConfig;
  matchCount: number;
  observationCount: number;
  teamCount: number;
  firstDate: string | null;
  lastDate: string | null;
  sourceChecksumSha256: string;
  observationIdentityChecksumSha256: string;
}

export interface PairedLossObservation {
  matchId: string;
  tournamentYear: number;
  date: string;
  split: UncertaintySplit;
  observedOutcome: 0 | 1;
  selectedProbability: number;
  referenceProbability: number;
  selectedBrierLoss: number;
  referenceBrierLoss: number;
  brierDelta: number;
  selectedLogLoss: number;
  referenceLogLoss: number;
  logLossDelta: number;
}

export interface BootstrapMetricResult {
  split: UncertaintySplit;
  metric: UncertaintyMetric;
  sampleSize: number;
  observedMeanDelta: number;
  observedTotalLossDifference: number;
  bootstrapMeanDelta: number;
  bootstrapMedianDelta: number;
  confidenceLevel: 0.95;
  lowerBound: number;
  upperBound: number;
  proportionFavoringSelected: number;
  proportionFavoringReference: number;
  proportionEqual: number;
  replicationCount: 100000;
  seed: number;
  method: "paired_match_percentile";
  deltaDirection: "selected_minus_reference";
}

export interface SplitUncertaintyResult {
  split: UncertaintySplit;
  sampleSize: number;
  brierScore: BootstrapMetricResult;
  logLoss: BootstrapMetricResult;
}

export interface TournamentMetricResult {
  tournamentYear: number;
  sampleSize: number;
  selected: {
    brierScore: number;
    logLoss: number;
  };
  reference: {
    brierScore: number;
    logLoss: number;
  };
  deltas: {
    brierScore: number;
    logLoss: number;
  };
  favors: {
    brierScore: "selected" | "reference" | "tied";
    logLoss: "selected" | "reference" | "tied";
  };
}

export interface LeaveOneTournamentOutResult extends TournamentMetricResult {
  excludedTournamentYear: number;
  includedTournamentYears: number[];
}

export interface DevelopmentTournamentMetricSummary {
  tournamentCount: number;
  tournamentsFavoringSelected: number;
  tournamentsFavoringReference: number;
  tournamentsTiedAtSixDecimals: number;
  medianTournamentDelta: number;
  minTournamentDelta: number;
  maxTournamentDelta: number;
}

export interface DevelopmentTournamentSummary {
  tournamentSampleSizes: Array<{
    tournamentYear: number;
    sampleSize: number;
  }>;
  brierScore: DevelopmentTournamentMetricSummary;
  logLoss: DevelopmentTournamentMetricSummary;
}

export interface TournamentSensitivityResult {
  validationByTournament: TournamentMetricResult[];
  validationLeaveOneTournamentOut: LeaveOneTournamentOutResult[];
  developmentSummary: DevelopmentTournamentSummary;
  sensitivityPolicy: string;
}

export interface ProductionAdoptionDecision {
  classification: EvidenceClassification;
  decision: "defer_production_adoption";
  productionDivisor: 400;
  productionChangeApplied: false;
  leadingResearchCandidate: 200;
  selectedDivisor: 200;
  referenceDivisor: 400;
  policy: string;
  rationale: string[];
}

export interface UncertaintyAnalysisMetadata {
  generatedFileWarning: "Do not edit manually.";
  uncertaintyAnalysisModelVersion: "historical-elo-uncertainty-analysis-v1";
  sourceDatasetChecksumSha256: string;
  observationIdentityChecksumSha256: string;
  divisorComparisonArtifactChecksums: {
    ranking: string;
    candidates: string;
    metadata: string;
  };
  holdoutArtifactChecksums: {
    result: string;
    byCohort: string;
    metadata: string;
  };
  historicalReconstructionModelVersion: string;
  evaluationModelVersion: string;
  selectedDivisor: 200;
  referenceDivisor: 400;
  fixedCandidateGrid: readonly [200, 250, 300, 350, 400, 450, 500, 600];
  fixedBaselineParameters: Omit<SequentialEloConfig, "divisor">;
  frozenProtocol: FrozenUncertaintyProtocol;
  holdoutStatus: "opened_once_evaluated";
  numericPrecision: 6;
  numericSerializationPolicy: string;
  generationTimestampPolicy: string;
  quantileConvention: string;
  favorFractionInterpretation: string;
  noTuningPolicy: string;
  statisticalSafeguards: string[];
}

export interface UncertaintyAnalysisResult {
  frozenProtocol: FrozenUncertaintyProtocol;
  candidateSummaries: CandidateObservationSummary[];
  splitResults: SplitUncertaintyResult[];
  tournamentSensitivity: TournamentSensitivityResult;
  evidenceClassification: EvidenceClassification;
  productionDecision: ProductionAdoptionDecision;
  metadata: UncertaintyAnalysisMetadata;
}

export interface UncertaintyAnalysisArtifacts {
  summaryJson: string;
  bootstrapJson: string;
  tournamentSensitivityJson: string;
  metadataJson: string;
}
