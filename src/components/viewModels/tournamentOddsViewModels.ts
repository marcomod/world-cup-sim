import { getTeamDisplayName } from "@/src/components/viewModels/bracketViewModels";
import type { TeamTournamentOdds, TeamsById } from "@/src/lib/simulator/types";

export interface TournamentOddsRowViewModel {
  teamId: string;
  teamName: string;
  roundOf16ProbabilityLabel: string;
  quarterfinalProbabilityLabel: string;
  semifinalProbabilityLabel: string;
  finalProbabilityLabel: string;
  championProbabilityLabel: string;
}

export function createTournamentOddsRows(
  teamOdds: TeamTournamentOdds[],
  teamsById: TeamsById,
): TournamentOddsRowViewModel[] {
  return [...teamOdds]
    .sort((teamA, teamB) => teamB.championProbability - teamA.championProbability)
    .map((odds) => ({
      teamId: odds.teamId,
      teamName: getTeamDisplayName(odds.teamId, teamsById),
      roundOf16ProbabilityLabel: formatProbability(odds.roundOf16Probability),
      quarterfinalProbabilityLabel: formatProbability(odds.quarterfinalProbability),
      semifinalProbabilityLabel: formatProbability(odds.semifinalProbability),
      finalProbabilityLabel: formatProbability(odds.finalProbability),
      championProbabilityLabel: formatProbability(odds.championProbability),
    }));
}

export function formatSimulationCountLabel(simulationCount: number): string {
  return simulationCount.toLocaleString();
}

function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
