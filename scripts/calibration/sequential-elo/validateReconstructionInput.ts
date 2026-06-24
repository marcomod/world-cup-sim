import {
  HISTORICAL_STAGES,
  type NormalizedHistoricalMatch,
} from "../../historical-pipeline/schemas.ts";

const VALID_OUTCOME_STATUSES = new Set<string>([
  "decisive",
  "draw",
  "non_decisive",
]);

export function validateReconstructionInput(
  matches: readonly NormalizedHistoricalMatch[],
): void {
  const matchIds = new Set<string>();

  for (const match of matches) {
    if (typeof match.matchId !== "string" || !match.matchId.trim()) {
      throw new Error(
        'Sequential Elo match "<unknown>" has invalid matchId; expected a non-empty string.',
      );
    }

    const matchId = match.matchId;

    if (matchIds.has(matchId)) {
      throw new Error(`Sequential Elo input contains duplicate matchId "${matchId}".`);
    }
    matchIds.add(matchId);

    validateDate(match.date, matchId);
    validateTournamentYear(match.tournamentYear, matchId);
    validateTeamIds(match, matchId);
    validateScores(match, matchId);
    validateOutcome(match, matchId);
  }
}

function validateDate(date: string, matchId: string): void {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid date "${date}"; expected YYYY-MM-DD.`,
    );
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Sequential Elo match "${matchId}" has invalid date "${date}".`);
  }
}

function validateTournamentYear(tournamentYear: number, matchId: string): void {
  if (!Number.isInteger(tournamentYear) || tournamentYear <= 0) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid tournamentYear "${tournamentYear}".`,
    );
  }
}

function validateTeamIds(match: NormalizedHistoricalMatch, matchId: string): void {
  if (
    typeof match.teamAId !== "string" ||
    typeof match.teamBId !== "string" ||
    !match.teamAId.trim() ||
    !match.teamBId.trim()
  ) {
    throw new Error(`Sequential Elo match "${matchId}" has an empty team ID.`);
  }

  if (match.teamAId === match.teamBId) {
    throw new Error(
      `Sequential Elo match "${matchId}" cannot contain the same team twice.`,
    );
  }

  if (!HISTORICAL_STAGES.includes(match.stage)) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid stage "${match.stage}".`,
    );
  }
}

function validateScores(match: NormalizedHistoricalMatch, matchId: string): void {
  if (
    typeof match.wentToExtraTime !== "boolean" ||
    typeof match.wentToPenalties !== "boolean"
  ) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid extra-time or penalty flags.`,
    );
  }

  assertNonNegativeInteger(match.teamAGoals, "teamAGoals", matchId);
  assertNonNegativeInteger(match.teamBGoals, "teamBGoals", matchId);

  const hasTeamAPenalties = match.teamAPenaltyGoals !== undefined;
  const hasTeamBPenalties = match.teamBPenaltyGoals !== undefined;

  if (!match.wentToPenalties) {
    if (hasTeamAPenalties || hasTeamBPenalties) {
      throw new Error(
        `Sequential Elo match "${matchId}" has shootout scores without wentToPenalties.`,
      );
    }
    return;
  }

  if (!match.wentToExtraTime) {
    throw new Error(
      `Sequential Elo match "${matchId}" uses penalties without extra time.`,
    );
  }

  if (!hasTeamAPenalties || !hasTeamBPenalties) {
    throw new Error(
      `Sequential Elo match "${matchId}" must include both shootout scores.`,
    );
  }

  assertNonNegativeInteger(match.teamAPenaltyGoals, "teamAPenaltyGoals", matchId);
  assertNonNegativeInteger(match.teamBPenaltyGoals, "teamBPenaltyGoals", matchId);

  if (match.teamAGoals !== match.teamBGoals) {
    throw new Error(
      `Sequential Elo match "${matchId}" must have tied match goals before penalties.`,
    );
  }

  if (match.teamAPenaltyGoals === match.teamBPenaltyGoals) {
    throw new Error(
      `Sequential Elo match "${matchId}" must have a decisive shootout score.`,
    );
  }
}

function validateOutcome(match: NormalizedHistoricalMatch, matchId: string): void {
  const outcomeStatus: string = match.outcomeStatus;
  const winnerTeamId: string | null = match.winnerTeamId;

  if (!VALID_OUTCOME_STATUSES.has(outcomeStatus)) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid outcomeStatus "${outcomeStatus}".`,
    );
  }

  if (outcomeStatus === "decisive") {
    if (winnerTeamId === null) {
      throw new Error(
        `Sequential Elo match "${matchId}" is decisive but has a null winner.`,
      );
    }

    if (
      winnerTeamId !== match.teamAId &&
      winnerTeamId !== match.teamBId
    ) {
      throw new Error(
        `Sequential Elo match "${matchId}" has winner "${winnerTeamId}" outside its participating teams.`,
      );
    }

    const expectedWinner = getExpectedWinner(match);
    if (expectedWinner === null || winnerTeamId !== expectedWinner) {
      throw new Error(
        `Sequential Elo match "${matchId}" has winner "${winnerTeamId}" inconsistent with its score.`,
      );
    }
    return;
  }

  if (winnerTeamId !== null) {
    throw new Error(
      `Sequential Elo match "${matchId}" has outcomeStatus "${outcomeStatus}" but a non-null winner.`,
    );
  }

  if (match.wentToPenalties || match.teamAGoals !== match.teamBGoals) {
    throw new Error(
      `Sequential Elo match "${matchId}" has outcomeStatus "${outcomeStatus}" but a decisive score.`,
    );
  }
}

function getExpectedWinner(match: NormalizedHistoricalMatch): string | null {
  if (match.wentToPenalties) {
    return Number(match.teamAPenaltyGoals) > Number(match.teamBPenaltyGoals)
      ? match.teamAId
      : match.teamBId;
  }

  if (match.teamAGoals === match.teamBGoals) {
    return null;
  }

  return match.teamAGoals > match.teamBGoals ? match.teamAId : match.teamBId;
}

function assertNonNegativeInteger(
  value: number | undefined,
  field: string,
  matchId: string,
): void {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(
      `Sequential Elo match "${matchId}" has invalid ${field}; expected a non-negative integer.`,
    );
  }
}
