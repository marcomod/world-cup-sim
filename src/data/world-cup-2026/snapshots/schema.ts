import { GROUP_IDS, isGroupId } from "@/src/lib/tournament-2026/constants";
import type { GroupId } from "@/src/lib/tournament-2026/types";
import type {
  SourceReference,
  TournamentSnapshot,
  TournamentSnapshotSources,
  TournamentSnapshotState,
} from "./types";

export const TOURNAMENT_SNAPSHOT_SCHEMA_VERSION = "world-cup-2026-snapshot-v1";
export const TOURNAMENT_SNAPSHOT_ID = "fifa-world-cup-2026";
export const GROUP_STAGE_FIXTURE_COUNT = 72;
export const GROUP_STAGE_MATCH_NUMBER_START = 1;
export const GROUP_STAGE_MATCH_NUMBER_END = 72;
export const SUPPORTED_SNAPSHOT_STATES: readonly TournamentSnapshotState[] = [
  "structure_only",
  "group_stage_in_progress",
  "group_stage_complete",
];

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "snapshotId",
  "snapshotVersion",
  "tournament",
  "state",
  "teams",
  "fixtures",
  "fairPlay",
  "fifaRanking",
  "sources",
] as const;

const SOURCE_KEYS = [
  "authority",
  "title",
  "url",
  "publishedDate",
  "accessedDate",
  "version",
  "checksum",
] as const;

const SOURCE_GROUP_KEYS = [
  "teams",
  "groups",
  "fixtures",
  "results",
  "fairPlay",
  "fifaRanking",
] as const;

export function isSnapshotState(value: string): value is TournamentSnapshotState {
  return SUPPORTED_SNAPSHOT_STATES.includes(value as TournamentSnapshotState);
}

export function assertKnownTopLevelKeys(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.includes(key as (typeof TOP_LEVEL_KEYS)[number])) {
      throw new Error(`Snapshot contains unknown top-level field "${key}".`);
    }
  }
}

function assertObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
}

function assertSourceReference(value: unknown, context: string): asserts value is SourceReference {
  assertObject(value, context);

  for (const key of Object.keys(value)) {
    if (!SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number])) {
      throw new Error(`${context} contains unknown field "${key}".`);
    }
  }

  for (const key of ["authority", "title", "url", "accessedDate"] as const) {
    if (typeof value[key] !== "string" || value[key].trim() === "") {
      throw new Error(`${context}.${key} must be a non-empty string.`);
    }
  }

  for (const key of ["publishedDate", "version", "checksum"] as const) {
    if (value[key] !== null && typeof value[key] !== "string") {
      throw new Error(`${context}.${key} must be a string or null.`);
    }
  }
}

export function assertSourceReferences(
  value: unknown,
  context = "sources",
): asserts value is TournamentSnapshotSources {
  assertObject(value, context);

  for (const key of Object.keys(value)) {
    if (!SOURCE_GROUP_KEYS.includes(key as (typeof SOURCE_GROUP_KEYS)[number])) {
      throw new Error(`${context} contains unknown field "${key}".`);
    }
  }

  for (const key of ["teams", "groups", "fixtures"] as const) {
    assertSourceReference(value[key], `${context}.${key}`);
  }

  for (const key of ["results", "fairPlay", "fifaRanking"] as const) {
    if (value[key] !== null) {
      assertSourceReference(value[key], `${context}.${key}`);
    }
  }
}

export function assertGroupId(value: unknown, context: string): asserts value is GroupId {
  if (typeof value !== "string" || !isGroupId(value)) {
    throw new Error(`${context} must be one of ${GROUP_IDS.join(", ")}.`);
  }
}

export function parseTournamentSnapshot(value: unknown): TournamentSnapshot {
  assertObject(value, "Snapshot");
  assertKnownTopLevelKeys(value);
  assertSourceReferences(value.sources);

  return value as unknown as TournamentSnapshot;
}
