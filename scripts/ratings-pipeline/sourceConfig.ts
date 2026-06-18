export type RatingsSourceId = "fixture" | "real";

export interface RatingsSourceConfig {
  sourceId: RatingsSourceId;
  sourceFile: string;
  fixture: boolean;
  sourceName: string;
  sourceUrl: string;
  accessDate: string;
  snapshotDate: string;
  license: string;
  attribution: string;
  redistributionStatus: string;
  transformationNotes: string;
}

const SOURCE_IDS: RatingsSourceId[] = ["fixture", "real"];

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
};

export const realRatingsSourceConfig: RatingsSourceConfig = {
  sourceId: "real",
  sourceFile: "data/raw/ratings/team-elo-approved.csv",
  fixture: false,
  sourceName: "",
  sourceUrl: "",
  accessDate: "",
  snapshotDate: "",
  license: "",
  attribution: "",
  redistributionStatus: "",
  transformationNotes: "",
};

export function parseRatingsSourceSelection(args: string[]): RatingsSourceId {
  if (args.length === 0) {
    return "fixture";
  }

  const [firstArg, secondArg, ...extraArgs] = args;

  if (extraArgs.length > 0) {
    throw new Error(
      `Unsupported ratings generator arguments: ${args.join(" ")}. Use --source fixture or --source real.`,
    );
  }

  if (firstArg === "--source") {
    if (!secondArg) {
      throw new Error("Missing value for --source. Use --source fixture or --source real.");
    }

    return parseRatingsSourceId(secondArg);
  }

  if (firstArg.startsWith("--source=")) {
    if (secondArg) {
      throw new Error(
        `Unsupported ratings generator arguments: ${args.join(" ")}. Use --source fixture or --source real.`,
      );
    }

    return parseRatingsSourceId(firstArg.slice("--source=".length));
  }

  throw new Error(
    `Unsupported ratings generator argument "${firstArg}". Use --source fixture or --source real.`,
  );
}

export function getRatingsSourceConfig(sourceId: RatingsSourceId): RatingsSourceConfig {
  if (sourceId === "fixture") {
    return fixtureRatingsSourceConfig;
  }

  return realRatingsSourceConfig;
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

  if (config.sourceId === "real" && config.fixture !== false) {
    errors.push("real source must use fixture: false");
  }

  for (const field of REQUIRED_PROVENANCE_FIELDS) {
    if (!String(config[field]).trim()) {
      errors.push(`missing ${field}`);
    }
  }

  return errors;
}

function parseRatingsSourceId(value: string): RatingsSourceId {
  if (value === "fixture" || value === "real") {
    return value;
  }

  throw new Error(
    `Unknown ratings source "${value}". Use --source fixture or --source real.`,
  );
}
