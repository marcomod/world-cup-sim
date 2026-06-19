import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mockTeams } from "../../src/data/mockTeams.ts";
import { tournamentTeams } from "../../src/data/tournamentTeams.ts";
import type { Team, TeamId, TeamRatingV2 } from "../../src/lib/simulator/types.ts";
import { buildTeamRatingsV2 } from "./buildTeamRatingsV2.ts";
import { loadSourceRatings } from "./loadSourceRatings.ts";
import {
  assertValidRatingsSourceConfig,
  getRatingsSourceConfig,
  parseRatingsSourceSelection,
  type RatingsSourceConfig,
} from "./sourceConfig.ts";
import { teamAliasEntries, tournamentTeamAliasEntries } from "./teamAliases.ts";
import { normalizeAndValidateTeamRatings } from "./validateTeamRatings.ts";
import {
  createGeneratedRatingsMetadata,
  createGeneratedRatingsArtifacts,
  type GeneratedRatingsArtifacts,
  type GeneratedRatingsMetadata,
  writeGeneratedRatingsArtifacts,
} from "./writeGeneratedRatings.ts";

const RATINGS_JSON_PATH = "data/generated/team-ratings-v2.json";
const METADATA_JSON_PATH = "data/generated/team-ratings-v2.metadata.json";
const TYPESCRIPT_PATH = "src/data/generated/teamRatingsV2.generated.ts";

interface RatingsGenerationScope {
  teams: Team[];
  aliasEntries: typeof teamAliasEntries;
  expectedTeamCount: number;
}

export interface RatingsGenerationResult {
  metadata: GeneratedRatingsMetadata;
  artifacts: GeneratedRatingsArtifacts;
  ratingsByTeamId: Record<TeamId, TeamRatingV2>;
}

async function main(): Promise<void> {
  const sourceId = parseRatingsSourceSelection(process.argv.slice(2));
  const sourceConfig = getRatingsSourceConfig(sourceId);
  const result = await createRatingsGenerationResult(sourceConfig);

  await writeGeneratedRatingsArtifacts({
    ratingsByTeamId: result.ratingsByTeamId,
    metadata: result.metadata,
    ratingsJsonPath: sourceConfig.ratingsJsonPath ?? RATINGS_JSON_PATH,
    metadataJsonPath: sourceConfig.metadataJsonPath ?? METADATA_JSON_PATH,
    typescriptPath: sourceConfig.typescriptPath ?? TYPESCRIPT_PATH,
    generatedExportName: sourceConfig.generatedExportName,
    generatedFileDescription: sourceConfig.generatedFileDescription,
    teams: getRatingsGenerationScope(sourceConfig).teams,
  });

  console.log(
    `Generated ${sourceConfig.sourceId} ratings for ${result.metadata.teamCount} teams from ${result.metadata.sourceFile}.`,
  );
}

export async function createRatingsGenerationResult(
  sourceConfig: RatingsSourceConfig,
): Promise<RatingsGenerationResult> {
  await assertSourceIsReady(sourceConfig);

  const scope = getRatingsGenerationScope(sourceConfig);
  const rawRecords = await loadSourceRatings(resolve(sourceConfig.sourceFile));
  const normalizedResult = normalizeAndValidateTeamRatings(rawRecords, {
    teams: scope.teams,
    aliasEntries: scope.aliasEntries,
  });
  const ratingsByTeamId = buildTeamRatingsV2(normalizedResult.records, {
    teams: scope.teams,
    expectedTeamCount: scope.expectedTeamCount,
  });
  const metadata = createGeneratedRatingsMetadata({
    sourceConfig,
    sourceDates: normalizedResult.records.map((record) => record.sourceDate),
    teamCount: normalizedResult.records.length,
    warnings: normalizedResult.warnings,
  });
  const artifacts = createGeneratedRatingsArtifacts(ratingsByTeamId, metadata, {
    generatedExportName: sourceConfig.generatedExportName,
    generatedFileDescription: sourceConfig.generatedFileDescription,
    teams: scope.teams,
  });

  return {
    metadata,
    artifacts,
    ratingsByTeamId,
  };
}

function getRatingsGenerationScope(sourceConfig: RatingsSourceConfig): RatingsGenerationScope {
  if (sourceConfig.sourceId === "world-football-elo-development") {
    return {
      teams: tournamentTeams,
      aliasEntries: tournamentTeamAliasEntries,
      expectedTeamCount: sourceConfig.expectedTeamCount ?? 48,
    };
  }

  return {
    teams: mockTeams,
    aliasEntries: teamAliasEntries,
    expectedTeamCount: sourceConfig.expectedTeamCount ?? 32,
  };
}

async function assertSourceIsReady(sourceConfig: RatingsSourceConfig): Promise<void> {
  const errors: string[] = [];

  try {
    assertValidRatingsSourceConfig(sourceConfig);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    await access(resolve(sourceConfig.sourceFile));
  } catch {
    errors.push(`source file not found: ${sourceConfig.sourceFile}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate ratings: ${message}`);
    process.exitCode = 1;
  });
}
