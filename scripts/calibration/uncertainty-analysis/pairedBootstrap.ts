import {
  createStableSeed,
  FROZEN_UNCERTAINTY_PROTOCOL,
} from "./frozenUncertaintyProtocol.ts";
import {
  calculateMeanDelta,
  getMetricDelta,
} from "./pairedLosses.ts";
import type {
  BootstrapMetricResult,
  PairedLossObservation,
  UncertaintyMetric,
  UncertaintySplit,
} from "./types.ts";
import { compareCodePoints } from "../sequential-elo/compareCodePoints.ts";

export function calculatePairedBootstrap(input: {
  observations: readonly PairedLossObservation[];
  split: UncertaintySplit;
  metric: UncertaintyMetric;
}): BootstrapMetricResult {
  const observations = [...input.observations].sort((left, right) =>
    compareCodePoints(left.matchId, right.matchId)
  );
  if (observations.length === 0) {
    throw new Error(`Cannot bootstrap empty ${input.split}/${input.metric} observations.`);
  }

  const deltas = observations.map((observation) => getMetricDelta(observation, input.metric));
  const replicationCount = FROZEN_UNCERTAINTY_PROTOCOL.bootstrapReplications;
  const replicationMeans = new Array<number>(replicationCount);
  const rng = createSeededRng(createStableSeed(
    `${FROZEN_UNCERTAINTY_PROTOCOL.seed}:${input.split}:${input.metric}`,
  ));

  let bootstrapSum = 0;
  let favorSelected = 0;
  let favorReference = 0;
  let equal = 0;

  for (let replication = 0; replication < replicationCount; replication += 1) {
    let sum = 0;
    for (let sampleIndex = 0; sampleIndex < deltas.length; sampleIndex += 1) {
      const index = Math.floor(rng() * deltas.length);
      sum += deltas[index];
    }
    const mean = sum / deltas.length;
    replicationMeans[replication] = mean;
    bootstrapSum += mean;
    if (mean < 0) {
      favorSelected += 1;
    } else if (mean > 0) {
      favorReference += 1;
    } else {
      equal += 1;
    }
  }

  const sorted = [...replicationMeans].sort((left, right) => left - right);
  const alpha = 1 - FROZEN_UNCERTAINTY_PROTOCOL.confidenceLevel;

  return {
    split: input.split,
    metric: input.metric,
    sampleSize: observations.length,
    observedMeanDelta: calculateMeanDelta(observations, input.metric),
    observedTotalLossDifference: deltas.reduce((sum, delta) => sum + delta, 0),
    bootstrapMeanDelta: bootstrapSum / replicationCount,
    bootstrapMedianDelta: quantileSorted(sorted, 0.5),
    confidenceLevel: FROZEN_UNCERTAINTY_PROTOCOL.confidenceLevel,
    lowerBound: quantileSorted(sorted, alpha / 2),
    upperBound: quantileSorted(sorted, 1 - alpha / 2),
    proportionFavoringSelected: favorSelected / replicationCount,
    proportionFavoringReference: favorReference / replicationCount,
    proportionEqual: equal / replicationCount,
    replicationCount: FROZEN_UNCERTAINTY_PROTOCOL.bootstrapReplications,
    seed: FROZEN_UNCERTAINTY_PROTOCOL.seed,
    method: FROZEN_UNCERTAINTY_PROTOCOL.bootstrapMethod,
    deltaDirection: FROZEN_UNCERTAINTY_PROTOCOL.deltaDirection,
  };
}

export function quantileSorted(sortedValues: readonly number[], probability: number): number {
  if (sortedValues.length === 0) {
    throw new Error("Cannot calculate a quantile for an empty array.");
  }
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error(`Invalid quantile probability "${probability}".`);
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
