import { readFile } from "node:fs/promises";
import type { RawHistoricalMatch } from "./schemas.ts";

const REQUIRED_HEADERS = [
  "tournamentYear",
  "date",
  "stage",
  "homeTeam",
  "awayTeam",
  "homeGoals",
  "awayGoals",
  "extraTime",
  "penalties",
] as const;

const OPTIONAL_HEADERS = [
  "homePenaltyGoals",
  "awayPenaltyGoals",
  "neutralVenue",
  "sourceMatchId",
] as const;

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
const SUPPORTED_TOURNAMENT_YEARS = new Set([
  1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1982, 1986,
  1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
]);

interface ParsedCsvRow {
  lineNumber: number;
  values: string[];
}

export async function loadHistoricalMatches(
  filePath: string,
): Promise<RawHistoricalMatch[]> {
  const csv = await readFile(filePath, "utf8");

  return parseHistoricalMatchesCsv(csv);
}

// This parser intentionally supports the repository's synthetic-v1 fixture
// schema only. The Kaggle source needs a separate adapter after its raw file is
// approved and its exact headers and score semantics are inspected locally.
export function parseHistoricalMatchesCsv(csv: string): RawHistoricalMatch[] {
  const rows = parseCsvRows(csv);

  if (rows.length === 0) {
    throw new Error("Historical match CSV is empty.");
  }

  const headers = rows[0].values.map((header) => header.trim());
  validateHeaders(headers);

  if (rows.length === 1) {
    throw new Error("Historical match CSV contains no match records.");
  }

  return rows.slice(1).map((row) => parseHistoricalRow(headers, row));
}

function parseHistoricalRow(headers: string[], row: ParsedCsvRow): RawHistoricalMatch {
  if (row.values.length !== headers.length) {
    throw new Error(
      `Malformed CSV row ${row.lineNumber}: expected ${headers.length} columns but found ${row.values.length}.`,
    );
  }

  const values = Object.fromEntries(
    headers.map((header, index) => [header, row.values[index].trim()]),
  );

  for (const header of REQUIRED_HEADERS) {
    if (!values[header]) {
      throw new Error(`Missing value for "${header}" on CSV row ${row.lineNumber}.`);
    }
  }

  const tournamentYear = parseTournamentYear(values.tournamentYear, row.lineNumber);
  const date = parseIsoDate(values.date, row.lineNumber);

  if (!date.startsWith(`${tournamentYear}-`)) {
    throw new Error(
      `Invalid date "${date}" on CSV row ${row.lineNumber}: it does not match tournamentYear ${tournamentYear}.`,
    );
  }

  const homeTeam = values.homeTeam;
  const awayTeam = values.awayTeam;

  if (normalizeComparableName(homeTeam) === normalizeComparableName(awayTeam)) {
    throw new Error(
      `Invalid match on CSV row ${row.lineNumber}: homeTeam and awayTeam are identical.`,
    );
  }

  const homeGoals = parseNonNegativeInteger(values.homeGoals, "homeGoals", row.lineNumber);
  const awayGoals = parseNonNegativeInteger(values.awayGoals, "awayGoals", row.lineNumber);
  const extraTime = parseBoolean(values.extraTime, "extraTime", row.lineNumber);
  const penalties = parseBoolean(values.penalties, "penalties", row.lineNumber);
  const homePenaltyGoals = parseOptionalNonNegativeInteger(
    values.homePenaltyGoals,
    "homePenaltyGoals",
    row.lineNumber,
  );
  const awayPenaltyGoals = parseOptionalNonNegativeInteger(
    values.awayPenaltyGoals,
    "awayPenaltyGoals",
    row.lineNumber,
  );

  validatePenaltyFields({
    rowNumber: row.lineNumber,
    homeGoals,
    awayGoals,
    extraTime,
    penalties,
    homePenaltyGoals,
    awayPenaltyGoals,
  });

  const neutralVenue = parseOptionalBoolean(
    values.neutralVenue,
    "neutralVenue",
    row.lineNumber,
  );
  const sourceMatchId = values.sourceMatchId || undefined;

  return {
    tournamentYear,
    date,
    stage: values.stage,
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    extraTime,
    penalties,
    ...(homePenaltyGoals === undefined ? {} : { homePenaltyGoals }),
    ...(awayPenaltyGoals === undefined ? {} : { awayPenaltyGoals }),
    ...(neutralVenue === undefined ? {} : { neutralVenue }),
    ...(sourceMatchId === undefined ? {} : { sourceMatchId }),
  };
}

function parseTournamentYear(value: string, rowNumber: number): number {
  const year = Number(value);

  if (!Number.isInteger(year) || !SUPPORTED_TOURNAMENT_YEARS.has(year)) {
    throw new Error(
      `Invalid tournamentYear "${value}" on CSV row ${rowNumber}: expected a completed World Cup year from 1930 through 2022.`,
    );
  }

  return year;
}

