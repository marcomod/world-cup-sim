import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { worldCup2026FormatProvenance } from "../../src/data/world-cup-2026/provenance.ts";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/loadSnapshot.ts";
import { compareCodePoints, GROUP_IDS } from "../../src/lib/tournament-2026/constants.ts";
import {
  computeQualificationChecksum,
  computeRoundOf32Checksum,
} from "./officialArtifactChecksums.ts";
import {
  OFFICIAL_EXPECTED_FIXTURE_DIR,
  OFFICIAL_EXPECTED_QUALIFICATION_FILE,
  OFFICIAL_EXPECTED_METADATA_FILE,
  OFFICIAL_EXPECTED_ROUND_OF_32_FILE,
  OFFICIAL_EXPECTED_THIRD_PLACE_RANKING_FILE,
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SNAPSHOT_FILE,
} from "./officialSnapshotPaths.ts";
import {
  OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY,
  OFFICIAL_SNAPSHOT_CHECKSUM,
} from "./buildOfficialQualification.ts";

type QualificationArtifact = Record<string, unknown> & {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  status: string;
  groupWinners: Row[];
  groupRunnersUp: Row[];
  thirdPlacedTeams: ThirdPlaceRow[];
  thirdPlaceEquivalenceGroups: { sharedRank: number; teamIds: string[]; semantics: string }[];
  qualifiedThirdPlacedTeams: ThirdPlaceRow[];
  eliminatedThirdPlacedTeams: ThirdPlaceRow[];
  qualifyingThirdPlaceGroupKey: string;
  qualifiers: Row[];
  fairPlay: { totalsIncluded: boolean; fabricatedTotals: boolean; records: unknown[] };
  tieSemantics: Record<string, unknown>;
  annexCChecksum: string;
  qualificationChecksum: string;
};

type Row = {
  group: string;
  teamId: string;
  qualificationSource?: string;
  groupPosition?: number;
};

type ThirdPlaceRow = Row & {
  thirdPlaceRank: number;
  qualified: boolean;
  points: number;
  goalDifference: number;
  goalsFor: number;
  appliedTieBreakers?: string[];
};

type RoundOf32Artifact = Record<string, unknown> & {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  annexCChecksum: string;
  topologyChecksum: string;
  qualifyingThirdPlaceGroupKey: string;
  matches: RoundMatch[];
  roundOf32Checksum: string;
};

type RoundMatch = {
  matchId: string;
  participantAId: string;
  participantBId: string;
  participantA: { teamId: string; sourceSlot: string; groupPositionSource: { group: string; position: number }; annexCSource: unknown };
  participantB: { teamId: string; sourceSlot: string; groupPositionSource: { group: string; position: number }; annexCSource: unknown };
  sourceSlots: { participantA: string; participantB: string };
  nextMatchId: string;
  nextSide: string;
  tournamentSnapshotId: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  annexCChecksum: string;
  topologyChecksum: string;
  roundOf32Checksum: string;
};

type ExpectedQualification = {
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  status: string;
  qualifyingThirdPlaceGroupKey: string;
  groupWinners: Record<string, string>;
  groupRunnersUp: Record<string, string>;
  qualifiers: string[];
  qualifiedThirdPlacedTeams: string[];
  eliminatedThirdPlacedTeams: string[];
  thirdPlaceEquivalenceGroups: { sharedRank: number; teamIds: string[]; semantics: string; affectsQualification: boolean }[];
};

type ExpectedRoundMatch = {
  matchId: string;
  participantAId: string;
  participantBId: string;
  sourceSlots: { participantA: string; participantB: string };
  nextMatchId: string;
  nextSide: string;
};

type ExpectedFixtureMetadataEntry = {
  fixtureFilename: string;
  fixtureSchemaVersion: string;
  semanticChecksum: string;
  sourceAuthority: string;
  sourceTitle: string;
  sourceUrl: string;
  stableSourceId: string;
  sourceRole: string;
  fixedAccessTimestampUtc: string;
  normalizationVersion: string;
  purpose: string;
  result?: string;
  normalizedSourceChecksum?: string;
};

