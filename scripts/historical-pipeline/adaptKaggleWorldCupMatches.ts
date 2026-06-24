import {
  KAGGLE_WORLD_CUP_ROUNDS,
  type KaggleWorldCupRound,
  type KaggleWorldCupSourceRow,
} from "./kaggleWorldCupSchemas.ts";
import { normalizeHistoricalMatches } from "./normalizeHistoricalMatches.ts";
import {
  createKaggleSourceMatchId,
  isAllowlistedReplayEraNonDecisiveMatch,
} from "./replayEraNonDecisiveMatches.ts";
import type {
  HistoricalOutcomeStatus,
  HistoricalStage,
  NormalizedHistoricalMatch,
  RawHistoricalMatch,
} from "./schemas.ts";
import { HISTORICAL_WORLD_CUP_YEARS } from "./schemas.ts";

export const KAGGLE_WORLD_CUP_SOURCE_ID = "kaggle-piterfm-fifa-football-world-cup";

const REQUIRED_SOURCE_FIELDS = [
  "home_team",
  "away_team",
  "home_score",
  "away_score",
  "home_manager",
  "away_manager",
  "Attendance",
  "Venue",
  "Round",
  "Date",
  "Score",
  "Host",
  "Year",
] as const satisfies readonly (keyof KaggleWorldCupSourceRow)[];

const SUPPORTED_TOURNAMENT_YEARS = new Set<number>(HISTORICAL_WORLD_CUP_YEARS);

const GROUP_SOURCE_ROUNDS = new Set<KaggleWorldCupRound>([
  "Group stage",
  "First group stage",
  "Second group stage",
  "First round",
  "Second round",
  "Final stage",
]);

const STAGE_BY_SOURCE_ROUND: Record<KaggleWorldCupRound, HistoricalStage> = {
  Final: "final",
  "Third-place match": "third_place",
  "Semi-finals": "semifinal",
  "Quarter-finals": "quarterfinal",
  "Round of 16": "round_of_16",
  "Group stage": "group_stage",
  "Second group stage": "second_group_stage",
  "First group stage": "first_group_stage",
  "Second round": "second_group_stage",
  "First round": "first_group_stage",
  "Group stage play-off": "group_stage_playoff",
  "Final stage": "final_group_stage",
};

const PENALTY_NOTE_SUFFIX = " won on penalty kicks following extra time";

export interface KaggleWorldCupDiagnostic {
  severity: "warning";
  code: "unicode_whitespace_normalized";
  sourceRowNumber: number;
  message: string;
}

export interface KaggleWorldCupAdaptedRecord {
  sourceRow: KaggleWorldCupSourceRow;
  rawMatch: RawHistoricalMatch;
}

export interface KaggleWorldCupNormalizedRecord extends KaggleWorldCupAdaptedRecord {
  normalizedMatch: NormalizedHistoricalMatch;
}

export interface KaggleWorldCupAdaptationResult {
  records: KaggleWorldCupAdaptedRecord[];
  diagnostics: KaggleWorldCupDiagnostic[];
}

export interface KaggleWorldCupNormalizationResult {
  records: KaggleWorldCupNormalizedRecord[];
  diagnostics: KaggleWorldCupDiagnostic[];
}

export function adaptKaggleWorldCupMatches(
  sourceRows: readonly KaggleWorldCupSourceRow[],
): KaggleWorldCupAdaptationResult {
  const diagnostics: KaggleWorldCupDiagnostic[] = [];
  const sourceMatchIds = new Set<string>();
  const records = sourceRows.map((sourceRow) => {
    const rawMatch = adaptSourceRow(sourceRow, diagnostics);

    if (!rawMatch.sourceMatchId) {
      throw new Error(`Kaggle source row ${sourceRow.sourceRowNumber} has no source match ID.`);
    }

    if (sourceMatchIds.has(rawMatch.sourceMatchId)) {
      throw new Error(
        `Kaggle source row ${sourceRow.sourceRowNumber} duplicates source tuple "${rawMatch.sourceMatchId}".`,
      );
    }

    sourceMatchIds.add(rawMatch.sourceMatchId);

    return { sourceRow, rawMatch };
  });

  return { records, diagnostics };
}

