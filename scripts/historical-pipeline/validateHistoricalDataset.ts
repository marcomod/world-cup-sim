import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeKaggleWorldCupMatches } from "./adaptKaggleWorldCupMatches.ts";
import { resolveHistoricalTeamId } from "./historicalTeamAliases.ts";
import type {
  KaggleWorldCupProvenance,
  KaggleWorldCupRound,
} from "./kaggleWorldCupSchemas.ts";
import { KAGGLE_WORLD_CUP_ROUNDS } from "./kaggleWorldCupSchemas.ts";
import { loadKaggleWorldCupMatches } from "./loadKaggleWorldCupMatches.ts";
import type { HistoricalOutcomeStatus } from "./schemas.ts";

export const EXPECTED_KAGGLE_MATCH_FILE =
  "data/raw/historical/world-cup/matches_1930_2022.csv";
export const EXPECTED_KAGGLE_PROVENANCE_FILE =
  "data/raw/historical/world-cup/matches_1930_2022.provenance.json";

export interface HistoricalDatasetValidationSummary {
  rowCount: number;
  yearRange: [number, number];
  stageCounts: Record<KaggleWorldCupRound, number>;
  shootoutCount: number;
  extraTimeCount: number;
  outcomeCounts: Record<HistoricalOutcomeStatus, number>;
  aliasCoverage: {
    resolved: number;
    total: number;
  };
  diagnostics: string[];
  checksum: string;
}

export async function assertHistoricalSourceReady(
  filePath: string = EXPECTED_KAGGLE_MATCH_FILE,
): Promise<void> {
  try {
    await access(resolve(filePath));
  } catch {
    throw new Error(
      `Historical World Cup source file is missing: ${filePath}. After licence and attribution review, place the unmodified Kaggle matches_1930_2022.csv at that path. Synthetic test fixtures are not accepted by historical:validate.`,
    );
  }
}

export async function validateHistoricalDataset(input: {
  sourceFile?: string;
  provenanceFile?: string;
} = {}): Promise<HistoricalDatasetValidationSummary> {
  const sourceFile = input.sourceFile ?? EXPECTED_KAGGLE_MATCH_FILE;
  const provenanceFile = input.provenanceFile ?? EXPECTED_KAGGLE_PROVENANCE_FILE;
  await assertHistoricalSourceReady(sourceFile);
  const provenance = await loadProvenance(provenanceFile);
  const sourceBuffer = await readFile(resolve(sourceFile));
  const sourceStat = await stat(resolve(sourceFile));
  const checksum = createHash("sha256").update(sourceBuffer).digest("hex");

  if (basename(sourceFile) !== provenance.expectedFilename) {
    throw new Error(
      `Historical source filename "${basename(sourceFile)}" does not match provenance expectedFilename "${provenance.expectedFilename}".`,
    );
  }

  if (sourceStat.size !== provenance.fileSizeBytes) {
    throw new Error(
      `Historical source size ${sourceStat.size} does not match provenance size ${provenance.fileSizeBytes}.`,
    );
  }

  if (checksum !== provenance.sha256) {
    throw new Error(
      `Historical source SHA-256 ${checksum} does not match provenance SHA-256 ${provenance.sha256}.`,
    );
  }

  const sourceRows = await loadKaggleWorldCupMatches(resolve(sourceFile));
  const normalized = normalizeKaggleWorldCupMatches(sourceRows);
  const years = normalized.records.map(
    (record) => record.normalizedMatch.tournamentYear,
  );
  const yearRange: [number, number] = [Math.min(...years), Math.max(...years)];

  if (sourceRows.length !== provenance.rowCount) {
    throw new Error(
      `Historical source row count ${sourceRows.length} does not match provenance row count ${provenance.rowCount}.`,
    );
  }

  if (
    yearRange[0] !== provenance.yearRange[0] ||
    yearRange[1] !== provenance.yearRange[1]
  ) {
    throw new Error(
      `Historical source year range ${yearRange.join("-")} does not match provenance year range ${provenance.yearRange.join("-")}.`,
    );
  }

  const stageCounts = Object.fromEntries(
    KAGGLE_WORLD_CUP_ROUNDS.map((round) => [round, 0]),
  ) as Record<KaggleWorldCupRound, number>;
  const outcomeCounts: Record<HistoricalOutcomeStatus, number> = {
    decisive: 0,
    draw: 0,
    non_decisive: 0,
  };
  const sourceTeamNames = new Set<string>();
  let shootoutCount = 0;
  let extraTimeCount = 0;

  for (const record of normalized.records) {
    stageCounts[record.sourceRow.Round as KaggleWorldCupRound] += 1;
    outcomeCounts[record.normalizedMatch.outcomeStatus] += 1;
    shootoutCount += record.normalizedMatch.wentToPenalties ? 1 : 0;
    extraTimeCount += record.normalizedMatch.wentToExtraTime ? 1 : 0;
    sourceTeamNames.add(record.sourceRow.home_team);
    sourceTeamNames.add(record.sourceRow.away_team);
  }

  for (const sourceName of sourceTeamNames) {
    resolveHistoricalTeamId(sourceName);
  }

  return {
    rowCount: sourceRows.length,
    yearRange,
    stageCounts,
    shootoutCount,
    extraTimeCount,
    outcomeCounts,
    aliasCoverage: {
      resolved: sourceTeamNames.size,
      total: sourceTeamNames.size,
    },
    diagnostics: normalized.diagnostics.map(
      (diagnostic) =>
        `${diagnostic.severity.toUpperCase()} row ${diagnostic.sourceRowNumber} [${diagnostic.code}]: ${diagnostic.message}`,
    ),
    checksum,
  };
}

