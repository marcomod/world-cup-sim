import { compareCodePoints } from "../sequential-elo/compareCodePoints.ts";
import {
  calculateMeanDelta,
  filterPairedLossesBySplit,
} from "./pairedLosses.ts";
import type {
  DevelopmentTournamentMetricSummary,
  DevelopmentTournamentSummary,
  PairedLossObservation,
  TournamentMetricResult,
  TournamentSensitivityResult,
  UncertaintyMetric,
} from "./types.ts";

export function calculateTournamentSensitivity(
  observations: readonly PairedLossObservation[],
): TournamentSensitivityResult {
  const validation = filterPairedLossesBySplit(observations, "validation");
  const development = filterPairedLossesBySplit(observations, "development");
  const validationYears = [2010, 2014, 2018];

  return {
    validationByTournament: validationYears.map((year) =>
      calculateTournamentMetricResult(year, validation.filter(
        (observation) => observation.tournamentYear === year,
      ))
    ),
    validationLeaveOneTournamentOut: validationYears.map((excludedYear) => {
      const included = validation.filter(
        (observation) => observation.tournamentYear !== excludedYear,
      );
      return {
        ...calculateTournamentMetricResult(excludedYear, included),
        excludedTournamentYear: excludedYear,
        includedTournamentYears: validationYears.filter((year) => year !== excludedYear),
      };
    }),
    developmentSummary: calculateDevelopmentSummary(development),
    sensitivityPolicy:
      "Tournament slices are descriptive sensitivity checks only; they do not rerank candidates, replace the primary metric, or create a majority-vote decision.",
  };
}

export function calculateTournamentMetricResult(
  tournamentYear: number,
  observations: readonly PairedLossObservation[],
): TournamentMetricResult {
  if (observations.length === 0) {
    throw new Error(`Tournament ${tournamentYear} has no paired observations.`);
  }

  const selectedBrier = mean(observations.map((observation) => observation.selectedBrierLoss));
  const referenceBrier = mean(observations.map((observation) => observation.referenceBrierLoss));
  const selectedLogLoss = mean(observations.map((observation) => observation.selectedLogLoss));
  const referenceLogLoss = mean(observations.map((observation) => observation.referenceLogLoss));
  const brierDelta = selectedBrier - referenceBrier;
  const logLossDelta = selectedLogLoss - referenceLogLoss;

  return {
    tournamentYear,
    sampleSize: observations.length,
    selected: {
      brierScore: selectedBrier,
      logLoss: selectedLogLoss,
    },
    reference: {
      brierScore: referenceBrier,
      logLoss: referenceLogLoss,
    },
    deltas: {
      brierScore: brierDelta,
      logLoss: logLossDelta,
    },
    favors: {
      brierScore: favorFromDelta(brierDelta),
      logLoss: favorFromDelta(logLossDelta),
    },
  };
}

function calculateDevelopmentSummary(
  observations: readonly PairedLossObservation[],
): DevelopmentTournamentSummary {
  const byYear = groupByTournamentYear(observations);
  const tournamentResults = [...byYear.entries()]
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, yearObservations]) =>
      calculateTournamentMetricResult(year, yearObservations)
    );

  return {
    tournamentSampleSizes: tournamentResults.map((result) => ({
      tournamentYear: result.tournamentYear,
      sampleSize: result.sampleSize,
    })),
    brierScore: summarizeTournamentMetric(tournamentResults, "brierScore"),
    logLoss: summarizeTournamentMetric(tournamentResults, "logLoss"),
  };
}

function summarizeTournamentMetric(
  results: readonly TournamentMetricResult[],
  metric: UncertaintyMetric,
): DevelopmentTournamentMetricSummary {
  const deltas = results.map((result) => result.deltas[metric])
    .sort((left, right) => left - right);
  const roundedDeltas = results.map((result) =>
    roundSixDecimals(result.deltas[metric])
  );

  return {
    tournamentCount: results.length,
    tournamentsFavoringSelected: roundedDeltas.filter((delta) => delta < 0).length,
    tournamentsFavoringReference: roundedDeltas.filter((delta) => delta > 0).length,
    tournamentsTiedAtSixDecimals: roundedDeltas.filter((delta) => delta === 0).length,
    medianTournamentDelta: median(deltas),
    minTournamentDelta: deltas[0],
    maxTournamentDelta: deltas[deltas.length - 1],
  };
}

function groupByTournamentYear(
  observations: readonly PairedLossObservation[],
): Map<number, PairedLossObservation[]> {
  const byYear = new Map<number, PairedLossObservation[]>();
  for (const observation of [...observations].sort(compareObservation)) {
    const yearObservations = byYear.get(observation.tournamentYear) ?? [];
    yearObservations.push(observation);
    byYear.set(observation.tournamentYear, yearObservations);
  }
  return byYear;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate mean for an empty array.");
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate median for an empty array.");
  }
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
}

function favorFromDelta(delta: number): "selected" | "reference" | "tied" {
  const roundedDelta = roundSixDecimals(delta);
  if (roundedDelta < 0) {
    return "selected";
  }
  if (roundedDelta > 0) {
    return "reference";
  }
  return "tied";
}

function roundSixDecimals(value: number): number {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function compareObservation(
  left: PairedLossObservation,
  right: PairedLossObservation,
): number {
  return left.tournamentYear - right.tournamentYear ||
    compareCodePoints(left.date, right.date) ||
    compareCodePoints(left.matchId, right.matchId);
}

export function calculateSplitObservedMeanDelta(input: {
  observations: readonly PairedLossObservation[];
  metric: UncertaintyMetric;
}): number {
  return calculateMeanDelta(input.observations, input.metric);
}
