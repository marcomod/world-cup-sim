import { simulateMatch } from "./simulateMatch";
import type {
  BracketSimulationOptions,
  Match,
  RatingsByTeamId,
  RNG,
  TournamentSimulationResult,
} from "./types";

export function simulateBracket(
  matches: Match[],
  ratingsByTeamId: RatingsByTeamId,
  rng: RNG,
  options: BracketSimulationOptions = {},
): TournamentSimulationResult {
  const simulatedMatches = matches.map((match) => ({ ...match }));
  const matchesById = new Map(simulatedMatches.map((match) => [match.id, match]));

  // V1 bracket data is ordered from Round of 32 through Final, so advancing
  // winners fills each future match before that future match is processed.
  for (const match of simulatedMatches) {
    const result = simulateMatch(match, ratingsByTeamId, rng, options);
    match.winnerId = result.winnerId;

    if (result.score) {
      match.score = result.score;
    }

    if (!match.nextMatchId) {
      continue;
    }

    if (!match.nextSlot) {
      throw new Error(`Match "${match.id}" has nextMatchId but no nextSlot.`);
    }

    const nextMatch = matchesById.get(match.nextMatchId);

    if (!nextMatch) {
      throw new Error(`Match "${match.id}" advances to missing match "${match.nextMatchId}".`);
    }

    nextMatch[match.nextSlot] = result.winnerId;
  }

  const finalMatch = simulatedMatches[simulatedMatches.length - 1];

  if (!finalMatch || finalMatch.round !== "final") {
    throw new Error("Cannot determine champion because the final match is missing or not last.");
  }

  if (!finalMatch.winnerId) {
    throw new Error(`Cannot determine champion because final match "${finalMatch.id}" has no winner.`);
  }

  return {
    championId: finalMatch.winnerId,
    matches: simulatedMatches,
  };
}
