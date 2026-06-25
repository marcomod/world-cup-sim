import { EVALUATION_MODEL_VERSION } from "../evaluation/types.ts";
import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
} from "../divisor-comparison/candidateDivisors.ts";
import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  SEQUENTIAL_ELO_MODEL_VERSION,
} from "../sequential-elo/index.ts";
import { evaluateHoldoutCandidate } from "./evaluateHoldoutCandidate.ts";
import {
  createTextSha256,
  FROZEN_HOLDOUT_PROTOCOL,
  getFrozenHoldoutProtocolChecksum,
  HOLDOUT_CANDIDATE_DIVISORS,
  HOLDOUT_EVALUATION_MODEL_VERSION,
} from "./frozenHoldoutProtocol.ts";
import type {
  FrozenHoldoutProtocol,
  HoldoutCandidateResult,
  HoldoutCohortResult,
  HoldoutDecisionSummary,
  HoldoutEvaluationResult,
  HoldoutMetricComparison,
} from "./types.ts";

export interface SealedDivisorComparisonState {
  rankingJson: string;
  metadataJson: string;
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

export function compareHoldoutCandidates(input: {
  normalizedMatches: readonly NormalizedHistoricalMatch[];
  sourceChecksumSha256: string;
  sealedDivisorComparison: SealedDivisorComparisonState;
  candidateExecutionOrder?: readonly (200 | 400)[];
}): HoldoutEvaluationResult {
  validateSealedDivisorComparison(input);
  const executionOrder = input.candidateExecutionOrder ?? HOLDOUT_CANDIDATE_DIVISORS;
  validateHoldoutCandidateExecutionOrder(executionOrder);

  const candidates = executionOrder.map((divisor) =>
    evaluateHoldoutCandidate({
      matches: input.normalizedMatches,
      divisor,
      sourceChecksumSha256: input.sourceChecksumSha256,
    })
  ).sort((left, right) => left.divisor - right.divisor);

  validateHoldoutCandidateConsistency(candidates, input.sourceChecksumSha256);

  const primaryComparison = createPrimaryComparison(candidates);
  const decisionSummary = createDecisionSummary(primaryComparison);

  return {
    frozenProtocol: { ...FROZEN_HOLDOUT_PROTOCOL },
    primaryComparison,
    decisionSummary,
    candidates,
    metadata: {
      generatedFileWarning: "Do not edit manually.",
      holdoutStatus: "opened_once_evaluated",
      projectRecordDate: "2026-06-24",
      projectRecordDatePolicy:
        "Fixed project record date for the one-time holdout opening; not an execution timestamp.",
      sourceDatasetChecksumSha256: input.sourceChecksumSha256,
      divisorComparisonMetadataChecksumSha256:
        createTextSha256(input.sealedDivisorComparison.metadataJson),
      frozenProtocolChecksumSha256: getFrozenHoldoutProtocolChecksum(),
      historicalReconstructionModelVersion: SEQUENTIAL_ELO_MODEL_VERSION,
      evaluationModelVersion: EVALUATION_MODEL_VERSION,
      holdoutEvaluationModelVersion: HOLDOUT_EVALUATION_MODEL_VERSION,
      candidateDivisors: [200, 400],
      fixedCandidateGrid: [...DIVISOR_CANDIDATES],
      fixedBaselineParameters: {
        initialRating: BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating,
        kFactor: BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor,
        homeAdvantage: BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage,
        penaltyUpdateOutcome: BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome,
        nonDecisiveUpdateOutcome:
          BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome,
      },
      frozenProtocol: { ...FROZEN_HOLDOUT_PROTOCOL },
      previouslySealedHoldoutStatus: "sealed_unopened",
      openingReason:
        "One-time final holdout evaluation after the divisor-comparison protocol, grid, and provisional divisor 200 selection were fixed.",
      numericPrecision: 6,
      numericSerializationPolicy:
        "Generated numbers are rounded to 6 decimal places and negative zero is serialized as zero.",
      generationTimestampPolicy:
        "No wall-clock timestamp is written; identical validated input produces byte-stable artifacts.",
      noRetuningPolicy:
        "Holdout metrics are descriptive only; they do not rerank candidates, expand the grid, alter fixed parameters, or change the production divisor.",
    },
  };
}

function validateSealedDivisorComparison(input: {
  sourceChecksumSha256: string;
  sealedDivisorComparison: SealedDivisorComparisonState;
}): {
  ranking: DivisorComparisonRankingArtifact;
  metadata: DivisorComparisonMetadataArtifact;
} {
  const ranking = parseJson<DivisorComparisonRankingArtifact>(
    input.sealedDivisorComparison.rankingJson,
    "divisor comparison ranking",
  );
  const metadata = parseJson<DivisorComparisonMetadataArtifact>(
    input.sealedDivisorComparison.metadataJson,
    "divisor comparison metadata",
  );

  if (ranking.selectionDecision.provisionalSelectedDivisor !==
    FROZEN_HOLDOUT_PROTOCOL.selectedDivisor) {
    throw new Error("Holdout evaluation requires the committed selected divisor 200.");
  }
  if (
    ranking.selectionDecision.productionDivisor !== CURRENT_PRODUCTION_DIVISOR ||
    metadata.productionDivisor !== CURRENT_PRODUCTION_DIVISOR ||
    FROZEN_HOLDOUT_PROTOCOL.referenceDivisor !== CURRENT_PRODUCTION_DIVISOR
  ) {
    throw new Error("Holdout evaluation requires reference and production divisor 400.");
  }
  if (
    ranking.selectionDecision.holdoutStatus !== "sealed_unopened" ||
    metadata.holdoutStatus !== "sealed_unopened"
  ) {
    throw new Error("Holdout evaluation requires sealed divisor-comparison artifacts.");
  }
  if (metadata.sourceDatasetChecksumSha256 !== input.sourceChecksumSha256) {
    throw new Error("Holdout evaluation source checksum does not match comparison metadata.");
  }
  if (JSON.stringify(metadata.candidateGrid) !== JSON.stringify(DIVISOR_CANDIDATES)) {
    throw new Error("Holdout evaluation requires the fixed divisor candidate grid.");
  }
  if (!ranking.ranking.some((entry) => entry.divisor === FROZEN_HOLDOUT_PROTOCOL.selectedDivisor)) {
    throw new Error("Holdout evaluation cannot find selected divisor 200 in comparison ranking.");
  }
  if (!ranking.ranking.some((entry) => entry.divisor === FROZEN_HOLDOUT_PROTOCOL.referenceDivisor)) {
    throw new Error("Holdout evaluation cannot find reference divisor 400 in comparison ranking.");
  }
  if (
    metadata.selectionProtocol.primaryCohort !== FROZEN_HOLDOUT_PROTOCOL.primaryCohort ||
    metadata.selectionProtocol.primaryMetric !== "validation_brier_score" ||
    metadata.selectionProtocol.secondaryMetric !== "validation_log_loss" ||
    !metadata.selectionProtocol.eligibleSplits.includes("development") ||
    !metadata.selectionProtocol.eligibleSplits.includes("validation") ||
    !metadata.selectionProtocol.excludedSplits.includes("holdout") ||
    !metadata.selectionProtocol.excludedSplits.includes("full_history") ||
    metadata.selectionProtocol.accuracyUsedForSelection !== false
  ) {
    throw new Error("Holdout evaluation requires the frozen pre-holdout protocol.");
  }

  return { ranking, metadata };
}

function validateHoldoutCandidateExecutionOrder(
  executionOrder: readonly (200 | 400)[],
): void {
  if (executionOrder.length !== HOLDOUT_CANDIDATE_DIVISORS.length) {
    throw new Error("Holdout evaluation must evaluate exactly divisors 200 and 400.");
  }
  const seen = new Set<number>();
  for (const divisor of executionOrder) {
    if (!HOLDOUT_CANDIDATE_DIVISORS.includes(divisor)) {
      throw new Error(`Unexpected holdout divisor "${divisor}".`);
    }
    if (seen.has(divisor)) {
      throw new Error(`Duplicate holdout divisor "${divisor}".`);
    }
    seen.add(divisor);
  }
}

function validateHoldoutCandidateConsistency(
  candidates: readonly HoldoutCandidateResult[],
  sourceChecksumSha256: string,
): void {
  if (candidates.length !== 2) {
    throw new Error("Holdout evaluation requires exactly two candidate results.");
  }

  const reference = candidates[0];
  for (const candidate of candidates) {
    if (candidate.reconstruction.sourceChecksumSha256 !== sourceChecksumSha256) {
      throw new Error(`Holdout divisor ${candidate.divisor} has mismatched source checksum.`);
    }
    if (
      candidate.reconstructionConfig.initialRating !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating ||
      candidate.reconstructionConfig.kFactor !== BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor ||
      candidate.reconstructionConfig.homeAdvantage !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage ||
      candidate.reconstructionConfig.penaltyUpdateOutcome !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome ||
      candidate.reconstructionConfig.nonDecisiveUpdateOutcome !==
        BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome
    ) {
      throw new Error(`Holdout divisor ${candidate.divisor} changed a fixed parameter.`);
    }
    for (const field of [
      "observationIdentityChecksumSha256",
      "matchCount",
      "observationCount",
      "teamCount",
      "firstDate",
      "lastDate",
      "multiMatchDateCount",
      "matchesOnMultiMatchDates",
      "maxMatchesOnSingleDate",
    ] as const) {
      if (candidate.reconstruction[field] !== reference.reconstruction[field]) {
        throw new Error(
          `Holdout divisor ${candidate.divisor} has mismatched reconstruction field "${field}".`,
        );
      }
    }
    validateExpectedCohortCounts(candidate);
  }
}

function validateExpectedCohortCounts(candidate: HoldoutCandidateResult): void {
  const expectedCounts = {
    all_matches: [64, 49],
    decisive_only: [49, 49],
    knockout_only: [16, 11],
    knockout_decisive_only: [11, 11],
  } as const;

  for (const cohort of candidate.cohorts) {
    const [selected, scored] = expectedCounts[cohort.cohort];
    if (
      cohort.selectedSampleSize !== selected ||
      cohort.scoredSampleSize !== scored ||
      cohort.excludedFromBinaryScoring !== selected - scored
    ) {
      throw new Error(
        `Holdout divisor ${candidate.divisor} has unexpected ${cohort.cohort} sample counts.`,
      );
    }
  }
}

function createPrimaryComparison(
  candidates: readonly HoldoutCandidateResult[],
): HoldoutMetricComparison {
  const selected = findCandidate(candidates, FROZEN_HOLDOUT_PROTOCOL.selectedDivisor);
  const reference = findCandidate(candidates, FROZEN_HOLDOUT_PROTOCOL.referenceDivisor);
  const selectedCohort = requireCohort(
    selected,
    FROZEN_HOLDOUT_PROTOCOL.primaryCohort,
  );
  const referenceCohort = requireCohort(
    reference,
    FROZEN_HOLDOUT_PROTOCOL.primaryCohort,
  );

  if (
    selectedCohort.selectedSampleSize !== referenceCohort.selectedSampleSize ||
    selectedCohort.scoredSampleSize !== referenceCohort.scoredSampleSize ||
    selectedCohort.excludedFromBinaryScoring !==
      referenceCohort.excludedFromBinaryScoring
  ) {
    throw new Error("Primary holdout cohort membership differs between candidates.");
  }
  if (!selectedCohort.metrics || !referenceCohort.metrics) {
    throw new Error("Primary holdout metrics must be finite for both candidates.");
  }

  const brierScoreDelta =
    selectedCohort.metrics.brierScore - referenceCohort.metrics.brierScore;
  const logLossDelta = selectedCohort.metrics.logLoss - referenceCohort.metrics.logLoss;

  return {
    selectedDivisor: FROZEN_HOLDOUT_PROTOCOL.selectedDivisor,
    referenceDivisor: FROZEN_HOLDOUT_PROTOCOL.referenceDivisor,
    cohort: FROZEN_HOLDOUT_PROTOCOL.primaryCohort,
    split: FROZEN_HOLDOUT_PROTOCOL.holdoutSplit,
    selectedSampleSize: selectedCohort.selectedSampleSize,
    scoredSampleSize: selectedCohort.scoredSampleSize,
    selected: selectedCohort.metrics,
    reference: referenceCohort.metrics,
    deltas: {
      brierScore: brierScoreDelta,
      logLoss: logLossDelta,
    },
    deltaDirection: {
      brierScore: directionFromDelta(brierScoreDelta),
      logLoss: directionFromDelta(logLossDelta),
    },
    accuracyPolicy: "secondary_not_used_for_selection",
  };
}

function createDecisionSummary(
  comparison: HoldoutMetricComparison,
): HoldoutDecisionSummary {
  const conclusion = comparison.deltaDirection.brierScore === "favors_selected"
    ? "holdout_favors_selected_divisor"
    : comparison.deltaDirection.brierScore === "favors_reference"
    ? "holdout_favors_reference_divisor"
    : "holdout_effectively_tied_at_reported_precision";

  return {
    status: "opened_once_evaluated",
    conclusion,
    conclusionBasis: "primary_holdout_brier_score_delta",
    primarySampleSize: 11,
    selectedDivisor: FROZEN_HOLDOUT_PROTOCOL.selectedDivisor,
    referenceDivisor: FROZEN_HOLDOUT_PROTOCOL.referenceDivisor,
    productionDivisor: CURRENT_PRODUCTION_DIVISOR,
    productionChangeApplied: false,
    protocolRetuned: false,
    gridExpanded: false,
    significanceClaimed: false,
    furtherTuningOnHoldoutAllowed: false,
    note:
      "The holdout is one 11-match primary sample from one tournament. No statistical significance is claimed, no further tuning may use 2022, and production remains divisor 400 pending a separate adoption decision.",
  };
}

function directionFromDelta(
  delta: number,
): "favors_selected" | "favors_reference" | "tied" {
  if (delta < 0) {
    return "favors_selected";
  }
  if (delta > 0) {
    return "favors_reference";
  }
  return "tied";
}

function findCandidate(
  candidates: readonly HoldoutCandidateResult[],
  divisor: 200 | 400,
): HoldoutCandidateResult {
  const candidate = candidates.find((entry) => entry.divisor === divisor);
  if (!candidate) {
    throw new Error(`Missing holdout divisor ${divisor}.`);
  }
  return candidate;
}

function requireCohort(
  candidate: HoldoutCandidateResult,
  cohort: FrozenHoldoutProtocol["primaryCohort"],
): HoldoutCohortResult {
  const result = candidate.cohorts.find((entry) => entry.cohort === cohort);
  if (!result) {
    throw new Error(`Missing ${cohort} holdout result for divisor ${candidate.divisor}.`);
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
