import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { knockoutTopology } from "../../src/lib/tournament-2026/bracket/knockoutTopology.ts";
import type {
  KnockoutAdvancement,
  KnockoutMatchRound,
  KnockoutTopologyMatch,
} from "../../src/lib/tournament-2026/types.ts";
import type { MatchScore, MatchSlot } from "../../src/lib/simulator/types.ts";
import {
  compareCanonicalMatchIds,
  computeQualificationChecksum,
  computeRoundOf32Checksum,
  semanticSha256,
} from "./officialArtifactChecksums.ts";
import { computeKnockoutTopologyChecksum } from "./knockoutTopologyChecksum.ts";
import {
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE,
  OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
} from "./officialSnapshotPaths.ts";
import { writeJsonAtomically } from "./atomicJson.ts";

export const KNOCKOUT_RESULTS_SCHEMA_VERSION =
  "world-cup-2026-official-knockout-results-v1";
export const KNOCKOUT_RESULTS_SOURCE_SCHEMA_VERSION =
  "world-cup-2026-official-knockout-results-source-v1";
export const KNOCKOUT_RESULTS_ARTIFACT_VERSION =
  `${OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID}-knockout-results-r1`;
export const KNOCKOUT_RESULTS_SOURCE_PATH =
  OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE;

type JsonObject = Record<string, unknown>;

export interface KnockoutResultScore {
  participantAGoals: number;
  participantBGoals: number;
  decidedBy: "regular_time" | "extra_time" | "penalties";
  participantAPenalties?: number;
  participantBPenalties?: number;
}

export interface KnockoutResultSourceEntry {
  matchId: string;
  participantAId: string;
  participantBId: string;
  score: KnockoutResultScore;
  winnerId: string;
  resultStatus: "official_final";
  resultSource: string;
}

export interface KnockoutResultsSource {
  schemaVersion: string;
  sourceFileVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  topologyChecksum: string;
  sourceAccessTimestampUtc: string;
  sources: {
    sourceId: string;
    sourceTitle: string;
    sourceRole: string;
    accessTimestampUtc: string;
    offlineOnly: boolean;
  }[];
  results: KnockoutResultSourceEntry[];
}

interface QualificationArtifact {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
}

interface RoundOf32Participant {
  teamId: string;
  displayName: string;
  sourceSlot: string;
}

interface RoundOf32Match {
  matchId: string;
  participantAId: string;
  participantBId: string;
  participantADisplayName: string;
  participantBDisplayName: string;
  participantA: RoundOf32Participant;
  participantB: RoundOf32Participant;
  sourceSlots: {
    participantA: string;
    participantB: string;
  };
  nextMatchId: string;
  nextSide: MatchSlot;
}

interface RoundOf32Artifact {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  topologyChecksum: string;
  roundOf32Checksum: string;
  matches: RoundOf32Match[];
}

export interface KnockoutResultParticipant {
  teamId: string;
  displayName: string;
  sourceSlot: string;
}

export interface KnockoutResultRouting {
  outcome: "winner";
  toMatchId: string;
  toSlot: MatchSlot;
}

export interface CompletedKnockoutMatch {
  matchId: string;
  round: KnockoutMatchRound;
  participantA: KnockoutResultParticipant;
  participantB: KnockoutResultParticipant;
  score: KnockoutResultScore;
  winnerId: string;
  loserId: string;
  resultStatus: "official_final";
  resultSource: string;
  extraTime: boolean;
  penalties: boolean;
  nextMatchRouting: KnockoutResultRouting[];
}

export interface PendingKnockoutMatch {
  matchId: string;
  round: KnockoutMatchRound;
  sourceSlots: {
    participantA: string;
    participantB: string;
  };
  knownParticipants: {
    participantA?: KnockoutResultParticipant;
    participantB?: KnockoutResultParticipant;
  };
  unresolvedParticipantSlots: {
    participantA?: string;
    participantB?: string;
  };
  status: "pending";
}

export interface KnockoutResultsArtifact {
  generatedFileWarning: string;
  schemaVersion: string;
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  topologyChecksum: string;
  source: {
    sourcePath: string;
    sourceFileVersion: string;
    sourceAccessTimestampUtc: string;
    sources: KnockoutResultsSource["sources"];
    runtimeFetch: false;
  };
  completedMatchCount: number;
  pendingMatchCount: number;
  completedMatches: CompletedKnockoutMatch[];
  pendingMatches: PendingKnockoutMatch[];
  resultChecksum: string;
}

