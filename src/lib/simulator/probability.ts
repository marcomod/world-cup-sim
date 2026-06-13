import type {
  Match,
  MatchupProbability,
  RatingsByTeamId,
  TeamRating,
} from "./types";

export function calculateMatchupProbability(
  teamARating: TeamRating,
  teamBRating: TeamRating,
): MatchupProbability {
  const teamAWinProbability = calculateWinProbabilityFromOverall(
    teamARating.overall,
    teamBRating.overall,
  );

  return {
    teamAId: teamARating.teamId,
    teamBId: teamBRating.teamId,
    teamAWinProbability,
    teamBWinProbability: 1 - teamAWinProbability,
  };
}

export function calculateWinProbabilityFromOverall(
  teamAOverall: number,
  teamBOverall: number,
): number {
  const ratingDiff = teamAOverall - teamBOverall;

  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

export function getMatchupProbabilityForMatch(
  match: Match,
  ratingsByTeamId: RatingsByTeamId,
): MatchupProbability {
  if (!match.teamAId || !match.teamBId) {
    throw new Error(`Cannot calculate matchup probability for incomplete match "${match.id}".`);
  }

  const teamARating = ratingsByTeamId[match.teamAId];
  const teamBRating = ratingsByTeamId[match.teamBId];

  if (!teamARating) {
    throw new Error(`Missing rating for team "${match.teamAId}" in match "${match.id}".`);
  }

  if (!teamBRating) {
    throw new Error(`Missing rating for team "${match.teamBId}" in match "${match.id}".`);
  }

  return calculateMatchupProbability(teamARating, teamBRating);
}
