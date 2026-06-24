import type { EvaluationObservation } from "./types.ts";
import { validateBinaryObservations } from "./validation.ts";

export function calculateLogLoss(
  observations: readonly EvaluationObservation[],
): number {
  validateBinaryObservations(observations);

  return observations.reduce((sum, observation) => {
    const probability = Math.min(
      1 - Number.EPSILON,
      Math.max(Number.EPSILON, observation.predictedProbability),
    );
    return sum -
      observation.observedOutcome * Math.log(probability) -
      (1 - observation.observedOutcome) * Math.log(1 - probability);
  }, 0) / observations.length;
}