interface ParticipantState {
  participantA: KnockoutResultParticipant | null;
  participantB: KnockoutResultParticipant | null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSha256(value: string, label: string): void {
  assert(/^[a-f0-9]{64}$/.test(value), `${label} must be a lowercase SHA-256 checksum.`);
}

function assertFixedTimestamp(value: string, label: string): void {
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value),
    `${label} must be an explicit fixed UTC timestamp.`,
  );
}

function normalizeScore(score: unknown, matchId: string): KnockoutResultScore {
  assert(isRecord(score), `Result ${matchId} score must be an object.`);
  assert(
    Number.isInteger(score.participantAGoals) &&
      Number(score.participantAGoals) >= 0 &&
      Number(score.participantAGoals) <= 99,
    `Result ${matchId} has impossible participant A score.`,
  );
  assert(
    Number.isInteger(score.participantBGoals) &&
      Number(score.participantBGoals) >= 0 &&
      Number(score.participantBGoals) <= 99,
    `Result ${matchId} has impossible participant B score.`,
  );
  const participantAGoals = Number(score.participantAGoals);
  const participantBGoals = Number(score.participantBGoals);
  const decidedBy = score.decidedBy;
  assert(
    decidedBy === "regular_time" || decidedBy === "extra_time" || decidedBy === "penalties",
    `Result ${matchId} has invalid decidedBy value.`,
  );

  const normalized: KnockoutResultScore = {
    participantAGoals,
    participantBGoals,
    decidedBy,
  };

  if (decidedBy === "penalties") {
    assert(participantAGoals === participantBGoals, `Result ${matchId} penalty match must be level after play.`);
    assert(
      Number.isInteger(score.participantAPenalties) &&
        Number(score.participantAPenalties) >= 0 &&
        Number(score.participantAPenalties) <= 99,
      `Result ${matchId} has impossible participant A penalties.`,
    );
    assert(
      Number.isInteger(score.participantBPenalties) &&
        Number(score.participantBPenalties) >= 0 &&
        Number(score.participantBPenalties) <= 99,
      `Result ${matchId} has impossible participant B penalties.`,
    );
    const participantAPenalties = Number(score.participantAPenalties);
    const participantBPenalties = Number(score.participantBPenalties);
    assert(participantAPenalties !== participantBPenalties, `Result ${matchId} penalties must decide a winner.`);
    normalized.participantAPenalties = participantAPenalties;
    normalized.participantBPenalties = participantBPenalties;
  } else {
    assert(participantAGoals !== participantBGoals, `Result ${matchId} drawn score requires penalties.`);
    assert(!("participantAPenalties" in score), `Result ${matchId} must not include penalties unless decidedBy is penalties.`);
    assert(!("participantBPenalties" in score), `Result ${matchId} must not include penalties unless decidedBy is penalties.`);
  }

  return normalized;
}

function validateScoreWinner(score: KnockoutResultScore, winnerId: string, participantAId: string, participantBId: string, matchId: string): void {
  const participantAWon =
    score.decidedBy === "penalties"
      ? Number(score.participantAPenalties) > Number(score.participantBPenalties)
      : score.participantAGoals > score.participantBGoals;
  const scoreWinnerId = participantAWon ? participantAId : participantBId;
  assert(winnerId === scoreWinnerId, `Result ${matchId} winner does not match the score.`);
}

function normalizeSourceEntry(entry: unknown): KnockoutResultSourceEntry {
  assert(isRecord(entry), "Each source result must be an object.");
  const matchId = String(entry.matchId ?? "");
  assert(matchId.length > 0, "Source result is missing matchId.");
  const participantAId = String(entry.participantAId ?? "");
  const participantBId = String(entry.participantBId ?? "");
  const winnerId = String(entry.winnerId ?? "");
  const resultStatus = entry.resultStatus;
  const resultSource = String(entry.resultSource ?? "");
  assert(participantAId.length > 0, `Result ${matchId} is missing participantAId.`);
  assert(participantBId.length > 0, `Result ${matchId} is missing participantBId.`);
  assert(winnerId.length > 0, `Result ${matchId} is missing winnerId.`);
  assert(resultStatus === "official_final", `Result ${matchId} must have resultStatus official_final.`);
  assert(resultSource.length > 0, `Result ${matchId} is missing resultSource.`);
  const score = normalizeScore(entry.score, matchId);
  assert(
    winnerId === participantAId || winnerId === participantBId,
    `Result ${matchId} winner must be one of the participants.`,
  );
  validateScoreWinner(score, winnerId, participantAId, participantBId, matchId);

  return {
    matchId,
    participantAId,
    participantBId,
    score,
    winnerId,
    resultStatus,
    resultSource,
  };
}

