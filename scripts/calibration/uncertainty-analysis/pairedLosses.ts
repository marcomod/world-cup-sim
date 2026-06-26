import {
  calculateBrierScore,
  calculateLogLoss,
  selectEvaluationCohort,
  type EvaluationObservation,
} from "../evaluation/index.ts";
import { compareCodePoints } from "../sequential-elo/compareCodePoints.ts";
import type { HistoricalPredictionObservation } from "../sequential-elo/types.ts";
import {
  FROZEN_UNCERTAINTY_PROTOCOL,
} from "./frozenUncertaintyProtocol.ts";
import type {
  PairedLossObservation,
  UncertaintyMetric,
  UncertaintySplit,
} from "./types.ts";

export function createPairedLossObservations(input: {
  selectedObservations: readonly HistoricalPredictionObservation[];
  referenceObservations: readonly HistoricalPredictionObservation[];
}): PairedLossObservation[] {
  const paired = FROZEN_UNCERTAINTY_PROTOCOL.splits.flatMap((split) =>
    pairSplit({
      split,
      selectedObservations: input.selectedObservations,
      referenceObservations: input.referenceObservations,
    })
  );

  return paired.sort(comparePairedLossObservations);
}

export function calculateMeanDelta(
  observations: readonly PairedLossObservation[],
  metric: UncertaintyMetric,
): number {
  if (observations.length === 0) {
    throw new Error("Paired uncertainty analysis requires at least one observation.");
  }
  return observations.reduce((sum, observation) => sum + getMetricDelta(observation, metric), 0) /
    observations.length;
}

export function calculateMetricLosses(
  observation: Pick<EvaluationObservation, "matchId" | "predictedProbability" | "observedOutcome">,
): {
  brierLoss: number;
  logLoss: number;
} {
  validateProbability(observation.predictedProbability, observation.matchId);

  const singleObservation: EvaluationObservation = {
    matchId: observation.matchId,
    tournamentYear: 2022,
    date: "2022-01-01",
    stage: "final",
    homeTeamId: "home",
    awayTeamId: "away",
    predictedProbability: observation.predictedProbability,
    observedOutcome: observation.observedOutcome,
  };

  return {
    brierLoss: calculateBrierScore([singleObservation]),
    logLoss: calculateLogLoss([singleObservation]),
  };
}

export function getMetricDelta(
  observation: PairedLossObservation,
  metric: UncertaintyMetric,
): number {
  return metric === "brierScore" ? observation.brierDelta : observation.logLossDelta;
}

export function filterPairedLossesBySplit(
  observations: readonly PairedLossObservation[],
  split: UncertaintySplit,
): PairedLossObservation[] {
  return observations.filter((observation) => observation.split === split)
    .sort(comparePairedLossObservations);
}

function pairSplit(input: {
  split: UncertaintySplit;
  selectedObservations: readonly HistoricalPredictionObservation[];
  referenceObservations: readonly HistoricalPredictionObservation[];
}): PairedLossObservation[] {
  const selected = selectEvaluationCohort({
    observations: input.selectedObservations,
    cohort: FROZEN_UNCERTAINTY_PROTOCOL.cohort,
    split: input.split,
  }).scoredObservations;
  const reference = selectEvaluationCohort({
    observations: input.referenceObservations,
    cohort: FROZEN_UNCERTAINTY_PROTOCOL.cohort,
    split: input.split,
  }).scoredObservations;
  const selectedByMatchId = toUniqueMap(selected, "selected");
  const referenceByMatchId = toUniqueMap(reference, "reference");
  assertExactPairedMatchIds({
    selectedByMatchId,
    referenceByMatchId,
    split: input.split,
  });

  return selected.map((selectedObservation) => {
    const referenceObservation = referenceByMatchId.get(selectedObservation.matchId);
    if (!referenceObservation) {
      throw new Error(`Missing reference observation for paired match "${selectedObservation.matchId}".`);
    }
    validatePair(selectedObservation, referenceObservation, input.split);
    const selectedLosses = calculateMetricLosses(selectedObservation);
    const referenceLosses = calculateMetricLosses(referenceObservation);

    return {
      matchId: selectedObservation.matchId,
      tournamentYear: selectedObservation.tournamentYear,
      date: selectedObservation.date,
      split: input.split,
      observedOutcome: selectedObservation.observedOutcome,
      selectedProbability: selectedObservation.predictedProbability,
      referenceProbability: referenceObservation.predictedProbability,
      selectedBrierLoss: selectedLosses.brierLoss,
      referenceBrierLoss: referenceLosses.brierLoss,
      brierDelta: selectedLosses.brierLoss - referenceLosses.brierLoss,
      selectedLogLoss: selectedLosses.logLoss,
      referenceLogLoss: referenceLosses.logLoss,
      logLossDelta: selectedLosses.logLoss - referenceLosses.logLoss,
    };
  }).sort(comparePairedLossObservations);
}

