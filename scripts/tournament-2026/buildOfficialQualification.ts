import { fileURLToPath } from "node:url";
import { roundOf32SlotDefinitions } from "../../src/data/world-cup-2026/roundOf32Slots.ts";
import { worldCup2026FormatProvenance } from "../../src/data/world-cup-2026/provenance.ts";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/loadSnapshot.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import { compareCodePoints, GROUP_IDS } from "../../src/lib/tournament-2026/constants.ts";
import { resolveThirdPlaceAssignments } from "../../src/lib/tournament-2026/qualification/resolveThirdPlaceAssignments.ts";
import { buildTournamentState } from "../../src/lib/tournament-2026/snapshot/buildTournamentState.ts";
import type {
  GeneratedRoundOf32Match,
  GroupId,
  RankedGroupTeam,
  RoundOf32ParticipantSource,
  TeamId,
  ThirdPlacedTeam,
} from "../../src/lib/tournament-2026/types.ts";
import {
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  OFFICIAL_SNAPSHOT_VERSION,
} from "./officialSnapshotPaths.ts";
import {
  computeQualificationChecksum,
  computeRoundOf32Checksum,
} from "./officialArtifactChecksums.ts";
import { buildOfficialSnapshotOrchestrationStatus } from "./officialOrchestrationStatus.ts";
import { writeJsonAtomically } from "./atomicJson.ts";

export const OFFICIAL_SNAPSHOT_CHECKSUM =
  "1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7";
export const OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY = "BDEFIJKL";

type TeamNameById = ReadonlyMap<TeamId, string>;

function teamName(teamNames: TeamNameById, teamId: TeamId): string {
  const name = teamNames.get(teamId);
  if (!name) {
    throw new Error(`Missing display name for team "${teamId}".`);
  }
  return name;
}

function standingRow(teamNames: TeamNameById, row: RankedGroupTeam) {
  return {
    group: row.group,
    teamId: row.teamId,
    displayName: teamName(teamNames, row.teamId),
    groupPosition: row.position,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
    appliedTieBreakers: row.appliedTieBreakers,
  };
}

function thirdPlaceRow(teamNames: TeamNameById, row: ThirdPlacedTeam) {
  return {
    ...standingRow(teamNames, row),
    thirdPlaceRank: row.thirdPlaceRank,
    qualified: row.qualified,
  };
}

function sourceSlot(
  source: RoundOf32ParticipantSource,
  teamId: TeamId,
  assignmentsBySlot: ReadonlyMap<string, GroupId>,
): string {
  if (source.type === "group_position") {
    return source.label;
  }
  const group = assignmentsBySlot.get(source.assignmentKey);
  if (!group) {
    throw new Error(`Missing Annex C assignment for ${source.assignmentKey}.`);
  }
  return `3${group}`;
}

function participantSource(
  source: RoundOf32ParticipantSource,
  teamId: TeamId,
  teamNames: TeamNameById,
  assignmentsBySlot: ReadonlyMap<string, GroupId>,
) {
  if (source.type === "group_position") {
    return {
      teamId,
      displayName: teamName(teamNames, teamId),
      sourceSlot: source.label,
      groupPositionSource: {
        group: source.group,
        position: source.position,
      },
      annexCSource: null,
    };
  }

  const assignedGroup = assignmentsBySlot.get(source.assignmentKey);
  if (!assignedGroup) {
    throw new Error(`Missing Annex C assignment for ${source.assignmentKey}.`);
  }
  return {
    teamId,
    displayName: teamName(teamNames, teamId),
    sourceSlot: sourceSlot(source, teamId, assignmentsBySlot),
    groupPositionSource: {
      group: assignedGroup,
      position: 3,
    },
    annexCSource: {
      assignmentKey: source.assignmentKey,
      qualifyingThirdPlaceGroupKey: OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY,
      sourceLabel: source.label,
      eligibleGroups: [...source.eligibleGroups],
      assignedGroup,
    },
  };
}

