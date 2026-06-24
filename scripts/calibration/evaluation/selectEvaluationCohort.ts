import { isKnockoutHistoricalStage } from "../../historical-pipeline/validateHistoricalMatches.ts";
import {
  HISTORICAL_STAGES,
  HISTORICAL_WORLD_CUP_YEARS,
} from "../../historical-pipeline/schemas.ts";
import { compareCodePoints } from "../sequential-elo/compareCodePoints.ts";
import type { HistoricalPredictionObservation } from "../sequential-elo/types.ts";
import {
  EVALUATION_COHORT_NAMES,
  EVALUATION_SPLIT_NAMES,
  type CohortSelection,
  type EvaluationCohortName,
  type EvaluationObservation,
  type EvaluationSplitName,
} from "./types.ts";

const SUPPORTED_TOURNAMENT_YEARS = new Set<number>(HISTORICAL_WORLD_CUP_YEARS);
const VALID_OUTCOME_STATUSES = new Set<string>([
  "decisive",
  "draw",
  "non_decisive",
]);

export function selectEvaluationCohort(input: {
  observations: readonly HistoricalPredictionObservation[];
  cohort: EvaluationCohortName;
  split: EvaluationSplitName;
}): CohortSelection {
  assertEvaluationCohortName(input.cohort);
  assertEvaluationSplitName(input.split);
  validateSourceObservations(input.observations);

  const selectedObservations = [...input.observations]
    .filter((observation) => isInSplit(observation, input.split))
    .filter((observation) => isInCohort(observation, input.cohort))
    .sort(compareObservations);
  const scoredObservations = selectedObservations.flatMap(toBinaryObservation);

  return {
    cohort: input.cohort,
    split: input.split,
    selectedObservations,
    scoredObservations,
  };
}

export function assertEvaluationCohortName(
  value: string,
): asserts value is EvaluationCohortName {
  if (!(EVALUATION_COHORT_NAMES as readonly string[]).includes(value)) {
    throw new Error(`Unknown evaluation cohort "${value}".`);
  }
}

export function assertEvaluationSplitName(
  value: string,
): asserts value is EvaluationSplitName {
  if (!(EVALUATION_SPLIT_NAMES as readonly string[]).includes(value)) {
    throw new Error(`Unknown evaluation split "${value}".`);
  }
}

export function validateSourceObservations(
  observations: readonly HistoricalPredictionObservation[],
): void {
  const matchIds = new Set<string>();

  for (const observation of observations) {
    if (typeof observation.matchId !== "string" || !observation.matchId.trim()) {
      throw new Error(
        'Historical evaluation observation "<unknown>" has invalid matchId; expected a non-empty string.',
      );
    }
    const matchId = observation.matchId;
    if (matchIds.has(matchId)) {
      throw new Error(
        `Duplicate historical evaluation observation ID "${matchId}".`,
      );
    }
    matchIds.add(matchId);

    validateTournamentYear(observation.tournamentYear, matchId);
    validateDate(observation.date, observation.tournamentYear, matchId);
    validateStage(observation.stage, matchId);
    validateTeams(observation, matchId);

    if (
      !Number.isFinite(observation.predictedHomeScore) ||
      observation.predictedHomeScore < 0 ||
      observation.predictedHomeScore > 1
    ) {
      throw new Error(
        `Historical evaluation observation "${matchId}" has invalid predictedHomeScore.`,
      );
    }
    if (
      observation.observedHomeScore !== 0 &&
      observation.observedHomeScore !== 0.5 &&
      observation.observedHomeScore !== 1
    ) {
      throw new Error(
        `Historical evaluation observation "${matchId}" has invalid observedHomeScore.`,
      );
    }
    if (
      typeof observation.wentToExtraTime !== "boolean" ||
      typeof observation.decidedByPenalties !== "boolean"
    ) {
      throw new Error(
        `Historical evaluation observation "${matchId}" has invalid decision metadata.`,
      );
    }

    validateOutcomeMetadata(observation, matchId);
  }
}

function validateTournamentYear(tournamentYear: number, matchId: string): void {
  if (
    !Number.isFinite(tournamentYear) ||
    !Number.isInteger(tournamentYear) ||
    !SUPPORTED_TOURNAMENT_YEARS.has(tournamentYear)
  ) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has unsupported tournamentYear "${tournamentYear}".`,
    );
  }
}

function validateDate(date: string, tournamentYear: number, matchId: string): void {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has invalid date "${date}".`,
    );
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    Number(date.slice(0, 4)) !== tournamentYear
  ) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has invalid date "${date}" for tournamentYear ${tournamentYear}.`,
    );
  }
}

function validateStage(stage: string, matchId: string): void {
  if (!(HISTORICAL_STAGES as readonly string[]).includes(stage)) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has unknown stage "${stage}".`,
    );
  }
}

