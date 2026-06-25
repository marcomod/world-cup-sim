import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidatedHistoricalDataset } from "../historical-pipeline/validateHistoricalDataset.ts";
import {
  compareHoldoutCandidates,
  createHoldoutEvaluationArtifacts,
  writeHoldoutEvaluationArtifacts,
  type HoldoutEvaluationResult,
} from "./holdout-evaluation/index.ts";

const OUTPUT_DIRECTORY = "data/generated/calibration/holdout-evaluation";
const DIVISOR_COMPARISON_DIRECTORY =
  "data/generated/calibration/divisor-comparison";

export const HOLDOUT_EVALUATION_RESULT_PATH = `${OUTPUT_DIRECTORY}/result.json`;
export const HOLDOUT_EVALUATION_BY_COHORT_PATH = `${OUTPUT_DIRECTORY}/by-cohort.json`;
export const HOLDOUT_EVALUATION_METADATA_PATH = `${OUTPUT_DIRECTORY}/metadata.json`;
export const DIVISOR_COMPARISON_RANKING_PATH =
  `${DIVISOR_COMPARISON_DIRECTORY}/ranking.json`;
export const DIVISOR_COMPARISON_METADATA_PATH =
  `${DIVISOR_COMPARISON_DIRECTORY}/metadata.json`;

export async function generateHistoricalEloHoldoutEvaluation(): Promise<
  HoldoutEvaluationResult
> {
  const [validatedDataset, rankingJson, metadataJson] = await Promise.all([
    loadValidatedHistoricalDataset(),
    readFile(DIVISOR_COMPARISON_RANKING_PATH, "utf8"),
    readFile(DIVISOR_COMPARISON_METADATA_PATH, "utf8"),
  ]);
  const result = compareHoldoutCandidates({
    normalizedMatches: validatedDataset.normalizedMatches,
    sourceChecksumSha256: validatedDataset.summary.checksum,
    sealedDivisorComparison: {
      rankingJson,
      metadataJson,
    },
  });
  const artifacts = createHoldoutEvaluationArtifacts(result);

  await writeHoldoutEvaluationArtifacts({
    artifacts,
    resultPath: HOLDOUT_EVALUATION_RESULT_PATH,
    byCohortPath: HOLDOUT_EVALUATION_BY_COHORT_PATH,
    metadataPath: HOLDOUT_EVALUATION_METADATA_PATH,
  });

  return result;
}

function printHoldoutEvaluation(result: HoldoutEvaluationResult): void {
  const comparison = result.primaryComparison;

  console.log("Historical Elo 2022 holdout evaluation complete.");
  console.log(
    `Frozen protocol: selected divisor ${comparison.selectedDivisor}; reference divisor ${comparison.referenceDivisor}; cohort ${comparison.cohort}; metric Brier score.`,
  );
  console.log(
    `Primary holdout sample: ${comparison.selectedSampleSize} selected/${comparison.scoredSampleSize} scored.`,
  );
  console.log([
    "Divisor",
    "Brier",
    "Log Loss",
    "Accuracy",
    "Mean Prediction",
    "Observed Home Win Rate",
  ].join(" | "));
  console.log(formatMetricRow(comparison.selectedDivisor, comparison.selected));
  console.log(formatMetricRow(comparison.referenceDivisor, comparison.reference));
  console.log(
    `Deltas selected-reference: Brier ${comparison.deltas.brierScore.toFixed(6)} (${comparison.deltaDirection.brierScore}); log loss ${comparison.deltas.logLoss.toFixed(6)} (${comparison.deltaDirection.logLoss}).`,
  );
  console.log(
    `Conclusion: ${result.decisionSummary.conclusion}. ${result.decisionSummary.note}`,
  );
  console.log(
    `Artifacts: ${HOLDOUT_EVALUATION_RESULT_PATH}, ${HOLDOUT_EVALUATION_BY_COHORT_PATH}, ${HOLDOUT_EVALUATION_METADATA_PATH}.`,
  );
}

function formatMetricRow(
  divisor: number,
  metrics: HoldoutEvaluationResult["primaryComparison"]["selected"],
): string {
  return [
    String(divisor),
    metrics.brierScore.toFixed(6),
    metrics.logLoss.toFixed(6),
    metrics.accuracy.toFixed(6),
    metrics.meanPredictedProbability.toFixed(6),
    metrics.observedHomeWinRate.toFixed(6),
  ].join(" | ");
}

async function main(): Promise<void> {
  printHoldoutEvaluation(await generateHistoricalEloHoldoutEvaluation());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical Elo holdout evaluation failed: ${message}`);
    process.exitCode = 1;
  });
}
