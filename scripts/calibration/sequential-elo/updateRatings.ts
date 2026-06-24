export interface EloRatingUpdateInput {
  homeRating: number;
  awayRating: number;
  expectedHomeScore: number;
  observedHomeScore: 0 | 0.5 | 1;
  kFactor: number;
}

export interface EloRatingUpdateResult {
  preMatchHomeRating: number;
  preMatchAwayRating: number;
  postMatchHomeRating: number;
  postMatchAwayRating: number;
}

export function updateHistoricalEloRatings({
  homeRating,
  awayRating,
  expectedHomeScore,
  observedHomeScore,
  kFactor,
}: EloRatingUpdateInput): EloRatingUpdateResult {
  assertFinite(homeRating, "homeRating");
  assertFinite(awayRating, "awayRating");

  if (!(expectedHomeScore > 0 && expectedHomeScore < 1)) {
    throw new Error("Sequential Elo expectedHomeScore must be between 0 and 1.");
  }

  if (![0, 0.5, 1].includes(observedHomeScore)) {
    throw new Error("Sequential Elo observedHomeScore must be 0, 0.5, or 1.");
  }

  if (!Number.isFinite(kFactor) || kFactor < 0) {
    throw new Error("Sequential Elo K-factor must be a finite non-negative number.");
  }

  const homeDelta = kFactor * (observedHomeScore - expectedHomeScore);
  const awayDelta =
    kFactor * ((1 - observedHomeScore) - (1 - expectedHomeScore));

  return {
    preMatchHomeRating: homeRating,
    preMatchAwayRating: awayRating,
    postMatchHomeRating: homeRating + homeDelta,
    postMatchAwayRating: awayRating + awayDelta,
  };
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Sequential Elo ${field} must be finite.`);
  }
}

