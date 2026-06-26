import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
} from "../divisor-comparison/candidateDivisors.ts";
import { reconstructDivisorCandidate } from "../divisor-comparison/reconstructCandidate.ts";
import { EVALUATION_MODEL_VERSION } from "../evaluation/types.ts";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  SEQUENTIAL_ELO_MODEL_VERSION,
} from "../sequential-elo/index.ts";
import {
  FROZEN_UNCERTAINTY_PROTOCOL,
  createTextSha256,
  UNCERTAINTY_ANALYSIS_MODEL_VERSION,
} from "./frozenUncertaintyProtocol.ts";
import {
  createPairedLossObservations,
  filterPairedLossesBySplit,
} from "./pairedLosses.ts";
import { calculatePairedBootstrap } from "./pairedBootstrap.ts";
import { calculateTournamentSensitivity } from "./tournamentSensitivity.ts";
import type {
  CandidateObservationSummary,
  EvidenceClassification,
  PairedLossObservation,
  ProductionAdoptionDecision,
  SplitUncertaintyResult,
  UncertaintyAnalysisResult,
} from "./types.ts";

export interface UncertaintyArtifactInputs {
  divisorComparisonRankingJson: string;
  divisorComparisonCandidatesJson: string;
  divisorComparisonMetadataJson: string;
  holdoutResultJson: string;
  holdoutByCohortJson: string;
  holdoutMetadataJson: string;
}

interface DivisorComparisonRankingArtifact {
  selectionDecision: {
    provisionalSelectedDivisor: number;
    productionDivisor: number;
    holdoutStatus: string;
  };
  ranking: Array<{ divisor: number }>;
}

interface DivisorComparisonMetadataArtifact {
  sourceDatasetChecksumSha256: string;
  candidateGrid: number[];
  productionDivisor: number;
  holdoutStatus: string;
  selectionProtocol: {
    primaryCohort: string;
    primaryMetric: string;
    secondaryMetric: string;
    eligibleSplits: string[];
    excludedSplits: string[];
    accuracyUsedForSelection: boolean;
  };
}

interface HoldoutMetadataArtifact {
  holdoutStatus: string;
  sourceDatasetChecksumSha256: string;
  candidateDivisors: number[];
  frozenProtocol: {
    selectedDivisor: number;
    referenceDivisor: number;
    primaryCohort: string;
    primaryMetric: string;
    secondaryMetric: string;
    holdoutSplit: string;
    holdoutTournamentYear: number;
  };
  productionDivisor?: number;
}

