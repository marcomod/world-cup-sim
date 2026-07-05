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
      modeLabel: "Current-state simulation",
      heading: "Current official state simulation",
      description:
        "Official completed matches are locked from the knockout-results artifact, completed winners are propagated into the Round of 16, and pending official fixtures are simulated from the current bracket state.",
      oddsDescription:
        "Based on current-state simulations after locking official completed knockout results.",
    };
  }

  return {
    modeLabel: "Baseline simulation",
    heading: "Baseline simulation",
    description:
      "Baseline simulations start from the original Round-of-32 simulator input and ignore official knockout results.",
    oddsDescription:
      "Based on baseline simulations from the original Round-of-32 simulator input; official knockout results are ignored.",
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
      <header className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
            World Cup 2026 knockout workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            World Cup Knockout Simulator
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8afb9] sm:text-base">
            Inspect official completed and pending knockout matches, then project
            unresolved fixtures in the simulation sandbox below.
          </p>
        </div>
      </header>

      <OfficialTournamentOverview />

      <section aria-labelledby="simulation-sandbox-heading">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 border-t border-white/10 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
              Simulation sandbox
            </p>
            <h2 id="simulation-sandbox-heading" className="mt-2 text-2xl font-bold text-white">
              {sandboxCopy.heading}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8afb9]">
              {sandboxCopy.description}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8afb9]">
              Official completed means a real result; Pending official means a
              future fixture with no official score; Simulation projection means
              a model-generated outcome.
            </p>
            <p
              className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c929d]"
              aria-label="Ratings and bracket status"
            >
              <span>Ratings: {teamRatingsV2SourceMetadata.sourceName}</span>
              <span aria-hidden="true">/</span>
              <span>Snapshot label: {teamRatingsV2SourceMetadata.snapshotDate}</span>
              <span aria-hidden="true">/</span>
              <span>{sandboxCopy.modeLabel}</span>
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap lg:max-w-[620px] lg:justify-end">
            <button
              type="button"
              onClick={handleSimulateCurrentStateBracket}
              className="h-11 rounded-md bg-emerald-500 px-5 text-sm font-bold text-[#07130e] shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Simulate Current State
            </button>
            <button
              type="button"
              onClick={handleRunCurrentStateMonteCarlo}
              className="h-11 rounded-md bg-white px-5 text-sm font-bold text-[#101318] shadow-sm transition hover:bg-[#dfe3e8] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Run 10,000 Current-State Simulations
            </button>
            <button
              type="button"
              onClick={handleSimulateBaselineBracket}
              className="h-11 rounded-md border border-white/20 bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Baseline: Ignore Official Results
            </button>
            <button
              type="button"
              onClick={handleRunBaselineMonteCarlo}
              className="h-11 rounded-md border border-white/20 bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Run 10,000 Baseline Simulations
            </button>
            <button
              type="button"
              onClick={handleResetBracket}
              className="h-11 rounded-md border border-white/20 bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#101318]"
            >
              Reset
            </button>
            <p
              className="basis-full pt-1 text-right font-mono text-[10px] text-[#747c88]"
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
