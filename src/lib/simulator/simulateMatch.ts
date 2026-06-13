import { getMatchupProbabilityForMatch } from "./probability";
import type { Match, MatchSimulationResult, RatingsByTeamId, RNG } from "./types";

export function simulateMatch(
  match: Match,
  ratingsByTeamId: RatingsByTeamId,
  rng: RNG,
): MatchSimulationResult {
  if (!match.teamAId || !match.teamBId) {
    throw new Error(`Cannot simulate incomplete match "${match.id}".`);
  }

  const matchupProbability = getMatchupProbabilityForMatch(match, ratingsByTeamId);
  const teamAWins = rng.next() < matchupProbability.teamAWinProbability;

  return {
    winnerId: teamAWins ? match.teamAId : match.teamBId,
    loserId: teamAWins ? match.teamBId : match.teamAId,
    teamAWinProbability: matchupProbability.teamAWinProbability,
    teamBWinProbability: matchupProbability.teamBWinProbability,
  };
}