export function analyzeHistoricalEloUncertainty(input: {
  normalizedMatches: readonly NormalizedHistoricalMatch[];
  sourceChecksumSha256: string;
  artifacts: UncertaintyArtifactInputs;
  candidateExecutionOrder?: readonly (200 | 400)[];
}): UncertaintyAnalysisResult {
  validateArtifactState(input);
  const executionOrder = input.candidateExecutionOrder ??
    [FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor, FROZEN_UNCERTAINTY_PROTOCOL.referenceDivisor];
  validateCandidateExecutionOrder(executionOrder);

  const reconstructed = executionOrder.map((divisor) =>
    reconstructDivisorCandidate({
      matches: input.normalizedMatches,
      divisor,
      sourceChecksumSha256: input.sourceChecksumSha256,
    })
  ).sort((left, right) => left.divisor - right.divisor);

  validateCandidateReconstruction(reconstructed, input.sourceChecksumSha256);

  const selected = reconstructed.find(
    (candidate) => candidate.divisor === FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor,
  );
  const reference = reconstructed.find(
    (candidate) => candidate.divisor === FROZEN_UNCERTAINTY_PROTOCOL.referenceDivisor,
  );
  if (!selected || !reference) {
    throw new Error("Uncertainty analysis requires selected and reference candidates.");
  }

  const pairedLosses = createPairedLossObservations({
    selectedObservations: selected.result.observations,
    referenceObservations: reference.result.observations,
  });
  const splitResults = createSplitResults(pairedLosses);
  const tournamentSensitivity = calculateTournamentSensitivity(pairedLosses);
  const evidenceClassification = classifyEvidence({
    splitResults,
    validationTournamentCountFavoringSelected:
      tournamentSensitivity.validationByTournament.filter(
        (entry) => entry.favors.brierScore === "selected",
      ).length,
  });
  const productionDecision = createProductionDecision(evidenceClassification);
  const sharedReconstructionSummary = reconstructed[0].summary;

  return {
    frozenProtocol: { ...FROZEN_UNCERTAINTY_PROTOCOL },
    candidateSummaries: reconstructed.map((candidate): CandidateObservationSummary => ({
      divisor: candidate.divisor as 200 | 400,
      reconstructionConfig: { ...candidate.config },
      matchCount: candidate.summary.matchCount,
      observationCount: candidate.summary.observationCount,
      teamCount: candidate.summary.teamCount,
      firstDate: candidate.summary.firstDate,
      lastDate: candidate.summary.lastDate,
      sourceChecksumSha256: candidate.summary.sourceChecksumSha256,
      observationIdentityChecksumSha256:
        candidate.summary.observationIdentityChecksumSha256,
    })),
    splitResults,
    tournamentSensitivity,
    evidenceClassification,
    productionDecision,
    metadata: {
      generatedFileWarning: "Do not edit manually.",
      uncertaintyAnalysisModelVersion: UNCERTAINTY_ANALYSIS_MODEL_VERSION,
      sourceDatasetChecksumSha256: input.sourceChecksumSha256,
      observationIdentityChecksumSha256:
        sharedReconstructionSummary.observationIdentityChecksumSha256,
      divisorComparisonArtifactChecksums: {
        ranking: createTextSha256(input.artifacts.divisorComparisonRankingJson),
        candidates: createTextSha256(input.artifacts.divisorComparisonCandidatesJson),
        metadata: createTextSha256(input.artifacts.divisorComparisonMetadataJson),
      },
      holdoutArtifactChecksums: {
        result: createTextSha256(input.artifacts.holdoutResultJson),
        byCohort: createTextSha256(input.artifacts.holdoutByCohortJson),
        metadata: createTextSha256(input.artifacts.holdoutMetadataJson),
      },
      historicalReconstructionModelVersion: SEQUENTIAL_ELO_MODEL_VERSION,
      evaluationModelVersion: EVALUATION_MODEL_VERSION,
      selectedDivisor: FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor,
      referenceDivisor: FROZEN_UNCERTAINTY_PROTOCOL.referenceDivisor,
      fixedCandidateGrid: [200, 250, 300, 350, 400, 450, 500, 600],
      fixedBaselineParameters: {
        initialRating: BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating,
        kFactor: BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor,
        homeAdvantage: BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage,
        penaltyUpdateOutcome: BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome,
        nonDecisiveUpdateOutcome:
          BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome,
      },
      frozenProtocol: { ...FROZEN_UNCERTAINTY_PROTOCOL },
      holdoutStatus: "opened_once_evaluated",
      numericPrecision: 6,
      numericSerializationPolicy:
        "Generated numbers are rounded to 6 decimal places and negative zero is serialized as zero.",
      generationTimestampPolicy:
        "No wall-clock timestamp is written; identical validated input produces byte-stable artifacts.",
      quantileConvention:
        "Percentile bounds use the Type 7 linear-interpolation quantile convention: sorted numeric replication means of length n use h = (n - 1) * p, the values at floor(h) and ceil(h), and linear interpolation by the fractional part of h. Lower and upper probabilities are 0.025 and 0.975, and full-precision replication values are used before six-decimal serialization.",
      favorFractionInterpretation:
        "The fraction of paired bootstrap replications with a negative delta is a descriptive resampling frequency. It is not a Bayesian posterior probability that divisor 200 is superior, not the probability that divisor 200 is the true optimum, not a production-adoption probability, and not a replacement for the predefined evidence-classification policy.",
      noTuningPolicy:
        "This uncertainty analysis does not rerank candidates, add divisors, combine splits into a new selection score, retune parameters, or change production.",
      statisticalSafeguards: [
        "Match-level bootstrap treats scored matches as exchangeable.",
        "Football matches within the same tournament may not be independent.",
        "Validation covers only three tournaments.",
        "Holdout covers only one tournament and 11 primary scored matches.",
        "Percentile intervals are descriptive uncertainty summaries.",
        "No statistical significance is claimed solely from this analysis.",
        "Bootstrap favor fractions are descriptive resampling frequencies, not posterior probabilities.",
        "Bootstrap intervals do not resolve the lower-boundary divisor-200 limitation.",
        "The 2022 holdout cannot be reused for tuning.",
      ],
    },
  };
}

