import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import {
  calculateEvaluationMetrics,
  selectEvaluationCohort,
} from "../evaluation/index.ts";
import { reconstructDivisorCandidate } from "../divisor-comparison/reconstructCandidate.ts";
import {
  FROZEN_HOLDOUT_PROTOCOL,
  HOLDOUT_EVALUATION_COHORTS,
} from "./frozenHoldoutProtocol.ts";
import type {
  HoldoutCandidateResult,
  HoldoutCohortMetrics,
  HoldoutCohortResult,
} from "./types.ts";

export function evaluateHoldoutCandidate(input: {
  matches: readonly NormalizedHistoricalMatch[];
  divisor: 200 | 400;
  sourceChecksumSha256: string;
}): HoldoutCandidateResult {
  const reconstruction = reconstructDivisorCandidate({
    matches: input.matches,
    divisor: input.divisor,
    sourceChecksumSha256: input.sourceChecksumSha256,
  });

  return {
    divisor: input.divisor,
    reconstructionConfig: { ...reconstruction.config },
    reconstruction: { ...reconstruction.summary },
    cohorts: HOLDOUT_EVALUATION_COHORTS.map((cohort) =>
      evaluateHoldoutCohort({
        observations: reconstruction.result.observations,
        cohort,
      })
    ),
  };
}

function evaluateHoldoutCohort(input: {
  observations: Parameters<typeof selectEvaluationCohort>[0]["observations"];
  cohort: HoldoutCohortResult["cohort"];
}): HoldoutCohortResult {
  const selection = selectEvaluationCohort({
    observations: input.observations,
    cohort: input.cohort,
    split: FROZEN_HOLDOUT_PROTOCOL.holdoutSplit,
  });
  const metrics = selection.scoredObservations.length === 0
    ? null
    : toHoldoutMetrics(calculateEvaluationMetrics(selection.scoredObservations));

  return {
    cohort: input.cohort,
    split: FROZEN_HOLDOUT_PROTOCOL.holdoutSplit,
    selectedSampleSize: selection.selectedObservations.length,
    scoredSampleSize: selection.scoredObservations.length,
    excludedFromBinaryScoring:
      selection.selectedObservations.length - selection.scoredObservations.length,
    metrics,
  };
}

function toHoldoutMetrics(
  metrics: ReturnType<typeof calculateEvaluationMetrics>,
): HoldoutCohortMetrics {
  return {
    brierScore: metrics.brierScore,
    logLoss: metrics.logLoss,
    accuracy: metrics.accuracy,
    meanPredictedProbability: metrics.meanPredictedProbability,
    observedHomeWinRate: metrics.observedHomeWinRate,
  };
}
