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
  teamAIsWinner: boolean;
  teamBIsWinner: boolean;
  teamAScoreLabel: string | null;
  teamBScoreLabel: string | null;
  scorelineLabel: string | null;
  resultDetailLabel: string | null;
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
    teamAIsWinner: match.winnerId !== undefined && match.winnerId === match.teamAId,
    teamBIsWinner: match.winnerId !== undefined && match.winnerId === match.teamBId,
    teamAScoreLabel: match.score ? String(match.score.teamAGoals) : null,
    teamBScoreLabel: match.score ? String(match.score.teamBGoals) : null,
    scorelineLabel: formatScoreline(match),
    resultDetailLabel: match.score ? formatDecisionLabel(match.score.decidedBy) : null,
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

function formatScoreline(match: Match): string | null {
  if (!match.score) {
    return null;
  }

  const scoreline = `${match.score.teamAGoals}-${match.score.teamBGoals}`;

  if (
    match.score.decidedBy === "penalties" &&
    match.score.teamAPenalties !== undefined &&
    match.score.teamBPenalties !== undefined
  ) {
    return `${scoreline} (${match.score.teamAPenalties}-${match.score.teamBPenalties} pens)`;
  }

  return scoreline;
}

function formatDecisionLabel(decidedBy: NonNullable<Match["score"]>["decidedBy"]): string {
  if (decidedBy === "extra_time") {
    return "AET";
  }

  if (decidedBy === "penalties") {
    return "Pens";
  }

  return "FT";
}

function formatWholeProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPreciseProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