function assertUniqueTeamIds(teamIds: readonly TeamId[], context: string): void {
  const unique = new Set(teamIds);
  if (unique.size !== teamIds.length) {
    const duplicates = teamIds.filter((teamId, index) => teamIds.indexOf(teamId) !== index);
    throw new Error(`${context} contains duplicate team IDs: ${duplicates.join(", ")}.`);
  }
}

function buildQualifierRows(teamNames: TeamNameById, state: Extract<ReturnType<typeof buildTournamentState>, { status: "knockout_ready" }>) {
  return [
    ...GROUP_IDS.map((group) => ({ qualificationSource: `1${group}`, ...standingRow(teamNames, state.qualification.groupWinners[group]) })),
    ...GROUP_IDS.map((group) => ({ qualificationSource: `2${group}`, ...standingRow(teamNames, state.qualification.groupRunnersUp[group]) })),
    ...state.qualification.qualifiedThirdPlacedTeams.map((team) => ({
      qualificationSource: `3${team.group}`,
      ...thirdPlaceRow(teamNames, team),
    })),
  ];
}

function assertEcuadorGhanaEquivalence(thirdPlacedTeams: readonly ThirdPlacedTeam[]): void {
  const ecuador = thirdPlacedTeams.find((team) => team.teamId === "ecu");
  const ghana = thirdPlacedTeams.find((team) => team.teamId === "gha");
  if (!ecuador || !ghana) {
    throw new Error("Ecuador and Ghana must both be present in the third-place table.");
  }
  if (!ecuador.qualified || !ghana.qualified || ecuador.thirdPlaceRank !== 3 || ghana.thirdPlaceRank !== 3) {
    throw new Error("Ecuador and Ghana must both qualify at shared third-place rank 3.");
  }
  if (ecuador.appliedTieBreakers.includes("deterministic_fallback") || ghana.appliedTieBreakers.includes("deterministic_fallback")) {
    throw new Error("Ecuador/Ghana qualification must not record deterministic fallback ordering.");
  }
}

