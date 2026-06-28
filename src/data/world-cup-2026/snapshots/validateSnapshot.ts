import {
  GROUP_COUNT,
  GROUP_IDS,
  GROUP_STAGE_MATCHES_PER_GROUP,
  GROUP_STAGE_MATCHES_PER_TEAM,
  TEAMS_PER_GROUP,
  TOURNAMENT_2026_TEAM_COUNT,
  compareCodePoints,
} from "@/src/lib/tournament-2026/constants";
import { FAIR_PLAY_CARD_DEDUCTION_POINTS } from "@/src/lib/tournament-2026/standings";
import {
  GROUP_STAGE_FIXTURE_COUNT,
  GROUP_STAGE_MATCH_NUMBER_END,
  GROUP_STAGE_MATCH_NUMBER_START,
  TOURNAMENT_SNAPSHOT_ID,
  TOURNAMENT_SNAPSHOT_SCHEMA_VERSION,
  assertGroupId,
  isSnapshotState,
  parseTournamentSnapshot,
} from "./schema";
import { normalizeTournamentSnapshot } from "./normalizeSnapshot";
import type {
  SnapshotFairPlayRecord,
  SnapshotFifaRankingRecord,
  SnapshotFixture,
  SnapshotTeam,
  TournamentSnapshot,
  ValidatedTournamentSnapshot,
} from "./types";

function assertNonEmptyString(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string.`);
  }
}

function assertNonNegativeInteger(value: unknown, context: string): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${context} must be a non-negative integer.`);
  }
}

function assertIsoDate(value: string, context: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`${context} must be a valid ISO date.`);
  }
}

function assertUtcInstant(value: string, context: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${context} must be a valid UTC timestamp.`);
  }
}

function assertChecksum(value: string | null, context: string): void {
  if (value !== null && !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${context}.checksum must be a lowercase SHA-256 hex string or null.`);
  }
}

function assertNoLocalPath(value: string, context: string): void {
  if (value.includes("/Users/") || value.includes("\\") || value.startsWith("file:")) {
    throw new Error(`${context} must not contain a local machine path.`);
  }
}