function normalizeSource(source: KnockoutResultsSource): KnockoutResultsSource {
  assert(source.schemaVersion === KNOCKOUT_RESULTS_SOURCE_SCHEMA_VERSION, "Knockout result source schema version mismatch.");
  assert(source.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Knockout result source tournament snapshot ID mismatch.");
  assertSha256(source.tournamentSnapshotChecksum, "Source tournament snapshot checksum");
  assertSha256(source.qualificationChecksum, "Source qualification checksum");
  assertSha256(source.roundOf32Checksum, "Source Round-of-32 checksum");
  assertSha256(source.topologyChecksum, "Source topology checksum");
  assertFixedTimestamp(source.sourceAccessTimestampUtc, "Source access timestamp");
  assert(Array.isArray(source.sources), "Knockout result source metadata must include sources.");
  assert(Array.isArray(source.results), "Knockout result source results must be an array.");

  const seenSourceIds = new Set<string>();
  for (const sourceMetadata of source.sources) {
    assert(sourceMetadata.offlineOnly === true, `Result source ${sourceMetadata.sourceId} must be marked offlineOnly.`);
    assert(sourceMetadata.accessTimestampUtc === source.sourceAccessTimestampUtc, `Result source ${sourceMetadata.sourceId} timestamp must match sourceAccessTimestampUtc.`);
    assertFixedTimestamp(sourceMetadata.accessTimestampUtc, `Result source ${sourceMetadata.sourceId} access timestamp`);
    assert(!seenSourceIds.has(sourceMetadata.sourceId), `Duplicate result source ID "${sourceMetadata.sourceId}".`);
    seenSourceIds.add(sourceMetadata.sourceId);
  }

  const results = source.results.map(normalizeSourceEntry).sort((left, right) =>
    compareCanonicalMatchIds(left.matchId, right.matchId),
  );
  const seenMatchIds = new Set<string>();
  for (const result of results) {
    assert(!seenMatchIds.has(result.matchId), `Duplicate result for match "${result.matchId}".`);
    seenMatchIds.add(result.matchId);
    assert(seenSourceIds.has(result.resultSource), `Result ${result.matchId} references unknown result source "${result.resultSource}".`);
  }

  return {
    ...source,
    results,
  };
}

function winnerAdvancements(match: KnockoutTopologyMatch): KnockoutResultRouting[] {
  return match.advancements
    .filter((advancement): advancement is KnockoutAdvancement & { outcome: "winner"; toSlot: MatchSlot } => advancement.outcome === "winner")
    .map((advancement) => ({
      outcome: "winner" as const,
      toMatchId: advancement.toMatchId,
      toSlot: advancement.toSlot,
    }))
    .sort(
      (left, right) =>
        compareCanonicalMatchIds(left.toMatchId, right.toMatchId) ||
        left.toSlot.localeCompare(right.toSlot),
    );
}

function participantForSlot(state: ParticipantState, slot: MatchSlot): KnockoutResultParticipant | null {
  return slot === "teamAId" ? state.participantA : state.participantB;
}

function assignParticipantForSlot(state: ParticipantState, slot: MatchSlot, participant: KnockoutResultParticipant): void {
  if (slot === "teamAId") {
    state.participantA = participant;
  } else {
    state.participantB = participant;
  }
}

function sourceSlotForSlot(matchId: string, incomingByMatch: Map<string, KnockoutAdvancement[]>, slot: MatchSlot): string {
  const incoming = incomingByMatch.get(matchId)?.find((advancement) => advancement.toSlot === slot);
  if (!incoming) {
    return slot === "teamAId" ? "unresolved participant A" : "unresolved participant B";
  }
  return `${incoming.outcome} of ${incoming.toMatchId}`;
}

function getLoser(completed: CompletedKnockoutMatch): KnockoutResultParticipant {
  return completed.winnerId === completed.participantA.teamId
    ? completed.participantB
    : completed.participantA;
}

function getWinner(completed: CompletedKnockoutMatch): KnockoutResultParticipant {
  return completed.winnerId === completed.participantA.teamId
    ? completed.participantA
    : completed.participantB;
}

function resultChecksumPayload(artifact: Omit<KnockoutResultsArtifact, "resultChecksum">): unknown {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    tournamentSnapshotId: artifact.tournamentSnapshotId,
    tournamentSnapshotVersion: artifact.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: artifact.tournamentSnapshotChecksum,
    qualificationChecksum: artifact.qualificationChecksum,
    roundOf32Checksum: artifact.roundOf32Checksum,
    topologyChecksum: artifact.topologyChecksum,
    source: artifact.source,
    completedMatches: artifact.completedMatches,
    pendingMatches: artifact.pendingMatches,
  };
}