function createSplitResults(
  pairedLosses: readonly PairedLossObservation[],
): SplitUncertaintyResult[] {
  return FROZEN_UNCERTAINTY_PROTOCOL.splits.map((split) => {
    const observations = filterPairedLossesBySplit(pairedLosses, split);
    return {
      split,
      sampleSize: observations.length,
      brierScore: calculatePairedBootstrap({
        observations,
        split,
        metric: "brierScore",
      }),
      logLoss: calculatePairedBootstrap({
        observations,
        split,
        metric: "logLoss",
      }),
    };
  });
}

export function classifyEvidence(input: {
  splitResults: readonly SplitUncertaintyResult[];
  validationTournamentCountFavoringSelected: number;
}): EvidenceClassification {
  const validation = requireSplit(input.splitResults, "validation").brierScore;
  const holdout = requireSplit(input.splitResults, "holdout").brierScore;

  if (
    validation.observedMeanDelta < 0 &&
    holdout.observedMeanDelta < 0 &&
    validation.upperBound < 0 &&
    input.validationTournamentCountFavoringSelected >= 2
  ) {
    return "supports_adoption_review";
  }
  if (validation.observedMeanDelta > 0 && holdout.observedMeanDelta > 0) {
    return "supports_retaining_reference";
  }
  return "mixed_or_uncertain";
}

function createProductionDecision(
  classification: EvidenceClassification,
): ProductionAdoptionDecision {
  return {
    classification,
    decision: "defer_production_adoption",
    productionDivisor: CURRENT_PRODUCTION_DIVISOR,
    productionChangeApplied: false,
    leadingResearchCandidate: FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor,
    selectedDivisor: FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor,
    referenceDivisor: FROZEN_UNCERTAINTY_PROTOCOL.referenceDivisor,
    policy:
      "Classification describes whether evidence supports a human adoption review; it never changes production automatically.",
    rationale: [
      "Validation and holdout samples are small.",
      "The holdout is one tournament.",
      "Divisor 200 was the lower boundary of the searched grid.",
      "Uncertainty analysis remains descriptive.",
      "Changing the production divisor would affect every matchup and tournament simulation.",
    ],
  };
}

