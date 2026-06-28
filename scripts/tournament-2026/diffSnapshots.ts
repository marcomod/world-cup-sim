import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeTournamentSnapshotChecksum } from "../../src/data/world-cup-2026/snapshots/snapshotChecksum.ts";
import { validateTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/validateSnapshot.ts";
import { stableJson } from "./stableJson.ts";

export type SnapshotDiffCategory =
  | "teams"
  | "groups"
  | "fixtures"
  | "match_status"
  | "scores"
  | "fair_play"
  | "ranking"
  | "source_metadata"
  | "normalization_version"
  | "checksum";

const SNAPSHOT_DIFF_CATEGORY_ORDER: readonly SnapshotDiffCategory[] = [
  "teams",
  "groups",
  "fixtures",
  "match_status",
  "scores",
  "fair_play",
  "ranking",
  "source_metadata",
  "normalization_version",
  "checksum",
];

export interface SnapshotDiffResult {
  identical: boolean;
  categories: readonly SnapshotDiffCategory[];
  details: readonly SnapshotDiffDetail[];
  leftChecksum: string;
  rightChecksum: string;
}

export interface SnapshotDiffDetail {
  category: SnapshotDiffCategory;
  changeType: "added" | "removed" | "changed";
  id: string;
  field: string;
  before: unknown;
  after: unknown;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function addIfChanged(categories: Set<SnapshotDiffCategory>, category: SnapshotDiffCategory, left: unknown, right: unknown): void {
  if (serialize(left) !== serialize(right)) {
    categories.add(category);
  }
}

function detail(
  details: SnapshotDiffDetail[],
  categories: Set<SnapshotDiffCategory>,
  category: SnapshotDiffCategory,
  changeType: SnapshotDiffDetail["changeType"],
  id: string,
  field: string,
  before: unknown,
  after: unknown,
): void {
  categories.add(category);
  details.push({ category, changeType, id, field, before, after });
}

function compareById<T extends object>(
  details: SnapshotDiffDetail[],
  categories: Set<SnapshotDiffCategory>,
  category: SnapshotDiffCategory,
  leftRows: readonly T[],
  rightRows: readonly T[],
  getId: (row: T) => string,
): void {
  const left = new Map(leftRows.map((row) => [getId(row), row]));
  const right = new Map(rightRows.map((row) => [getId(row), row]));
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  for (const id of ids) {
    const before = left.get(id);
    const after = right.get(id);
    if (!before) {
      detail(details, categories, category, "added", id, "row", null, after);
      continue;
    }
    if (!after) {
      detail(details, categories, category, "removed", id, "row", before, null);
      continue;
    }
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    for (const key of [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort()) {
      if (serialize(beforeRecord[key]) !== serialize(afterRecord[key])) {
        detail(details, categories, category, "changed", id, key, beforeRecord[key], afterRecord[key]);
      }
    }
  }
}

export function diffTournamentSnapshots(leftValue: unknown, rightValue: unknown): SnapshotDiffResult {
  const left = validateTournamentSnapshot(leftValue).snapshot;
  const right = validateTournamentSnapshot(rightValue).snapshot;
  const categories = new Set<SnapshotDiffCategory>();
  const details: SnapshotDiffDetail[] = [];

  compareById(details, categories, "teams", left.teams, right.teams, (team) => String(team.id));
  compareById(
    details,
    categories,
    "groups",
    left.teams.map((team) => ({ id: team.id, group: team.group })),
    right.teams.map((team) => ({ id: team.id, group: team.group })),
    (team) => String(team.id),
  );
  compareById(
    details,
    categories,
    "fixtures",
    left.fixtures.map((fixture) => ({ id: fixture.id, fifaMatchNumber: fixture.fifaMatchNumber, group: fixture.group, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, kickoffUtc: fixture.kickoffUtc, venueId: fixture.venueId })),
    right.fixtures.map((fixture) => ({ id: fixture.id, fifaMatchNumber: fixture.fifaMatchNumber, group: fixture.group, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, kickoffUtc: fixture.kickoffUtc, venueId: fixture.venueId })),
    (fixture) => String(fixture.id),
  );
  compareById(
    details,
    categories,
    "match_status",
    left.fixtures.map((fixture) => ({ id: fixture.id, status: fixture.status })),
    right.fixtures.map((fixture) => ({ id: fixture.id, status: fixture.status })),
    (fixture) => String(fixture.id),
  );
  compareById(
    details,
    categories,
    "scores",
    left.fixtures.map((fixture) => ({ id: fixture.id, result: fixture.result })),
    right.fixtures.map((fixture) => ({ id: fixture.id, result: fixture.result })),
    (fixture) => String(fixture.id),
  );
  compareById(details, categories, "fair_play", left.fairPlay.map((record) => ({ id: record.teamId, ...record })), right.fairPlay.map((record) => ({ id: record.teamId, ...record })), (record) => String(record.id));
  compareById(details, categories, "ranking", left.fifaRanking.map((record) => ({ id: record.teamId, ...record })), right.fifaRanking.map((record) => ({ id: record.teamId, ...record })), (record) => String(record.id));
  addIfChanged(categories, "source_metadata", left.sources, right.sources);
  if (serialize(left.sources) !== serialize(right.sources)) {
    detail(details, categories, "source_metadata", "changed", "sources", "sources", left.sources, right.sources);
  }
  addIfChanged(categories, "normalization_version", left.schemaVersion, right.schemaVersion);
  if (left.schemaVersion !== right.schemaVersion) {
    detail(details, categories, "normalization_version", "changed", "schemaVersion", "schemaVersion", left.schemaVersion, right.schemaVersion);
  }

  const leftChecksum = computeTournamentSnapshotChecksum(leftValue);
  const rightChecksum = computeTournamentSnapshotChecksum(rightValue);
  if (leftChecksum !== rightChecksum) {
    categories.add("checksum");
    if (details.length === 0) {
      detail(details, categories, "checksum", "changed", "snapshot", "checksum", leftChecksum, rightChecksum);
    }
  }

  const orderedCategories = SNAPSHOT_DIFF_CATEGORY_ORDER.filter((category) => categories.has(category));

  return {
    identical: orderedCategories.length === 0,
    categories: orderedCategories,
    details: details.sort((leftDetail, rightDetail) =>
      leftDetail.category.localeCompare(rightDetail.category) ||
      leftDetail.id.localeCompare(rightDetail.id) ||
      leftDetail.field.localeCompare(rightDetail.field),
    ),
    leftChecksum,
    rightChecksum,
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , leftPath, rightPath] = process.argv;
  if (!leftPath || !rightPath) {
    throw new Error("Usage: npm run tournament2026:diff-snapshots -- <left-snapshot.json> <right-snapshot.json>");
  }
  const left = JSON.parse(readFileSync(leftPath, "utf8"));
  const right = JSON.parse(readFileSync(rightPath, "utf8"));
  console.log(stableJson(diffTournamentSnapshots(left, right)));
}
