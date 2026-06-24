import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  EvaluationCohortName,
  EvaluationReport,
  EvaluationResult,
} from "./types.ts";
import { EVALUATION_COHORT_NAMES } from "./types.ts";

export const EVALUATION_NUMERIC_PRECISION = 6;
export const EVALUATION_GENERATED_FILE_WARNING = "Do not edit manually." as const;

export interface EvaluationArtifacts {
  summaryJson: string;
  byCohortJson: string;
  metadataJson: string;
}

export function createEvaluationArtifacts(
  report: EvaluationReport,
): EvaluationArtifacts {
  const roundedResults = report.results.map(roundEvaluationResult);
  const byCohort = Object.fromEntries(
    EVALUATION_COHORT_NAMES.map((cohort) => [
      cohort,
      roundedResults.filter((result) => result.cohort === cohort),
    ]),
  ) as Record<EvaluationCohortName, EvaluationResult[]>;

  return {
    summaryJson: toJson({
      generatedFileWarning: EVALUATION_GENERATED_FILE_WARNING,
      evaluationModelVersion: report.metadata.evaluationModelVersion,
      results: roundedResults.map((result) => ({
        cohort: result.cohort,
        split: result.split,
        selectedSampleSize: result.selectedSampleSize,
        scoredSampleSize: result.scoredSampleSize,
        excludedFromBinaryScoring: result.excludedFromBinaryScoring,
        metrics: result.metrics === null ? null : {
          sampleSize: result.metrics.sampleSize,
          brierScore: result.metrics.brierScore,
          logLoss: result.metrics.logLoss,
          accuracy: result.metrics.accuracy,
          meanPredictedProbability: result.metrics.meanPredictedProbability,
          observedHomeWinRate: result.metrics.observedHomeWinRate,
        },
      })),
    }),
    byCohortJson: toJson({
      generatedFileWarning: EVALUATION_GENERATED_FILE_WARNING,
      evaluationModelVersion: report.metadata.evaluationModelVersion,
      byCohort,
    }),
    metadataJson: toJson(roundUnknownNumbers(report.metadata)),
  };
}

export async function writeEvaluationArtifacts(input: {
  artifacts: EvaluationArtifacts;
  summaryPath: string;
  byCohortPath: string;
  metadataPath: string;
}): Promise<void> {
  await Promise.all([
    writeTextFile(input.summaryPath, input.artifacts.summaryJson),
    writeTextFile(input.byCohortPath, input.artifacts.byCohortJson),
    writeTextFile(input.metadataPath, input.artifacts.metadataJson),
  ]);
}

function roundEvaluationResult(result: EvaluationResult): EvaluationResult {
  if (result.metrics === null) {
    return { ...result, metrics: null };
  }

  return {
    ...result,
    metrics: {
      ...result.metrics,
      brierScore: roundEvaluationNumber(result.metrics.brierScore),
      logLoss: roundEvaluationNumber(result.metrics.logLoss),
      accuracy: roundEvaluationNumber(result.metrics.accuracy),
      meanPredictedProbability: roundEvaluationNumber(
        result.metrics.meanPredictedProbability,
      ),
      observedHomeWinRate: roundEvaluationNumber(
        result.metrics.observedHomeWinRate,
      ),
      calibrationBuckets: result.metrics.calibrationBuckets.map((bucket) => ({
        ...bucket,
        lowerBound: roundEvaluationNumber(bucket.lowerBound),
        upperBound: roundEvaluationNumber(bucket.upperBound),
        meanPredictedProbability: roundNullable(bucket.meanPredictedProbability),
        observedHomeWinRate: roundNullable(bucket.observedHomeWinRate),
        absoluteCalibrationError: roundNullable(bucket.absoluteCalibrationError),
      })),
    },
  };
}

export function roundEvaluationNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot serialize a non-finite historical evaluation value.");
  }
  const rounded = Number(value.toFixed(EVALUATION_NUMERIC_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : roundEvaluationNumber(value);
}

function roundUnknownNumbers(value: unknown): unknown {
  if (typeof value === "number") {
    return roundEvaluationNumber(value);
  }
  if (Array.isArray(value)) {
    return value.map(roundUnknownNumbers);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, roundUnknownNumbers(nested)]),
    );
  }
  return value;
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
