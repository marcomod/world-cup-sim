import type {
  CalibrationBucket,
  EvaluationObservation,
} from "./types.ts";
import { validateBinaryObservations } from "./validation.ts";

const BUCKET_COUNT = 10;

export function calculateCalibrationBuckets(
  observations: readonly EvaluationObservation[],
): CalibrationBucket[] {
  validateBinaryObservations(observations);
  const observationsByBucket = Array.from(
    { length: BUCKET_COUNT },
    (): EvaluationObservation[] => [],
  );

  for (const observation of observations) {
    const bucketIndex = Math.min(
      BUCKET_COUNT - 1,
      Math.floor(observation.predictedProbability * BUCKET_COUNT),
    );
    observationsByBucket[bucketIndex].push(observation);
  }

  return observationsByBucket.map((bucketObservations, index) => {
    const lowerBound = index / BUCKET_COUNT;
    const upperBound = (index + 1) / BUCKET_COUNT;

    if (bucketObservations.length === 0) {
      return {
        lowerBound,
        upperBound,
        includesUpperBound: index === BUCKET_COUNT - 1,
        sampleSize: 0,
        meanPredictedProbability: null,
        observedHomeWinRate: null,
        absoluteCalibrationError: null,
      };
    }

    const meanPredictedProbability = mean(
      bucketObservations.map((observation) => observation.predictedProbability),
    );
    const observedHomeWinRate = mean(
      bucketObservations.map((observation) => observation.observedOutcome),
    );

    return {
      lowerBound,
      upperBound,
      includesUpperBound: index === BUCKET_COUNT - 1,
      sampleSize: bucketObservations.length,
      meanPredictedProbability,
      observedHomeWinRate,
      absoluteCalibrationError: Math.abs(
        meanPredictedProbability - observedHomeWinRate,
      ),
    };
  });
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

