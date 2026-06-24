export interface ExpectedScoreInput {
  homeRating: number;
  awayRating: number;
  divisor: number;
  homeAdvantage?: number;
}

export function calculateHistoricalEloExpectedScore({
  homeRating,
  awayRating,
  divisor,
  homeAdvantage = 0,
}: ExpectedScoreInput): number {
  assertFinite(homeRating, "homeRating");
  assertFinite(awayRating, "awayRating");
  assertFinite(homeAdvantage, "homeAdvantage");

  if (!Number.isFinite(divisor) || divisor <= 0) {
    throw new Error("Sequential Elo divisor must be a positive finite number.");
  }

  const exponent = calculateBase10Exponent({
    homeRating,
    awayRating,
    homeAdvantage,
    divisor,
  });
  const boundedOdds = 10 ** -Math.abs(exponent);
  const expectedScore =
    exponent >= 0
      ? boundedOdds / (1 + boundedOdds)
      : 1 / (1 + boundedOdds);

  // Floating-point saturation is bounded at the closest symmetric, machine-safe
  // open interval. This does not impose an application-level probability floor.
  return Math.min(
    1 - Number.EPSILON,
    Math.max(Number.EPSILON, expectedScore),
  );
}

function calculateBase10Exponent(input: {
  homeRating: number;
  awayRating: number;
  homeAdvantage: number;
  divisor: number;
}): number {
  const directDifference =
    input.awayRating - input.homeRating - input.homeAdvantage;

  if (Number.isFinite(directDifference)) {
    return directDifference / input.divisor;
  }

  const scale = Math.max(
    Math.abs(input.homeRating),
    Math.abs(input.awayRating),
    Math.abs(input.homeAdvantage),
    1,
  );
  const scaledDifference =
    input.awayRating / scale -
    input.homeRating / scale -
    input.homeAdvantage / scale;

  if (scaledDifference === 0) {
    return 0;
  }

  const scaledDivisor = input.divisor / scale;
  if (scaledDivisor === 0) {
    return scaledDifference > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  return scaledDifference / scaledDivisor;
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Sequential Elo ${field} must be finite.`);
  }
}