async function loadProvenance(filePath: string): Promise<KaggleWorldCupProvenance> {
  let contents: string;

  try {
    contents = await readFile(resolve(filePath), "utf8");
  } catch {
    throw new Error(`Historical provenance file is missing: ${filePath}.`);
  }

  const parsed: unknown = JSON.parse(contents);

  if (!isKaggleWorldCupProvenance(parsed)) {
    throw new Error(`Historical provenance file is invalid: ${filePath}.`);
  }

  return parsed;
}

function isKaggleWorldCupProvenance(
  value: unknown,
): value is KaggleWorldCupProvenance {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const requiredStrings = [
    "sourceName",
    "sourceUrl",
    "datasetAuthor",
    "accessDate",
    "licence",
    "attribution",
    "redistributionStatus",
    "expectedFilename",
    "sha256",
    "sourceVersionBasis",
  ];

  return (
    requiredStrings.every(
      (field) => typeof record[field] === "string" && String(record[field]).trim() !== "",
    ) &&
    typeof record.fileSizeBytes === "number" &&
    typeof record.rowCount === "number" &&
    Array.isArray(record.yearRange) &&
    record.yearRange.length === 2 &&
    record.yearRange.every((year) => typeof year === "number") &&
    (record.sourceVersionOrUpdateDate === null ||
      typeof record.sourceVersionOrUpdateDate === "string") &&
    record.rawFileModified === false &&
    Array.isArray(record.notes) &&
    record.notes.every((note) => typeof note === "string")
  );
}

function printSummary(summary: HistoricalDatasetValidationSummary): void {
  console.log(`Historical Kaggle dataset valid: ${summary.rowCount} rows.`);
  console.log(`Year range: ${summary.yearRange.join("-")}.`);
  console.log("Stage counts:");

  for (const round of KAGGLE_WORLD_CUP_ROUNDS) {
    console.log(`  ${round}: ${summary.stageCounts[round]}`);
  }

  console.log(
    `Outcomes: ${summary.outcomeCounts.decisive} decisive, ${summary.outcomeCounts.draw} draws, ${summary.outcomeCounts.non_decisive} non-decisive.`,
  );
  console.log(
    `Extra time: ${summary.extraTimeCount}; shootouts: ${summary.shootoutCount}.`,
  );
  console.log(
    `Alias coverage: ${summary.aliasCoverage.resolved}/${summary.aliasCoverage.total}.`,
  );
  console.log(`SHA-256: ${summary.checksum}.`);

  if (summary.diagnostics.length === 0) {
    console.log("Diagnostics: none.");
    return;
  }

  console.log(`Diagnostics: ${summary.diagnostics.length}.`);
  for (const diagnostic of summary.diagnostics) {
    console.log(`  ${diagnostic}`);
  }
}

async function main(): Promise<void> {
  const summary = await validateHistoricalDataset();
  printSummary(summary);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical validation failed: ${message}`);
    process.exitCode = 1;
  });
}
