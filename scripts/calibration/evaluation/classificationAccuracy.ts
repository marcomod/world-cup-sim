import type { EvaluationObservation } from "./types.ts";
import { validateBinaryObservations } from "./validation.ts";

export const HOME_WIN_CLASSIFICATION_THRESHOLD = 0.5;

export function calculateClassificationAccuracy(
  observations: readonly EvaluationObservation[],
): number {
  validateBinaryObservations(observations);

  const correct = observations.filter((observation) => {
    // Exact 0.5 is classified as a home win for deterministic threshold behavior.
    const predictedOutcome = observation.predictedProbability >=
      HOME_WIN_CLASSIFICATION_THRESHOLD ? 1 : 0;
    return predictedOutcome === observation.observedOutcome;
  }).length;

  return correct / observations.length;
}

