import { readFile } from "node:fs/promises";
import {
  MAX_SOURCE_ELO,
  MIN_SOURCE_ELO,
  type RawTeamRatingRecord,
} from "./schemas.ts";

const REQUIRED_HEADERS = ["sourceName", "sourceElo", "sourceDate", "sourceNote"] as const;

interface ParsedCsvRow {
  lineNumber: number;
  values: string[];
}

export async function loadSourceRatings(filePath: string): Promise<RawTeamRatingRecord[]> {
  const csv = await readFile(filePath, "utf8");

  return parseSourceRatingsCsv(csv);
}

export function parseSourceRatingsCsv(csv: string): RawTeamRatingRecord[] {
  const rows = parseCsvRows(csv);

  if (rows.length === 0) {
    throw new Error("Rating source CSV is empty.");
  }

  const headers = rows[0].values.map((header) => header.trim());
  validateHeaders(headers);

  return rows
    .slice(1)
    .map((row) => parseRatingRow(headers, row.values, row.lineNumber));
}

function parseRatingRow(
  headers: string[],
  row: string[],
  lineNumber: number,
): RawTeamRatingRecord {
  if (row.length !== headers.length) {
    throw new Error(
      `Malformed CSV row ${lineNumber}: expected ${headers.length} columns but found ${row.length}.`,
    );
  }

  const values = Object.fromEntries(headers.map((header, index) => [header, row[index].trim()]));

  for (const header of REQUIRED_HEADERS) {
    if (!values[header]) {
      throw new Error(`Missing value for "${header}" on CSV row ${lineNumber}.`);
    }
  }

  const sourceElo = Number(values.sourceElo);

  if (!Number.isFinite(sourceElo)) {
    throw new Error(`Invalid numeric sourceElo "${values.sourceElo}" on CSV row ${lineNumber}.`);
  }

  if (sourceElo < MIN_SOURCE_ELO || sourceElo > MAX_SOURCE_ELO) {
    throw new Error(
      `Invalid sourceElo ${sourceElo} on CSV row ${lineNumber}: expected ${MIN_SOURCE_ELO}..${MAX_SOURCE_ELO}.`,
    );
  }

  return {
    sourceName: values.sourceName,
    sourceElo,
    sourceDate: values.sourceDate,
    sourceNote: values.sourceNote,
  };
}

function validateHeaders(headers: string[]): void {
  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      throw new Error(`Rating source CSV has duplicate header "${header}".`);
    }

    seenHeaders.add(header);
  }

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Rating source CSV is missing required header "${requiredHeader}".`);
    }
  }
}

// Supported CSV subset: comma-separated fields, optional quoted fields, and escaped
// quotes represented as doubled quotes. Multiline quoted fields are intentionally
// unsupported, and malformed quote placement is rejected instead of normalized.
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