export function computeKnockoutResultsChecksum(artifact: Omit<KnockoutResultsArtifact, "resultChecksum"> | KnockoutResultsArtifact): string {
  const withoutChecksum: Partial<KnockoutResultsArtifact> = { ...(artifact as KnockoutResultsArtifact) };
  delete withoutChecksum.resultChecksum;
  return semanticSha256(resultChecksumPayload(withoutChecksum as Omit<KnockoutResultsArtifact, "resultChecksum">));
}

function scoreForSimulator(score: KnockoutResultScore): MatchScore {
  return {
    teamAGoals: score.participantAGoals,
    teamBGoals: score.participantBGoals,
    decidedBy: score.decidedBy,
    ...(score.participantAPenalties !== undefined ? { teamAPenalties: score.participantAPenalties } : {}),
    ...(score.participantBPenalties !== undefined ? { teamBPenalties: score.participantBPenalties } : {}),
  };
}

export function toSimulatorScore(score: KnockoutResultScore): MatchScore {
  return scoreForSimulator(score);
}

export function buildKnockoutResultsArtifact(input: {
  qualification: QualificationArtifact;
  roundOf32: RoundOf32Artifact;
  source: KnockoutResultsSource;
  topology?: readonly KnockoutTopologyMatch[];
  sourcePath?: string;
}): KnockoutResultsArtifact {
  const topology = [...(input.topology ?? knockoutTopology)].sort((left, right) =>
    compareCanonicalMatchIds(left.matchId, right.matchId),
  );
  const source = normalizeSource(input.source);
  const topologyChecksum = computeKnockoutTopologyChecksum(topology);
  const qualificationChecksum = computeQualificationChecksum(input.qualification as unknown as Record<string, unknown>);
  const roundOf32Checksum = computeRoundOf32Checksum(input.roundOf32 as unknown as Record<string, unknown>);

  assert(input.qualification.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Qualification artifact has wrong tournament snapshot ID.");
  assert(input.qualification.qualificationChecksum === qualificationChecksum, "Stale qualification checksum.");
  assert(input.roundOf32.tournamentSnapshotId === input.qualification.tournamentSnapshotId, "Round-of-32 tournament snapshot ID mismatch.");
  assert(input.roundOf32.tournamentSnapshotChecksum === input.qualification.tournamentSnapshotChecksum, "Round-of-32 stale snapshot checksum.");
  assert(input.roundOf32.qualificationChecksum === input.qualification.qualificationChecksum, "Round-of-32 qualification checksum mismatch.");
  assert(input.roundOf32.roundOf32Checksum === roundOf32Checksum, "Stale Round-of-32 checksum.");
  assert(input.roundOf32.topologyChecksum === topologyChecksum, "Round-of-32 topology checksum mismatch.");
  assert(source.tournamentSnapshotId === input.qualification.tournamentSnapshotId, "Knockout result source snapshot ID mismatch.");
  assert(source.tournamentSnapshotChecksum === input.qualification.tournamentSnapshotChecksum, "Knockout result source has stale snapshot checksum.");
  assert(source.qualificationChecksum === input.qualification.qualificationChecksum, "Knockout result source has stale qualification checksum.");
  assert(source.roundOf32Checksum === input.roundOf32.roundOf32Checksum, "Knockout result source has stale Round-of-32 checksum.");
  assert(source.topologyChecksum === topologyChecksum, "Knockout result source has stale topology checksum.");

  const topologyById = new Map(topology.map((match) => [match.matchId, match]));
  const incomingByMatch = new Map<string, KnockoutAdvancement[]>();
  for (const match of topology) {
    for (const advancement of match.advancements) {
      const incoming = incomingByMatch.get(advancement.toMatchId) ?? [];
      incoming.push({ ...advancement, toMatchId: match.matchId });
      incomingByMatch.set(advancement.toMatchId, incoming);
    }
  }

  const roundMatchesById = new Map(input.roundOf32.matches.map((match) => [match.matchId, match]));
  const sourceResultsById = new Map(source.results.map((result) => [result.matchId, result]));
  for (const result of source.results) {
    const topologyMatch = topologyById.get(result.matchId);
    assert(topologyMatch, `Result for unknown match ID "${result.matchId}".`);
    assert(
      topologyMatch.round !== undefined,
      `Result ${result.matchId} is not a known knockout match.`,
    );
  }

  const participantStateByMatch = new Map<string, ParticipantState>();
  const sourceSlotByMatch = new Map<string, { participantA: string; participantB: string }>();

  for (const match of topology) {
    if (match.round === "round_of_32") {
      const roundMatch = roundMatchesById.get(match.matchId);
      assert(roundMatch, `Missing Round-of-32 artifact match "${match.matchId}".`);
      participantStateByMatch.set(match.matchId, {
        participantA: {
          teamId: roundMatch.participantA.teamId,
          displayName: roundMatch.participantA.displayName,
          sourceSlot: roundMatch.participantA.sourceSlot,
        },
        participantB: {
          teamId: roundMatch.participantB.teamId,
          displayName: roundMatch.participantB.displayName,
          sourceSlot: roundMatch.participantB.sourceSlot,
        },
      });
      sourceSlotByMatch.set(match.matchId, {
        participantA: roundMatch.sourceSlots.participantA,
        participantB: roundMatch.sourceSlots.participantB,
      });
    } else {
      participantStateByMatch.set(match.matchId, {
        participantA: null,
        participantB: null,
      });
      sourceSlotByMatch.set(match.matchId, {
        participantA: sourceSlotForSlot(match.matchId, incomingByMatch, "teamAId"),
        participantB: sourceSlotForSlot(match.matchId, incomingByMatch, "teamBId"),
      });
    }
  }

  const completedMatches: CompletedKnockoutMatch[] = [];
  const pendingMatches: PendingKnockoutMatch[] = [];

  for (const topologyMatch of topology) {
    const state = participantStateByMatch.get(topologyMatch.matchId);
    assert(state, `Missing participant state for "${topologyMatch.matchId}".`);
    const sourceResult = sourceResultsById.get(topologyMatch.matchId);

    if (!sourceResult) {
      const slots = sourceSlotByMatch.get(topologyMatch.matchId);
      assert(slots, `Missing source slots for "${topologyMatch.matchId}".`);
      const pending: PendingKnockoutMatch = {
        matchId: topologyMatch.matchId,
        round: topologyMatch.round,
        sourceSlots: slots,
        knownParticipants: {},
        unresolvedParticipantSlots: {},
        status: "pending",
      };
      if (state.participantA) {
        pending.knownParticipants.participantA = state.participantA;
      } else {
        pending.unresolvedParticipantSlots.participantA = slots.participantA;
      }
      if (state.participantB) {
        pending.knownParticipants.participantB = state.participantB;
      } else {
        pending.unresolvedParticipantSlots.participantB = slots.participantB;
      }
      pendingMatches.push(pending);
      continue;
    }

    assert(state.participantA && state.participantB, `Completed match "${topologyMatch.matchId}" has unresolved prerequisite participants.`);
    assert(sourceResult.participantAId === state.participantA.teamId, `Result ${topologyMatch.matchId} participant A does not match official bracket participant.`);
    assert(sourceResult.participantBId === state.participantB.teamId, `Result ${topologyMatch.matchId} participant B does not match official bracket participant.`);
    assert(
      sourceResult.winnerId === state.participantA.teamId || sourceResult.winnerId === state.participantB.teamId,
      `Result ${topologyMatch.matchId} winner must be one of the participants.`,
    );
    validateScoreWinner(
      sourceResult.score,
      sourceResult.winnerId,
      state.participantA.teamId,
      state.participantB.teamId,
      topologyMatch.matchId,
    );

    const completed: CompletedKnockoutMatch = {
      matchId: topologyMatch.matchId,
      round: topologyMatch.round,
      participantA: state.participantA,
      participantB: state.participantB,
      score: sourceResult.score,
      winnerId: sourceResult.winnerId,
      loserId: sourceResult.winnerId === state.participantA.teamId ? state.participantB.teamId : state.participantA.teamId,
      resultStatus: sourceResult.resultStatus,
      resultSource: sourceResult.resultSource,
      extraTime: sourceResult.score.decidedBy === "extra_time" || sourceResult.score.decidedBy === "penalties",
      penalties: sourceResult.score.decidedBy === "penalties",
      nextMatchRouting: winnerAdvancements(topologyMatch),
    };
    completedMatches.push(completed);

    for (const advancement of topologyMatch.advancements) {
      const nextState = participantStateByMatch.get(advancement.toMatchId);
      assert(nextState, `Match "${topologyMatch.matchId}" routes to unknown match "${advancement.toMatchId}".`);
      const routedParticipant = advancement.outcome === "winner" ? getWinner(completed) : getLoser(completed);
      const existing = participantForSlot(nextState, advancement.toSlot);
      if (existing) {
        assert(
          existing.teamId === routedParticipant.teamId,
          `Routing ${topologyMatch.matchId} ${advancement.outcome} to ${advancement.toMatchId}/${advancement.toSlot} conflicts with an existing participant.`,
        );
      }
      assignParticipantForSlot(nextState, advancement.toSlot, routedParticipant);
    }
  }

  const artifactWithoutChecksum: Omit<KnockoutResultsArtifact, "resultChecksum"> = {
    generatedFileWarning: "Do not edit manually. Update data/world-cup-2026/sources/official-knockout-results.json and rebuild.",
    schemaVersion: KNOCKOUT_RESULTS_SCHEMA_VERSION,
    artifactVersion: KNOCKOUT_RESULTS_ARTIFACT_VERSION,
    tournamentSnapshotId: input.qualification.tournamentSnapshotId,
    tournamentSnapshotVersion: input.qualification.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: input.qualification.tournamentSnapshotChecksum,
    qualificationChecksum: input.qualification.qualificationChecksum,
    roundOf32Checksum: input.roundOf32.roundOf32Checksum,
    topologyChecksum,
    source: {
      sourcePath: input.sourcePath ?? KNOCKOUT_RESULTS_SOURCE_PATH,
      sourceFileVersion: source.sourceFileVersion,
      sourceAccessTimestampUtc: source.sourceAccessTimestampUtc,
      sources: source.sources,
      runtimeFetch: false,
    },
    completedMatchCount: completedMatches.length,
    pendingMatchCount: pendingMatches.length,
    completedMatches,
    pendingMatches,
  };

  return {
    ...artifactWithoutChecksum,
    resultChecksum: computeKnockoutResultsChecksum(artifactWithoutChecksum),
  };
}

export function loadKnockoutResultsSource(filePath = OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE): KnockoutResultsSource {
  if (!existsSync(filePath)) {
    return {
      schemaVersion: KNOCKOUT_RESULTS_SOURCE_SCHEMA_VERSION,
      sourceFileVersion: "official-2026-current-knockout-results-source-r1",
      tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
      tournamentSnapshotChecksum: "",
      qualificationChecksum: "",
      roundOf32Checksum: "",
      topologyChecksum: "",
      sourceAccessTimestampUtc: "2026-07-04T00:00:00Z",
      sources: [],
      results: [],
    };
  }
  return readJson<KnockoutResultsSource>(filePath);
}

export function buildKnockoutResults(): { resultChecksum: string; completedMatchCount: number; pendingMatchCount: number } {
  const qualification = readJson<QualificationArtifact>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
  const roundOf32 = readJson<RoundOf32Artifact>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
  const source = loadKnockoutResultsSource(OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE);
  const artifact = buildKnockoutResultsArtifact({
    qualification,
    roundOf32,
    source,
    sourcePath: OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
  });
  writeJsonAtomically(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE, artifact);
  return {
    resultChecksum: artifact.resultChecksum,
    completedMatchCount: artifact.completedMatchCount,
    pendingMatchCount: artifact.pendingMatchCount,
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildKnockoutResults();
  console.log(
    `Built official knockout results ${result.resultChecksum} (${result.completedMatchCount} completed, ${result.pendingMatchCount} pending).`,
  );
}