function buildQualificationArtifact() {
  const loaded = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
  if (loaded.snapshot.snapshotVersion !== OFFICIAL_SNAPSHOT_VERSION) {
    throw new Error("Official qualification builder loaded the wrong snapshot version.");
  }
  if (loaded.metadata.snapshotChecksum !== OFFICIAL_SNAPSHOT_CHECKSUM) {
    throw new Error("Official qualification builder loaded a stale or modified snapshot checksum.");
  }

  const state = buildTournamentState(loaded, {
    ratingsByTeamId: worldFootballEloDevelopmentByTeamId,
    rankingMode: "official",
  });
  if (state.status !== "knockout_ready") {
    throw new Error(`Official qualification requires knockout_ready state, received ${state.status}.`);
  }

  assertEcuadorGhanaEquivalence(state.qualification.thirdPlacedTeams);
  const teamNames = new Map(loaded.snapshot.teams.map((team) => [team.id, team.name]));
  const qualifiedThirdPlaceGroupKey = state.qualification.qualifiedThirdPlacedTeams
    .map((team) => team.group)
    .sort(compareCodePoints)
    .join("");
  if (qualifiedThirdPlaceGroupKey !== OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY) {
    throw new Error(`Expected third-place group key ${OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY}, received ${qualifiedThirdPlaceGroupKey}.`);
  }

  const qualifiers = buildQualifierRows(teamNames, state);
  const qualifierIds = qualifiers.map((team) => team.teamId);
  if (qualifierIds.length !== 32) {
    throw new Error(`Expected 32 qualifiers, received ${qualifierIds.length}.`);
  }
  assertUniqueTeamIds(qualifierIds, "Official qualifiers");

  const artifact: Record<string, unknown> = {
    generatedFileWarning: "Do not edit manually.",
    schemaVersion: "world-cup-2026-official-qualification-v1",
    artifactVersion: `${loaded.snapshot.snapshotVersion}-qualification-r1`,
    tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
    tournamentSnapshotVersion: loaded.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: loaded.metadata.snapshotChecksum,
    status: state.status,
    serializationPolicy:
      "Rows are emitted in canonical deterministic order only; equal third-place ranks do not imply official ordering.",
    groupWinners: GROUP_IDS.map((group) => ({
      qualificationSource: `1${group}`,
      ...standingRow(teamNames, state.qualification.groupWinners[group]),
    })),
    groupRunnersUp: GROUP_IDS.map((group) => ({
      qualificationSource: `2${group}`,
      ...standingRow(teamNames, state.qualification.groupRunnersUp[group]),
    })),
    thirdPlacedTeams: state.qualification.thirdPlacedTeams.map((team) => thirdPlaceRow(teamNames, team)),
    thirdPlaceEquivalenceGroups: [
      {
        sharedRank: 3,
        teamIds: ["ecu", "gha"],
        groups: ["E", "L"],
        semantics: "not_officially_ordered",
        serializationOrder: "canonical_team_id_only",
        affectsQualification: false,
      },
    ],
    qualifiedThirdPlacedTeams: state.qualification.qualifiedThirdPlacedTeams.map((team) => thirdPlaceRow(teamNames, team)),
    eliminatedThirdPlacedTeams: state.qualification.thirdPlacedTeams
      .filter((team) => !team.qualified)
      .map((team) => thirdPlaceRow(teamNames, team)),
    qualifyingThirdPlaceGroupKey: qualifiedThirdPlaceGroupKey,
    qualifiers,
    qualifierCount: qualifiers.length,
    uniqueQualifierCount: new Set(qualifierIds).size,
    annexCChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256,
    fairPlay: {
      totalsIncluded: false,
      fabricatedTotals: false,
      sourceStatus: "unavailable_in_reviewed_fifa_sources",
      records: [],
    },
    tieSemantics: {
      ecuadorGhanaSharedRank: 3,
      strictEcuadorGhanaOrderingResolved: false,
      deterministicFallbackRecorded: false,
      teamIdFallbackRecorded: false,
      alphabeticalFallbackRecorded: false,
      affectsQualification: false,
    },
  };
  artifact.qualificationChecksum = computeQualificationChecksum(artifact);

  return { loaded, state, teamNames, artifact };
}