type ExpectedFixtureMetadata = {
  accessCutoffUtc: string;
  normalizationVersion: string;
  expectedFixtures: ExpectedFixtureMetadataEntry[];
};

const REQUIRED_EXPECTED_FIXTURE_METADATA = {
  "expected-qualification.json": {
    sourceRole: "official_qualification_membership_expected_fixture",
    purpose: "Verify finalized qualification membership, group key, and Ecuador/Ghana shared-rank semantics independently of production builders.",
  },
  "expected-third-place-ranking.json": {
    sourceRole: "official_third_place_ranking_expected_fixture",
    purpose: "Verify finalized third-place ranking rows and Ecuador/Ghana shared rank without fabricating fair-play totals.",
  },
  "expected-round-of-32.json": {
    stableSourceId: "fifa-full-calendar",
    sourceRole: "official_round_of_32_participant_cross_check",
    sourceUrl: "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=200",
    result: "16 Round-of-32 fixtures/participants available",
    normalizedSourceChecksum: "0c32fcd1d75c049bf7e909ed17a832d5de6595aed3ebe7bfa88f2cff3265a73f",
    purpose: "Cross-check finalized Round-of-32 participants against the official FIFA full-calendar knockout listing.",
  },
} as const;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ids(rows: readonly { teamId: string }[]): string[] {
  return rows.map((row) => row.teamId);
}

