import { describe, expect, it } from "vitest";
import { teamRatingsV2ByTeamId } from "@/src/data/teamRatingsV2";
import { validateTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { computeTournamentSnapshotChecksum } from "@/src/data/world-cup-2026/snapshots/node";
import { adaptRoundOf32ToSimulatorBracket, buildTournamentState, generateRoundOf32, qualifyTeams } from "@/src/lib/tournament-2026";
import {
  buildTournamentStateWithDependencies,
  type TournamentStateDependencies,
} from "@/src/lib/tournament-2026/snapshot/buildTournamentState";
import type { TournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { cloneSnapshot, completeSnapshot, loadSnapshotFixture, readSnapshotFixture } from "./helpers";

type KnockoutDependencyCallName = keyof TournamentStateDependencies;

function createUnexpectedKnockoutDependencies(): {
  calls: Record<KnockoutDependencyCallName, number>;
  dependencies: TournamentStateDependencies;
} {
  const calls: Record<KnockoutDependencyCallName, number> = {
    qualifyTeams: 0,
    generateRoundOf32: 0,
    adaptRoundOf32ToSimulatorBracket: 0,
  };

  return {
    calls,
    dependencies: {
      qualifyTeams: (() => {
        calls.qualifyTeams += 1;
        throw new Error("qualifyTeams must not be called");
      }) as typeof qualifyTeams,
      generateRoundOf32: (() => {
        calls.generateRoundOf32 += 1;
        throw new Error("generateRoundOf32 must not be called");
      }) as typeof generateRoundOf32,
      adaptRoundOf32ToSimulatorBracket: (() => {
        calls.adaptRoundOf32ToSimulatorBracket += 1;
        throw new Error("adaptRoundOf32ToSimulatorBracket must not be called");
      }) as typeof adaptRoundOf32ToSimulatorBracket,
    },
  };
}

function createObservedKnockoutDependencies(): {
  calls: KnockoutDependencyCallName[];
  dependencies: TournamentStateDependencies;
} {
  const calls: KnockoutDependencyCallName[] = [];

  return {
    calls,
    dependencies: {
      qualifyTeams: ((...args: Parameters<typeof qualifyTeams>) => {
        calls.push("qualifyTeams");
        return qualifyTeams(...args);
      }) as typeof qualifyTeams,
      generateRoundOf32: ((...args: Parameters<typeof generateRoundOf32>) => {
        calls.push("generateRoundOf32");
        return generateRoundOf32(...args);
      }) as typeof generateRoundOf32,
      adaptRoundOf32ToSimulatorBracket: ((...args: Parameters<typeof adaptRoundOf32ToSimulatorBracket>) => {
        calls.push("adaptRoundOf32ToSimulatorBracket");
        return adaptRoundOf32ToSimulatorBracket(...args);
      }) as typeof adaptRoundOf32ToSimulatorBracket,
    },
  };
}

function withCompletedFixtureCount(completedCount: number): TournamentSnapshot {
  const complete = completeSnapshot();
  const structure = readSnapshotFixture("synthetic-structure-only.snapshot.json");
  return {
    ...structure,
    state:
      completedCount === 0
        ? "structure_only"
        : completedCount === 72
          ? "group_stage_complete"
          : "group_stage_in_progress",
    fixtures: structure.fixtures.map((fixture, index) =>
      index < completedCount
        ? { ...fixture, status: "completed", result: complete.fixtures[index].result }
        : fixture,
    ),
    fairPlay: completedCount === 72 ? complete.fairPlay : [],
    fifaRanking: completedCount === 72 ? complete.fifaRanking : [],
    sources: {
      ...structure.sources,
      results: completedCount > 0 ? structure.sources.fixtures : null,
      fairPlay: completedCount === 72 ? structure.sources.fixtures : null,
      fifaRanking: completedCount === 72 ? structure.sources.fixtures : null,
    },
  };
}

function expectIncompleteOnly(state: ReturnType<typeof buildTournamentState>, completed: number): void {
  expect(state.status).toBe("group_stage_incomplete");
  expect(state.completedMatchCount).toBe(completed);
  expect(state.remainingMatchCount).toBe(72 - completed);
  expect(state.groupTables.A).toHaveLength(4);
  expect("qualification" in state).toBe(false);
  expect("roundOf32" in state).toBe(false);
  expect("simulatorBracket" in state).toBe(false);
}

describe("buildTournamentState", () => {
  it("returns incomplete state for structure-only and in-progress snapshots", () => {
    for (const fixtureName of [
      "synthetic-structure-only.snapshot.json",
      "synthetic-in-progress.snapshot.json",
    ]) {
      const snapshot = loadSnapshotFixture(fixtureName);
      const state = buildTournamentState(snapshot, { ratingsByTeamId: teamRatingsV2ByTeamId });
      expectIncompleteOnly(state, snapshot.snapshot.fixtures.filter((fixture) => fixture.status === "completed").length);
    }
  });

  it("keeps zero, one, and 71 completed fixtures out of knockout orchestration", () => {
    for (const completedCount of [0, 1, 71]) {
      const snapshot = validateTournamentSnapshot(withCompletedFixtureCount(completedCount));
      const state = buildTournamentState(snapshot, { ratingsByTeamId: {} });
      expectIncompleteOnly(state, completedCount);
    }
  });

  it.each([
    ["zero completed fixtures", 0],
    ["one completed fixture", 1],
    ["71 completed fixtures", 71],
  ] as const)("does not invoke knockout dependencies for %s", (_label, completedCount) => {
    const snapshot = validateTournamentSnapshot(withCompletedFixtureCount(completedCount));
    const { calls, dependencies } = createUnexpectedKnockoutDependencies();

    const state = buildTournamentStateWithDependencies(snapshot, { ratingsByTeamId: {} }, dependencies);

    expectIncompleteOnly(state, completedCount);
    expect(calls).toEqual({
      qualifyTeams: 0,
      generateRoundOf32: 0,
      adaptRoundOf32ToSimulatorBracket: 0,
    });
  });

  it("builds a knockout-ready state from a complete validated snapshot", () => {
    const snapshot = loadSnapshotFixture("synthetic-complete.snapshot.json");
    const state = buildTournamentState(snapshot, { ratingsByTeamId: teamRatingsV2ByTeamId });

    expect(state.status).toBe("knockout_ready");
    if (state.status !== "knockout_ready") {
      throw new Error("Expected knockout-ready state.");
    }
    expect(Object.keys(state.qualification.groupWinners)).toHaveLength(12);
    expect(Object.keys(state.qualification.groupRunnersUp)).toHaveLength(12);
    expect(state.qualification.qualifiedThirdPlacedTeams).toHaveLength(8);
    expect(
      new Set([
        ...Object.values(state.qualification.groupWinners).map((team) => team.teamId),
        ...Object.values(state.qualification.groupRunnersUp).map((team) => team.teamId),
        ...state.qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId),
      ]).size,
    ).toBe(32);
    expect(state.roundOf32).toHaveLength(16);
    expect(state.simulatorBracket).toHaveLength(31);
    expect(state.snapshotMetadata.snapshotChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("invokes knockout dependencies exactly once in order for a complete snapshot", () => {
    const snapshot = loadSnapshotFixture("synthetic-complete.snapshot.json");
    const { calls, dependencies } = createObservedKnockoutDependencies();
    const state = buildTournamentStateWithDependencies(
      snapshot,
      { ratingsByTeamId: teamRatingsV2ByTeamId },
      dependencies,
    );

    expect(calls).toEqual(["qualifyTeams", "generateRoundOf32", "adaptRoundOf32ToSimulatorBracket"]);
    expect(state.status).toBe("knockout_ready");
    if (state.status !== "knockout_ready") {
      throw new Error("Expected knockout-ready state.");
    }
    expect(
      new Set([
        ...Object.values(state.qualification.groupWinners).map((team) => team.teamId),
        ...Object.values(state.qualification.groupRunnersUp).map((team) => team.teamId),
        ...state.qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId),
      ]).size,
    ).toBe(32);
    expect(state.roundOf32).toHaveLength(16);
    expect(state.simulatorBracket).toHaveLength(31);
  });

  it("is deterministic under arbitrary snapshot ordering", () => {
    const reordered = cloneSnapshot(completeSnapshot());
    reordered.teams = [...reordered.teams].reverse();
    reordered.fixtures = [...reordered.fixtures].reverse();
    reordered.fairPlay = [...reordered.fairPlay].reverse();
    reordered.fifaRanking = [...reordered.fifaRanking].reverse();

    const baseline = buildTournamentState(loadSnapshotFixture("synthetic-complete.snapshot.json"), {
      ratingsByTeamId: teamRatingsV2ByTeamId,
    });
    const validatedAlternate = validateTournamentSnapshot(reordered);
    const alternate = buildTournamentState(
      {
        ...validatedAlternate,
        metadata: {
          ...validatedAlternate.metadata,
          snapshotChecksum: computeTournamentSnapshotChecksum(reordered),
        },
      },
      {
        ratingsByTeamId: teamRatingsV2ByTeamId,
      },
    );

    expect(alternate).toEqual(baseline);
  });

  it("derives completeness from fixture status instead of trusting manipulated metadata", () => {
    const validated = validateTournamentSnapshot(withCompletedFixtureCount(1));
    const manipulated = {
      ...validated,
      snapshot: {
        ...validated.snapshot,
        state: "group_stage_complete" as const,
        derivedState: "group_stage_complete" as const,
      },
      metadata: {
        ...validated.metadata,
        declaredState: "group_stage_complete" as const,
        derivedState: "group_stage_complete" as const,
        completedFixtureCount: 72,
        remainingFixtureCount: 0,
      },
    };

    const { calls, dependencies } = createUnexpectedKnockoutDependencies();
    const state = buildTournamentStateWithDependencies(manipulated, { ratingsByTeamId: {} }, dependencies);

    expectIncompleteOnly(state, 1);
    expect(calls).toEqual({
      qualifyTeams: 0,
      generateRoundOf32: 0,
      adaptRoundOf32ToSimulatorBracket: 0,
    });
  });

  it("does not silently fall back when official tie data is missing", () => {
    const snapshot = completeSnapshot();
    snapshot.fifaRanking = [];
    const validated = validateTournamentSnapshot(snapshot);
    const state = buildTournamentState(validated, { ratingsByTeamId: teamRatingsV2ByTeamId });

    expect(state.status).toBe("official_tie_unresolved");
  });

  it("uses development fallback only when explicitly requested", () => {
    const snapshot = completeSnapshot();
    snapshot.fifaRanking = [];
    const validated = validateTournamentSnapshot(snapshot);
    const state = buildTournamentState(validated, {
      ratingsByTeamId: teamRatingsV2ByTeamId,
      rankingMode: "development_fallback",
    });

    expect(state.status).toBe("knockout_ready");
  });
});
