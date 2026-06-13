import { getMatchupProbabilityForMatch } from "@/src/lib/simulator/probability";
import type {
  Match,
  MatchupProbability,
  RatingsByTeamId,
  TeamId,
  TeamsById,
  TournamentRound,
} from "@/src/lib/simulator/types";

export interface MatchCardViewModel {
  id: string;
  round: TournamentRound;
  statusLabel: string;
  teamAName: string;
  teamBName: string;
  teamAIsKnown: boolean;
  teamBIsKnown: boolean;
  teamAWinProbabilityLabel: string | null;
  teamBWinProbabilityLabel: string | null;
}

export interface MatchupOddsRowViewModel {
  matchId: string;
  teamAName: string;
  teamBName: string;
  teamAWinProbabilityLabel: string;
  teamBWinProbabilityLabel: string;
}

export type PlayableMatch = Match & {
  teamAId: TeamId;
  teamBId: TeamId;
  winnerId?: undefined;
};

export function isPlayableMatch(match: Match): match is PlayableMatch {
  return match.teamAId !== null && match.teamBId !== null && !match.winnerId;
}

export function getTeamDisplayName(teamId: TeamId | null, teamsById: TeamsById): string {
  if (!teamId) {
    return "Awaiting teams";
  }

  return teamsById[teamId]?.name ?? teamId.toUpperCase();
}

export function createMatchCardViewModel(
  match: Match,
  ratingsByTeamId: RatingsByTeamId,
  teamsById: TeamsById,
): MatchCardViewModel {
  const probability =
    match.teamAId && match.teamBId
      ? getMatchupProbabilityForMatch(match, ratingsByTeamId)
      : null;

  return {
    id: match.id,
    round: match.round,
    statusLabel: getMatchStatusLabel(match, teamsById),
    teamAName: getTeamDisplayName(match.teamAId, teamsById),
    teamBName: getTeamDisplayName(match.teamBId, teamsById),
    teamAIsKnown: match.teamAId !== null,
    teamBIsKnown: match.teamBId !== null,
    teamAWinProbabilityLabel: probability
      ? formatWholeProbability(probability.teamAWinProbability)
      : null,
    teamBWinProbabilityLabel: probability
      ? formatWholeProbability(probability.teamBWinProbability)
      : null,
  };
}

export function createMatchupOddsRows(
  matches: Match[],
  ratingsByTeamId: RatingsByTeamId,
  teamsById: TeamsById,
): MatchupOddsRowViewModel[] {
  return matches.filter(isPlayableMatch).map((match) => {
    const probability = getMatchupProbabilityForMatch(match, ratingsByTeamId);

    return createMatchupOddsRow(probability, teamsById, match.id);
  });
}

function createMatchupOddsRow(
  probability: MatchupProbability,
  teamsById: TeamsById,
  matchId: string,
): MatchupOddsRowViewModel {
  return {
    matchId,
    teamAName: getTeamDisplayName(probability.teamAId, teamsById),
    teamBName: getTeamDisplayName(probability.teamBId, teamsById),
    teamAWinProbabilityLabel: formatPreciseProbability(probability.teamAWinProbability),
    teamBWinProbabilityLabel: formatPreciseProbability(probability.teamBWinProbability),
  };
}

function getMatchStatusLabel(match: Match, teamsById: TeamsById): string {
  if (match.winnerId) {
    return `Winner: ${getTeamDisplayName(match.winnerId, teamsById)}`;
  }

  if (!match.teamAId || !match.teamBId) {
    return "Awaiting teams";
  }

  return "Ready";
}

function formatWholeProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPreciseProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
