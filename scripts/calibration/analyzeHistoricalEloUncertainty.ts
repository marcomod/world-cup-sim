import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidatedHistoricalDataset } from "../historical-pipeline/validateHistoricalDataset.ts";
import {
  analyzeHistoricalEloUncertainty,
  createUncertaintyAnalysisArtifacts,
  writeUncertaintyAnalysisArtifacts,
  type UncertaintyAnalysisResult,
} from "./uncertainty-analysis/index.ts";

const DIVISOR_COMPARISON_DIRECTORY =
  "data/generated/calibration/divisor-comparison";
const HOLDOUT_EVALUATION_DIRECTORY =
  "data/generated/calibration/holdout-evaluation";
const OUTPUT_DIRECTORY = "data/generated/calibration/uncertainty-analysis";

export const UNCERTAINTY_ANALYSIS_SUMMARY_PATH = `${OUTPUT_DIRECTORY}/summary.json`;
export const UNCERTAINTY_ANALYSIS_BOOTSTRAP_PATH = `${OUTPUT_DIRECTORY}/bootstrap.json`;
export const UNCERTAINTY_ANALYSIS_TOURNAMENT_SENSITIVITY_PATH =
  `${OUTPUT_DIRECTORY}/tournament-sensitivity.json`;
export const UNCERTAINTY_ANALYSIS_METADATA_PATH = `${OUTPUT_DIRECTORY}/metadata.json`;

export async function generateHistoricalEloUncertaintyAnalysis(): Promise<
  UncertaintyAnalysisResult
> {
  const [
    validatedDataset,
    divisorComparisonRankingJson,
    divisorComparisonCandidatesJson,
    divisorComparisonMetadataJson,
    holdoutResultJson,
    holdoutByCohortJson,
    holdoutMetadataJson,
  ] = await Promise.all([
    loadValidatedHistoricalDataset(),
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/ranking.json`, "utf8"),
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/candidates.json`, "utf8"),
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/metadata.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/result.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/by-cohort.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/metadata.json`, "utf8"),
  ]);

  const result = analyzeHistoricalEloUncertainty({
    normalizedMatches: validatedDataset.normalizedMatches,
    sourceChecksumSha256: validatedDataset.summary.checksum,
    artifacts: {
      divisorComparisonRankingJson,
      divisorComparisonCandidatesJson,
      divisorComparisonMetadataJson,
      holdoutResultJson,
      holdoutByCohortJson,
      holdoutMetadataJson,
    },
  });
  const artifacts = createUncertaintyAnalysisArtifacts(result);

  await writeUncertaintyAnalysisArtifacts({
    artifacts,
    summaryPath: UNCERTAINTY_ANALYSIS_SUMMARY_PATH,
    bootstrapPath: UNCERTAINTY_ANALYSIS_BOOTSTRAP_PATH,
    tournamentSensitivityPath: UNCERTAINTY_ANALYSIS_TOURNAMENT_SENSITIVITY_PATH,
    metadataPath: UNCERTAINTY_ANALYSIS_METADATA_PATH,
  });

  return result;
}

function printUncertaintyAnalysis(result: UncertaintyAnalysisResult): void {
  console.log("Historical Elo uncertainty analysis complete.");
  console.log(
    `Frozen comparison: divisor ${result.frozenProtocol.selectedDivisor} vs ${result.frozenProtocol.referenceDivisor}; cohort ${result.frozenProtocol.cohort}; ${result.frozenProtocol.bootstrapReplications.toLocaleString("en-US")} paired bootstrap replications.`,
  );
  console.log(
    "Split | Metric | N | Observed Δ | 95% lower | 95% upper | Bootstrap favors 200",
  );
  for (const split of result.splitResults) {
    console.log(formatMetricRow(split.split, split.brierScore));
    console.log(formatMetricRow(split.split, split.logLoss));
  }
  console.log(
    `Validation tournaments favoring divisor 200 by Brier: ${result.tournamentSensitivity.validationByTournament.filter((entry) => entry.favors.brierScore === "selected").length}/${result.tournamentSensitivity.validationByTournament.length}.`,
  );
  console.log(
    `Evidence classification: ${result.evidenceClassification}; decision: ${result.productionDecision.decision}.`,
  );
  console.log(
    "Production remains divisor 400. Divisor 200 remains a leading research candidate only.",
  );
  console.log(
    `Artifacts: ${UNCERTAINTY_ANALYSIS_SUMMARY_PATH}, ${UNCERTAINTY_ANALYSIS_BOOTSTRAP_PATH}, ${UNCERTAINTY_ANALYSIS_TOURNAMENT_SENSITIVITY_PATH}, ${UNCERTAINTY_ANALYSIS_METADATA_PATH}.`,
  );
}

function formatMetricRow(
  split: string,
  metric: UncertaintyAnalysisResult["splitResults"][number]["brierScore"],
): string {
  return [
    split,
    metric.metric,
    String(metric.sampleSize),
    metric.observedMeanDelta.toFixed(6),
    metric.lowerBound.toFixed(6),
    metric.upperBound.toFixed(6),
    metric.proportionFavoringSelected.toFixed(6),
  ].join(" | ");
}

async function main(): Promise<void> {
  printUncertaintyAnalysis(await generateHistoricalEloUncertaintyAnalysis());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical Elo uncertainty analysis failed: ${message}`);
    process.exitCode = 1;
  });
}
