import type { SelectionProtocol } from "./types.ts";

export const DIVISOR_COMPARISON_MODEL_VERSION =
  "historical-elo-divisor-comparison-v1" as const;
export const CURRENT_PRODUCTION_DIVISOR = 400 as const;
export const DIVISOR_CANDIDATES = Object.freeze([
  200,
  250,
  300,
  350,
  400,
  450,
  500,
  600,
] as const);

export const DIVISOR_SELECTION_PROTOCOL = {
  primaryCohort: "knockout_decisive_only",
  primaryMetric: "validation_brier_score",
  secondaryMetric: "validation_log_loss",
  tieBreakRules: [
    "development_brier_score",
    "development_log_loss",
    "distance_from_current_divisor_400",
    "smaller_numeric_divisor",
  ],
  rankingPrecision: "full_precision",
  eligibleSplits: ["development", "validation"],
  excludedSplits: ["holdout", "full_history"],
  accuracyUsedForSelection: false,
} as const satisfies SelectionProtocol;

export function validateCandidateDivisor(divisor: number): void {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    throw new Error(
      `Historical Elo divisor candidate must be a positive finite number; received "${divisor}".`,
    );
  }
}

export function validateAscendingCandidateGrid(
  divisors: readonly number[],
): void {
  const seen = new Set<number>();

  for (let index = 0; index < divisors.length; index += 1) {
    const divisor = divisors[index];
    validateCandidateDivisor(divisor);

    if (seen.has(divisor)) {
      throw new Error(`Duplicate historical Elo divisor candidate "${divisor}".`);
    }
    if (index > 0 && divisor <= divisors[index - 1]) {
      throw new Error("Historical Elo divisor candidate grid must be strictly ascending.");
    }

    seen.add(divisor);
  }
}

export function validateCandidateExecutionOrder(
  executionOrder: readonly number[],
): void {
  validateAscendingCandidateGrid(DIVISOR_CANDIDATES);

  if (executionOrder.length !== DIVISOR_CANDIDATES.length) {
    throw new Error(
      `Historical Elo divisor execution order must contain exactly ${DIVISOR_CANDIDATES.length} candidates.`,
    );
  }

  const seen = new Set<number>();
  for (const divisor of executionOrder) {
    validateCandidateDivisor(divisor);
    if (seen.has(divisor)) {
      throw new Error(`Duplicate historical Elo divisor candidate "${divisor}".`);
    }
    if (!(DIVISOR_CANDIDATES as readonly number[]).includes(divisor)) {
      throw new Error(`Unexpected historical Elo divisor candidate "${divisor}".`);
    }
    seen.add(divisor);
  }

  for (const divisor of DIVISOR_CANDIDATES) {
    if (!seen.has(divisor)) {
      throw new Error(`Missing historical Elo divisor candidate "${divisor}".`);
    }
  }
}
