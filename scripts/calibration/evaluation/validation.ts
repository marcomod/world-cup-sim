import type { EvaluationObservation } from "./types.ts";

export function validateBinaryObservations(
  observations: readonly EvaluationObservation[],
  options: { allowEmpty?: boolean } = {},
): void {
  if (observations.length === 0 && !options.allowEmpty) {
    throw new Error("Binary evaluation requires at least one scored observation.");
  }

  const matchIds = new Set<string>();

  for (const observation of observations) {
    if (typeof observation.matchId !== "string" || !observation.matchId.trim()) {
      throw new Error("Evaluation observation has an invalid matchId.");
    }
    if (matchIds.has(observation.matchId)) {
      throw new Error(`Duplicate evaluation observation ID "${observation.matchId}".`);
    }
    matchIds.add(observation.matchId);

    if (
      !Number.isFinite(observation.predictedProbability) ||
      observation.predictedProbability < 0 ||
      observation.predictedProbability > 1
    ) {
      throw new Error(
        `Evaluation observation "${observation.matchId}" has invalid predictedProbability.`,
      );
    }

    if (observation.observedOutcome !== 0 && observation.observedOutcome !== 1) {
      throw new Error(
        `Evaluation observation "${observation.matchId}" must have a binary observedOutcome.`,
      );
    }
  }
}