function assertSameArray(actual: readonly string[], expected: readonly string[], context: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${context} mismatch.\nExpected: ${expected.join(", ")}\nActual: ${actual.join(", ")}`);
  }
}

function assertUnique(values: readonly string[], context: string): void {
  assert(new Set(values).size === values.length, `${context} must be unique.`);
}

function compactThirdPlace(rows: readonly ThirdPlaceRow[]) {
  return rows.map((row) => ({
    teamId: row.teamId,
    group: row.group,
    thirdPlaceRank: row.thirdPlaceRank,
    qualified: row.qualified,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
  }));
}

function compactMatch(match: RoundMatch): ExpectedRoundMatch {
  return {
    matchId: match.matchId,
    participantAId: match.participantAId,
    participantBId: match.participantBId,
    sourceSlots: match.sourceSlots,
    nextMatchId: match.nextMatchId,
    nextSide: match.nextSide,
  };
}

function verifyQualification(artifact: QualificationArtifact, expected: ExpectedQualification): void {
  assert(artifact.status === "knockout_ready", "Qualification artifact must be knockout_ready.");
  assert(artifact.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Qualification artifact has wrong tournament snapshot ID.");
  assert(artifact.tournamentSnapshotChecksum === OFFICIAL_SNAPSHOT_CHECKSUM, "Qualification artifact has stale snapshot checksum.");
  assert(artifact.tournamentSnapshotVersion === expected.tournamentSnapshotVersion, "Qualification artifact has stale snapshot version.");
  assert(artifact.tournamentSnapshotChecksum === expected.tournamentSnapshotChecksum, "Qualification artifact does not match expected snapshot checksum.");
  assert(artifact.qualifyingThirdPlaceGroupKey === expected.qualifyingThirdPlaceGroupKey, "Qualification artifact has wrong third-place group key.");
  assert(artifact.qualifyingThirdPlaceGroupKey === OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY, "Qualification artifact must retain BDEFIJKL.");
  assert(artifact.annexCChecksum === worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256, "Qualification artifact has wrong Annex C checksum.");
  assert(artifact.qualificationChecksum === computeQualificationChecksum(artifact), "Qualification checksum does not recompute.");

  assertSameArray(GROUP_IDS.map((group) => artifact.groupWinners.find((row) => row.group === group)?.teamId ?? ""), GROUP_IDS.map((group) => expected.groupWinners[group]), "Group winners");
  assertSameArray(GROUP_IDS.map((group) => artifact.groupRunnersUp.find((row) => row.group === group)?.teamId ?? ""), GROUP_IDS.map((group) => expected.groupRunnersUp[group]), "Group runners-up");
  assertSameArray(ids(artifact.qualifiers), expected.qualifiers, "32 qualifiers");
  assert(artifact.qualifiers.length === 32, "Qualification artifact must contain exactly 32 qualifiers.");
  assertUnique(ids(artifact.qualifiers), "Qualification artifact qualifiers");
  assertSameArray(ids(artifact.qualifiedThirdPlacedTeams), expected.qualifiedThirdPlacedTeams, "Qualified third-place teams");
  assertSameArray(ids(artifact.eliminatedThirdPlacedTeams), expected.eliminatedThirdPlacedTeams, "Eliminated third-place teams");

  const ecuador = artifact.thirdPlacedTeams.find((team) => team.teamId === "ecu");
  const ghana = artifact.thirdPlacedTeams.find((team) => team.teamId === "gha");
  assert(ecuador && ghana, "Ecuador and Ghana must both be present in third-place ranking.");
  assert(ecuador.thirdPlaceRank === 3 && ghana.thirdPlaceRank === 3, "Ecuador and Ghana must share rank 3.");
  assert(ecuador.qualified && ghana.qualified, "Ecuador and Ghana must both qualify.");
  assert(!ecuador.appliedTieBreakers?.includes("deterministic_fallback"), "Ecuador must not record deterministic fallback.");
  assert(!ghana.appliedTieBreakers?.includes("deterministic_fallback"), "Ghana must not record deterministic fallback.");
  assert(artifact.thirdPlaceEquivalenceGroups.some((group) => group.sharedRank === 3 && JSON.stringify([...group.teamIds].sort(compareCodePoints)) === JSON.stringify(["ecu", "gha"]) && group.semantics === "not_officially_ordered"), "Qualification artifact must record Ecuador/Ghana rank equivalence.");
  assert(artifact.fairPlay.totalsIncluded === false, "Qualification artifact must not include fair-play totals.");
  assert(artifact.fairPlay.fabricatedTotals === false, "Qualification artifact must not fabricate fair-play totals.");
  assert(Array.isArray(artifact.fairPlay.records) && artifact.fairPlay.records.length === 0, "Qualification fair-play records must be empty.");
  assert(artifact.tieSemantics.strictEcuadorGhanaOrderingResolved === false, "Qualification artifact must not resolve strict Ecuador/Ghana order.");
  assert(artifact.tieSemantics.deterministicFallbackRecorded === false, "Qualification artifact must not record deterministic fallback.");
  assert(artifact.tieSemantics.teamIdFallbackRecorded === false, "Qualification artifact must not record team-ID fallback.");
  assert(artifact.tieSemantics.alphabeticalFallbackRecorded === false, "Qualification artifact must not record alphabetical fallback.");
}

function verifyRoundOf32(round: RoundOf32Artifact, qualification: QualificationArtifact, expected: ExpectedRoundMatch[]): void {
  assert(round.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Round-of-32 artifact has wrong tournament snapshot ID.");
  assert(round.tournamentSnapshotChecksum === qualification.tournamentSnapshotChecksum, "Round-of-32 snapshot checksum mismatch.");
  assert(round.qualificationChecksum === qualification.qualificationChecksum, "Round-of-32 qualification checksum mismatch.");
  assert(round.annexCChecksum === worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCExpectedFixtureRowsSha256, "Round-of-32 Annex C checksum mismatch.");
  assert(round.topologyChecksum === worldCup2026FormatProvenance.normalizedLocalRepresentations.knockoutTopologySha256, "Round-of-32 topology checksum mismatch.");
  assert(round.qualifyingThirdPlaceGroupKey === OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY, "Round-of-32 must retain BDEFIJKL.");
  assert(round.roundOf32Checksum === computeRoundOf32Checksum(round), "Round-of-32 checksum does not recompute.");
  assert(round.matches.length === 16, "Round-of-32 artifact must contain 16 matches.");
  assertSameArray(round.matches.map((match) => match.matchId), expected.map((match) => match.matchId), "Round-of-32 match IDs");
  assert(JSON.stringify(round.matches.map(compactMatch)) === JSON.stringify(expected), "Round-of-32 participants/source slots differ from expected fixture.");

  const participants = round.matches.flatMap((match) => [match.participantAId, match.participantBId]);
  const qualifiers = ids(qualification.qualifiers);
  assert(participants.length === 32, "Round-of-32 must contain 32 participant slots.");
  assertUnique(participants, "Round-of-32 participants");
  assert(participants.every((teamId) => qualifiers.includes(teamId)), "Round-of-32 contains eliminated or synthetic participant.");
  assert(!participants.some((teamId) => /^TBD|placeholder|synthetic$/i.test(teamId)), "Round-of-32 contains placeholders.");
  for (const match of round.matches) {
    assert(match.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, `Match ${match.matchId} tournament snapshot ID mismatch.`);
    assert(match.tournamentSnapshotChecksum === round.tournamentSnapshotChecksum, `Match ${match.matchId} snapshot checksum mismatch.`);
    assert(match.qualificationChecksum === round.qualificationChecksum, `Match ${match.matchId} qualification checksum mismatch.`);
    assert(match.annexCChecksum === round.annexCChecksum, `Match ${match.matchId} Annex C checksum mismatch.`);
    assert(match.topologyChecksum === round.topologyChecksum, `Match ${match.matchId} topology checksum mismatch.`);
    assert(match.roundOf32Checksum === round.roundOf32Checksum, `Match ${match.matchId} Round-of-32 checksum mismatch.`);
    assert(match.participantA.teamId === match.participantAId, `Match ${match.matchId} participant A ID mismatch.`);
    assert(match.participantB.teamId === match.participantBId, `Match ${match.matchId} participant B ID mismatch.`);
    assert(match.participantA.sourceSlot === match.sourceSlots.participantA, `Match ${match.matchId} participant A source slot mismatch.`);
    assert(match.participantB.sourceSlot === match.sourceSlots.participantB, `Match ${match.matchId} participant B source slot mismatch.`);
  }
  assert(round.matches.find((match) => match.matchId === "m79")?.participantAId === "mex", "m79 participant A must be Mexico.");
  assert(round.matches.find((match) => match.matchId === "m79")?.participantBId === "ecu", "m79 participant B must be Ecuador.");
  assert(round.matches.find((match) => match.matchId === "m87")?.participantAId === "col", "m87 participant A must be Colombia.");
  assert(round.matches.find((match) => match.matchId === "m87")?.participantBId === "gha", "m87 participant B must be Ghana.");
}

export function verifyExpectedFixtureMetadata(
  metadata: ExpectedFixtureMetadata = readJson<ExpectedFixtureMetadata>(OFFICIAL_EXPECTED_METADATA_FILE),
): void {
  assert(Array.isArray(metadata.expectedFixtures), "Expected fixture metadata must contain expectedFixtures.");
  const entries = metadata.expectedFixtures;
  const fileNames = entries.map((entry) => entry.fixtureFilename);
  assertUnique(fileNames, "Expected fixture metadata entries");

  const entriesByFileName = new Map(entries.map((entry) => [entry.fixtureFilename, entry]));
  for (const [fixtureFilename, requirement] of Object.entries(REQUIRED_EXPECTED_FIXTURE_METADATA)) {
    const entry = entriesByFileName.get(fixtureFilename);
    assert(entry, `Expected fixture metadata is missing ${fixtureFilename}.`);
    assert(entry.fixtureSchemaVersion.length > 0, `${fixtureFilename} metadata must include a fixture schema version.`);
    assert(entry.semanticChecksum === sha256File(`${OFFICIAL_EXPECTED_FIXTURE_DIR}/${fixtureFilename}`), `${fixtureFilename} metadata checksum mismatch.`);
    assert(entry.sourceAuthority === "FIFA", `${fixtureFilename} metadata must use FIFA as source authority.`);
    assert(entry.fixedAccessTimestampUtc === "2026-06-28T17:05:00.000Z", `${fixtureFilename} metadata has wrong fixed access timestamp.`);
    assert(entry.normalizationVersion === metadata.normalizationVersion, `${fixtureFilename} metadata normalization version mismatch.`);
    assert(entry.sourceRole === requirement.sourceRole, `${fixtureFilename} metadata has wrong source role.`);
    assert(entry.purpose === requirement.purpose, `${fixtureFilename} metadata has wrong purpose.`);
    if ("stableSourceId" in requirement) {
      assert(entry.stableSourceId === requirement.stableSourceId, `${fixtureFilename} metadata must reference the FIFA full-calendar source.`);
      assert(!entry.sourceUrl.includes("idStage=289273"), `${fixtureFilename} metadata must not use first-stage-only provenance.`);
      assert(entry.sourceUrl === requirement.sourceUrl, `${fixtureFilename} metadata has wrong knockout source URL.`);
      assert(entry.result === requirement.result, `${fixtureFilename} metadata has wrong knockout source result.`);
      assert(entry.normalizedSourceChecksum === requirement.normalizedSourceChecksum, `${fixtureFilename} metadata has wrong normalized source checksum.`);
    } else {
      assert(entry.stableSourceId === "fifa-first-stage-calendar", `${fixtureFilename} metadata has wrong stable source ID.`);
      assert(entry.sourceUrl.includes("idStage=289273"), `${fixtureFilename} metadata must reference the first-stage source.`);
    }
  }
}

export function verifyOfficialQualificationArtifacts(input: {
  qualification: QualificationArtifact;
  round: RoundOf32Artifact;
  expectedQualification: ExpectedQualification;
  expectedThirdPlace: ReturnType<typeof compactThirdPlace>;
  expectedRound: ExpectedRoundMatch[];
  expectedMetadata?: ExpectedFixtureMetadata;
}): void {
  verifyExpectedFixtureMetadata(input.expectedMetadata);
  verifyQualification(input.qualification, input.expectedQualification);
  if (JSON.stringify(compactThirdPlace(input.qualification.thirdPlacedTeams)) !== JSON.stringify(input.expectedThirdPlace)) {
    throw new Error("Third-place ranking differs from independent expected fixture.");
  }
  verifyRoundOf32(input.round, input.qualification, input.expectedRound);
}

export function verifyOfficialQualification(): {
  qualificationChecksum: string;
  roundOf32Checksum: string;
  qualifierCount: number;
  roundOf32MatchCount: number;
} {
  const snapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
  assert(snapshot.metadata.snapshotChecksum === OFFICIAL_SNAPSHOT_CHECKSUM, "Official snapshot checksum changed.");
  const qualification = readJson<QualificationArtifact>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
  const round = readJson<RoundOf32Artifact>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
  const expectedQualification = readJson<ExpectedQualification>(OFFICIAL_EXPECTED_QUALIFICATION_FILE);
  const expectedThirdPlace = readJson<ReturnType<typeof compactThirdPlace>>(OFFICIAL_EXPECTED_THIRD_PLACE_RANKING_FILE);
  const expectedRound = readJson<ExpectedRoundMatch[]>(OFFICIAL_EXPECTED_ROUND_OF_32_FILE);
  const expectedMetadata = readJson<ExpectedFixtureMetadata>(OFFICIAL_EXPECTED_METADATA_FILE);

  verifyOfficialQualificationArtifacts({
    qualification,
    round,
    expectedQualification,
    expectedThirdPlace,
    expectedRound,
    expectedMetadata,
  });

  return {
    qualificationChecksum: qualification.qualificationChecksum,
    roundOf32Checksum: round.roundOf32Checksum,
    qualifierCount: qualification.qualifiers.length,
    roundOf32MatchCount: round.matches.length,
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = verifyOfficialQualification();
  console.log(
    `Verified official qualification: ${result.qualifierCount} qualifiers, ${result.roundOf32MatchCount} Round-of-32 matches, qualification ${result.qualificationChecksum}, Round-of-32 ${result.roundOf32Checksum}.`,
  );
}
