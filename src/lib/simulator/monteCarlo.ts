import { simulateBracket } from "./simulateBracket";
import type {
  Match,
  MonteCarloOptions,
  MonteCarloResult,
  TeamId,
  TeamTournamentOdds,
  RatingsByTeamId,
  RNG,
  TournamentSimulationResult,
} from "./types";

interface TeamTournamentOddsCounts {
  teamId: TeamId;
  roundOf16Count: number;
  quarterfinalCount: number;
  semifinalCount: number;
  finalCount: number;
  championCount: number;
}

export interface MonteCarloAccountingOptions<TMatch extends Match> {
  matches: readonly TMatch[];
  ratingsByTeamId: RatingsByTeamId;
  simulationCount: number;
  rng: RNG;
  simulateTournament: (
    matches: readonly TMatch[],
    ratingsByTeamId: RatingsByTeamId,
    rng: RNG,
  ) => TournamentSimulationResult;
}

export function runMonteCarlo(options: MonteCarloOptions): MonteCarloResult {
  return runMonteCarloAccounting({
    ...options,
    simulateTournament: (matches, ratingsByTeamId, rng) =>
      simulateBracket([...matches], ratingsByTeamId, rng),
  });
}

export function runMonteCarloAccounting<TMatch extends Match>(
  options: MonteCarloAccountingOptions<TMatch>,
): MonteCarloResult {
  const {
    matches,
    ratingsByTeamId,
    simulationCount,
    rng,
    simulateTournament,
  } = options;

  if (!Number.isInteger(simulationCount) || simulationCount <= 0) {
    throw new Error("simulationCount must be a positive integer.");
  }

  const teamIds = getInitialTeamIds(matches);
  const countsByTeamId = createCountsByTeamId(teamIds);

  for (let simulationIndex = 0; simulationIndex < simulationCount; simulationIndex += 1) {
    const result = simulateTournament(matches, ratingsByTeamId, rng);

    for (const match of result.matches) {
      if (!match.winnerId) {
        continue;
      }

      incrementAdvancementCount(countsByTeamId, match);
    }
  }

  return {
    simulationCount,
    teamOdds: teamIds.map((teamId) =>
      normalizeCounts(countsByTeamId[teamId], simulationCount),
    ),
  };
}

function getInitialTeamIds(matches: readonly Match[]): TeamId[] {
  const teamIds: TeamId[] = [];
  const seenTeamIds = new Set<TeamId>();

  for (const match of matches) {
    for (const teamId of [match.teamAId, match.teamBId]) {
      if (teamId && !seenTeamIds.has(teamId)) {
        seenTeamIds.add(teamId);
        teamIds.push(teamId);
      }
    }
  }

  return teamIds;
}

function createCountsByTeamId(
  teamIds: TeamId[],
): Record<TeamId, TeamTournamentOddsCounts> {
  return Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        roundOf16Count: 0,
        quarterfinalCount: 0,
        semifinalCount: 0,
        finalCount: 0,
        championCount: 0,
      },
    ]),
  );
}

function incrementAdvancementCount(
  countsByTeamId: Record<TeamId, TeamTournamentOddsCounts>,
  match: Match,
) {
  if (!match.winnerId) {
    return;
  }

  const counts = countsByTeamId[match.winnerId];

  if (!counts) {
    throw new Error(`Cannot count odds for unknown team "${match.winnerId}".`);
  }

  if (match.round === "round_of_32") {
    counts.roundOf16Count += 1;
    return;
  }

  if (match.round === "round_of_16") {
    counts.quarterfinalCount += 1;
    return;
  }

  if (match.round === "quarterfinal") {
    counts.semifinalCount += 1;
    return;
  }

  if (match.round === "semifinal") {
    counts.finalCount += 1;
    return;
  }

  counts.championCount += 1;
}

function normalizeCounts(
  counts: TeamTournamentOddsCounts,
  simulationCount: number,
): TeamTournamentOdds {
  return {
    teamId: counts.teamId,
    roundOf16Probability: counts.roundOf16Count / simulationCount,
    quarterfinalProbability: counts.quarterfinalCount / simulationCount,
    semifinalProbability: counts.semifinalCount / simulationCount,
    finalProbability: counts.finalCount / simulationCount,
    championProbability: counts.championCount / simulationCount,
  };
}
