import type { HistoricalPredictionObservation } from "../sequential-elo/types.ts";
import { calculateBrierScore } from "./brierScore.ts";
import { calculateCalibrationBuckets } from "./calibrationBuckets.ts";
import { calculateClassificationAccuracy } from "./classificationAccuracy.ts";
import { calculateLogLoss } from "./logLoss.ts";
import { selectEvaluationCohort } from "./selectEvaluationCohort.ts";
import {
  EVALUATION_COHORT_NAMES,
  EVALUATION_SPLIT_NAMES,
  type EvaluationMetrics,
  type EvaluationReport,
  type EvaluationReportMetadata,
  type EvaluationResult,
} from "./types.ts";
import { validateBinaryObservations } from "./validation.ts";

export function evaluateHistoricalObservations(input: {
  observations: readonly HistoricalPredictionObservation[];
  metadata: EvaluationReportMetadata;
}): EvaluationReport {
  const results: EvaluationResult[] = [];

  for (const cohort of EVALUATION_COHORT_NAMES) {
    for (const split of EVALUATION_SPLIT_NAMES) {
      const selection = selectEvaluationCohort({
        observations: input.observations,
        cohort,
        split,
      });
      const metrics = selection.scoredObservations.length === 0
        ? null
        : calculateEvaluationMetrics(selection.scoredObservations);

      results.push({
        cohort,
        split,
        selectedSampleSize: selection.selectedObservations.length,
        scoredSampleSize: selection.scoredObservations.length,
        excludedFromBinaryScoring:
          selection.selectedObservations.length - selection.scoredObservations.length,
        metrics,
      });
    }
  }

  return { results, metadata: input.metadata };
}

export function calculateEvaluationMetrics(
  observations: Parameters<typeof calculateBrierScore>[0],
): EvaluationMetrics {
  validateBinaryObservations(observations);
  const meanPredictedProbability = observations.reduce(
    (sum, observation) => sum + observation.predictedProbability,
    0,
  ) / observations.length;
  const observedHomeWinRate = observations.reduce(
    (sum, observation) => sum + observation.observedOutcome,
    0,
  ) / observations.length;

  return {
    sampleSize: observations.length,
    brierScore: calculateBrierScore(observations),
    logLoss: calculateLogLoss(observations),
    accuracy: calculateClassificationAccuracy(observations),
    meanPredictedProbability,
    observedHomeWinRate,
    calibrationBuckets: calculateCalibrationBuckets(observations),
  };
}