export function normalizeKaggleWorldCupMatches(
  sourceRows: readonly KaggleWorldCupSourceRow[],
): KaggleWorldCupNormalizationResult {
  const adapted = adaptKaggleWorldCupMatches(sourceRows);
  const normalizedMatches = normalizeHistoricalMatches(
    adapted.records.map((record) => record.rawMatch),
    { source: KAGGLE_WORLD_CUP_SOURCE_ID },
  );
  const adaptedBySourceId = new Map(
    adapted.records.map((record) => [record.rawMatch.sourceMatchId, record]),
  );
  const records = normalizedMatches.map((normalizedMatch) => {
    const adaptedRecord = adaptedBySourceId.get(normalizedMatch.sourceMatchId);

    if (!adaptedRecord) {
      throw new Error(
        `Normalized historical match "${normalizedMatch.matchId}" cannot be traced to its Kaggle source row.`,
      );
    }

    return { ...adaptedRecord, normalizedMatch };
  });

  return { records, diagnostics: adapted.diagnostics };
}

function adaptSourceRow(
  sourceRow: KaggleWorldCupSourceRow,
  diagnostics: KaggleWorldCupDiagnostic[],
): RawHistoricalMatch {
  validateRequiredValues(sourceRow);
  const tournamentYear = parseTournamentYear(sourceRow.Year, sourceRow.sourceRowNumber);
  const date = parseIsoDate(sourceRow.Date, tournamentYear, sourceRow.sourceRowNumber);
  const sourceRound = parseSourceRound(sourceRow.Round, sourceRow.sourceRowNumber);
  const stage = STAGE_BY_SOURCE_ROUND[sourceRound];
  const homeGoals = parseNonNegativeInteger(
    sourceRow.home_score,
    "home_score",
    sourceRow.sourceRowNumber,
  );
  const awayGoals = parseNonNegativeInteger(
    sourceRow.away_score,
    "away_score",
    sourceRow.sourceRowNumber,
  );
  parseNonNegativeInteger(sourceRow.Attendance, "Attendance", sourceRow.sourceRowNumber);
  parseOptionalNonNegativeNumber(sourceRow.home_xg, "home_xg", sourceRow.sourceRowNumber);
  parseOptionalNonNegativeNumber(sourceRow.away_xg, "away_xg", sourceRow.sourceRowNumber);

  if (
    normalizeValidationText(sourceRow.home_team) ===
    normalizeValidationText(sourceRow.away_team)
  ) {
    throw new Error(
      `Kaggle source row ${sourceRow.sourceRowNumber} contains the same home and away team.`,
    );
  }

  const homePenaltyGoals = parseOptionalNonNegativeInteger(
    sourceRow.home_penalty,
    "home_penalty",
    sourceRow.sourceRowNumber,
  );
  const awayPenaltyGoals = parseOptionalNonNegativeInteger(
    sourceRow.away_penalty,
    "away_penalty",
    sourceRow.sourceRowNumber,
  );
  const hasHomePenalties = homePenaltyGoals !== undefined;
  const hasAwayPenalties = awayPenaltyGoals !== undefined;

  if (hasHomePenalties !== hasAwayPenalties) {
    throw new Error(
      `Kaggle source row ${sourceRow.sourceRowNumber} must include both penalty totals or neither.`,
    );
  }

  const wentToPenalties = hasHomePenalties && hasAwayPenalties;
  const notes = normalizeValidationText(sourceRow.Notes);
  const penaltyNote = notes.endsWith(PENALTY_NOTE_SUFFIX);
  const wentToExtraTime = notes === "Required Extra Time" || penaltyNote;

  if (notes && !wentToExtraTime) {
    throw new Error(
      `Kaggle source row ${sourceRow.sourceRowNumber} has unsupported Notes value "${sourceRow.Notes}".`,
    );
  }

  validatePenaltyCombination({
    sourceRowNumber: sourceRow.sourceRowNumber,
    homeGoals,
    awayGoals,
    homePenaltyGoals,
    awayPenaltyGoals,
    wentToPenalties,
    wentToExtraTime,
    penaltyNote,
  });

  validateScoreCrossCheck(
    sourceRow,
    homeGoals,
    awayGoals,
    homePenaltyGoals,
    awayPenaltyGoals,
    diagnostics,
  );

  const sourceMatchId = createKaggleSourceMatchId({
    year: sourceRow.Year,
    date: sourceRow.Date,
    round: sourceRow.Round,
    homeTeam: sourceRow.home_team,
    awayTeam: sourceRow.away_team,
  });
  const outcomeStatus = determineOutcomeStatus({
    tournamentYear,
    sourceRound,
    stage,
    sourceMatchId,
    homeGoals,
    awayGoals,
    wentToPenalties,
    wentToExtraTime,
  });
  return {
    tournamentYear,
    date,
    stage,
    homeTeam: sourceRow.home_team,
    awayTeam: sourceRow.away_team,
    homeGoals,
    awayGoals,
    extraTime: wentToExtraTime,
    penalties: wentToPenalties,
    ...(homePenaltyGoals === undefined ? {} : { homePenaltyGoals }),
    ...(awayPenaltyGoals === undefined ? {} : { awayPenaltyGoals }),
    neutralVenue: null,
    sourceMatchId,
    outcomeStatus,
  };
}

