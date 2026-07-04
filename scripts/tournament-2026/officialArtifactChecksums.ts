import { createHash } from "node:crypto";
import { compareCodePoints } from "../../src/lib/tournament-2026/constants.ts";

type JsonObject = Record<string, unknown>;

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([key, nested]) => [key, sortObjectKeys(nested)]),
    );
  }
  return value;
}

export function semanticSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sortObjectKeys(value)), "utf8")
    .digest("hex");
}

function rowTeamId(row: unknown): string {
  return typeof row === "object" && row !== null && "teamId" in row
    ? String((row as { teamId: unknown }).teamId)
    : "";
}

function rowGroup(row: unknown): string {
  return typeof row === "object" && row !== null && "group" in row
    ? String((row as { group: unknown }).group)
    : "";
}

function rowRank(row: unknown): number {
  return typeof row === "object" && row !== null && "thirdPlaceRank" in row
    ? Number((row as { thirdPlaceRank: unknown }).thirdPlaceRank)
    : Number.POSITIVE_INFINITY;
}

function sortTeamRows<T>(rows: readonly T[] | undefined): T[] {
  return [...(rows ?? [])].sort(
    (left, right) =>
      compareCodePoints(rowGroup(left), rowGroup(right)) ||
      compareCodePoints(rowTeamId(left), rowTeamId(right)),
  );
}

function sortThirdRows<T>(rows: readonly T[] | undefined): T[] {
  return [...(rows ?? [])].sort(
    (left, right) =>
      rowRank(left) - rowRank(right) ||
      compareCodePoints(rowGroup(left), rowGroup(right)) ||
      compareCodePoints(rowTeamId(left), rowTeamId(right)),
  );
}

function normalizeEquivalenceGroups(groups: readonly unknown[] | undefined): unknown[] {
  return [...(groups ?? [])]
    .map((group) => {
      if (group === null || typeof group !== "object") {
        return group;
      }
      const record = group as JsonObject;
      return {
        ...record,
        teamIds: Array.isArray(record.teamIds)
          ? [...record.teamIds].map(String).sort(compareCodePoints)
          : record.teamIds,
      };
    })
    .sort((left, right) => {
      const leftRecord = left as { sharedRank?: unknown; teamIds?: unknown };
      const rightRecord = right as { sharedRank?: unknown; teamIds?: unknown };
      return (
        Number(leftRecord.sharedRank ?? 0) - Number(rightRecord.sharedRank ?? 0) ||
        compareCodePoints(JSON.stringify(leftRecord.teamIds ?? []), JSON.stringify(rightRecord.teamIds ?? []))
      );
    });
}

export function qualificationChecksumPayload(artifact: Record<string, unknown>): unknown {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    tournamentSnapshotId: artifact.tournamentSnapshotId,
    tournamentSnapshotVersion: artifact.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: artifact.tournamentSnapshotChecksum,
    status: artifact.status,
    groupWinners: sortTeamRows(artifact.groupWinners as readonly unknown[]),
    groupRunnersUp: sortTeamRows(artifact.groupRunnersUp as readonly unknown[]),
    thirdPlacedTeams: sortThirdRows(artifact.thirdPlacedTeams as readonly unknown[]),
    thirdPlaceEquivalenceGroups: normalizeEquivalenceGroups(
      artifact.thirdPlaceEquivalenceGroups as readonly unknown[],
    ),
    qualifiedThirdPlacedTeams: sortTeamRows(artifact.qualifiedThirdPlacedTeams as readonly unknown[]),
    eliminatedThirdPlacedTeams: sortTeamRows(artifact.eliminatedThirdPlacedTeams as readonly unknown[]),
    qualifyingThirdPlaceGroupKey: artifact.qualifyingThirdPlaceGroupKey,
    qualifiers: sortTeamRows(artifact.qualifiers as readonly unknown[]),
    annexCChecksum: artifact.annexCChecksum,
    fairPlay: artifact.fairPlay,
    tieSemantics: artifact.tieSemantics,
  };
}

export function computeQualificationChecksum(artifact: Record<string, unknown>): string {
  return semanticSha256(qualificationChecksumPayload(artifact));
}