function validateTeams(
  observation: HistoricalPredictionObservation,
  matchId: string,
): void {
  if (
    typeof observation.homeTeamId !== "string" ||
    typeof observation.awayTeamId !== "string" ||
    !observation.homeTeamId.trim() ||
    !observation.awayTeamId.trim()
  ) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has an invalid team ID.`,
    );
  }
  if (observation.homeTeamId === observation.awayTeamId) {
    throw new Error(
      `Historical evaluation observation "${matchId}" cannot contain the same team twice.`,
    );
  }
}

function validateOutcomeMetadata(
  observation: HistoricalPredictionObservation,
  matchId: string,
): void {
  const outcomeStatus: string = observation.outcomeStatus;
  const winnerTeamId: string | null = observation.winnerTeamId;

  if (!VALID_OUTCOME_STATUSES.has(outcomeStatus)) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has unknown outcomeStatus "${outcomeStatus}".`,
    );
  }

  if (outcomeStatus === "decisive") {
    if (
      winnerTeamId !== observation.homeTeamId &&
      winnerTeamId !== observation.awayTeamId
    ) {
      throw new Error(
        `Historical evaluation observation "${matchId}" has an invalid decisive winner.`,
      );
    }
    if (observation.decidedByPenalties) {
      if (!observation.wentToExtraTime || observation.observedHomeScore !== 0.5) {
        throw new Error(
          `Historical evaluation observation "${matchId}" has inconsistent penalty metadata.`,
        );
      }
      return;
    }

    const expectedScore = winnerTeamId === observation.homeTeamId ? 1 : 0;
    if (observation.observedHomeScore !== expectedScore) {
      throw new Error(
        `Historical evaluation observation "${matchId}" has observedHomeScore inconsistent with its winner.`,
      );
    }
    return;
  }

  if (winnerTeamId !== null || observation.observedHomeScore !== 0.5) {
    throw new Error(
      `Historical evaluation observation "${matchId}" has inconsistent ${outcomeStatus} metadata.`,
    );
  }
  if (observation.decidedByPenalties) {
    throw new Error(
      `Historical evaluation observation "${matchId}" cannot combine ${outcomeStatus} with penalties.`,
    );
  }
}

function isInSplit(
  observation: HistoricalPredictionObservation,
  split: EvaluationSplitName,
): boolean {
  if (split === "full_history") {
    return true;
  }
  if (split === "development") {
    return observation.tournamentYear >= 1930 && observation.tournamentYear <= 2006;
  }
  if (split === "validation") {
    return observation.tournamentYear >= 2010 && observation.tournamentYear <= 2018;
  }
  return observation.tournamentYear === 2022;
}

function isInCohort(
  observation: HistoricalPredictionObservation,
  cohort: EvaluationCohortName,
): boolean {
  const knockout = isKnockoutHistoricalStage(observation.stage);
  const regulationStyleDecisive =
    observation.outcomeStatus === "decisive" && !observation.decidedByPenalties;

  switch (cohort) {
    case "all_matches":
      return true;
    case "knockout_only":
      return knockout;
    case "decisive_only":
      return regulationStyleDecisive;
    case "knockout_decisive_only":
      return knockout && regulationStyleDecisive;
    case "penalties_only":
      return observation.decidedByPenalties;
    case "extra_time_only":
      return observation.wentToExtraTime;
  }
}

function toBinaryObservation(
  observation: HistoricalPredictionObservation,
): EvaluationObservation[] {
  if (
    observation.outcomeStatus !== "decisive" ||
    observation.decidedByPenalties
  ) {
    return [];
  }

  if (
    observation.winnerTeamId !== observation.homeTeamId &&
    observation.winnerTeamId !== observation.awayTeamId
  ) {
    throw new Error(
      `Historical evaluation observation "${observation.matchId}" has an invalid decisive winner.`,
    );
  }

  return [{
    matchId: observation.matchId,
    tournamentYear: observation.tournamentYear,
    date: observation.date,
    stage: observation.stage,
    homeTeamId: observation.homeTeamId,
    awayTeamId: observation.awayTeamId,
    predictedProbability: observation.predictedHomeScore,
    observedOutcome: observation.winnerTeamId === observation.homeTeamId ? 1 : 0,
  }];
}

function compareObservations(
  left: HistoricalPredictionObservation,
  right: HistoricalPredictionObservation,
): number {
  return compareCodePoints(left.date, right.date) ||
    compareCodePoints(left.matchId, right.matchId);
}
