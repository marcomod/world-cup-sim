import type {
  Match,
  MatchScore,
  RatingsByTeamId,
  RNG,
  TeamId,
  TeamRating,
} from "./types";

const BASE_XG_90 = 1.25;
const ATTACK_BASELINE = 82.5;
const DEFENSE_BASELINE = 81.0;
const ATTACK_WEIGHT = 0.035;
const DEFENSE_WEIGHT = 0.035;
const MIN_XG_90 = 0.25;
const MAX_XG_90 = 3.25;
const EXTRA_TIME_XG_MULTIPLIER = 0.25;

const BASE_PENALTY_CONVERSION = 0.75;
const PENALTY_BASELINE = 80;
const PENALTY_WEIGHT = 0.0025;
const MIN_PENALTY_CONVERSION = 0.68;
const MAX_PENALTY_CONVERSION = 0.82;

interface GoalPair {
  teamAGoals: number;
  teamBGoals: number;
}

interface PenaltyShootoutResult {
  teamAPenalties: number;
  teamBPenalties: number;
}

export function simulateScoreline(
  match: Match,
  ratingsByTeamId: RatingsByTeamId,
  winnerId: TeamId,
  rng: RNG,
): MatchScore {
  if (!match.teamAId || !match.teamBId) {
    throw new Error(`Cannot simulate scoreline for incomplete match "${match.id}".`);
  }

  const teamARating = getRating(match.teamAId, match.id, ratingsByTeamId);
  const teamBRating = getRating(match.teamBId, match.id, ratingsByTeamId);
  const teamAXg = calculateExpectedGoals(teamARating, teamBRating);
  const teamBXg = calculateExpectedGoals(teamBRating, teamARating);

  const regularTime = {
    teamAGoals: samplePoisson(teamAXg, rng),
    teamBGoals: samplePoisson(teamBXg, rng),
  };
  const regularTimeWinnerId = getGoalWinnerId(
    match.teamAId,
    match.teamBId,
    regularTime.teamAGoals,
    regularTime.teamBGoals,
  );

  if (regularTimeWinnerId === winnerId) {
    return {
      ...regularTime,
      decidedBy: "regular_time",
    };
  }

  if (regularTimeWinnerId) {
    return {
      ...adjustGoalsForWinner(regularTime, match.teamAId, winnerId),
      decidedBy: "regular_time",
    };
  }

  const extraTime = {
    teamAGoals: samplePoisson(teamAXg * EXTRA_TIME_XG_MULTIPLIER, rng),
    teamBGoals: samplePoisson(teamBXg * EXTRA_TIME_XG_MULTIPLIER, rng),
  };
  const afterExtraTime = {
    teamAGoals: regularTime.teamAGoals + extraTime.teamAGoals,
    teamBGoals: regularTime.teamBGoals + extraTime.teamBGoals,
  };
  const extraTimeWinnerId = getGoalWinnerId(
    match.teamAId,
    match.teamBId,
    afterExtraTime.teamAGoals,
    afterExtraTime.teamBGoals,
  );

  if (extraTimeWinnerId === winnerId) {
    return {
      ...afterExtraTime,
      decidedBy: "extra_time",
    };
  }

  if (extraTimeWinnerId) {
    // V3 scorelines are conditioned on the already-sampled winner, so a
    // conflicting extra-time sample is adjusted to keep the bracket result stable.
    return {
      ...adjustGoalsForWinner(afterExtraTime, match.teamAId, winnerId),
      decidedBy: "extra_time",
    };
  }

  return {
    ...afterExtraTime,
    ...simulatePenaltyShootout(teamARating, teamBRating, match.teamAId, winnerId, rng),
    decidedBy: "penalties",
  };
}

export function calculateExpectedGoals(
  attackingTeamRating: TeamRating,
  defendingTeamRating: TeamRating,
): number {
  return clamp(
    BASE_XG_90 *
      Math.exp((attackingTeamRating.attack - ATTACK_BASELINE) * ATTACK_WEIGHT) *
      Math.exp((DEFENSE_BASELINE - defendingTeamRating.defense) * DEFENSE_WEIGHT),
    MIN_XG_90,
    MAX_XG_90,
  );
}

