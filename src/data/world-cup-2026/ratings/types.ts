import type { SourceReference } from "@/src/data/world-cup-2026/snapshots/types";
import type { TeamId } from "@/src/lib/tournament-2026/types";

export const KNOCKOUT_RATING_SNAPSHOT_SCHEMA_VERSION = "world-cup-2026-knockout-ratings-v1";
export const KNOCKOUT_RATING_MODEL_VERSION = "world-cup-2026-group-stage-elo-refresh-v1";
export const KNOCKOUT_RATING_DIVISOR = 400 as const;
export const KNOCKOUT_RATING_K_FACTOR = 20;
export const KNOCKOUT_RATING_K_FACTOR_POLICY_ID = "project-sequential-elo-k20-neutral-v1";

export interface KFactorPolicy {
  value: number;
  policyId: string;
  rationale: string;
  selectedBeforeKnockoutResults: boolean;
}

export interface InitialRatingSourceMetadata {
  sourceName: string;
  modelVersion: string;
  snapshotLabel: string;
  snapshotDate: string;
  sourceUrl: string;
  sourceArtifact: string;
  inputChecksum: string;
  metadataChecksum: string;
  teamIdentityMappingVersion: string;
  ratingBasis: string;
  normalizationNotes: string;
}

export interface KnockoutRatingRecord {
  teamId: TeamId;
  preTournamentRating: number;
  groupStageDelta: number;
  knockoutRating: number;
}

export interface KnockoutRatingSnapshot {
  schemaVersion: string;
  snapshotId: string;
  snapshotVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  modelVersion: string;
  divisor: typeof KNOCKOUT_RATING_DIVISOR;
  kFactor: number;
  kFactorPolicy: KFactorPolicy;
  initialRatingSource: InitialRatingSourceMetadata;
  completedMatchCount: number;
  fixtureRangeUsed: {
    firstFifaMatchNumber: number;
    lastFifaMatchNumber: number;
  };
  records: readonly KnockoutRatingRecord[];
  sources: readonly SourceReference[];
}

export interface NormalizedKnockoutRatingSnapshot extends KnockoutRatingSnapshot {
  ratingChecksum: string | null;
}
