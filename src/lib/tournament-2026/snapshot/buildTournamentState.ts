import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import { worldCup2026FormatProvenance } from "@/src/data/world-cup-2026/provenance";
import { deriveSnapshotState } from "@/src/data/world-cup-2026/snapshots";
import {
  calculateGroupTable,
  generateRoundOf32,
  GROUP_IDS,
  qualifyTeams,
  rankGroupTeams,
  validateTournament2026Data,
} from "../index";
import { adaptRoundOf32ToSimulatorBracket } from "../bracket";
import { adaptSnapshotFairPlay } from "./adaptFairPlay";
import { adaptSnapshotFifaRanking } from "./adaptFifaRanking";
import { adaptSnapshotMatches } from "./adaptSnapshotMatches";
import { adaptSnapshotTeams } from "./adaptSnapshotTeams";
import type { GroupId, RankedGroupTeam, RankingMode } from "../types";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/types";
import type {
  BuildTournamentStateOptions,
  KnockoutReadyTournamentState,
  OfficialTieUnresolvedTournamentState,
  TournamentStateAuditRecord,
  TournamentStateResult,
} from "./types";

export type TournamentStateDependencies = {
  qualifyTeams: typeof qualifyTeams;
  generateRoundOf32: typeof generateRoundOf32;
  adaptRoundOf32ToSimulatorBracket: typeof adaptRoundOf32ToSimulatorBracket;
};

const DEFAULT_TOURNAMENT_STATE_DEPENDENCIES: TournamentStateDependencies = {
  qualifyTeams,
  generateRoundOf32,
  adaptRoundOf32ToSimulatorBracket,
};

function isOfficialTieError(error: unknown): error is Error {
  return error instanceof Error && /requires (official )?FIFA ranking|requires complete fair-play/.test(error.message);
}

function getRatingsModelVersion(options: BuildTournamentStateOptions): string {
  const modelVersions = new Set(
    Object.values(options.ratingsByTeamId).map((rating) => rating.modelVersion ?? "unknown"),
  );
  return [...modelVersions].sort().join("|");
}

function buildAuditRecord(
  snapshot: ValidatedTournamentSnapshot,
  options: BuildTournamentStateOptions,
): TournamentStateAuditRecord {
  const completedFixtureCount = snapshot.snapshot.fixtures.filter((fixture) => fixture.status === "completed").length;

  return {
    ...snapshot.metadata,
    derivedState: deriveSnapshotState(snapshot.snapshot.fixtures),
    completedFixtureCount,
    remainingFixtureCount: snapshot.snapshot.fixtures.length - completedFixtureCount,
    tournamentDomainVersion: "world-cup-2026-domain-v1",
    annexCChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256,
    topologyChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.knockoutTopologySha256,
    activeRatingsModelVersion: getRatingsModelVersion(options),
  };
}

function buildRankedGroupTables(
  groups: ReturnType<typeof adaptSnapshotTeams>,
  matches: ReturnType<typeof adaptSnapshotMatches>,
  snapshot: ValidatedTournamentSnapshot,
  rankingMode: RankingMode,
): Record<GroupId, readonly RankedGroupTeam[]> {
  const fairPlayByTeamId = adaptSnapshotFairPlay(snapshot);
  const fifaRankingByTeamId = adaptSnapshotFifaRanking(snapshot);

  return Object.fromEntries(
    GROUP_IDS.map((groupId) => {
      const group = groups.find((candidate) => candidate.id === groupId);
      if (!group) {
        throw new Error(`Missing Group ${groupId}.`);
      }
      const table = calculateGroupTable(group.id, group.teamIds, matches);
      return [
        group.id,
        rankGroupTeams(group.id, table, matches, {
          fairPlayByTeamId,
          fifaRankingByTeamId,
          rankingMode,
        }),
      ];
    }),
  ) as Record<GroupId, readonly RankedGroupTeam[]>;
}

function unresolvedState(
  reason: string,
  base: Omit<OfficialTieUnresolvedTournamentState, "status" | "reason">,
): OfficialTieUnresolvedTournamentState {
  return {
    status: "official_tie_unresolved",
    reason,
    ...base,
  };
}

export function buildTournamentState(
  snapshot: ValidatedTournamentSnapshot,
  options: BuildTournamentStateOptions,
): TournamentStateResult {
  return buildTournamentStateWithDependencies(snapshot, options, DEFAULT_TOURNAMENT_STATE_DEPENDENCIES);
}

export function buildTournamentStateWithDependencies(
  snapshot: ValidatedTournamentSnapshot,
  options: BuildTournamentStateOptions,
  dependencies: TournamentStateDependencies,
): TournamentStateResult {
  const rankingMode = options.rankingMode ?? "official";
  const derivedState = deriveSnapshotState(snapshot.snapshot.fixtures);
  const groups = adaptSnapshotTeams(snapshot);
  const matches = adaptSnapshotMatches(snapshot);
  validateTournament2026Data({
    version: snapshot.snapshot.snapshotVersion,
    groups,
    groupStageMatches: matches,
  });

  const snapshotMetadata = buildAuditRecord(snapshot, options);
  const base = {
    snapshotMetadata,
    groups,
    completedMatchCount: snapshotMetadata.completedFixtureCount,
    remainingMatchCount: snapshotMetadata.remainingFixtureCount,
  };

  let groupTables: Record<GroupId, readonly RankedGroupTeam[]>;
  try {
    groupTables = buildRankedGroupTables(
      groups,
      matches,
      snapshot,
      derivedState === "group_stage_complete" ? rankingMode : "development_fallback",
    );
  } catch (error) {
    if (isOfficialTieError(error)) {
      return unresolvedState(error.message, {
        ...base,
        groupTables: {} as Record<GroupId, readonly RankedGroupTeam[]>,
      });
    }
    throw error;
  }

  if (derivedState !== "group_stage_complete") {
    return {
      status: "group_stage_incomplete",
      ...base,
      groupTables,
    };
  }

  try {
    const fairPlayByTeamId = adaptSnapshotFairPlay(snapshot);
    const fifaRankingByTeamId = adaptSnapshotFifaRanking(snapshot);
    const qualification = dependencies.qualifyTeams(groupTables, {
      fairPlayByTeamId,
      fifaRankingByTeamId,
      rankingMode,
    });
    const roundOf32 = dependencies.generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const simulatorBracket = dependencies.adaptRoundOf32ToSimulatorBracket(roundOf32, options.ratingsByTeamId);

    const result: KnockoutReadyTournamentState = {
      status: "knockout_ready",
      ...base,
      groupTables,
      qualification,
      roundOf32,
      simulatorBracket,
    };
    return result;
  } catch (error) {
    if (isOfficialTieError(error)) {
      return unresolvedState(error.message, {
        ...base,
        groupTables,
      });
    }
    throw error;
  }
}
