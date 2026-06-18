import { resolve } from "node:path";
import { buildTeamRatingsV2 } from "./buildTeamRatingsV2.ts";
import { loadSourceRatings } from "./loadSourceRatings.ts";
import { normalizeAndValidateTeamRatings } from "./validateTeamRatings.ts";
import {
  createGeneratedRatingsMetadata,
  writeGeneratedRatingsArtifacts,
} from "./writeGeneratedRatings.ts";

const SOURCE_FILE = "data/raw/ratings/team-elo-fixture.csv";
const RATINGS_JSON_PATH = "data/generated/team-ratings-v2.json";
const METADATA_JSON_PATH = "data/generated/team-ratings-v2.metadata.json";
const TYPESCRIPT_PATH = "src/data/generated/teamRatingsV2.generated.ts";

async function main(): Promise<void> {
  const rawRecords = await loadSourceRatings(resolve(SOURCE_FILE));
  const normalizedResult = normalizeAndValidateTeamRatings(rawRecords);
  const ratingsByTeamId = buildTeamRatingsV2(normalizedResult.records);
  const metadata = createGeneratedRatingsMetadata({
    sourceFile: SOURCE_FILE,
    sourceDates: normalizedResult.records.map((record) => record.sourceDate),
    teamCount: normalizedResult.records.length,
    warnings: normalizedResult.warnings,
  });

  await writeGeneratedRatingsArtifacts({
    ratingsByTeamId,
    metadata,
    ratingsJsonPath: RATINGS_JSON_PATH,
    metadataJsonPath: METADATA_JSON_PATH,
    typescriptPath: TYPESCRIPT_PATH,
  });

  console.log(
    `Generated fixture ratings for ${metadata.teamCount} teams from ${metadata.sourceFile}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate ratings: ${message}`);
  process.exitCode = 1;
});
