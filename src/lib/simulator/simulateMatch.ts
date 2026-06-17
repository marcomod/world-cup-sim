import { getMatchupProbabilityForMatch } from "./probability";
import { simulateScoreline } from "./scoreline";
import type {
  Match,
  MatchSimulationOptions,
  MatchSimulationResult,
  RatingsByTeamId,
  RNG,
} from "./types";

export function simulateMatch(
  match: Match,
  ratingsByTeamId: RatingsByTeamId,
  rng: RNG,
  options: MatchSimulationOptions = {},
): MatchSimulationResult {
  if (!match.teamAId || !match.teamBId) {
    throw new Error(`Cannot simulate incomplete match "${match.id}".`);
  }

  const matchupProbability = getMatchupProbabilityForMatch(match, ratingsByTeamId);
  const teamAWins = rng.next() < matchupProbability.teamAWinProbability;
  const winnerId = teamAWins ? match.teamAId : match.teamBId;
  const loserId = teamAWins ? match.teamBId : match.teamAId;

  const result: MatchSimulationResult = {
    winnerId,
    loserId,
    teamAWinProbability: matchupProbability.teamAWinProbability,
    teamBWinProbability: matchupProbability.teamBWinProbability,
  };

  if (!options.includeScoreline) {
    return result;
  }

  if (!options.scoreRng) {
    throw new Error(
      `Cannot simulate scoreline for match "${match.id}" without scoreRng. Pass a separate scoreRng when includeScoreline is true to preserve winner RNG stability.`,
    );
  }

  return {
    ...result,
    score: simulateScoreline(match, ratingsByTeamId, winnerId, options.scoreRng),
  };
}
