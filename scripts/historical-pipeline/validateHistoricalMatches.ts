import {
  HISTORICAL_STAGES,
  type HistoricalStage,
  type NormalizedHistoricalMatch,
} from "./schemas.ts";
import { isAllowlistedReplayEraNonDecisiveMatch } from "./replayEraNonDecisiveMatches.ts";

const GROUP_STAGES = new Set<HistoricalStage>([
  "group_stage",
  "first_group_stage",
  "second_group_stage",
  "final_group_stage",
]);

export function isGroupHistoricalStage(stage: HistoricalStage): boolean {
  return GROUP_STAGES.has(stage);
}

export function isKnockoutHistoricalStage(stage: HistoricalStage): boolean {
  return !isGroupHistoricalStage(stage);
}

export function validateHistoricalMatches(
  matches: readonly NormalizedHistoricalMatch[],
): void {
  const matchIds = new Set<string>();
  const fixtureKeys = new Set<string>();

  for (const match of matches) {
    validateHistoricalMatch(match);

    if (matchIds.has(match.matchId)) {
      throw new Error(`Duplicate historical matchId "${match.matchId}".`);
    }

    matchIds.add(match.matchId);
    const fixtureKey = createFixtureKey(match);

    if (fixtureKeys.has(fixtureKey)) {
      throw new Error(
        `Duplicate historical match for ${match.date}, ${match.stage}, ${match.teamAId} and ${match.teamBId}.`,
      );
    }

    fixtureKeys.add(fixtureKey);
  }
}

function validateHistoricalMatch(match: NormalizedHistoricalMatch): void {
  if (!match.matchId.trim()) {
    throw new Error("Historical matchId cannot be empty.");
  }

  if (!match.source.trim()) {
    throw new Error(`Historical match "${match.matchId}" has an empty source.`);
  }

  if (!HISTORICAL_STAGES.includes(match.stage)) {
    throw new Error(
      `Historical match "${match.matchId}" has unknown stage "${match.stage}".`,
    );
  }

  if (match.teamAId === match.teamBId) {
    throw new Error(
      `Historical match "${match.matchId}" cannot contain the same team twice.`,
    );
  }

  assertNonNegativeInteger(match.teamAGoals, "teamAGoals", match.matchId);
  assertNonNegativeInteger(match.teamBGoals, "teamBGoals", match.matchId);

  const hasTeamAPenalties = match.teamAPenaltyGoals !== undefined;
  const hasTeamBPenalties = match.teamBPenaltyGoals !== undefined;

  if (!match.wentToPenalties && (hasTeamAPenalties || hasTeamBPenalties)) {
    throw new Error(
      `Historical match "${match.matchId}" has shootout scores without wentToPenalties.`,
    );
  }

  if (match.wentToPenalties) {
    validateShootout(match, hasTeamAPenalties, hasTeamBPenalties);
  }

  if (isGroupHistoricalStage(match.stage)) {
    if (match.wentToPenalties) {
      throw new Error(
        `Group-stage historical match "${match.matchId}" cannot use penalties.`,
      );
    }
  }

  const expectedWinner = calculateExpectedWinner(match);
  validateOutcomeStatus(match, expectedWinner);
}

function validateOutcomeStatus(
  match: NormalizedHistoricalMatch,
  expectedWinner: string | null,
): void {
  if (match.outcomeStatus === "decisive") {
    if (!expectedWinner || match.winnerTeamId !== expectedWinner) {
      throw new Error(
        `Historical match "${match.matchId}" has winnerTeamId "${match.winnerTeamId}" but its score implies "${expectedWinner}".`,
      );
    }

    return;
  }

  if (expectedWinner !== null || match.winnerTeamId !== null) {
    throw new Error(
      `Historical match "${match.matchId}" uses outcomeStatus "${match.outcomeStatus}" but its score is decisive.`,
    );
  }

  if (match.outcomeStatus === "draw") {
    if (!isGroupHistoricalStage(match.stage)) {
      throw new Error(
        `Historical match "${match.matchId}" can use outcomeStatus "draw" only in a group-format stage.`,
      );
    }

    return;
  }

  if (!isAllowlistedReplayEraNonDecisiveMatch(match)) {
    throw new Error(
      `Historical match "${match.matchId}" can use outcomeStatus "non_decisive" only when its exact source key is one of the four allowlisted replay-era ties.`,
    );
  }
}

function validateShootout(
  match: NormalizedHistoricalMatch,
  hasTeamAPenalties: boolean,
  hasTeamBPenalties: boolean,
): void {
  if (!match.wentToExtraTime) {
    throw new Error(
      `Historical match "${match.matchId}" uses penalties without extra time.`,
    );
  }

  if (!hasTeamAPenalties || !hasTeamBPenalties) {
    throw new Error(
      `Historical match "${match.matchId}" must include both shootout scores.`,
    );
  }

  if (match.teamAGoals !== match.teamBGoals) {
    throw new Error(
      `Historical match "${match.matchId}" must have tied match goals before penalties.`,
    );
  }

  assertNonNegativeInteger(match.teamAPenaltyGoals, "teamAPenaltyGoals", match.matchId);
  assertNonNegativeInteger(match.teamBPenaltyGoals, "teamBPenaltyGoals", match.matchId);

  if (match.teamAPenaltyGoals === match.teamBPenaltyGoals) {
    throw new Error(
      `Historical match "${match.matchId}" must have a decisive penalty shootout.`,
    );
  }
}

function calculateExpectedWinner(match: NormalizedHistoricalMatch): string | null {
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
      `Historical match "${matchId}" has invalid ${field}; expected a non-negative integer.`,
    );
  }
}

function createFixtureKey(match: NormalizedHistoricalMatch): string {
  const sortedTeamIds = [match.teamAId, match.teamBId].sort();

  return [
    match.tournamentYear,
    match.date,
    match.stage,
    sortedTeamIds[0],
    sortedTeamIds[1],
  ].join("|");
}
