import {
  calculateEvaluationMetrics,
  selectEvaluationCohort,
} from "../evaluation/index.ts";
import type { HistoricalPredictionObservation } from "../sequential-elo/types.ts";
import type {
  DivisorCandidate,
  DivisorCandidateMetrics,
  DivisorCandidateReconstruction,
  DivisorComparisonCohort,
  DivisorComparisonSplit,
} from "./types.ts";

const SUPPORTING_COHORTS = [
  "decisive_only",
  "all_matches",
  "knockout_only",
] as const satisfies readonly DivisorComparisonCohort[];
const COMPARISON_SPLITS = [
  "development",
  "validation",
] as const satisfies readonly DivisorComparisonSplit[];

export function evaluateDivisorCandidate(
  reconstruction: DivisorCandidateReconstruction,
): DivisorCandidate {
  const development = evaluateCohortSplit(
    reconstruction.result.observations,
    "knockout_decisive_only",
    "development",
  );
  const validation = evaluateCohortSplit(
    reconstruction.result.observations,
    "knockout_decisive_only",
    "validation",
  );
  const supportingDiagnostics = SUPPORTING_COHORTS.flatMap((cohort) =>
    COMPARISON_SPLITS.map((split) => ({
      cohort,
      split,
      ...evaluateCohortSplit(reconstruction.result.observations, cohort, split),
    })),
  );

  return {
    divisor: reconstruction.divisor,
    reconstructionConfig: { ...reconstruction.config },
    reconstruction: { ...reconstruction.summary },
    development,
    validation,
    supportingDiagnostics,
  };
}

function evaluateCohortSplit(
  observations: readonly HistoricalPredictionObservation[],
  cohort: DivisorComparisonCohort,
  split: DivisorComparisonSplit,
): DivisorCandidateMetrics {
  const selection = selectEvaluationCohort({ observations, cohort, split });
  const metrics = selection.scoredObservations.length === 0
    ? null
    : calculateEvaluationMetrics(selection.scoredObservations);

  return {
    selectedSampleSize: selection.selectedObservations.length,
    scoredSampleSize: selection.scoredObservations.length,
    brierScore: metrics?.brierScore ?? null,
    logLoss: metrics?.logLoss ?? null,
    accuracy: metrics?.accuracy ?? null,
    meanPredictedProbability: metrics?.meanPredictedProbability ?? null,
    observedHomeWinRate: metrics?.observedHomeWinRate ?? null,
  };
}