function matchNumber(matchId: unknown): number {
  const match = /^m(\d+)$/.exec(String(matchId));
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function compareCanonicalMatchIds(left: unknown, right: unknown): number {
  return (
    matchNumber(left) - matchNumber(right) ||
    compareCodePoints(String(left), String(right))
  );
}

function sortMatches<T>(matches: readonly T[] | undefined, idField: "id" | "matchId"): T[] {
  return [...(matches ?? [])].sort(
    (left, right) =>
      compareCanonicalMatchIds(
        (left as { id?: unknown; matchId?: unknown })[idField],
        (right as { id?: unknown; matchId?: unknown })[idField],
      ),
  );
}

function stripEchoChecksumsFromMatch(match: unknown): unknown {
  if (match === null || typeof match !== "object") {
    return match;
  }
  const rest = { ...(match as JsonObject) };
  delete rest.roundOf32Checksum;
  delete rest.simulatorInputChecksum;
  return rest;
}

export function roundOf32ChecksumPayload(artifact: Record<string, unknown>): unknown {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    tournamentSnapshotId: artifact.tournamentSnapshotId,
    tournamentSnapshotVersion: artifact.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: artifact.tournamentSnapshotChecksum,
    qualificationChecksum: artifact.qualificationChecksum,
    annexCChecksum: artifact.annexCChecksum,
    topologyChecksum: artifact.topologyChecksum,
    qualifyingThirdPlaceGroupKey: artifact.qualifyingThirdPlaceGroupKey,
    matches: sortMatches(artifact.matches as readonly unknown[], "matchId").map(stripEchoChecksumsFromMatch),
  };
}

export function computeRoundOf32Checksum(artifact: Record<string, unknown>): string {
  return semanticSha256(roundOf32ChecksumPayload(artifact));
}

export function ratingLinkageChecksumPayload(artifact: Record<string, unknown>): unknown {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    tournamentSnapshotId: artifact.tournamentSnapshotId,
    tournamentSnapshotVersion: artifact.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: artifact.tournamentSnapshotChecksum,
    qualificationChecksum: artifact.qualificationChecksum,
    roundOf32Checksum: artifact.roundOf32Checksum,
    ratingSnapshotId: artifact.ratingSnapshotId,
    ratingSnapshotVersion: artifact.ratingSnapshotVersion,
    ratingSnapshotChecksum: artifact.ratingSnapshotChecksum,
    numericRatingChecksum: artifact.numericRatingChecksum,
    divisor: artifact.divisor,
    modelVersion: artifact.modelVersion,
    totalRatingRecordCount: artifact.totalRatingRecordCount,
    qualifiedRatingRecordCount: artifact.qualifiedRatingRecordCount,
    qualifiedTeamRatings: sortTeamRows(artifact.qualifiedTeamRatings as readonly unknown[]),
  };
}

export function computeRatingLinkageChecksum(artifact: Record<string, unknown>): string {
  return semanticSha256(ratingLinkageChecksumPayload(artifact));
}

export function simulatorInputChecksumPayload(artifact: Record<string, unknown>): unknown {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    tournamentSnapshotId: artifact.tournamentSnapshotId,
    tournamentSnapshotVersion: artifact.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: artifact.tournamentSnapshotChecksum,
    qualificationChecksum: artifact.qualificationChecksum,
    roundOf32Checksum: artifact.roundOf32Checksum,
    ratingSnapshotId: artifact.ratingSnapshotId,
    ratingSnapshotChecksum: artifact.ratingSnapshotChecksum,
    ratingLinkageChecksum: artifact.ratingLinkageChecksum,
    modelVersion: artifact.modelVersion,
    divisor: artifact.divisor,
    openingRoundMatchCount: artifact.openingRoundMatchCount,
    championPathMatchCount: artifact.championPathMatchCount,
    laterRoundsStatus: artifact.laterRoundsStatus,
    matches: sortMatches(artifact.matches as readonly unknown[], "id").map(stripEchoChecksumsFromMatch),
    qualifiedTeamRatings: sortTeamRows(artifact.qualifiedTeamRatings as readonly unknown[]),
  };
}

export function computeSimulatorInputChecksum(artifact: Record<string, unknown>): string {
  return semanticSha256(simulatorInputChecksumPayload(artifact));
}
