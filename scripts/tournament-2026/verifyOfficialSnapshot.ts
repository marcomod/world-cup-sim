import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/loadSnapshot.ts";
import { computeTournamentSnapshotChecksum } from "../../src/data/world-cup-2026/snapshots/snapshotChecksum.ts";
import { GROUP_IDS } from "../../src/lib/tournament-2026/constants.ts";
import { buildTournamentState } from "../../src/lib/tournament-2026/snapshot/buildTournamentState.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import type { GroupId } from "../../src/lib/tournament-2026/types.ts";
import {
  OFFICIAL_EXPECTED_FIXTURES_FILE,
  OFFICIAL_EXPECTED_METADATA_FILE,
  OFFICIAL_EXPECTED_RANKING_FILE,
  OFFICIAL_EXPECTED_TEAMS_FILE,
  OFFICIAL_SNAPSHOT_CHECKSUMS_FILE,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE,
  RAW_FIXTURES_FILE,
  RAW_RANKING_FILE,
  RAW_TEAMS_FILE,
} from "./officialSnapshotPaths.ts";

interface SnapshotChecksums {
  snapshotChecksum: string;
  rawArtifactChecksums: Record<string, string>;
}

interface ExpectedTeamRecord {
  teamId: string;
  officialName: string;
  shortName: string;
  fifaCode: string;
  group: GroupId;
}

interface ExpectedFixtureRecord {
  fifaMatchNumber: number;
  group: GroupId;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
  venueId: string | null;
  status: "scheduled" | "completed";
  result: { homeGoals: number; awayGoals: number } | null;
}

interface ExpectedRankingRecord {
  teamId: string;
  rank: number;
  rankingDate: string;
}

interface ExpectedMetadata {
  accessCutoffUtc: string;
  checksums: Record<string, string>;
}

interface RawFixtureRecord {
  fifaMatchNumber: number;
  group: GroupId;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
  venueId: string | null;
  homeGoals: number;
  awayGoals: number;
}

interface RawFixturesArtifact {
  fixtures: readonly RawFixtureRecord[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export interface OfficialSnapshotVerificationSummary {
  teamCount: number;
  fixtureCount: number;
  completedFixtureCount: number;
  state: string;
  snapshotChecksum: string;
  orchestrationStatus: string;
}

function assertRawChecksums(checksums: SnapshotChecksums): void {
  for (const filePath of [RAW_TEAMS_FILE, RAW_FIXTURES_FILE, RAW_RANKING_FILE]) {
    const expected = checksums.rawArtifactChecksums[filePath];
    if (!expected) {
      throw new Error(`Official snapshot checksum file is missing raw checksum for ${filePath}.`);
    }
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new Error(`Official raw source checksum mismatch for ${filePath}.`);
    }
  }
  readJson<unknown>(OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE);
}

function assertExpectedFixtureChecksums(): void {
  const metadata = readJson<ExpectedMetadata>(OFFICIAL_EXPECTED_METADATA_FILE);
  for (const [fileName, expected] of Object.entries(metadata.checksums)) {
    const filePath = `${OFFICIAL_EXPECTED_METADATA_FILE.slice(0, OFFICIAL_EXPECTED_METADATA_FILE.lastIndexOf("/") + 1)}${fileName}`;
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new Error(`Expected official verification fixture checksum mismatch for ${fileName}.`);
    }
  }
}