function validateRequiredValues(sourceRow: KaggleWorldCupSourceRow): void {
  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (normalizeValidationText(String(sourceRow[field])) === "") {
      throw new Error(
        `Kaggle source row ${sourceRow.sourceRowNumber} is missing required value "${field}".`,
      );
    }
  }
}

function parseTournamentYear(value: string, rowNumber: number): number {
  const year = Number(value);

  if (!Number.isInteger(year) || !SUPPORTED_TOURNAMENT_YEARS.has(year)) {
    throw new Error(
      `Kaggle source row ${rowNumber} has invalid Year "${value}"; expected a completed World Cup year from 1930 through 2022.`,
    );
  }

  return year;
}

function parseIsoDate(value: string, tournamentYear: number, rowNumber: number): string {
  const normalizedDate = normalizeValidationText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDate);

  if (!match) {
    throw new Error(
      `Kaggle source row ${rowNumber} has invalid Date "${value}"; expected YYYY-MM-DD.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    year !== tournamentYear
  ) {
    throw new Error(
      `Kaggle source row ${rowNumber} has invalid Date "${value}" for tournament Year ${tournamentYear}.`,
    );
  }

  return normalizedDate;
}

function parseSourceRound(value: string, rowNumber: number): KaggleWorldCupRound {
  if (!KAGGLE_WORLD_CUP_ROUNDS.includes(value as KaggleWorldCupRound)) {
    throw new Error(`Kaggle source row ${rowNumber} has unknown Round "${value}".`);
  }

  return value as KaggleWorldCupRound;
}

function parseNonNegativeInteger(value: string, field: string, rowNumber: number): number {
  const normalizedValue = normalizeValidationText(value);

  if (!/^\d+$/u.test(normalizedValue)) {
    throw new Error(
      `Kaggle source row ${rowNumber} has invalid ${field} "${value}"; expected a non-negative integer.`,
    );
  }

  return Number(normalizedValue);
}

function parseOptionalNonNegativeInteger(
  value: string,
  field: string,
  rowNumber: number,
): number | undefined {
  if (normalizeValidationText(value) === "") {
    return undefined;
  }

  return parseNonNegativeInteger(value, field, rowNumber);
}

function parseOptionalNonNegativeNumber(
  value: string,
  field: string,
  rowNumber: number,
): number | undefined {
  const normalizedValue = normalizeValidationText(value);

  if (normalizedValue === "") {
    return undefined;
  }

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Kaggle source row ${rowNumber} has invalid ${field} "${value}"; expected a non-negative finite number or blank.`,
    );
  }

  return parsed;
}