function validateIdentity(snapshot: TournamentSnapshot): void {
  if (snapshot.schemaVersion !== TOURNAMENT_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported snapshot schemaVersion "${snapshot.schemaVersion}".`);
  }
  assertNonEmptyString(snapshot.snapshotId, "snapshotId");
  assertNonEmptyString(snapshot.snapshotVersion, "snapshotVersion");
  if (snapshot.tournament !== TOURNAMENT_SNAPSHOT_ID) {
    throw new Error(`Snapshot tournament must be "${TOURNAMENT_SNAPSHOT_ID}".`);
  }
  if (typeof snapshot.state !== "string" || !isSnapshotState(snapshot.state)) {
    throw new Error(`Snapshot state "${String(snapshot.state)}" is not supported.`);
  }
}

function validateSources(snapshot: TournamentSnapshot): void {
  for (const [key, source] of Object.entries(snapshot.sources)) {
    if (source === null) {
      continue;
    }

    assertIsoDate(source.accessedDate, `sources.${key}.accessedDate`);
    if (source.publishedDate !== null) {
      assertIsoDate(source.publishedDate, `sources.${key}.publishedDate`);
    }
    assertChecksum(source.checksum, `sources.${key}`);
    for (const field of ["authority", "title", "url"] as const) {
      assertNoLocalPath(source[field], `sources.${key}.${field}`);
    }
  }
}

function validateTeams(teams: readonly SnapshotTeam[]): Map<string, SnapshotTeam> {
  if (teams.length !== TOURNAMENT_2026_TEAM_COUNT) {
    throw new Error(`Snapshot must contain exactly ${TOURNAMENT_2026_TEAM_COUNT} teams.`);
  }

  const byId = new Map<string, SnapshotTeam>();
  const fifaCodes = new Set<string>();
  const groupCounts = new Map<string, number>();

  for (const team of teams) {
    assertNonEmptyString(team.id, `teams.${team.id || "<unknown>"}.id`);
    assertNonEmptyString(team.name, `teams.${team.id}.name`);
    assertNonEmptyString(team.shortName, `teams.${team.id}.shortName`);
    assertNonEmptyString(team.fifaCode, `teams.${team.id}.fifaCode`);
    assertGroupId(team.group, `teams.${team.id}.group`);

    if (byId.has(team.id)) {
      throw new Error(`Duplicate snapshot team ID "${team.id}".`);
    }
    byId.set(team.id, team);

    if (fifaCodes.has(team.fifaCode)) {
      throw new Error(`Duplicate snapshot FIFA code "${team.fifaCode}".`);
    }
    fifaCodes.add(team.fifaCode);
    groupCounts.set(team.group, (groupCounts.get(team.group) ?? 0) + 1);
  }

  if (groupCounts.size !== GROUP_COUNT) {
    throw new Error("Snapshot teams must cover groups A through L.");
  }

  for (const groupId of GROUP_IDS) {
    if ((groupCounts.get(groupId) ?? 0) !== TEAMS_PER_GROUP) {
      throw new Error(`Snapshot Group ${groupId} must contain exactly four teams.`);
    }
  }

  return byId;
}

function validateFixtures(fixtures: readonly SnapshotFixture[], teamsById: ReadonlyMap<string, SnapshotTeam>): void {
  if (fixtures.length !== GROUP_STAGE_FIXTURE_COUNT) {
    throw new Error(`Snapshot must contain exactly ${GROUP_STAGE_FIXTURE_COUNT} fixtures.`);
  }

  const ids = new Set<string>();
  const matchNumbers = new Set<number>();
  const fixtureKeys = new Set<string>();
  const groupCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();

  for (const fixture of fixtures) {
    assertNonEmptyString(fixture.id, "fixture.id");
    if (ids.has(fixture.id)) {
      throw new Error(`Duplicate fixture ID "${fixture.id}".`);
    }
    ids.add(fixture.id);

    if (
      !Number.isInteger(fixture.fifaMatchNumber) ||
      fixture.fifaMatchNumber < GROUP_STAGE_MATCH_NUMBER_START ||
      fixture.fifaMatchNumber > GROUP_STAGE_MATCH_NUMBER_END
    ) {
      throw new Error(`Fixture "${fixture.id}" has invalid FIFA match number.`);
    }
    if (matchNumbers.has(fixture.fifaMatchNumber)) {
      throw new Error(`Duplicate FIFA match number ${fixture.fifaMatchNumber}.`);
    }
    matchNumbers.add(fixture.fifaMatchNumber);

    assertGroupId(fixture.group, `fixtures.${fixture.id}.group`);
    assertNonEmptyString(fixture.homeTeamId, `fixtures.${fixture.id}.homeTeamId`);
    assertNonEmptyString(fixture.awayTeamId, `fixtures.${fixture.id}.awayTeamId`);
    assertUtcInstant(fixture.kickoffUtc, `fixtures.${fixture.id}.kickoffUtc`);

    if (fixture.venueId !== null && typeof fixture.venueId !== "string") {
      throw new Error(`fixtures.${fixture.id}.venueId must be a string or null.`);
    }

    if (fixture.status !== "scheduled" && fixture.status !== "completed") {
      throw new Error(`Fixture "${fixture.id}" has unsupported status "${String(fixture.status)}".`);
    }

    if (fixture.homeTeamId === fixture.awayTeamId) {
      throw new Error(`Fixture "${fixture.id}" contains the same team twice.`);
    }

    const home = teamsById.get(fixture.homeTeamId);
    const away = teamsById.get(fixture.awayTeamId);
    if (!home || !away) {
      throw new Error(`Fixture "${fixture.id}" references an unknown team.`);
    }
    if (home.group !== fixture.group || away.group !== fixture.group) {
      throw new Error(`Fixture "${fixture.id}" contains a team outside Group ${fixture.group}.`);
    }

    const sortedTeams = [fixture.homeTeamId, fixture.awayTeamId].sort(compareCodePoints);
    const fixtureKey = `${fixture.group}:${sortedTeams[0]}:${sortedTeams[1]}`;
    if (fixtureKeys.has(fixtureKey)) {
      throw new Error(`Duplicate Group ${fixture.group} fixture: ${sortedTeams.join(" vs ")}.`);
    }
    fixtureKeys.add(fixtureKey);

    if (fixture.status === "scheduled" && fixture.result !== null) {
      throw new Error(`Scheduled fixture "${fixture.id}" must not include a result.`);
    }
    if (fixture.status === "completed" && fixture.result === null) {
      throw new Error(`Completed fixture "${fixture.id}" must include a result.`);
    }
    if (fixture.result) {
      assertNonNegativeInteger(fixture.result.homeGoals, `fixtures.${fixture.id}.result.homeGoals`);
      assertNonNegativeInteger(fixture.result.awayGoals, `fixtures.${fixture.id}.result.awayGoals`);
    }

    groupCounts.set(fixture.group, (groupCounts.get(fixture.group) ?? 0) + 1);
    teamCounts.set(fixture.homeTeamId, (teamCounts.get(fixture.homeTeamId) ?? 0) + 1);
    teamCounts.set(fixture.awayTeamId, (teamCounts.get(fixture.awayTeamId) ?? 0) + 1);
  }

  for (const groupId of GROUP_IDS) {
    if ((groupCounts.get(groupId) ?? 0) !== GROUP_STAGE_MATCHES_PER_GROUP) {
      throw new Error(`Snapshot Group ${groupId} must contain exactly six fixtures.`);
    }
  }

  for (const team of teamsById.values()) {
    if ((teamCounts.get(team.id) ?? 0) !== GROUP_STAGE_MATCHES_PER_TEAM) {
      throw new Error(`Snapshot team "${team.id}" must have exactly three fixtures.`);
    }
  }
}

function validateFairPlay(
  records: readonly SnapshotFairPlayRecord[],
  teamsById: ReadonlyMap<string, SnapshotTeam>,
): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (!teamsById.has(record.teamId)) {
      throw new Error(`Fair-play record references unknown team "${record.teamId}".`);
    }
    if (seen.has(record.teamId)) {
      throw new Error(`Duplicate fair-play record for team "${record.teamId}".`);
    }
    seen.add(record.teamId);

    for (const key of [
      "yellowCards",
      "indirectRedCards",
      "directRedCards",
      "yellowAndDirectRedCards",
      "deductionPoints",
    ] as const) {
      assertNonNegativeInteger(record[key], `fairPlay.${record.teamId}.${key}`);
    }

    const expected =
      record.yellowCards * FAIR_PLAY_CARD_DEDUCTION_POINTS.yellowCard +
      record.indirectRedCards * FAIR_PLAY_CARD_DEDUCTION_POINTS.indirectRedCard +
      record.directRedCards * FAIR_PLAY_CARD_DEDUCTION_POINTS.directRedCard +
      record.yellowAndDirectRedCards * FAIR_PLAY_CARD_DEDUCTION_POINTS.yellowAndDirectRedCard;
    if (record.deductionPoints !== expected) {
      throw new Error(`Fair-play deductions for team "${record.teamId}" do not match card counts.`);
    }
  }
}

function validateFifaRanking(
  records: readonly SnapshotFifaRankingRecord[],
  teamsById: ReadonlyMap<string, SnapshotTeam>,
): void {
  const seenTeams = new Set<string>();
  const seenRanks = new Map<number, string>();
  let rankingDate: string | null = null;

  for (const record of records) {
    if (!teamsById.has(record.teamId)) {
      throw new Error(`FIFA ranking record references unknown team "${record.teamId}".`);
    }
    if (seenTeams.has(record.teamId)) {
      throw new Error(`Duplicate FIFA ranking record for team "${record.teamId}".`);
    }
    seenTeams.add(record.teamId);

    if (!Number.isInteger(record.rank) || record.rank <= 0) {
      throw new Error(`FIFA ranking for team "${record.teamId}" must be a positive integer.`);
    }
    const duplicate = seenRanks.get(record.rank);
    if (duplicate) {
      throw new Error(`Duplicate FIFA ranking ${record.rank} for teams "${duplicate}" and "${record.teamId}".`);
    }
    seenRanks.set(record.rank, record.teamId);

    assertIsoDate(record.rankingDate, `fifaRanking.${record.teamId}.rankingDate`);
    if (rankingDate === null) {
      rankingDate = record.rankingDate;
    } else if (rankingDate !== record.rankingDate) {
      throw new Error("FIFA ranking records must use one ranking date.");
    }
  }
}

function validateState(snapshot: TournamentSnapshot): void {
  const completedCount = snapshot.fixtures.filter((fixture) => fixture.status === "completed").length;
  const scheduledCount = snapshot.fixtures.length - completedCount;
  const derivedState =
    completedCount === 0
      ? "structure_only"
      : scheduledCount === 0
        ? "group_stage_complete"
        : "group_stage_in_progress";

  if (snapshot.state !== derivedState) {
    throw new Error(`Snapshot state "${snapshot.state}" does not match derived state "${derivedState}".`);
  }
}

export function validateTournamentSnapshot(value: unknown): ValidatedTournamentSnapshot {
  const snapshot = parseTournamentSnapshot(value);
  validateIdentity(snapshot);
  validateSources(snapshot);

  if (!Array.isArray(snapshot.teams)) {
    throw new Error("teams must be an array.");
  }
  if (!Array.isArray(snapshot.fixtures)) {
    throw new Error("fixtures must be an array.");
  }
  if (!Array.isArray(snapshot.fairPlay)) {
    throw new Error("fairPlay must be an array.");
  }
  if (!Array.isArray(snapshot.fifaRanking)) {
    throw new Error("fifaRanking must be an array.");
  }

  const teamsById = validateTeams(snapshot.teams);
  validateFixtures(snapshot.fixtures, teamsById);
  validateFairPlay(snapshot.fairPlay, teamsById);
  validateFifaRanking(snapshot.fifaRanking, teamsById);
  validateState(snapshot);

  const normalized = normalizeTournamentSnapshot(snapshot);

  return {
    snapshot: normalized,
    metadata: {
      schemaVersion: normalized.schemaVersion,
      snapshotId: normalized.snapshotId,
      snapshotVersion: normalized.snapshotVersion,
      tournament: normalized.tournament,
      declaredState: normalized.state,
      derivedState: normalized.derivedState,
      snapshotChecksum: null,
      sourceReferences: normalized.sources,
    },
  };
}
