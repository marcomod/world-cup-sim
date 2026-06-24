import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import {
  buildHistoricalPredictionObservation,
  getObservedHomeScore,
} from "./buildHistoricalPredictionObservations.ts";
import { calculateHistoricalEloExpectedScore } from "./expectedScore.ts";
import {
  SEQUENTIAL_ELO_MODEL_VERSION,
  type PreMatchEloSnapshot,
  type SequentialEloConfig,
  type SequentialEloReconstructionResult,
  type TeamRatingState,
} from "./types.ts";
import { updateHistoricalEloRatings } from "./updateRatings.ts";
import { compareCodePoints } from "./compareCodePoints.ts";
import { validateReconstructionInput } from "./validateReconstructionInput.ts";

export const BASELINE_SEQUENTIAL_ELO_CONFIG: Readonly<SequentialEloConfig> = Object.freeze({
  initialRating: 1500,
  kFactor: 20,
  divisor: 400,
  homeAdvantage: 0,
  penaltyUpdateOutcome: "draw",
  nonDecisiveUpdateOutcome: "draw",
});

const SAME_DAY_ORDERING_POLICY =
  "Matches are ordered by date, then stable matchId when kickoff times are unavailable.";

export function reconstructHistoricalElo(
  matches: readonly NormalizedHistoricalMatch[],
  config: SequentialEloConfig = { ...BASELINE_SEQUENTIAL_ELO_CONFIG },
): SequentialEloReconstructionResult {
  validateConfig(config);
  validateReconstructionInput(matches);

  const orderedMatches = [...matches].sort(
    (matchA, matchB) =>
      compareCodePoints(matchA.date, matchB.date) ||
      compareCodePoints(matchA.matchId, matchB.matchId),
  );
  const ratingsByTeamId = new Map<string, TeamRatingState>();
  const observations: SequentialEloReconstructionResult["observations"] = [];
  const updates: SequentialEloReconstructionResult["updates"] = [];

  for (const match of orderedMatches) {
    const homeState = getOrCreateTeamState(
      ratingsByTeamId,
      match.teamAId,
      config.initialRating,
    );
    const awayState = getOrCreateTeamState(
      ratingsByTeamId,
      match.teamBId,
      config.initialRating,
    );
    const preMatch: PreMatchEloSnapshot = {
      homeTeamId: match.teamAId,
      awayTeamId: match.teamBId,
      homeRating: homeState.rating,
      awayRating: awayState.rating,
    };
    const predictedHomeScore = calculateHistoricalEloExpectedScore({
      homeRating: preMatch.homeRating,
      awayRating: preMatch.awayRating,
      divisor: config.divisor,
      homeAdvantage: config.homeAdvantage,
    });
    const observedHomeScore = getObservedHomeScore(match);

    observations.push(
      buildHistoricalPredictionObservation({
        match,
        preMatch,
        predictedHomeScore,
        observedHomeScore,
      }),
    );

    const update = updateHistoricalEloRatings({
      homeRating: preMatch.homeRating,
      awayRating: preMatch.awayRating,
      expectedHomeScore: predictedHomeScore,
      observedHomeScore,
      kFactor: config.kFactor,
    });

    ratingsByTeamId.set(match.teamAId, {
      teamId: match.teamAId,
      rating: update.postMatchHomeRating,
      matchesPlayed: homeState.matchesPlayed + 1,
    });
    ratingsByTeamId.set(match.teamBId, {
      teamId: match.teamBId,
      rating: update.postMatchAwayRating,
      matchesPlayed: awayState.matchesPlayed + 1,
    });
    updates.push({
      matchId: match.matchId,
      date: match.date,
      homeTeamId: match.teamAId,
      awayTeamId: match.teamBId,
      observedHomeScore,
      expectedHomeScore: predictedHomeScore,
      ...update,
    });
  }

  const dateCounts = countMatchesByDate(orderedMatches);
  const sameDayCounts = [...dateCounts.values()].filter((count) => count > 1);
  const finalRatings = [...ratingsByTeamId.values()].sort((teamA, teamB) =>
    compareCodePoints(teamA.teamId, teamB.teamId),
  );

  return {
    observations,
    updates,
    finalRatings,
    metadata: {
      modelVersion: SEQUENTIAL_ELO_MODEL_VERSION,
      matchCount: orderedMatches.length,
      teamCount: finalRatings.length,
      firstDate: orderedMatches[0]?.date ?? null,
      lastDate: orderedMatches[orderedMatches.length - 1]?.date ?? null,
      multiMatchDateCount: sameDayCounts.length,
      matchesOnMultiMatchDates: sameDayCounts.reduce((sum, count) => sum + count, 0),
      maxMatchesOnSingleDate: Math.max(0, ...sameDayCounts),
      sameDayOrderingPolicy: SAME_DAY_ORDERING_POLICY,
      config: Object.freeze({ ...config }),
    },
  };
}

function getOrCreateTeamState(
  ratingsByTeamId: Map<string, TeamRatingState>,
  teamId: string,
  initialRating: number,
): TeamRatingState {
  const existing = ratingsByTeamId.get(teamId);

  if (existing) {
    return existing;
  }

  const initialState = { teamId, rating: initialRating, matchesPlayed: 0 };
  ratingsByTeamId.set(teamId, initialState);
  return initialState;
}

function countMatchesByDate(
  matches: readonly NormalizedHistoricalMatch[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const match of matches) {
    counts.set(match.date, (counts.get(match.date) ?? 0) + 1);
  }

  return counts;
}

function validateConfig(config: SequentialEloConfig): void {
  if (!Number.isFinite(config.initialRating)) {
    throw new Error("Sequential Elo initialRating must be finite.");
  }

  if (!Number.isFinite(config.kFactor) || config.kFactor < 0) {
    throw new Error("Sequential Elo kFactor must be finite and non-negative.");
  }

  if (!Number.isFinite(config.divisor) || config.divisor <= 0) {
    throw new Error("Sequential Elo divisor must be positive and finite.");
  }

  if (!Number.isFinite(config.homeAdvantage)) {
    throw new Error("Sequential Elo homeAdvantage must be finite.");
  }

  if (
    config.penaltyUpdateOutcome !== "draw" ||
    config.nonDecisiveUpdateOutcome !== "draw"
  ) {
    throw new Error(
      "Sequential Elo baseline requires penalty and non-decisive outcomes to update as draws.",
    );
  }
}