function validatePenaltyCombination(input: {
  sourceRowNumber: number;
  homeGoals: number;
  awayGoals: number;
  homePenaltyGoals?: number;
  awayPenaltyGoals?: number;
  wentToPenalties: boolean;
  wentToExtraTime: boolean;
  penaltyNote: boolean;
}): void {
  if (input.wentToPenalties !== input.penaltyNote) {
    throw new Error(
      `Kaggle source row ${input.sourceRowNumber} has inconsistent penalty totals and Notes.`,
    );
  }

  if (!input.wentToPenalties) {
    return;
  }

  if (!input.wentToExtraTime) {
    throw new Error(
      `Kaggle source row ${input.sourceRowNumber} has penalty totals without extra time.`,
    );
  }

  if (input.homeGoals !== input.awayGoals) {
    throw new Error(
      `Kaggle source row ${input.sourceRowNumber} has penalty totals but the match score is not tied.`,
    );
  }

  if (input.homePenaltyGoals === input.awayPenaltyGoals) {
    throw new Error(
      `Kaggle source row ${input.sourceRowNumber} has equal penalty totals and no shootout winner.`,
    );
  }
}

function validateScoreCrossCheck(
  sourceRow: KaggleWorldCupSourceRow,
  homeGoals: number,
  awayGoals: number,
  homePenaltyGoals: number | undefined,
  awayPenaltyGoals: number | undefined,
  diagnostics: KaggleWorldCupDiagnostic[],
): void {
  const expectedScore =
    homePenaltyGoals === undefined || awayPenaltyGoals === undefined
      ? `${homeGoals}–${awayGoals}`
      : `(${homePenaltyGoals}) ${homeGoals}–${awayGoals} (${awayPenaltyGoals})`;
  const normalizedScore = normalizeValidationText(sourceRow.Score);

  if (normalizedScore !== expectedScore) {
    throw new Error(
      `Kaggle source row ${sourceRow.sourceRowNumber} has Score "${sourceRow.Score}" but score columns imply "${expectedScore}".`,
    );
  }

  if (sourceRow.Score !== normalizedScore) {
    diagnostics.push({
      severity: "warning",
      code: "unicode_whitespace_normalized",
      sourceRowNumber: sourceRow.sourceRowNumber,
      message: `Score contains non-canonical surrounding Unicode whitespace; raw value was preserved and normalized only for validation.`,
    });
  }
}

function determineOutcomeStatus(input: {
  tournamentYear: number;
  sourceRound: KaggleWorldCupRound;
  stage: HistoricalStage;
  sourceMatchId: string;
  homeGoals: number;
  awayGoals: number;
  wentToPenalties: boolean;
  wentToExtraTime: boolean;
}): HistoricalOutcomeStatus {
  if (input.wentToPenalties || input.homeGoals !== input.awayGoals) {
    return "decisive";
  }

  if (GROUP_SOURCE_ROUNDS.has(input.sourceRound)) {
    return "draw";
  }

  if (
    isAllowlistedReplayEraNonDecisiveMatch({
      sourceMatchId: input.sourceMatchId,
      stage: input.stage,
      teamAGoals: input.homeGoals,
      teamBGoals: input.awayGoals,
      wentToExtraTime: input.wentToExtraTime,
      wentToPenalties: input.wentToPenalties,
    })
  ) {
    return "non_decisive";
  }

  throw new Error(
    `Tied ${input.sourceRound} match in ${input.tournamentYear} is not one of the four allowlisted replay-era non-decisive source matches.`,
  );
}

function normalizeValidationText(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}