function validateArtifactState(input: {
  sourceChecksumSha256: string;
  artifacts: UncertaintyArtifactInputs;
}): void {
  const ranking = parseJson<DivisorComparisonRankingArtifact>(
    input.artifacts.divisorComparisonRankingJson,
    "divisor comparison ranking",
  );
  const comparisonMetadata = parseJson<DivisorComparisonMetadataArtifact>(
    input.artifacts.divisorComparisonMetadataJson,
    "divisor comparison metadata",
  );
  const holdoutMetadata = parseJson<HoldoutMetadataArtifact>(
    input.artifacts.holdoutMetadataJson,
    "holdout metadata",
  );

  if (
    ranking.selectionDecision.provisionalSelectedDivisor !==
      FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor ||
    ranking.selectionDecision.productionDivisor !== CURRENT_PRODUCTION_DIVISOR ||
    ranking.selectionDecision.holdoutStatus !== "sealed_unopened"
  ) {
    throw new Error("Uncertainty analysis requires the committed pre-holdout comparison ranking.");
  }
  if (
    comparisonMetadata.sourceDatasetChecksumSha256 !== input.sourceChecksumSha256 ||
    comparisonMetadata.productionDivisor !== CURRENT_PRODUCTION_DIVISOR ||
    comparisonMetadata.holdoutStatus !== "sealed_unopened" ||
    JSON.stringify(comparisonMetadata.candidateGrid) !== JSON.stringify(DIVISOR_CANDIDATES)
  ) {
    throw new Error("Uncertainty analysis requires the committed divisor-comparison metadata.");
  }
  if (
    comparisonMetadata.selectionProtocol.primaryCohort !==
      FROZEN_UNCERTAINTY_PROTOCOL.cohort ||
    comparisonMetadata.selectionProtocol.primaryMetric !== "validation_brier_score" ||
    comparisonMetadata.selectionProtocol.secondaryMetric !== "validation_log_loss" ||
    !comparisonMetadata.selectionProtocol.excludedSplits.includes("holdout")
  ) {
    throw new Error("Uncertainty analysis requires the frozen comparison protocol.");
  }
  if (
    holdoutMetadata.holdoutStatus !== "opened_once_evaluated" ||
    holdoutMetadata.sourceDatasetChecksumSha256 !== input.sourceChecksumSha256 ||
    JSON.stringify(holdoutMetadata.candidateDivisors) !== JSON.stringify([200, 400]) ||
    holdoutMetadata.frozenProtocol.selectedDivisor !==
      FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor ||
    holdoutMetadata.frozenProtocol.referenceDivisor !==
      FROZEN_UNCERTAINTY_PROTOCOL.referenceDivisor ||
    holdoutMetadata.frozenProtocol.primaryCohort !== FROZEN_UNCERTAINTY_PROTOCOL.cohort ||
    holdoutMetadata.frozenProtocol.holdoutTournamentYear !== 2022
  ) {
    throw new Error("Uncertainty analysis requires the opened-once holdout artifacts.");
  }
}

function validateCandidateExecutionOrder(
  executionOrder: readonly (200 | 400)[],
): void {
  if (executionOrder.length !== 2) {
    throw new Error("Uncertainty analysis must evaluate exactly divisors 200 and 400.");
  }
  const seen = new Set<number>();
  for (const divisor of executionOrder) {
    if (divisor !== 200 && divisor !== 400) {
      throw new Error(`Unexpected uncertainty-analysis divisor "${divisor}".`);
    }
    if (seen.has(divisor)) {
      throw new Error(`Duplicate uncertainty-analysis divisor "${divisor}".`);
    }
    seen.add(divisor);
  }
}

function validateCandidateReconstruction(
  candidates: readonly ReturnType<typeof reconstructDivisorCandidate>[],
  sourceChecksumSha256: string,
): void {
  if (candidates.length !== 2) {
    throw new Error("Uncertainty analysis requires exactly two candidates.");
  }
  const reference = candidates[0];

  for (const candidate of candidates) {
    if (candidate.summary.sourceChecksumSha256 !== sourceChecksumSha256) {
      throw new Error(`Uncertainty divisor ${candidate.divisor} has mismatched source checksum.`);
    }
    if (
      candidate.config.initialRating !== BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating ||
      candidate.config.kFactor !== BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor ||
      candidate.config.homeAdvantage !== BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage ||
      candidate.config.penaltyUpdateOutcome !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome ||
      candidate.config.nonDecisiveUpdateOutcome !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome
    ) {
      throw new Error(`Uncertainty divisor ${candidate.divisor} changed a fixed parameter.`);
    }
    for (const field of [
      "observationIdentityChecksumSha256",
      "matchCount",
      "observationCount",
      "teamCount",
      "firstDate",
      "lastDate",
    ] as const) {
      if (candidate.summary[field] !== reference.summary[field]) {
        throw new Error(
          `Uncertainty divisor ${candidate.divisor} has mismatched reconstruction field "${field}".`,
        );
      }
    }
  }
}

function requireSplit(
  results: readonly SplitUncertaintyResult[],
  split: "validation" | "holdout",
): SplitUncertaintyResult {
  const result = results.find((entry) => entry.split === split);
  if (!result) {
    throw new Error(`Missing ${split} uncertainty result.`);
  }
  return result;
}

function parseJson<T>(contents: string, label: string): T {
  try {
    return JSON.parse(contents) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse ${label}: ${message}`);
  }
}
