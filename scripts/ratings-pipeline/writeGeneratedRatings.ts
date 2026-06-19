import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mockTeams } from "../../src/data/mockTeams.ts";
import type { Team, TeamId, TeamRatingV2 } from "../../src/lib/simulator/types.ts";
import type { ValidationWarning } from "./schemas.ts";
import type { RatingsSourceConfig, RatingsSourceId } from "./sourceConfig.ts";

const GENERATED_FILE_WARNING = "Do not edit manually.";

export interface GeneratedRatingsJson {
  generatedFileWarning: typeof GENERATED_FILE_WARNING;
  ratingsByTeamId: Record<TeamId, TeamRatingV2>;
}

export interface GeneratedRatingsMetadata {
  generatedFileWarning: typeof GENERATED_FILE_WARNING;
  modelVersion: "v2";
  sourceId: RatingsSourceId;
  sourceFile: string;
  sourceName: string;
  sourceUrl: string;
  accessDate: string;
  httpLastModified?: string;
  httpLastModifiedLocal?: string;
  sourceDateBasis?: string;
  snapshotDate: string;
  sourceDeclaredSnapshotDate?: string | null;
  license: string;
  licenseOrTermsStatus?: string;
  attribution: string;
  redistributionStatus: string;
  transformationNotes: string;
  sourceDateRange: {
    from: string;
    to: string;
  };
  teamCount: number;
  fixture: boolean;
  developmentSnapshot?: boolean;
  refreshRequiredAfterGroupStage?: boolean;
  warnings: ValidationWarning[];
  generationTimestampPolicy: string;
}

export interface GeneratedRatingsArtifacts {
  ratingsJson: string;
  metadataJson: string;
  typescript: string;
}

export interface WriteGeneratedRatingsOptions {
  ratingsByTeamId: Record<TeamId, TeamRatingV2>;
  metadata: GeneratedRatingsMetadata;
  ratingsJsonPath: string;
  metadataJsonPath: string;
  typescriptPath: string;
  generatedExportName?: string;
  generatedFileDescription?: string;
  teams?: Team[];
}

export async function writeGeneratedRatingsArtifacts(
  options: WriteGeneratedRatingsOptions,
): Promise<void> {
  const artifacts = createGeneratedRatingsArtifacts(
    options.ratingsByTeamId,
    options.metadata,
    {
      generatedExportName: options.generatedExportName,
      generatedFileDescription: options.generatedFileDescription,
      teams: options.teams,
    },
  );

  await Promise.all([
    writeTextFile(options.ratingsJsonPath, artifacts.ratingsJson),
    writeTextFile(options.metadataJsonPath, artifacts.metadataJson),
    writeTextFile(options.typescriptPath, artifacts.typescript),
  ]);
}

export function createGeneratedRatingsArtifacts(
  ratingsByTeamId: Record<TeamId, TeamRatingV2>,
  metadata: GeneratedRatingsMetadata,
  options: {
    generatedExportName?: string;
    generatedFileDescription?: string;
    teams?: Team[];
  } = {},
): GeneratedRatingsArtifacts {
  return {
    ratingsJson: `${JSON.stringify(createGeneratedRatingsJson(ratingsByTeamId, options.teams), null, 2)}\n`,
    metadataJson: `${JSON.stringify(metadata, null, 2)}\n`,
    typescript: createGeneratedRatingsTypeScript(ratingsByTeamId, options),
  };
}

export function createGeneratedRatingsMetadata(options: {
  sourceConfig: RatingsSourceConfig;
  sourceDates: string[];
  teamCount: number;
  warnings: ValidationWarning[];
}): GeneratedRatingsMetadata {
  const sortedSourceDates = [...new Set(options.sourceDates)].sort();

  return {
    generatedFileWarning: GENERATED_FILE_WARNING,
    modelVersion: "v2",
    sourceId: options.sourceConfig.sourceId,
    sourceFile: options.sourceConfig.sourceFile,
    sourceName: options.sourceConfig.sourceName,
    sourceUrl: options.sourceConfig.sourceUrl,
    accessDate: options.sourceConfig.accessDate,
    httpLastModified: options.sourceConfig.httpLastModified,
    httpLastModifiedLocal: options.sourceConfig.httpLastModifiedLocal,
    sourceDateBasis: options.sourceConfig.sourceDateBasis,
    snapshotDate: options.sourceConfig.snapshotDate,
    sourceDeclaredSnapshotDate: options.sourceConfig.sourceDeclaredSnapshotDate,
    license: options.sourceConfig.license,
    licenseOrTermsStatus: options.sourceConfig.licenseOrTermsStatus,
    attribution: options.sourceConfig.attribution,
    redistributionStatus: options.sourceConfig.redistributionStatus,
    transformationNotes: options.sourceConfig.transformationNotes,
    sourceDateRange: {
      from: sortedSourceDates[0] ?? "",
      to: sortedSourceDates[sortedSourceDates.length - 1] ?? "",
    },
    teamCount: options.teamCount,
    fixture: options.sourceConfig.fixture,
    developmentSnapshot: options.sourceConfig.developmentSnapshot,
    refreshRequiredAfterGroupStage: options.sourceConfig.refreshRequiredAfterGroupStage,
    warnings: options.warnings,
    generationTimestampPolicy:
      "No wall-clock timestamp is written; generated artifacts are deterministic for identical inputs.",
  };
}

function createGeneratedRatingsJson(
  ratingsByTeamId: Record<TeamId, TeamRatingV2>,
  teams: Team[] = mockTeams,
): GeneratedRatingsJson {
  return {
    generatedFileWarning: GENERATED_FILE_WARNING,
    ratingsByTeamId: orderRatingsByTeams(ratingsByTeamId, teams),
  };
}

function createGeneratedRatingsTypeScript(
  ratingsByTeamId: Record<TeamId, TeamRatingV2>,
  options: {
    generatedExportName?: string;
    generatedFileDescription?: string;
    teams?: Team[];
  },
): string {
  const ratingsJson = JSON.stringify(
    orderRatingsByTeams(ratingsByTeamId, options.teams ?? mockTeams),
    null,
    2,
  );
  const exportName = options.generatedExportName ?? "teamRatingsV2GeneratedByTeamId";
  const fileDescription =
    options.generatedFileDescription ?? "Synthetic fixture data only; not real Elo data.";

  return `import type { TeamId, TeamRatingV2 } from "@/src/lib/simulator/types";

// Generated by npm run ratings:generate.
// Do not edit manually.
// ${fileDescription}
// Elo-derived attack/defense/recentForm/squadStrength values are compatibility proxies, not independent measurements.
export const ${exportName}: Record<TeamId, TeamRatingV2> = ${ratingsJson};
`;
}

function orderRatingsByTeams(
  ratingsByTeamId: Record<TeamId, TeamRatingV2>,
  teams: Team[],
): Record<TeamId, TeamRatingV2> {
  return Object.fromEntries(
    teams.map((team) => {
      const rating = ratingsByTeamId[team.id];

      if (!rating) {
        throw new Error(`Cannot write generated ratings: missing rating for "${team.id}".`);
      }

      return [team.id, rating];
    }),
  );
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
