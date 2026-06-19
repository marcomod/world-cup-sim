export type RatingsSourceId = "fixture" | "world-football-elo-development";

export interface RatingsSourceConfig {
  sourceId: RatingsSourceId;
  sourceFile: string;
  fixture: boolean;
  developmentSnapshot?: boolean;
  refreshRequiredAfterGroupStage?: boolean;
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
  expectedTeamCount?: number;
  ratingsJsonPath?: string;
  metadataJsonPath?: string;
  typescriptPath?: string;
  generatedExportName?: string;
  generatedFileDescription?: string;
}

const SOURCE_IDS: RatingsSourceId[] = ["fixture", "world-football-elo-development"];

const REQUIRED_PROVENANCE_FIELDS = [
  "sourceName",
  "sourceUrl",
  "accessDate",
  "snapshotDate",
  "license",
  "attribution",
  "redistributionStatus",
  "transformationNotes",
] as const satisfies readonly (keyof RatingsSourceConfig)[];

export const fixtureRatingsSourceConfig: RatingsSourceConfig = {
  sourceId: "fixture",
  sourceFile: "data/raw/ratings/team-elo-fixture.csv",
  fixture: true,
  sourceName: "Synthetic ratings pipeline fixture",
  sourceUrl: "local synthetic fixture",
  accessDate: "2026-06-17",
  snapshotDate: "2026-06-01",
  license: "Repository-owned synthetic fixture data",
  attribution: "World Cup Simulator synthetic fixture",
  redistributionStatus: "Allowed; synthetic fixture data only",
  transformationNotes:
    "Synthetic source Elo values are converted into TeamRatingV2 compatibility proxy fields.",
  expectedTeamCount: 32,
  ratingsJsonPath: "data/generated/team-ratings-v2.json",
  metadataJsonPath: "data/generated/team-ratings-v2.metadata.json",
  typescriptPath: "src/data/generated/teamRatingsV2.generated.ts",
  generatedExportName: "teamRatingsV2GeneratedByTeamId",
  generatedFileDescription: "Synthetic fixture data only; not real Elo data.",
};

export const worldFootballEloDevelopmentSourceConfig: RatingsSourceConfig = {
  sourceId: "world-football-elo-development",
  sourceFile: "data/raw/ratings/world-football-elo-development.csv",
  fixture: false,
  developmentSnapshot: true,
  refreshRequiredAfterGroupStage: true,
  sourceName: "World Football Elo Ratings",
  sourceUrl: "https://eloratings.net/",
  accessDate: "2026-06-18",
  httpLastModified: "Fri, 19 Jun 2026 00:13:16 GMT",
  httpLastModifiedLocal: "2026-06-18T20:13:16-04:00",
  snapshotDate: "2026-06-18",
  sourceDeclaredSnapshotDate: null,
  sourceDateBasis:
    "The World.tsv snapshot did not declare a distinct ratings date. The project frozen snapshot label 2026-06-18 is based on the local retrieval date and HTTP Last-Modified metadata, not an official source-declared ratings date inside the dataset.",
  license: "Private personal project; review eloratings.net terms before public redistribution.",
  licenseOrTermsStatus:
    "Private personal project; review eloratings.net terms before public redistribution.",
  attribution: "World Football Elo Ratings (eloratings.net)",
  redistributionStatus: "Development snapshot for private personal project; not approved for redistribution.",
  transformationNotes:
    "Source Elo values from one World.tsv snapshot are preserved as overall ratings; sourceDate values use the project frozen snapshot label; attack, defense, recentForm, and squadStrength are Elo-derived compatibility proxies.",
  expectedTeamCount: 48,
  ratingsJsonPath: "data/generated/world-football-elo-development/team-ratings-v2.json",
  metadataJsonPath:
    "data/generated/world-football-elo-development/team-ratings-v2.metadata.json",
  typescriptPath: "src/data/generated/worldFootballEloDevelopment.generated.ts",
  generatedExportName: "worldFootballEloDevelopmentByTeamId",
  generatedFileDescription:
    "World Football Elo Ratings development snapshot; refresh after group stage before final knockout use.",
};

export function parseRatingsSourceSelection(args: string[]): RatingsSourceId {
  if (args.length === 0) {
    return "fixture";
  }

  const [firstArg, secondArg, ...extraArgs] = args;

  if (extraArgs.length > 0) {
    throw new Error(
      `Unsupported ratings generator arguments: ${args.join(" ")}. Use --source fixture or --source world-football-elo-development.`,
    );
  }

  if (firstArg === "--source") {
    if (!secondArg) {
      throw new Error(
        "Missing value for --source. Use --source fixture or --source world-football-elo-development.",
      );
    }

    return parseRatingsSourceId(secondArg);
  }

  if (firstArg.startsWith("--source=")) {
    if (secondArg) {
      throw new Error(
        `Unsupported ratings generator arguments: ${args.join(" ")}. Use --source fixture or --source world-football-elo-development.`,
      );
    }

    return parseRatingsSourceId(firstArg.slice("--source=".length));
  }

  throw new Error(
    `Unsupported ratings generator argument "${firstArg}". Use --source fixture or --source world-football-elo-development.`,
  );
}

export function getRatingsSourceConfig(sourceId: RatingsSourceId): RatingsSourceConfig {
  if (sourceId === "fixture") {
    return fixtureRatingsSourceConfig;
  }

  if (sourceId === "world-football-elo-development") {
    return worldFootballEloDevelopmentSourceConfig;
  }

  throw new Error(
    `Unknown ratings source "${sourceId}". Use --source fixture or --source world-football-elo-development.`,
  );
}

export function assertValidRatingsSourceConfig(config: RatingsSourceConfig): void {
  const errors = collectRatingsSourceConfigErrors(config);

  if (errors.length > 0) {
    throw new Error(
      `Invalid ratings source configuration "${config.sourceId}": ${errors.join("; ")}.`,
    );
  }
}

export function collectRatingsSourceConfigErrors(config: RatingsSourceConfig): string[] {
  const errors: string[] = [];

  if (!SOURCE_IDS.includes(config.sourceId)) {
    errors.push(`unknown sourceId "${config.sourceId}"`);
  }

  if (!config.sourceFile.trim()) {
    errors.push("missing sourceFile");
  }

  if (config.sourceId === "fixture" && config.fixture !== true) {
    errors.push("fixture source must use fixture: true");
  }

  if (config.sourceId === "world-football-elo-development" && config.fixture !== false) {
    errors.push("world-football-elo-development source must use fixture: false");
  }

  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    if (!String(config[field]).trim()) {
      errors.push(`missing ${field}`);
    }
  }

  return errors;
}

function parseRatingsSourceId(value: string): RatingsSourceId {
  if (value === "real") {
    throw new Error(
      'Generic ratings source "real" is not configured. Use --source world-football-elo-development for the approved development source.',
    );
  }

  if (value === "fixture" || value === "world-football-elo-development") {
    return value;
  }

  throw new Error(
    `Unknown ratings source "${value}". Use --source fixture or --source world-football-elo-development.`,
  );
}
