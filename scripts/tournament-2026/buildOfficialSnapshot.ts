import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROUP_STAGE_FIXTURE_COUNT,
  TOURNAMENT_SNAPSHOT_ID,
  TOURNAMENT_SNAPSHOT_SCHEMA_VERSION,
} from "../../src/data/world-cup-2026/snapshots/schema.ts";
import { deriveSnapshotState } from "../../src/data/world-cup-2026/snapshots/normalizeSnapshot.ts";
import { computeTournamentSnapshotChecksum } from "../../src/data/world-cup-2026/snapshots/snapshotChecksum.ts";
import { validateTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/validateSnapshot.ts";
import type {
  SnapshotFifaRankingRecord,
  SnapshotFixture,
  SnapshotTeam,
  SourceReference,
  TournamentSnapshot,
} from "../../src/data/world-cup-2026/snapshots/types.ts";
import {
  officialWorldCup2026TeamIdentities,
  resolveOfficialWorldCup2026TeamAlias,
  validateOfficialWorldCup2026TeamIdentities,
} from "../../src/data/world-cup-2026/officialTeamIdentities.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import { compareCodePoints, GROUP_IDS } from "../../src/lib/tournament-2026/constants.ts";
import { buildTournamentState } from "../../src/lib/tournament-2026/snapshot/buildTournamentState.ts";
import type { GroupId, TeamId } from "../../src/lib/tournament-2026/types.ts";
import {
  OFFICIAL_SNAPSHOT_ACCESS_DATE,
  OFFICIAL_SNAPSHOT_CHECKSUMS_FILE,
  OFFICIAL_SNAPSHOT_DIR,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  OFFICIAL_SNAPSHOT_PROVENANCE_FILE,
  OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE,
  OFFICIAL_SNAPSHOT_SOURCE_SET_ID,
  OFFICIAL_SNAPSHOT_VERSION,
  RAW_FIXTURES_FILE,
  RAW_RANKING_FILE,
  RAW_SOURCE_MANIFEST_FILE,
  RAW_TEAMS_FILE,
} from "./officialSnapshotPaths.ts";
import { stableJson } from "./stableJson.ts";

interface RawSourceManifest {
  sourceSetId: string;
  accessDate: string;
  accessCutoffUtc: string;
  normalizationVersion: string;
  artifacts: readonly { path: string; sha256: string; bytes: number }[];
  sources: readonly Record<string, unknown>[];
  unavailableSources: readonly Record<string, unknown>[];
}

interface RawTeamRecord {
  teamId: TeamId;
  fifaCode: string;
  sourceName: string;
  officialName: string;
  shortName: string;
  group: GroupId;
}

interface RawTeamsArtifact {
  sourceUrl: string;
  sourcePublishedOrUpdateDate: string | null;
  accessDate: string;
  accessCutoffUtc: string;
  normalizationVersion: string;
  teams: readonly RawTeamRecord[];
}

interface RawFixtureRecord {
  sourceMatchId: string;
  fifaMatchNumber: number;
  group: GroupId;
  homeSourceName: string;
  awaySourceName: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  kickoffUtc: string;
  venueId: string | null;
  matchStatusCode: number;
  resultTypeCode: number;
  homeGoals: number | null;
  awayGoals: number | null;
}

interface RawFixturesArtifact {
  sourceUrl: string;
  sourcePublishedOrUpdateDate: string | null;
  accessDate: string;
  accessCutoffUtc: string;
  normalizationVersion: string;
  fixtures: readonly RawFixtureRecord[];
}

interface RawRankingRecord {
  teamId: TeamId;
  rank: number;
  rankingDate: string;
}

interface RawRankingArtifact {
  sourceUrl: string;
  sourcePublishedOrUpdateDate: string;
  sourceVersion: string;
  accessDate: string;
  accessCutoffUtc: string;
  normalizationVersion: string;
  rankings: readonly RawRankingRecord[];
}

export interface OfficialSnapshotBuildResult {
  snapshot: TournamentSnapshot;
  snapshotChecksum: string;
  rawArtifactChecksums: Record<string, string>;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertManifestChecksum(manifest: RawSourceManifest, filePath: string): string {
  const expected = manifest.artifacts.find((artifact) => artifact.path === filePath);
  if (!expected) {
    throw new Error(`Raw source manifest does not list ${filePath}.`);
  }
  const actual = sha256File(filePath);
  if (actual !== expected.sha256) {
    throw new Error(`Raw source checksum mismatch for ${filePath}.`);
  }
  return actual;
}

function assertUtcTimestamp(value: string, context: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${context} must be a precise UTC timestamp.`);
  }
}

function assertAccessCutoffAfterCompletedFixtures(accessCutoffUtc: string, fixtures: readonly RawFixtureRecord[]): void {
  assertUtcTimestamp(accessCutoffUtc, "source access cutoff");
  const cutoffMs = Date.parse(accessCutoffUtc);
  const latestKickoffMs = Math.max(...fixtures.map((fixture) => Date.parse(fixture.kickoffUtc)));
  if (!Number.isFinite(latestKickoffMs)) {
    throw new Error("Official source fixtures contain an invalid kickoff timestamp.");
  }
  if (cutoffMs < latestKickoffMs) {
    throw new Error("Official source access cutoff precedes the latest completed fixture kickoff.");
  }
}

function sourceReference(input: {
  title: string;
  url: string;
  publishedDate: string | null;
  version: string | null;
  checksum: string;
}): SourceReference {
  return {
    authority: "FIFA",
    title: input.title,
    url: input.url,
    publishedDate: input.publishedDate,
    accessedDate: OFFICIAL_SNAPSHOT_ACCESS_DATE,
    version: input.version,
    checksum: input.checksum,
  };
}

function validateIdentityMapping(rawTeams: readonly RawTeamRecord[]): void {
  validateOfficialWorldCup2026TeamIdentities();

  const ids = new Set<string>();
  const fifaCodes = new Set<string>();
  const groupCounts = new Map<GroupId, number>();

  for (const identity of officialWorldCup2026TeamIdentities) {
    if (ids.has(identity.id)) {
      throw new Error(`Duplicate official team ID "${identity.id}".`);
    }
    ids.add(identity.id);

    if (fifaCodes.has(identity.fifaCode)) {
      throw new Error(`Duplicate official FIFA code "${identity.fifaCode}".`);
    }
    fifaCodes.add(identity.fifaCode);
    groupCounts.set(identity.group, (groupCounts.get(identity.group) ?? 0) + 1);
  }

  for (const group of GROUP_IDS) {
    if ((groupCounts.get(group) ?? 0) !== 4) {
      throw new Error(`Official identity map Group ${group} must contain exactly four teams.`);
    }
  }

  for (const rawTeam of rawTeams) {
    const identity = resolveOfficialWorldCup2026TeamAlias(rawTeam.sourceName);
    if (identity.id !== rawTeam.teamId || identity.fifaCode !== rawTeam.fifaCode || identity.group !== rawTeam.group) {
      throw new Error(`Official identity map disagrees with source team "${rawTeam.sourceName}".`);
    }
  }
}

function buildTeams(rawTeams: readonly RawTeamRecord[]): SnapshotTeam[] {
  validateIdentityMapping(rawTeams);
  return officialWorldCup2026TeamIdentities
    .map((identity): SnapshotTeam => ({
      id: identity.id,
      name: identity.officialName,
      shortName: identity.shortName,
      fifaCode: identity.fifaCode,
      group: identity.group,
    }))
    .sort((left, right) => GROUP_IDS.indexOf(left.group) - GROUP_IDS.indexOf(right.group) || compareCodePoints(left.id, right.id));
}

function buildFixtures(rawFixtures: readonly RawFixtureRecord[]): SnapshotFixture[] {
  if (rawFixtures.length !== GROUP_STAGE_FIXTURE_COUNT) {
    throw new Error(`Official source must contain exactly ${GROUP_STAGE_FIXTURE_COUNT} group fixtures.`);
  }

  const seenPairs = new Set<string>();
  return rawFixtures
    .map((fixture): SnapshotFixture => {
      const home = resolveOfficialWorldCup2026TeamAlias(fixture.homeSourceName);
      const away = resolveOfficialWorldCup2026TeamAlias(fixture.awaySourceName);
      if (home.id !== fixture.homeTeamId || away.id !== fixture.awayTeamId) {
        throw new Error(`Fixture ${fixture.sourceMatchId} team alias mapping disagrees with source IDs.`);
      }
      if (home.group !== fixture.group || away.group !== fixture.group) {
        throw new Error(`Fixture ${fixture.sourceMatchId} contains a team outside Group ${fixture.group}.`);
      }
      const pairKey = `${fixture.group}:${[home.id, away.id].sort(compareCodePoints).join(":")}`;
      if (seenPairs.has(pairKey)) {
        throw new Error(`Duplicate official group fixture ${pairKey}.`);
      }
      seenPairs.add(pairKey);
      if (fixture.matchStatusCode !== 0 || fixture.resultTypeCode !== 1) {
        throw new Error(`Fixture ${fixture.sourceMatchId} is not an official completed result in the source extract.`);
      }
      if (!Number.isInteger(fixture.homeGoals) || !Number.isInteger(fixture.awayGoals)) {
        throw new Error(`Completed fixture ${fixture.sourceMatchId} is missing a score.`);
      }
      const homeGoals = fixture.homeGoals;
      const awayGoals = fixture.awayGoals;
      if (homeGoals === null || awayGoals === null) {
        throw new Error(`Completed fixture ${fixture.sourceMatchId} is missing a score.`);
      }

      return {
        id: `fifa-2026-group-${String(fixture.fifaMatchNumber).padStart(2, "0")}`,
        fifaMatchNumber: fixture.fifaMatchNumber,
        group: fixture.group,
        homeTeamId: home.id,
        awayTeamId: away.id,
        kickoffUtc: fixture.kickoffUtc,
        venueId: fixture.venueId,
        status: "completed",
        result: {
          homeGoals,
          awayGoals,
        },
      };
    })
    .sort((left, right) => left.fifaMatchNumber - right.fifaMatchNumber);
}

function buildRanking(rawRankings: readonly RawRankingRecord[], teams: readonly SnapshotTeam[]): SnapshotFifaRankingRecord[] {
  const teamIds = new Set(teams.map((team) => team.id));
  const seen = new Set<string>();
  const records = rawRankings.map((record): SnapshotFifaRankingRecord => {
    if (!teamIds.has(record.teamId)) {
      throw new Error(`FIFA ranking source references unknown team "${record.teamId}".`);
    }
    if (seen.has(record.teamId)) {
      throw new Error(`Duplicate FIFA ranking source record for "${record.teamId}".`);
    }
    seen.add(record.teamId);
    return {
      teamId: record.teamId,
      rank: record.rank,
      rankingDate: record.rankingDate,
    };
  });
  if (records.length !== teams.length) {
    throw new Error("FIFA ranking source must cover all 48 official snapshot teams.");
  }
  return records.sort((left, right) => compareCodePoints(left.teamId, right.teamId));
}

export function buildOfficialSnapshot(): OfficialSnapshotBuildResult {
  const manifest = readJson<RawSourceManifest>(RAW_SOURCE_MANIFEST_FILE);
  if (manifest.sourceSetId !== OFFICIAL_SNAPSHOT_SOURCE_SET_ID) {
    throw new Error(`Unexpected official source set "${manifest.sourceSetId}".`);
  }

  const rawChecksums = {
    [RAW_TEAMS_FILE]: assertManifestChecksum(manifest, RAW_TEAMS_FILE),
    [RAW_FIXTURES_FILE]: assertManifestChecksum(manifest, RAW_FIXTURES_FILE),
    [RAW_RANKING_FILE]: assertManifestChecksum(manifest, RAW_RANKING_FILE),
  };

  const rawTeams = readJson<RawTeamsArtifact>(RAW_TEAMS_FILE);
  const rawFixtures = readJson<RawFixturesArtifact>(RAW_FIXTURES_FILE);
  const rawRanking = readJson<RawRankingArtifact>(RAW_RANKING_FILE);
  if (manifest.accessCutoffUtc !== rawTeams.accessCutoffUtc || manifest.accessCutoffUtc !== rawFixtures.accessCutoffUtc || manifest.accessCutoffUtc !== rawRanking.accessCutoffUtc) {
    throw new Error("Official source access cutoff metadata must match across raw artifacts.");
  }
  assertAccessCutoffAfterCompletedFixtures(manifest.accessCutoffUtc, rawFixtures.fixtures);

  const teams = buildTeams(rawTeams.teams);
  const fixtures = buildFixtures(rawFixtures.fixtures);
  const fifaRanking = buildRanking(rawRanking.rankings, teams);
  const state = deriveSnapshotState(fixtures);

  const snapshot: TournamentSnapshot = {
    schemaVersion: TOURNAMENT_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: TOURNAMENT_SNAPSHOT_ID,
    snapshotVersion: OFFICIAL_SNAPSHOT_VERSION,
    tournament: TOURNAMENT_SNAPSHOT_ID,
    state,
    teams,
    fixtures,
    fairPlay: [],
    fifaRanking,
    sources: {
      teams: sourceReference({
        title: "FIFA World Cup 2026 match calendar API, first-stage teams and groups",
        url: rawTeams.sourceUrl,
        publishedDate: rawTeams.sourcePublishedOrUpdateDate,
        version: rawTeams.normalizationVersion,
        checksum: rawChecksums[RAW_TEAMS_FILE],
      }),
      groups: sourceReference({
        title: "FIFA World Cup 2026 match calendar API, first-stage groups",
        url: rawTeams.sourceUrl,
        publishedDate: rawTeams.sourcePublishedOrUpdateDate,
        version: rawTeams.normalizationVersion,
        checksum: rawChecksums[RAW_TEAMS_FILE],
      }),
      fixtures: sourceReference({
        title: "FIFA World Cup 2026 match calendar API, first-stage fixtures",
        url: rawFixtures.sourceUrl,
        publishedDate: rawFixtures.sourcePublishedOrUpdateDate,
        version: rawFixtures.normalizationVersion,
        checksum: rawChecksums[RAW_FIXTURES_FILE],
      }),
      results: sourceReference({
        title: "FIFA World Cup 2026 match calendar API, first-stage results",
        url: rawFixtures.sourceUrl,
        publishedDate: rawFixtures.sourcePublishedOrUpdateDate,
        version: rawFixtures.normalizationVersion,
        checksum: rawChecksums[RAW_FIXTURES_FILE],
      }),
      fairPlay: null,
      fifaRanking: sourceReference({
        title: "FIFA men's ranking approved API for participating teams",
        url: rawRanking.sourceUrl,
        publishedDate: rawRanking.sourcePublishedOrUpdateDate,
        version: rawRanking.sourceVersion,
        checksum: rawChecksums[RAW_RANKING_FILE],
      }),
    },
  };

  validateTournamentSnapshot(snapshot);
  return {
    snapshot,
    snapshotChecksum: computeTournamentSnapshotChecksum(snapshot),
    rawArtifactChecksums: rawChecksums,
  };
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, stableJson(value), "utf8");
}

export function writeOfficialSnapshotArtifacts(result: OfficialSnapshotBuildResult): void {
  const checksums = {
    generatedFileWarning: "Do not edit manually.",
    snapshotChecksum: result.snapshotChecksum,
    rawArtifactChecksums: result.rawArtifactChecksums,
  };
  const manifest = readJson<RawSourceManifest>(RAW_SOURCE_MANIFEST_FILE);
  const provenance = {
    generatedFileWarning: "Do not edit manually.",
    snapshotId: result.snapshot.snapshotId,
    snapshotVersion: result.snapshot.snapshotVersion,
    declaredState: result.snapshot.state,
    derivedState: validateTournamentSnapshot(result.snapshot).snapshot.derivedState,
    accessDate: OFFICIAL_SNAPSHOT_ACCESS_DATE,
    accessCutoffUtc: manifest.accessCutoffUtc,
    snapshotChecksum: result.snapshotChecksum,
    sourceSetId: manifest.sourceSetId,
    sourceManifest: manifest,
    fairPlayPolicy:
      "Official per-team fair-play deduction totals were not available in the inspected stable FIFA source extracts. They must be added as a new source snapshot before fair play is used as an official tie-breaker.",
  };
  const tournamentState = buildTournamentState(
    {
      snapshot: validateTournamentSnapshot(result.snapshot).snapshot,
      metadata: {
        ...validateTournamentSnapshot(result.snapshot).metadata,
        snapshotChecksum: result.snapshotChecksum,
      },
    },
    { ratingsByTeamId: worldFootballEloDevelopmentByTeamId, rankingMode: "official" },
  );
  const orchestrationStatus =
    tournamentState.status === "official_tie_unresolved"
      ? {
          generatedFileWarning: "Do not edit manually.",
          tournamentSnapshotId: result.snapshot.snapshotId,
          tournamentSnapshotVersion: result.snapshot.snapshotVersion,
          tournamentSnapshotChecksum: result.snapshotChecksum,
          status: "official_tie_unresolved",
          criterion: "fair_play",
          teamIds: ["ecu", "gha"],
          missingDataset: "official_fair_play_records",
          reason: tournamentState.reason,
          generatedAtPolicy: "Deterministic artifact derived from the versioned official snapshot; no wall-clock timestamp is used.",
          officialRoundOf32Generated: false,
        }
      : {
          generatedFileWarning: "Do not edit manually.",
          tournamentSnapshotId: result.snapshot.snapshotId,
          tournamentSnapshotVersion: result.snapshot.snapshotVersion,
          tournamentSnapshotChecksum: result.snapshotChecksum,
          status: tournamentState.status,
          officialRoundOf32Generated: tournamentState.status === "knockout_ready",
          generatedAtPolicy: "Deterministic artifact derived from the versioned official snapshot; no wall-clock timestamp is used.",
        };

  writeJson(OFFICIAL_SNAPSHOT_FILE, result.snapshot);
  writeJson(OFFICIAL_SNAPSHOT_CHECKSUMS_FILE, checksums);
  writeJson(OFFICIAL_SNAPSHOT_PROVENANCE_FILE, provenance);
  writeJson(OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE, manifest);
  writeJson(OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE, orchestrationStatus);
  writeFileSync(
    `${OFFICIAL_SNAPSHOT_DIR}/README.md`,
    `# Official World Cup 2026 Snapshot\n\nGenerated by \`npm run tournament2026:build-official-snapshot\` from checked-in normalized FIFA source extracts.\n\n- Snapshot version: \`${result.snapshot.snapshotVersion}\`\n- Declared state: \`${result.snapshot.state}\`\n- Access cutoff: \`${manifest.accessCutoffUtc}\`\n- Semantic checksum: \`${result.snapshotChecksum}\`\n- Fair-play totals: unavailable in the inspected stable FIFA source extract\n- Official qualification: \`${orchestrationStatus.status}\`\n\nNo official Round of 32 artifact is generated while fair-play inputs are missing.\n\nDo not edit generated artifacts manually.\n`,
    "utf8",
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildOfficialSnapshot();
  writeOfficialSnapshotArtifacts(result);
  console.log(
    `Built ${result.snapshot.snapshotVersion}: ${result.snapshot.teams.length} teams, ${result.snapshot.fixtures.length} fixtures, checksum ${result.snapshotChecksum}.`,
  );
}
