import type { EvaluationObservation } from "./types.ts";
import { validateBinaryObservations } from "./validation.ts";

export function calculateBrierScore(
  observations: readonly EvaluationObservation[],
): number {
  validateBinaryObservations(observations);

  return observations.reduce((sum, observation) => {
    const error = observation.predictedProbability - observation.observedOutcome;
    return sum + error ** 2;
  }, 0) / observations.length;
}

