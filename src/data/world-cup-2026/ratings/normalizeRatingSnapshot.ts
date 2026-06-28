import { compareCodePoints } from "@/src/lib/tournament-2026/constants";
import type {
  KnockoutRatingRecord,
  KnockoutRatingSnapshot,
  NormalizedKnockoutRatingSnapshot,
} from "./types";

function normalizeRecord(record: KnockoutRatingRecord): KnockoutRatingRecord {
  return {
    teamId: record.teamId,
    preTournamentRating: record.preTournamentRating,
    groupStageDelta: record.groupStageDelta,
    knockoutRating: record.knockoutRating,
  };
}

export function normalizeKnockoutRatingSnapshot(
  snapshot: KnockoutRatingSnapshot,
): NormalizedKnockoutRatingSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    snapshotVersion: snapshot.snapshotVersion,
    tournamentSnapshotId: snapshot.tournamentSnapshotId,
    tournamentSnapshotVersion: snapshot.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: snapshot.tournamentSnapshotChecksum,
    modelVersion: snapshot.modelVersion,
    divisor: snapshot.divisor,
    kFactor: snapshot.kFactor,
    kFactorPolicy: { ...snapshot.kFactorPolicy },
    initialRatingSource: { ...snapshot.initialRatingSource },
    completedMatchCount: snapshot.completedMatchCount,
    fixtureRangeUsed: { ...snapshot.fixtureRangeUsed },
    records: [...snapshot.records].map(normalizeRecord).sort((left, right) => compareCodePoints(left.teamId, right.teamId)),
    sources: [...snapshot.sources].map((source) => ({ ...source })),
    ratingChecksum: null,
  };
}

export function serializeKnockoutRatingSnapshot(snapshot: NormalizedKnockoutRatingSnapshot): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    snapshotVersion: snapshot.snapshotVersion,
    tournamentSnapshotId: snapshot.tournamentSnapshotId,
    tournamentSnapshotVersion: snapshot.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: snapshot.tournamentSnapshotChecksum,
    modelVersion: snapshot.modelVersion,
    divisor: snapshot.divisor,
    kFactor: snapshot.kFactor,
    kFactorPolicy: snapshot.kFactorPolicy,
    initialRatingSource: snapshot.initialRatingSource,
    completedMatchCount: snapshot.completedMatchCount,
    fixtureRangeUsed: snapshot.fixtureRangeUsed,
    records: snapshot.records,
    sources: snapshot.sources,
  });
}