function assertExactPairedMatchIds(input: {
  selectedByMatchId: ReadonlyMap<string, EvaluationObservation>;
  referenceByMatchId: ReadonlyMap<string, EvaluationObservation>;
  split: UncertaintySplit;
}): void {
  const selectedOnly = [...input.selectedByMatchId.keys()]
    .filter((matchId) => !input.referenceByMatchId.has(matchId))
    .sort(compareCodePoints);
  const referenceOnly = [...input.referenceByMatchId.keys()]
    .filter((matchId) => !input.selectedByMatchId.has(matchId))
    .sort(compareCodePoints);

  if (selectedOnly.length > 0) {
    throw new Error(
      `Unmatched selected divisor observation in ${input.split} split: "${selectedOnly[0]}".`,
    );
  }
  if (referenceOnly.length > 0) {
    throw new Error(
      `Unmatched reference divisor observation in ${input.split} split: "${referenceOnly[0]}".`,
    );
  }
}

function toUniqueMap(
  observations: readonly EvaluationObservation[],
  label: string,
): Map<string, EvaluationObservation> {
  const byMatchId = new Map<string, EvaluationObservation>();
  for (const observation of observations) {
    if (byMatchId.has(observation.matchId)) {
      throw new Error(`Duplicate ${label} paired observation "${observation.matchId}".`);
    }
    byMatchId.set(observation.matchId, observation);
  }
  return byMatchId;
}

function validatePair(
  selected: EvaluationObservation,
  reference: EvaluationObservation,
  split: UncertaintySplit,
): void {
  if (selected.tournamentYear !== reference.tournamentYear) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched tournament year.`);
  }
  if (selected.date !== reference.date) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched date.`);
  }
  if (selected.stage !== reference.stage) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched stage.`);
  }
  if (
    selected.homeTeamId !== reference.homeTeamId ||
    selected.awayTeamId !== reference.awayTeamId
  ) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched teams.`);
  }
  if (selected.observedOutcome !== reference.observedOutcome) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched actual result.`);
  }
  if (getSplit(selected.tournamentYear) !== split) {
    throw new Error(`Paired match "${selected.matchId}" has mismatched split.`);
  }
}

function getSplit(tournamentYear: number): UncertaintySplit {
  if (tournamentYear >= 1930 && tournamentYear <= 2006) {
    return "development";
  }
  if (tournamentYear >= 2010 && tournamentYear <= 2018) {
    return "validation";
  }
  if (tournamentYear === 2022) {
    return "holdout";
  }
  throw new Error(`Unsupported uncertainty split year "${tournamentYear}".`);
}

function validateProbability(probability: number, matchId: string): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error(`Paired observation "${matchId}" has invalid probability.`);
  }
}

function comparePairedLossObservations(
  left: PairedLossObservation,
  right: PairedLossObservation,
): number {
  return compareCodePoints(left.split, right.split) ||
    compareCodePoints(left.date, right.date) ||
    compareCodePoints(left.matchId, right.matchId);
}