function buildRoundOf32Artifact(input: ReturnType<typeof buildQualificationArtifact>) {
  const qualificationChecksum = String(input.artifact.qualificationChecksum);
  const qualifiedThirdGroups = input.state.qualification.qualifiedThirdPlacedTeams.map((team) => team.group);
  const assignments = resolveThirdPlaceAssignments(qualifiedThirdGroups, roundOf32SlotDefinitions);
  const assignmentsBySlot = new Map(assignments.map((assignment) => [assignment.assignmentKey, assignment.group]));
  const slotsById = new Map(roundOf32SlotDefinitions.map((slot) => [slot.matchId, slot]));

  const matches = input.state.roundOf32.map((match: GeneratedRoundOf32Match) => {
    const slot = slotsById.get(match.matchId);
    if (!slot) {
      throw new Error(`Missing Round-of-32 slot definition for ${match.matchId}.`);
    }
    return {
      matchId: match.matchId,
      participantAId: match.homeTeamId,
      participantBId: match.awayTeamId,
      participantADisplayName: teamName(input.teamNames, match.homeTeamId),
      participantBDisplayName: teamName(input.teamNames, match.awayTeamId),
      participantA: participantSource(match.sourceMetadata.homeSource, match.homeTeamId, input.teamNames, assignmentsBySlot),
      participantB: participantSource(match.sourceMetadata.awaySource, match.awayTeamId, input.teamNames, assignmentsBySlot),
      sourceSlots: {
        participantA: sourceSlot(match.sourceMetadata.homeSource, match.homeTeamId, assignmentsBySlot),
        participantB: sourceSlot(match.sourceMetadata.awaySource, match.awayTeamId, assignmentsBySlot),
      },
      nextMatchId: slot.nextMatchId,
      nextSide: slot.nextSlot,
      tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
      tournamentSnapshotVersion: input.loaded.snapshot.snapshotVersion,
      tournamentSnapshotChecksum: input.loaded.metadata.snapshotChecksum,
      qualificationChecksum,
      annexCChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256,
      topologyChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.knockoutTopologySha256,
    };
  });

  const participantIds = matches.flatMap((match) => [match.participantAId, match.participantBId]);
  const qualifierIds = (input.artifact.qualifiers as { teamId: string }[]).map((team) => team.teamId);
  if (matches.length !== 16) {
    throw new Error(`Expected 16 Round-of-32 matches, received ${matches.length}.`);
  }
  if (participantIds.length !== 32) {
    throw new Error("Round-of-32 artifact must contain 32 participant slots.");
  }
  assertUniqueTeamIds(participantIds, "Round-of-32 participants");
  if (participantIds.some((teamId) => !qualifierIds.includes(teamId))) {
    throw new Error("Round-of-32 artifact contains an eliminated or synthetic participant.");
  }
  if (matches.find((match) => match.matchId === "m79")?.participantAId !== "mex" || matches.find((match) => match.matchId === "m79")?.participantBId !== "ecu") {
    throw new Error("Round-of-32 artifact must include m79 = mex vs ecu.");
  }
  if (matches.find((match) => match.matchId === "m87")?.participantAId !== "col" || matches.find((match) => match.matchId === "m87")?.participantBId !== "gha") {
    throw new Error("Round-of-32 artifact must include m87 = col vs gha.");
  }

  const artifact: Record<string, unknown> = {
    generatedFileWarning: "Do not edit manually.",
    schemaVersion: "world-cup-2026-official-round-of-32-v1",
    artifactVersion: `${input.loaded.snapshot.snapshotVersion}-round-of-32-r1`,
    tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
    tournamentSnapshotVersion: input.loaded.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: input.loaded.metadata.snapshotChecksum,
    qualificationChecksum,
    annexCChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256,
    topologyChecksum: worldCup2026FormatProvenance.normalizedLocalRepresentations.knockoutTopologySha256,
    qualifyingThirdPlaceGroupKey: OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY,
    matchCount: matches.length,
    uniqueParticipantCount: new Set(participantIds).size,
    matches,
  };
  artifact.roundOf32Checksum = computeRoundOf32Checksum(artifact);
  artifact.matches = matches.map((match) => ({
    ...match,
    roundOf32Checksum: artifact.roundOf32Checksum,
  }));
  artifact.roundOf32Checksum = computeRoundOf32Checksum(artifact);
  return artifact;
}

export function buildOfficialQualificationArtifacts(): {
  qualificationChecksum: string;
  roundOf32Checksum: string;
} {
  const qualification = buildQualificationArtifact();
  const roundOf32 = buildRoundOf32Artifact(qualification);
  writeJsonAtomically(OFFICIAL_QUALIFICATION_ARTIFACT_FILE, qualification.artifact);
  writeJsonAtomically(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE, roundOf32);
  const snapshotChecksum = qualification.loaded.metadata.snapshotChecksum;
  if (!snapshotChecksum) {
    throw new Error("Official qualification builder cannot update orchestration status without a snapshot checksum.");
  }
  writeJsonAtomically(
    OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
    buildOfficialSnapshotOrchestrationStatus({
      snapshot: qualification.loaded.snapshot,
      snapshotChecksum,
    }),
  );
  return {
    qualificationChecksum: String(qualification.artifact.qualificationChecksum),
    roundOf32Checksum: String(roundOf32.roundOf32Checksum),
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildOfficialQualificationArtifacts();
  console.log(
    `Built official qualification ${result.qualificationChecksum} and Round of 32 ${result.roundOf32Checksum}.`,
  );
}
