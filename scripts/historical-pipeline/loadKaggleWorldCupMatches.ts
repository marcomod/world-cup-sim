import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  KAGGLE_WORLD_CUP_HEADERS,
  type KaggleWorldCupSourceRow,
} from "./kaggleWorldCupSchemas.ts";

interface ParsedCsvRow {
  lineNumber: number;
  values: string[];
}

export async function loadKaggleWorldCupMatches(
  filePath: string,
): Promise<KaggleWorldCupSourceRow[]> {
  const buffer = await readFile(filePath);
  return decodeKaggleWorldCupMatches(buffer, filePath);
}

export function decodeKaggleWorldCupMatches(
  buffer: Uint8Array,
  fileContext: string,
): KaggleWorldCupSourceRow[] {
  let csv: string;

  try {
    csv = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      `Failed to decode Kaggle World Cup CSV "${basename(fileContext)}" as UTF-8: malformed byte sequence.`,
    );
  }

  return parseKaggleWorldCupCsv(csv);
}

export function parseKaggleWorldCupCsv(csv: string): KaggleWorldCupSourceRow[] {
  if (csv.charCodeAt(0) === 0xfeff) {
    throw new Error("Kaggle World Cup CSV must be UTF-8 without a byte-order mark.");
  }

  const rows = parseCsvRows(csv);

  if (rows.length === 0) {
    throw new Error("Kaggle World Cup CSV is empty.");
  }

  validateHeaders(rows[0].values);

  if (rows.length === 1) {
    throw new Error("Kaggle World Cup CSV contains no match records.");
  }

  return rows.slice(1).map(createSourceRow);
}

function validateHeaders(headers: string[]): void {
  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      throw new Error(`Kaggle World Cup CSV has duplicate header "${header}".`);
    }

    seenHeaders.add(header);
  }

  const expectedHeaders = new Set<string>(KAGGLE_WORLD_CUP_HEADERS);
  const unknownHeaders = headers.filter((header) => !expectedHeaders.has(header));
  const missingHeaders = KAGGLE_WORLD_CUP_HEADERS.filter(
    (header) => !seenHeaders.has(header),
  );

  if (unknownHeaders.length > 0) {
    throw new Error(
      `Kaggle World Cup CSV has unknown or extra header(s): ${unknownHeaders.join(", ")}.`,
    );
  }

  if (missingHeaders.length > 0) {
    throw new Error(
      `Kaggle World Cup CSV is missing required header(s): ${missingHeaders.join(", ")}.`,
    );
  }

  if (headers.length !== KAGGLE_WORLD_CUP_HEADERS.length) {
    throw new Error(
      `Kaggle World Cup CSV must contain exactly ${KAGGLE_WORLD_CUP_HEADERS.length} headers; found ${headers.length}.`,
    );
  }

  const reorderedIndex = headers.findIndex(
    (header, index) => header !== KAGGLE_WORLD_CUP_HEADERS[index],
  );

  if (reorderedIndex >= 0) {
    throw new Error(
      `Kaggle World Cup CSV header ${reorderedIndex + 1} is reordered: expected "${KAGGLE_WORLD_CUP_HEADERS[reorderedIndex]}" but found "${headers[reorderedIndex]}".`,
    );
  }
}

function createSourceRow(row: ParsedCsvRow): KaggleWorldCupSourceRow {
  if (row.values.length !== KAGGLE_WORLD_CUP_HEADERS.length) {
    throw new Error(
      `Malformed Kaggle CSV row ${row.lineNumber}: expected ${KAGGLE_WORLD_CUP_HEADERS.length} columns but found ${row.values.length}.`,
    );
  }

  const value = (index: number): string => row.values[index];

  return {
    sourceRowNumber: row.lineNumber,
    home_team: value(0),
    away_team: value(1),
    home_score: value(2),
    home_xg: value(3),
    home_penalty: value(4),
    away_score: value(5),
    away_xg: value(6),
    away_penalty: value(7),
    home_manager: value(8),
    home_captain: value(9),
    away_manager: value(10),
    away_captain: value(11),
    Attendance: value(12),
    Venue: value(13),
    Officials: value(14),
    Round: value(15),
    Date: value(16),
    Score: value(17),
    Referee: value(18),
    Notes: value(19),
    Host: value(20),
    Year: value(21),
    home_goal: value(22),
    away_goal: value(23),
    home_goal_long: value(24),
    away_goal_long: value(25),
    home_own_goal: value(26),
    away_own_goal: value(27),
    home_penalty_goal: value(28),
    away_penalty_goal: value(29),
    home_penalty_miss_long: value(30),
    away_penalty_miss_long: value(31),
    home_penalty_shootout_goal_long: value(32),
    away_penalty_shootout_goal_long: value(33),
    home_penalty_shootout_miss_long: value(34),
    away_penalty_shootout_miss_long: value(35),
    home_red_card: value(36),
    away_red_card: value(37),
    home_yellow_red_card: value(38),
    away_yellow_red_card: value(39),
    home_yellow_card_long: value(40),
    away_yellow_card_long: value(41),
    home_substitute_in_long: value(42),
    away_substitute_in_long: value(43),
  };
}

// Confirmed source contract: comma-separated UTF-8, double-quoted fields,
// doubled quote escaping, LF records, and no multiline fields.
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
        throw new Error(
          `Malformed Kaggle CSV row ${rowStartLine}: quote inside unquoted field.`,
        );
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
        `Malformed Kaggle CSV row ${rowStartLine}: multiline quoted fields are not supported.`,
      );
    }

    if (quoteClosed) {
      throw new Error(
        `Malformed Kaggle CSV row ${rowStartLine}: unexpected character after closing quote.`,
      );
    }

    field += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    throw new Error(
      `Malformed Kaggle CSV row ${rowStartLine}: unterminated quoted field.`,
    );
  }

  if (row.length > 0 || field.length > 0 || fieldStarted || quoteClosed) {
    row.push(field);
    appendCsvRow(rows, row, rowStartLine);
  }

  return rows;
}

function appendCsvRow(rows: ParsedCsvRow[], row: string[], lineNumber: number): void {
  if (row.every((field) => normalizeValidationText(field) === "")) {
    throw new Error(`Malformed Kaggle CSV row ${lineNumber}: blank rows are not allowed.`);
  }

  rows.push({ lineNumber, values: row });
}

function normalizeValidationText(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}
