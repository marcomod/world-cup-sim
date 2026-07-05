"use client";

import { useMemo, useState } from "react";
import {
  teamRatingsV2ByTeamId,
  teamRatingsV2SourceMetadata,
} from "@/src/data/teamRatingsV2";
import {
  officialKnockoutResultsForSimulator,
  officialSimulatorInputMatches,
  officialTournamentTeams,
} from "@/src/data/world-cup-2026/officialArtifacts";
import { Bracket } from "@/src/components/Bracket/Bracket";
import { OfficialTournamentOverview } from "@/src/components/OfficialTournamentOverview";
import { MatchupOddsTable } from "@/src/components/Odds/MatchupOddsTable";
import { TournamentOddsTable } from "@/src/components/Odds/TournamentOddsTable";
import {
  createMatchCardViewModel,
  createMatchupOddsRows,
  createChampionViewModel,
} from "@/src/components/viewModels/bracketViewModels";
import {
  createTournamentOddsRows,
  formatSimulationCountLabel,
} from "@/src/components/viewModels/tournamentOddsViewModels";
import { runMonteCarlo } from "@/src/lib/simulator/monteCarlo";
import { createSeededRng } from "@/src/lib/simulator/rng";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import {
  prepareMixedOfficialSimulatorBracket,
  runMixedOfficialMonteCarlo,
  simulateMixedOfficialBracket,
} from "@/src/lib/tournament-2026/bracket";
import type {
  Match,
  MonteCarloResult,
  Team,
  TeamsById,
} from "@/src/lib/simulator/types";

const MONTE_CARLO_SIMULATION_COUNT = 10_000;

export type SandboxMode = "current_official_state" | "baseline";

export interface SimulationSandboxState {
  matches: Match[];
  lastSeed: number | null;
  sandboxMode: SandboxMode;
  monteCarloResult: MonteCarloResult | null;
}

export interface SimulationSandboxCopy {
  modeLabel: string;
  heading: string;
  description: string;
  oddsDescription: string;
}

export function getSimulationSandboxCopy(
  sandboxMode: SandboxMode,
): SimulationSandboxCopy {
  if (sandboxMode === "current_official_state") {
    return {
      modeLabel: "Current official state simulation",
      heading: "Current official state simulation",
      description:
        "Uses official completed results, carries their winners forward, and simulates only unresolved fixtures.",
      oddsDescription:
        "Uses official completed results, then simulates unresolved fixtures from the current bracket state.",
    };
  }

  return {
    modeLabel: "Baseline simulation / ignores official results",
    heading: "Baseline simulation / ignores official results",
    description:
      "Starts from the original Round of 32 as if official knockout results had not been played.",
    oddsDescription:
      "Starts from the original Round of 32 and ignores official knockout results.",
  };
}

function cloneOfficialSimulatorInputMatches(): Match[] {
  return officialSimulatorInputMatches.map((match) => ({ ...match }));
}

export function createBaselineSandboxBracket(): Match[] {
  return cloneOfficialSimulatorInputMatches();
}

export function createCurrentOfficialStateBracket() {
  return prepareMixedOfficialSimulatorBracket(
    cloneOfficialSimulatorInputMatches(),
    officialKnockoutResultsForSimulator,
  );
}

export function createCurrentStateBracketSimulationState(
  seed: number,
): SimulationSandboxState {
  const result = simulateMixedOfficialBracket(
    createCurrentOfficialStateBracket(),
    teamRatingsV2ByTeamId,
    createSeededRng(seed),
    {
      includeScoreline: true,
      scoreRng: createSeededRng(seed + 1),
    },
  );

  return {
    matches: result.matches,
    lastSeed: seed,
    sandboxMode: "current_official_state",
    monteCarloResult: null,
  };
}

export function createBaselineBracketSimulationState(
  seed: number,
): SimulationSandboxState {
  const result = simulateBracket(
    createBaselineSandboxBracket(),
    teamRatingsV2ByTeamId,
    createSeededRng(seed),
    {
      includeScoreline: true,
      scoreRng: createSeededRng(seed + 1),
    },
  );

  return {
    matches: result.matches,
    lastSeed: seed,
    sandboxMode: "baseline",
    monteCarloResult: null,
  };
}

export function createCurrentStateMonteCarloState(
  seed: number,
): SimulationSandboxState {
  const matches = createCurrentOfficialStateBracket();
  const monteCarloResult = runMixedOfficialMonteCarlo({
    matches,
    ratingsByTeamId: teamRatingsV2ByTeamId,
    simulationCount: MONTE_CARLO_SIMULATION_COUNT,
    rng: createSeededRng(seed),
  });

  return {
    matches,
    lastSeed: null,
    sandboxMode: "current_official_state",
    monteCarloResult,
  };
}

export function createBaselineMonteCarloState(
  seed: number,
): SimulationSandboxState {
  const matches = createBaselineSandboxBracket();
  const monteCarloResult = runMonteCarlo({
    matches,
    ratingsByTeamId: teamRatingsV2ByTeamId,
    simulationCount: MONTE_CARLO_SIMULATION_COUNT,
    rng: createSeededRng(seed),
  });

  return {
    matches,
    lastSeed: null,
    sandboxMode: "baseline",
    monteCarloResult,
  };
}

function createTeamsById(teams: Team[]): TeamsById {
  return Object.fromEntries(teams.map((team) => [team.id, team]));
}