function assertUtcTimestamp(value: string, context: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${context} must be a precise UTC timestamp.`);
  }
}

function verifyAccessCutoff(): void {
  const metadata = readJson<ExpectedMetadata>(OFFICIAL_EXPECTED_METADATA_FILE);
  const manifest = readJson<{ accessCutoffUtc?: string }>(OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE);
  if (manifest.accessCutoffUtc !== metadata.accessCutoffUtc) {
    throw new Error("Official snapshot access cutoff does not match expected metadata.");
  }
  assertUtcTimestamp(metadata.accessCutoffUtc, "Expected official access cutoff");
  const snapshot = readJson<{ fixtures: readonly { kickoffUtc: string; status: string }[] }>(OFFICIAL_SNAPSHOT_FILE);
  const cutoffMs = Date.parse(metadata.accessCutoffUtc);
  for (const fixture of snapshot.fixtures) {
    if (fixture.status === "completed" && Date.parse(fixture.kickoffUtc) > cutoffMs) {
      throw new Error(`Official snapshot access cutoff precedes completed fixture ${fixture.kickoffUtc}.`);
    }
  }
}

function verifyFixturePairingsAgainstRaw(): void {
  const snapshot = readJson<{ fixtures: readonly ExpectedFixtureRecord[] }>(OFFICIAL_SNAPSHOT_FILE);
  const raw = readJson<RawFixturesArtifact>(RAW_FIXTURES_FILE);
  const expected = new Map(
    raw.fixtures.map((fixture) => [
      fixture.fifaMatchNumber,
      `${fixture.group}:${fixture.homeTeamId}:${fixture.awayTeamId}:${fixture.kickoffUtc}:${fixture.venueId}:${fixture.homeGoals}:${fixture.awayGoals}`,
    ]),
  );
  for (const fixture of snapshot.fixtures) {
    const expectedValue = expected.get(fixture.fifaMatchNumber);
    const actualValue = `${fixture.group}:${fixture.homeTeamId}:${fixture.awayTeamId}:${fixture.kickoffUtc}:${fixture.venueId}:${fixture.result?.homeGoals}:${fixture.result?.awayGoals}`;
    if (actualValue !== expectedValue) {
      throw new Error(`Official snapshot fixture ${fixture.fifaMatchNumber} does not match the normalized source extract.`);
    }
  }
}

function verifyAgainstExpectedData(): void {
  const snapshot = readJson<{
    teams: readonly ExpectedTeamRecord[];
    fixtures: readonly ExpectedFixtureRecord[];
    fifaRanking: readonly ExpectedRankingRecord[];
    fairPlay: readonly unknown[];
  }>(OFFICIAL_SNAPSHOT_FILE);
  const expectedTeams = readJson<ExpectedTeamRecord[]>(OFFICIAL_EXPECTED_TEAMS_FILE);
  const expectedFixtures = readJson<ExpectedFixtureRecord[]>(OFFICIAL_EXPECTED_FIXTURES_FILE);
  const expectedRanking = readJson<ExpectedRankingRecord[]>(OFFICIAL_EXPECTED_RANKING_FILE);

  if (JSON.stringify(snapshot.teams) !== JSON.stringify(expectedTeams.map((team) => ({
    id: team.teamId,
    name: team.officialName,
    shortName: team.shortName,
    fifaCode: team.fifaCode,
    group: team.group,
  })))) {
    throw new Error("Official snapshot team table does not match the independent expected table.");
  }
  if (JSON.stringify(snapshot.fixtures) !== JSON.stringify(expectedFixtures.map((fixture) => ({
    id: `fifa-2026-group-${String(fixture.fifaMatchNumber).padStart(2, "0")}`,
    ...fixture,
  })))) {
    throw new Error("Official snapshot fixture table does not match the independent expected table.");
  }
  if (JSON.stringify(snapshot.fifaRanking) !== JSON.stringify(expectedRanking)) {
    throw new Error("Official snapshot FIFA ranking table does not match the independent expected table.");
  }
  if (snapshot.fairPlay.length !== 0) {
    throw new Error("Official snapshot must not fabricate fair-play records.");
  }
}

function verifyNoSyntheticSources(): void {
  const raw = readFileSync(OFFICIAL_SNAPSHOT_FILE, "utf8");
  if (/synthetic|fixture-only|placeholder/i.test(raw)) {
    throw new Error("Official snapshot must not contain synthetic or placeholder source markers.");
  }
}

export function verifyOfficialSnapshot(): OfficialSnapshotVerificationSummary {
  const loaded = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
  const rawSnapshot = readJson<unknown>(OFFICIAL_SNAPSHOT_FILE);
  const checksums = readJson<SnapshotChecksums>(OFFICIAL_SNAPSHOT_CHECKSUMS_FILE);
  const actualChecksum = computeTournamentSnapshotChecksum(rawSnapshot);

  if (actualChecksum !== checksums.snapshotChecksum || actualChecksum !== loaded.metadata.snapshotChecksum) {
    throw new Error("Official snapshot semantic checksum mismatch.");
  }

  assertRawChecksums(checksums);
  assertExpectedFixtureChecksums();
  verifyAccessCutoff();
  verifyFixturePairingsAgainstRaw();
  verifyAgainstExpectedData();
  verifyNoSyntheticSources();

  for (const groupId of GROUP_IDS) {
    const fixtures = loaded.snapshot.fixtures.filter((fixture) => fixture.group === groupId);
    if (fixtures.length !== 6) {
      throw new Error(`Group ${groupId} must have exactly six official fixtures.`);
    }
  }
  const orchestrationStatus = readJson<{ status: string; criterion?: string; teamIds?: string[]; officialRoundOf32Generated?: boolean }>(
    OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  );
  const state = buildTournamentState(loaded, {
    ratingsByTeamId: worldFootballEloDevelopmentByTeamId,
    rankingMode: "official",
  });
  if (
    state.status !== "official_tie_unresolved" ||
    orchestrationStatus.status !== "official_tie_unresolved" ||
    orchestrationStatus.criterion !== "fair_play" ||
    JSON.stringify(orchestrationStatus.teamIds) !== JSON.stringify(["ecu", "gha"]) ||
    orchestrationStatus.officialRoundOf32Generated !== false
  ) {
    throw new Error("Official snapshot readiness must be recorded as unresolved fair-play qualification for ecu and gha.");
  }

  return {
    teamCount: loaded.snapshot.teams.length,
    fixtureCount: loaded.snapshot.fixtures.length,
    completedFixtureCount: loaded.snapshot.fixtures.filter((fixture) => fixture.status === "completed").length,
    state: loaded.snapshot.state,
    snapshotChecksum: actualChecksum,
    orchestrationStatus: orchestrationStatus.status,
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const summary = verifyOfficialSnapshot();
  console.log(
    `Verified official snapshot: ${summary.teamCount} teams, ${summary.fixtureCount} fixtures, ${summary.completedFixtureCount} completed, state ${summary.state}, orchestration ${summary.orchestrationStatus}, checksum ${summary.snapshotChecksum}.`,
  );
}
