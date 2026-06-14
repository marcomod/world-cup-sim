"use client";

import { useMemo, useState } from "react";
import { initialBracket } from "@/src/data/initialBracket";
import { mockTeams } from "@/src/data/mockTeams";
import { teamRatingsV2ByTeamId } from "@/src/data/teamRatingsV2";
import { Bracket } from "@/src/components/Bracket/Bracket";
import { MatchupOddsTable } from "@/src/components/Odds/MatchupOddsTable";
import { TournamentOddsTable } from "@/src/components/Odds/TournamentOddsTable";
import {
  createMatchCardViewModel,
  createMatchupOddsRows,
  getTeamDisplayName,
} from "@/src/components/viewModels/bracketViewModels";
import {
  createTournamentOddsRows,
  formatSimulationCountLabel,
} from "@/src/components/viewModels/tournamentOddsViewModels";
import { runMonteCarlo } from "@/src/lib/simulator/monteCarlo";
import { createSeededRng } from "@/src/lib/simulator/rng";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import type {
  Match,
  MonteCarloResult,
  Team,
  TeamsById,
} from "@/src/lib/simulator/types";

const MONTE_CARLO_SIMULATION_COUNT = 10_000;

function cloneInitialBracket(): Match[] {
  return initialBracket.map((match) => ({ ...match }));
}

function createTeamsById(teams: Team[]): TeamsById {
  return Object.fromEntries(teams.map((team) => [team.id, team]));
}

export function WorldCupSimulator() {
  const [matches, setMatches] = useState<Match[]>(() => cloneInitialBracket());
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [monteCarloResult, setMonteCarloResult] =
    useState<MonteCarloResult | null>(null);
  const teamsById = useMemo(() => createTeamsById(mockTeams), []);
  const finalMatch = matches[matches.length - 1];
  const championName = finalMatch?.winnerId
    ? getTeamDisplayName(finalMatch.winnerId, teamsById)
    : null;
  const bracketMatches = useMemo(
    () =>
      matches.map((match) =>
        createMatchCardViewModel(match, teamRatingsV2ByTeamId, teamsById),
      ),
    [matches, teamsById],
  );
  const matchupOddsRows = useMemo(
    () => createMatchupOddsRows(matches, teamRatingsV2ByTeamId, teamsById),
    [matches, teamsById],
  );
  const tournamentOddsRows = useMemo(
    () =>
      monteCarloResult
        ? createTournamentOddsRows(monteCarloResult.teamOdds, teamsById)
        : [],
    [monteCarloResult, teamsById],
  );
  const tournamentOddsSimulationCountLabel = monteCarloResult
    ? formatSimulationCountLabel(monteCarloResult.simulationCount)
    : "";

  function handleSimulateBracket() {
    const seed = Date.now();
    const result = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(seed),
    );

    setMatches(result.matches);
    setLastSeed(seed);
  }

  function handleResetBracket() {
    setMatches(cloneInitialBracket());
    setLastSeed(null);
    setMonteCarloResult(null);
  }

  function handleRunMonteCarlo() {
    const result = runMonteCarlo({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: MONTE_CARLO_SIMULATION_COUNT,
      rng: createSeededRng(Date.now()),
    });

    setMonteCarloResult(result);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
              Post-group-stage simulator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              World Cup Knockout Simulator
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Static Round of 32 bracket with mock teams, early V2 team-strength
              ratings, matchup odds, full-bracket simulation, champion output, and
              reset.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSimulateBracket}
              className="h-11 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              Simulate One Bracket
            </button>
            <button
              type="button"
              onClick={handleRunMonteCarlo}
              className="h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Run 10,000 Simulations
            </button>
            <button
              type="button"
              onClick={handleResetBracket}
              className="h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Reset
            </button>
          </div>
        </header>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Single Simulation Champion
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {championName ?? "Not simulated"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Last seed
            </p>
            <p className="mt-2 font-mono text-sm text-slate-700">
              {lastSeed ?? "Not simulated"}
            </p>
          </div>
        </section>

        <MatchupOddsTable rows={matchupOddsRows} hasSimulated={Boolean(championName)} />

        {monteCarloResult ? (
          <TournamentOddsTable
            rows={tournamentOddsRows}
            simulationCountLabel={tournamentOddsSimulationCountLabel}
          />
        ) : null}

        <Bracket matches={bracketMatches} />
      </div>
    </main>
  );
}
