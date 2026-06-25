import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadValidatedHistoricalDataset } from "../historical-pipeline/validateHistoricalDataset.ts";
import {
  compareHistoricalEloDivisors,
  createDivisorComparisonArtifacts,
  writeDivisorComparisonArtifacts,
  type DivisorComparisonResult,
} from "./divisor-comparison/index.ts";

const OUTPUT_DIRECTORY = "data/generated/calibration/divisor-comparison";
export const DIVISOR_COMPARISON_RANKING_PATH = `${OUTPUT_DIRECTORY}/ranking.json`;
export const DIVISOR_COMPARISON_CANDIDATES_PATH = `${OUTPUT_DIRECTORY}/candidates.json`;
export const DIVISOR_COMPARISON_METADATA_PATH = `${OUTPUT_DIRECTORY}/metadata.json`;

export async function generateHistoricalEloDivisorComparison(): Promise<
  DivisorComparisonResult
> {
  const validatedDataset = await loadValidatedHistoricalDataset();
  const result = compareHistoricalEloDivisors({
    normalizedMatches: validatedDataset.normalizedMatches,
    sourceChecksumSha256: validatedDataset.summary.checksum,
  });
  const artifacts = createDivisorComparisonArtifacts(result);

  await writeDivisorComparisonArtifacts({
    artifacts,
    rankingPath: DIVISOR_COMPARISON_RANKING_PATH,
    candidatesPath: DIVISOR_COMPARISON_CANDIDATES_PATH,
    metadataPath: DIVISOR_COMPARISON_METADATA_PATH,
  });

  return result;
}

function printComparison(result: DivisorComparisonResult): void {
  console.log(
    "Divisor | Validation Brier | Validation Log Loss | Development Brier | Development Log Loss | Delta Brier vs 400 | Rank",
  );
  for (const entry of result.ranking) {
    console.log([
      String(entry.divisor).padStart(7),
      formatMetric(entry.validation.brierScore).padStart(16),
      formatMetric(entry.validation.logLoss).padStart(19),
      formatMetric(entry.development.brierScore).padStart(17),
      formatMetric(entry.development.logLoss).padStart(20),
      formatMetric(entry.deltaFromCurrentDivisor.validationBrierScore).padStart(18),
      String(entry.rank).padStart(4),
    ].join(" | "));
  }

  const primary = result.ranking[0];
  console.log(`Primary cohort: ${result.metadata.selectionProtocol.primaryCohort}.`);
  console.log(
    `Primary samples: development ${primary.development.selectedSampleSize} selected/${primary.development.scoredSampleSize} scored; validation ${primary.validation.selectedSampleSize} selected/${primary.validation.scoredSampleSize} scored.`,
  );
  console.log(
    `Provisional selected divisor: ${result.selectionDecision.provisionalSelectedDivisor}.`,
  );
  console.log("Selection uses development and validation only; 2022 holdout remains unopened.");
  console.log("Production divisor remains 400; no production change was applied.");
  console.log(
    `Artifacts: ${DIVISOR_COMPARISON_RANKING_PATH}, ${DIVISOR_COMPARISON_CANDIDATES_PATH}, ${DIVISOR_COMPARISON_METADATA_PATH}.`,
  );
}

function formatMetric(value: number | null): string {
  return value === null ? "null" : value.toFixed(6);
}

async function main(): Promise<void> {
  printComparison(await generateHistoricalEloDivisorComparison());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical Elo divisor comparison failed: ${message}`);
    process.exitCode = 1;
  });
}