export function WorldCupSimulator() {
  const [matches, setMatches] = useState<Match[]>(() =>
    createCurrentOfficialStateBracket(),
  );
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [sandboxMode, setSandboxMode] =
    useState<SandboxMode>("current_official_state");
  const [monteCarloResult, setMonteCarloResult] =
    useState<MonteCarloResult | null>(null);
  const teamsById = useMemo(() => createTeamsById(officialTournamentTeams), []);
  const finalMatch = matches.find((match) => match.round === "final");
  const champion = useMemo(
    () => createChampionViewModel(finalMatch, teamsById),
    [finalMatch, teamsById],
  );
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
  const sandboxCopy = getSimulationSandboxCopy(sandboxMode);

  function applySandboxState(state: SimulationSandboxState) {
    setMatches(state.matches);
    setLastSeed(state.lastSeed);
    setSandboxMode(state.sandboxMode);
    setMonteCarloResult(state.monteCarloResult);
  }

  function handleSimulateCurrentStateBracket() {
    applySandboxState(createCurrentStateBracketSimulationState(Date.now()));
  }

  function handleSimulateBaselineBracket() {
    applySandboxState(createBaselineBracketSimulationState(Date.now()));
  }

  function handleResetBracket() {
    setMatches(createCurrentOfficialStateBracket());
    setLastSeed(null);
    setSandboxMode("current_official_state");
    setMonteCarloResult(null);
  }

  function handleRunCurrentStateMonteCarlo() {
    applySandboxState(createCurrentStateMonteCarloState(Date.now()));
  }

  function handleRunBaselineMonteCarlo() {
    applySandboxState(createBaselineMonteCarloState(Date.now()));
  }

  return (
    <main className="min-h-screen bg-[#101318] pb-10 text-[#edf0f4]">
      <header className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-9">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            World Cup 2026 knockout workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-5xl">
            World Cup Knockout Simulator
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8afb9] sm:text-base">
            Track the official knockout bracket, then project the remaining
            path with either the current official state or a baseline that
            ignores official results.
          </p>
        </div>
        <div className="grid gap-2 text-xs text-[#b6bec9] sm:grid-cols-3 lg:min-w-[520px]">
          <div className="border border-emerald-300/25 bg-emerald-300/8 px-3 py-2">
            <p className="font-bold text-emerald-200">Official completed</p>
            <p className="mt-1 text-[#8c929d]">Final results are locked.</p>
          </div>
          <div className="border border-amber-300/25 bg-amber-300/8 px-3 py-2">
            <p className="font-bold text-amber-200">Pending official</p>
            <p className="mt-1 text-[#8c929d]">Fixture has no official score.</p>
          </div>
          <div className="border border-sky-300/25 bg-sky-300/8 px-3 py-2">
            <p className="font-bold text-sky-200">Simulation projection</p>
            <p className="mt-1 text-[#8c929d]">Model-generated outcome.</p>
          </div>
        </div>
      </header>

      <OfficialTournamentOverview />

      <section aria-labelledby="simulation-sandbox-heading">
        <div className="mx-auto grid w-full max-w-[1800px] gap-5 border-t border-white/10 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              Simulation sandbox
            </p>
            <h2 id="simulation-sandbox-heading" className="mt-2 text-2xl font-bold text-white">
              {sandboxCopy.heading}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8afb9]">
              {sandboxCopy.description}
            </p>
            <p
              className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c929d]"
              aria-label="Ratings and bracket status"
            >
              <span className="border border-white/10 bg-white/5 px-2.5 py-1">
                Ratings: {teamRatingsV2SourceMetadata.sourceName}
              </span>
              <span className="border border-white/10 bg-white/5 px-2.5 py-1">
                Snapshot label: {teamRatingsV2SourceMetadata.snapshotDate}
              </span>
              <span className="border border-emerald-300/20 bg-emerald-300/8 px-2.5 py-1 text-emerald-200">
                {sandboxCopy.modeLabel}
              </span>
            </p>
          </div>

          <div className="grid gap-3 border border-white/10 bg-[#12161c] p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSimulateCurrentStateBracket}
                className="min-h-11 bg-emerald-500 px-4 py-3 text-left text-sm font-bold text-[#07130e] shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#101318]"
              >
                Simulate Current State
              </button>
              <button
                type="button"
                onClick={handleRunCurrentStateMonteCarlo}
                className="min-h-11 bg-white px-4 py-3 text-left text-sm font-bold text-[#101318] shadow-sm transition hover:bg-[#dfe3e8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#101318]"
              >
                Run 10,000 Current-State Simulations
              </button>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c929d]">
              Baseline simulation / ignores official results
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSimulateBaselineBracket}
                className="min-h-11 border border-white/20 bg-transparent px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
              >
                Baseline: Ignore Official Results
              </button>
              <button
                type="button"
                onClick={handleRunBaselineMonteCarlo}
                className="min-h-11 border border-white/20 bg-transparent px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
              >
                Run 10,000 Baseline Simulations
              </button>
            </div>
            <button
              type="button"
              onClick={handleResetBracket}
              className="min-h-10 border border-white/20 bg-transparent px-4 py-2 text-left text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Reset to current official state
            </button>
            <p
              className="font-mono text-[10px] text-[#747c88]"
              aria-live="polite"
            >
              Mode: {sandboxCopy.modeLabel} / Last seed: {lastSeed ?? "Not simulated"}
            </p>
          </div>
        </div>

        <Bracket matches={bracketMatches} champion={champion} />

        <div className="mx-auto mt-8 flex w-full max-w-7xl flex-col gap-6 px-4 text-slate-950 sm:px-6 lg:px-8">
          <MatchupOddsTable rows={matchupOddsRows} hasSimulated={champion.isKnown} />
          {monteCarloResult ? (
            <TournamentOddsTable
              rows={tournamentOddsRows}
              simulationCountLabel={tournamentOddsSimulationCountLabel}
              description={sandboxCopy.oddsDescription}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