export function samplePoisson(lambda: number, rng: RNG): number {
  if (lambda <= 0) {
    return 0;
  }

  const limit = Math.exp(-lambda);
  let product = 1;
  let goals = 0;

  do {
    goals += 1;
    product *= rng.next();
  } while (product > limit);

  return goals - 1;
}

function simulatePenaltyShootout(
  teamARating: TeamRating,
  teamBRating: TeamRating,
  teamAId: TeamId,
  winnerId: TeamId,
  rng: RNG,
): PenaltyShootoutResult {
  const teamAConversion = getPenaltyConversionProbability(teamARating);
  const teamBConversion = getPenaltyConversionProbability(teamBRating);
  let teamAPenalties = 0;
  let teamBPenalties = 0;
  let teamAKicks = 0;
  let teamBKicks = 0;

  for (let kickIndex = 0; kickIndex < 5; kickIndex += 1) {
    teamAKicks += 1;
    teamAPenalties += rng.next() < teamAConversion ? 1 : 0;

    if (shootoutCannotBeCaught(teamAPenalties, teamBPenalties, teamAKicks, teamBKicks)) {
      break;
    }

    teamBKicks += 1;
    teamBPenalties += rng.next() < teamBConversion ? 1 : 0;

    if (shootoutCannotBeCaught(teamBPenalties, teamAPenalties, teamBKicks, teamAKicks)) {
      break;
    }
  }

  while (teamAPenalties === teamBPenalties) {
    teamAPenalties += rng.next() < teamAConversion ? 1 : 0;
    teamBPenalties += rng.next() < teamBConversion ? 1 : 0;
  }

  const teamAWonShootout = teamAPenalties > teamBPenalties;
  const teamAShouldWin = winnerId === teamAId;

  if (teamAWonShootout === teamAShouldWin) {
    return { teamAPenalties, teamBPenalties };
  }

  return {
    teamAPenalties: teamBPenalties,
    teamBPenalties: teamAPenalties,
  };
}

function shootoutCannotBeCaught(
  leadingPenalties: number,
  trailingPenalties: number,
  leadingKicks: number,
  trailingKicks: number,
): boolean {
  const leadingKicksRemaining = 5 - leadingKicks;
  const trailingKicksRemaining = 5 - trailingKicks;

  return leadingPenalties + leadingKicksRemaining < trailingPenalties ||
    trailingPenalties + trailingKicksRemaining < leadingPenalties;
}

function getPenaltyConversionProbability(rating: TeamRating): number {
  return clamp(
    BASE_PENALTY_CONVERSION +
      ((rating.penalties ?? PENALTY_BASELINE) - PENALTY_BASELINE) * PENALTY_WEIGHT,
    MIN_PENALTY_CONVERSION,
    MAX_PENALTY_CONVERSION,
  );
}

function adjustGoalsForWinner(
  goals: GoalPair,
  teamAId: TeamId,
  winnerId: TeamId,
): GoalPair {
  if (winnerId === teamAId) {
    return {
      teamAGoals: goals.teamBGoals + 1,
      teamBGoals: goals.teamBGoals,
    };
  }

  return {
    teamAGoals: goals.teamAGoals,
    teamBGoals: goals.teamAGoals + 1,
  };
}

function getGoalWinnerId(
  teamAId: TeamId,
  teamBId: TeamId,
  teamAGoals: number,
  teamBGoals: number,
): TeamId | null {
  if (teamAGoals > teamBGoals) {
    return teamAId;
  }

  if (teamBGoals > teamAGoals) {
    return teamBId;
  }

  return null;
}

function getRating(
  teamId: TeamId,
  matchId: string,
  ratingsByTeamId: RatingsByTeamId,
): TeamRating {
  const rating = ratingsByTeamId[teamId];

  if (!rating) {
    throw new Error(`Missing rating for team "${teamId}" in match "${matchId}".`);
  }

  return rating;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