function parseIsoDate(value: string, rowNumber: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(
      `Invalid date "${value}" on CSV row ${rowNumber}: expected YYYY-MM-DD.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${value}" on CSV row ${rowNumber}.`);
  }

  return value;
}

function parseNonNegativeInteger(value: string, field: string, rowNumber: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid ${field} "${value}" on CSV row ${rowNumber}: expected a non-negative integer.`,
    );
  }

  return parsed;
}

function parseOptionalNonNegativeInteger(
  value: string | undefined,
  field: string,
  rowNumber: number,
): number | undefined {
  if (!value) {
    return undefined;
  }

  return parseNonNegativeInteger(value, field, rowNumber);
}

function parseBoolean(value: string, field: string, rowNumber: number): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(
    `Invalid ${field} "${value}" on CSV row ${rowNumber}: expected true or false.`,
  );
}

function parseOptionalBoolean(
  value: string | undefined,
  field: string,
  rowNumber: number,
): boolean | undefined {
  if (!value) {
    return undefined;
  }

  return parseBoolean(value, field, rowNumber);
}

function validatePenaltyFields(input: {
  rowNumber: number;
  homeGoals: number;
  awayGoals: number;
  extraTime: boolean;
  penalties: boolean;
  homePenaltyGoals?: number;
  awayPenaltyGoals?: number;
}): void {
  const hasHomePenaltyGoals = input.homePenaltyGoals !== undefined;
  const hasAwayPenaltyGoals = input.awayPenaltyGoals !== undefined;

  if (!input.penalties && (hasHomePenaltyGoals || hasAwayPenaltyGoals)) {
    throw new Error(
      `Invalid penalty data on CSV row ${input.rowNumber}: shootout scores require penalties=true.`,
    );
  }

  if (!input.penalties) {
    return;
  }

  if (!input.extraTime) {
    throw new Error(
      `Invalid penalty data on CSV row ${input.rowNumber}: penalties require extraTime=true.`,
    );
  }

  if (!hasHomePenaltyGoals || !hasAwayPenaltyGoals) {
    throw new Error(
      `Invalid penalty data on CSV row ${input.rowNumber}: both shootout scores are required.`,
    );
  }

  if (input.homeGoals !== input.awayGoals) {
    throw new Error(
      `Invalid penalty data on CSV row ${input.rowNumber}: match goals must be tied before a shootout.`,
    );
  }

  if (input.homePenaltyGoals === input.awayPenaltyGoals) {
    throw new Error(
      `Invalid penalty data on CSV row ${input.rowNumber}: shootout scores must identify a winner.`,
    );
  }
}

function validateHeaders(headers: string[]): void {
  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      throw new Error(`Historical match CSV has duplicate header "${header}".`);
    }

    if (!ALLOWED_HEADERS.has(header)) {
      throw new Error(`Historical match CSV has unsupported header "${header}".`);
    }

    seenHeaders.add(header);
  }

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Historical match CSV is missing required header "${requiredHeader}".`);
    }
  }
}

function normalizeComparableName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

// Supported synthetic-v1 CSV subset: comma-separated fields, optional quoted
// fields, and escaped quotes represented as doubled quotes. Multiline quoted
// fields are unsupported; malformed quote placement and blank rows are errors.
function parseCsvRows(csv: string): ParsedCsvRow[] {
  const rows: ParsedCsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;
  let fieldStarted = false;
  let lineNumber = 1;
  let rowStartLine = 1;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        field += "\"";
        index += 1;
        continue;
      }

      if (inQuotes) {
        inQuotes = false;
        quoteClosed = true;
        continue;
      }

      if (fieldStarted || field.length > 0 || quoteClosed) {
        throw new Error(`Malformed CSV row ${rowStartLine}: quote inside unquoted field.`);
      }

      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      quoteClosed = false;
      fieldStarted = false;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(field);
      appendCsvRow(rows, row, rowStartLine);
      row = [];
      field = "";
      quoteClosed = false;
      fieldStarted = false;
      lineNumber += 1;
      rowStartLine = lineNumber;
      continue;
    }

    if ((char === "\n" || char === "\r") && inQuotes) {
      throw new Error(
        `Malformed CSV row ${rowStartLine}: multiline quoted fields are not supported.`,
      );
    }

    if (quoteClosed) {
      throw new Error(
        `Malformed CSV row ${rowStartLine}: unexpected character after closing quote.`,
      );
    }

    field += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    throw new Error(`Malformed CSV row ${rowStartLine}: unterminated quoted field.`);
  }

  if (row.length > 0 || field.length > 0 || fieldStarted || quoteClosed) {
    row.push(field);
    appendCsvRow(rows, row, rowStartLine);
  }

  return rows;
}

function appendCsvRow(rows: ParsedCsvRow[], row: string[], lineNumber: number): void {
  if (row.every((value) => value.trim() === "")) {
    throw new Error(`Malformed CSV row ${lineNumber}: blank rows are not allowed.`);
  }

  rows.push({ lineNumber, values: row });
}
