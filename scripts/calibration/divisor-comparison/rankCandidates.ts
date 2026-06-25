import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
  DIVISOR_SELECTION_PROTOCOL,
  validateAscendingCandidateGrid,
  validateCandidateDivisor,
} from "./candidateDivisors.ts";
import type {
  DivisorCandidateMetrics,
  DivisorComparisonKeys,
  DivisorRankingCandidate,
  DivisorRankingEntry,
  SelectionDecision,
  SelectionProtocol,
} from "./types.ts";

export function rankDivisorCandidates(input: {
  candidates: readonly DivisorRankingCandidate[];
  protocol?: SelectionProtocol;
}): {
  ranking: DivisorRankingEntry[];
  selectionDecision: SelectionDecision;
} {
  const protocol = input.protocol ?? DIVISOR_SELECTION_PROTOCOL;
  validateProtocol(protocol);
  validateAscendingCandidateGrid(DIVISOR_CANDIDATES);

  const byDivisor = new Map<number, DivisorRankingCandidate>();
  for (const candidate of input.candidates) {
    validateCandidateDivisor(candidate.divisor);
    if (byDivisor.has(candidate.divisor)) {
      throw new Error(`Duplicate historical Elo divisor result "${candidate.divisor}".`);
    }
    if (!(DIVISOR_CANDIDATES as readonly number[]).includes(candidate.divisor)) {
      throw new Error(`Unexpected historical Elo divisor result "${candidate.divisor}".`);
    }
    validatePrimaryMetrics(candidate.divisor, "development", candidate.development);
    validatePrimaryMetrics(candidate.divisor, "validation", candidate.validation);
    byDivisor.set(candidate.divisor, candidate);
  }

  for (const divisor of DIVISOR_CANDIDATES) {
    if (!byDivisor.has(divisor)) {
      throw new Error(`Missing historical Elo divisor result "${divisor}".`);
    }
  }

  const candidates = DIVISOR_CANDIDATES.map((divisor) => byDivisor.get(divisor)!);
  validatePrimarySampleSizes(candidates);
  const ordered = [...candidates].sort(compareRankingCandidates);
  const current = byDivisor.get(CURRENT_PRODUCTION_DIVISOR)!;
  const best = ordered[0];
  const currentValidationBrier = requireMetric(
    current.validation.brierScore,
    current.divisor,
    "validation Brier score",
  );
  const currentValidationLogLoss = requireMetric(
    current.validation.logLoss,
    current.divisor,
    "validation log loss",
  );
  const bestValidationBrier = requireMetric(
    best.validation.brierScore,
    best.divisor,
    "validation Brier score",
  );

  const ranking = ordered.map((candidate, index): DivisorRankingEntry => {
    const comparisonKeys = createComparisonKeys(candidate);

    return {
      rank: index + 1,
      divisor: candidate.divisor,
      validation: { ...candidate.validation },
      development: { ...candidate.development },
      comparisonKeys,
      deltaFromCurrentDivisor: {
        validationBrierScore:
          comparisonKeys.validationBrierScore - currentValidationBrier,
        validationLogLoss:
          comparisonKeys.validationLogLoss - currentValidationLogLoss,
      },
      deltaFromBestValidationBrierScore:
        comparisonKeys.validationBrierScore - bestValidationBrier,
    };
  });

  return {
    ranking,
    selectionDecision: {
      provisionalSelectedDivisor: ranking[0].divisor,
      selectedRank: 1,
      productionDivisor: CURRENT_PRODUCTION_DIVISOR,
      productionChangeApplied: false,
      holdoutStatus: "sealed_unopened",
      status: "provisional_validation_selection",
    },
  };
}

function compareRankingCandidates(
  left: DivisorRankingCandidate,
  right: DivisorRankingCandidate,
): number {
  const leftKeys = createComparisonKeys(left);
  const rightKeys = createComparisonKeys(right);

  return leftKeys.validationBrierScore - rightKeys.validationBrierScore ||
    leftKeys.validationLogLoss - rightKeys.validationLogLoss ||
    leftKeys.developmentBrierScore - rightKeys.developmentBrierScore ||
    leftKeys.developmentLogLoss - rightKeys.developmentLogLoss ||
    leftKeys.distanceFromCurrentDivisor - rightKeys.distanceFromCurrentDivisor ||
    leftKeys.divisor - rightKeys.divisor;
}

function createComparisonKeys(
  candidate: DivisorRankingCandidate,
): DivisorComparisonKeys {
  return {
    validationBrierScore: requireMetric(
      candidate.validation.brierScore,
      candidate.divisor,
      "validation Brier score",
    ),
    validationLogLoss: requireMetric(
      candidate.validation.logLoss,
      candidate.divisor,
      "validation log loss",
    ),
    developmentBrierScore: requireMetric(
      candidate.development.brierScore,
      candidate.divisor,
      "development Brier score",
    ),
    developmentLogLoss: requireMetric(
      candidate.development.logLoss,
      candidate.divisor,
      "development log loss",
    ),
    distanceFromCurrentDivisor: Math.abs(
      candidate.divisor - CURRENT_PRODUCTION_DIVISOR,
    ),
    divisor: candidate.divisor,
  };
}

function validatePrimaryMetrics(
  divisor: number,
  split: "development" | "validation",
  metrics: DivisorCandidateMetrics,
): void {
  if (
    !Number.isInteger(metrics.selectedSampleSize) ||
    !Number.isInteger(metrics.scoredSampleSize) ||
    metrics.selectedSampleSize < 0 ||
    metrics.scoredSampleSize <= 0 ||
    metrics.scoredSampleSize > metrics.selectedSampleSize
  ) {
    throw new Error(
      `Historical Elo divisor ${divisor} has invalid ${split} primary sample sizes.`,
    );
  }

  for (const [name, value] of [
    ["Brier score", metrics.brierScore],
    ["log loss", metrics.logLoss],
    ["accuracy", metrics.accuracy],
    ["mean predicted probability", metrics.meanPredictedProbability],
    ["observed home-win rate", metrics.observedHomeWinRate],
  ] as const) {
    requireMetric(value, divisor, `${split} ${name}`);
  }
}

function validatePrimarySampleSizes(
  candidates: readonly DivisorRankingCandidate[],
): void {
  const reference = candidates[0];

  for (const candidate of candidates.slice(1)) {
    for (const split of ["development", "validation"] as const) {
      if (
        candidate[split].selectedSampleSize !==
          reference[split].selectedSampleSize ||
        candidate[split].scoredSampleSize !== reference[split].scoredSampleSize
      ) {
        throw new Error(
          `Historical Elo divisor ${candidate.divisor} has mismatched ${split} primary sample sizes.`,
        );
      }
    }
  }
}

function requireMetric(
  value: number | null,
  divisor: number,
  label: string,
): number {
  if (value === null || !Number.isFinite(value)) {
    throw new Error(
      `Historical Elo divisor ${divisor} has invalid ${label}; a finite primary metric is required.`,
    );
  }
  return value;
}

function validateProtocol(protocol: SelectionProtocol): void {
  if (JSON.stringify(protocol) !== JSON.stringify(DIVISOR_SELECTION_PROTOCOL)) {
    throw new Error("Historical Elo divisor selection protocol is not supported.");
  }
}
