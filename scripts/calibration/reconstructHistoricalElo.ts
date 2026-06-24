import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  loadValidatedHistoricalDataset,
} from "../historical-pipeline/validateHistoricalDataset.ts";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  createHistoricalEloArtifacts,
  createHistoricalEloGeneratedMetadata,
  reconstructHistoricalElo,
  writeHistoricalEloArtifacts,
} from "./sequential-elo/index.ts";

const OUTPUT_DIRECTORY = "data/generated/calibration/historical-elo";
const OBSERVATIONS_PATH = `${OUTPUT_DIRECTORY}/observations.json`;
const FINAL_RATINGS_PATH = `${OUTPUT_DIRECTORY}/final-ratings.json`;
const METADATA_PATH = `${OUTPUT_DIRECTORY}/metadata.json`;

export async function generateHistoricalEloArtifacts(): Promise<{
  matchCount: number;
  teamCount: number;
  firstDate: string | null;
  lastDate: string | null;
  multiMatchDateCount: number;
  matchesOnMultiMatchDates: number;
}> {
  const validatedDataset = await loadValidatedHistoricalDataset();
  const result = reconstructHistoricalElo(
    validatedDataset.normalizedMatches,
    { ...BASELINE_SEQUENTIAL_ELO_CONFIG },
  );
  const metadata = createHistoricalEloGeneratedMetadata({
    result,
    sourceFile: EXPECTED_KAGGLE_MATCH_FILE,
    sourceChecksumSha256: validatedDataset.summary.checksum,
  });
  const artifacts = createHistoricalEloArtifacts({ result, metadata });

  await writeHistoricalEloArtifacts({
    artifacts,
    observationsPath: OBSERVATIONS_PATH,
    finalRatingsPath: FINAL_RATINGS_PATH,
    metadataPath: METADATA_PATH,
  });

  return {
    matchCount: result.metadata.matchCount,
    teamCount: result.metadata.teamCount,
    firstDate: result.metadata.firstDate,
    lastDate: result.metadata.lastDate,
    multiMatchDateCount: result.metadata.multiMatchDateCount,
    matchesOnMultiMatchDates: result.metadata.matchesOnMultiMatchDates,
  };
}

async function main(): Promise<void> {
  const summary = await generateHistoricalEloArtifacts();

  console.log(
    `Historical Elo reconstruction complete: ${summary.matchCount} observations across ${summary.teamCount} team identities.`,
  );
  console.log(`Date range: ${summary.firstDate ?? "none"} to ${summary.lastDate ?? "none"}.`);
  console.log(
    `Same-day fallback: ${summary.multiMatchDateCount} dates containing ${summary.matchesOnMultiMatchDates} matches.`,
  );
  console.log(`Artifacts: ${OBSERVATIONS_PATH}, ${FINAL_RATINGS_PATH}, ${METADATA_PATH}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical Elo reconstruction failed: ${message}`);
    process.exitCode = 1;
  });
}
