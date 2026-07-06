import { getMatchupProbabilityForMatch } from "@/src/lib/simulator/probability";
import { getTeamFlagPath } from "@/src/data/teamFlags";
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
  nextMatchId: string | null;
  nextSlot: "teamAId" | "teamBId" | null;
  statusLabel: string;
  teamAName: string;
  teamBName: string;
  teamAFlagPath: string;
  teamBFlagPath: string;
  teamAIsKnown: boolean;
  teamBIsKnown: boolean;
  teamAIsWinner: boolean;
  teamBIsWinner: boolean;
  teamAScoreLabel: string | null;
  teamBScoreLabel: string | null;
  scorelineLabel: string | null;
  decisionLabel: string | null;
  resultDetailLabel: string | null;
  accessibleLabel: string;
  teamAWinProbabilityLabel: string | null;
  teamBWinProbabilityLabel: string | null;
}

export interface ChampionViewModel {
  isKnown: boolean;
  teamName: string;
  flagPath: string;
  statusLabel: string;
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

type MixedOfficialLikeMatch = Match & {
  officialResultLocked?: boolean;
  mixedOfficialStatus?: "official_completed" | "pending_simulation";
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
  const teamAName = getTeamDisplayName(match.teamAId, teamsById);
  const teamBName = getTeamDisplayName(match.teamBId, teamsById);
  const teamAWinProbabilityLabel = probability
    ? formatWholeProbability(probability.teamAWinProbability)
    : null;
  const teamBWinProbabilityLabel = probability
    ? formatWholeProbability(probability.teamBWinProbability)
    : null;

  return {
    id: match.id,
    round: match.round,
    nextMatchId: match.nextMatchId ?? null,
    nextSlot: match.nextSlot ?? null,
    statusLabel: getMatchStatusLabel(match, teamsById),
    teamAName,
    teamBName,
    teamAFlagPath: getTeamFlagPath(match.teamAId),
    teamBFlagPath: getTeamFlagPath(match.teamBId),
    teamAIsKnown: match.teamAId !== null,
    teamBIsKnown: match.teamBId !== null,
    teamAIsWinner: match.winnerId !== undefined && match.winnerId === match.teamAId,
    teamBIsWinner: match.winnerId !== undefined && match.winnerId === match.teamBId,
    teamAScoreLabel: match.score ? String(match.score.teamAGoals) : null,
    teamBScoreLabel: match.score ? String(match.score.teamBGoals) : null,
    scorelineLabel: formatScoreline(match),
    decisionLabel: match.score ? formatDecisionLabel(match.score.decidedBy) : null,
    resultDetailLabel: getResultDetailLabel(match, teamsById),
    accessibleLabel: formatAccessibleMatchLabel(
      match,
      teamAName,
      teamBName,
      teamAWinProbabilityLabel,
      teamBWinProbabilityLabel,
      teamsById,
    ),
    teamAWinProbabilityLabel,
    teamBWinProbabilityLabel,
  };
}

export function createChampionViewModel(
  finalMatch: Match | undefined,
  teamsById: TeamsById,
): ChampionViewModel {
  const championId = finalMatch?.winnerId ?? null;

  if (!championId) {
    return {
      isKnown: false,
      teamName: "Awaiting simulation",
      flagPath: getTeamFlagPath(null),
      statusLabel: "Not simulated",
    };
  }

  const teamName = getTeamDisplayName(championId, teamsById);

  return {
    isKnown: true,
    teamName,
    flagPath: getTeamFlagPath(championId),
    statusLabel: "Simulation projection",
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
  if (isMixedOfficialMatch(match)) {
    if (match.mixedOfficialStatus === "official_completed") {
      return "Official completed";
    }

    if (match.winnerId) {
      return "Simulation projection";
    }

    return "Pending official";
  }

  if (match.winnerId) {
    return `Winner: ${getTeamDisplayName(match.winnerId, teamsById)}`;
  }

  if (!match.teamAId || !match.teamBId) {
    return "Awaiting teams";
  }

  return "Ready";
}

function getResultDetailLabel(match: Match, teamsById: TeamsById): string | null {
  if (!match.score || !match.winnerId) {
    return null;
  }

  const winnerLabel = `Winner: ${getTeamDisplayName(match.winnerId, teamsById)}`;
  const decisionLabel = formatDecisionLabel(match.score.decidedBy);

  if (isMixedOfficialMatch(match)) {
    return `${getMatchStatusLabel(match, teamsById)}: ${winnerLabel} · ${decisionLabel}`;
  }

  return `${winnerLabel} · ${decisionLabel}`;
}

function isMixedOfficialMatch(match: Match): match is MixedOfficialLikeMatch {
  return (
    "mixedOfficialStatus" in match &&
    (match as MixedOfficialLikeMatch).mixedOfficialStatus !== undefined
  );
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

function formatAccessibleMatchLabel(
  match: Match,
  teamAName: string,
  teamBName: string,
  teamAWinProbabilityLabel: string | null,
  teamBWinProbabilityLabel: string | null,
  teamsById: TeamsById,
): string {
  if (!match.teamAId || !match.teamBId) {
    return `${match.id}: Matchup awaiting teams.`;
  }

  const parts = [`${match.id}: ${teamAName} vs ${teamBName}.`];

  if (match.winnerId) {
    if (isMixedOfficialMatch(match)) {
      parts.push(`${getMatchStatusLabel(match, teamsById)}.`);
    }
    parts.push(`Winner: ${getTeamDisplayName(match.winnerId, teamsById)}.`);
  } else {
    parts.push(`${getMatchStatusLabel(match, teamsById)}.`);
  }

  if (match.score) {
    parts.push(`Score: ${formatScoreline(match)}.`);
    parts.push(`${formatDecisionLabel(match.score.decidedBy)}.`);
  }

  if (teamAWinProbabilityLabel && teamBWinProbabilityLabel) {
    parts.push(
      `Win probabilities: ${teamAName} ${teamAWinProbabilityLabel}, ${teamBName} ${teamBWinProbabilityLabel}.`,
    );
  }

  return parts.join(" ");
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
