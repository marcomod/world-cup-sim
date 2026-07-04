import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/loadSnapshot.ts";
import {
  KNOCKOUT_RATING_DIVISOR,
  KNOCKOUT_RATING_MODEL_VERSION,
} from "../../src/data/world-cup-2026/ratings/types.ts";
import { validateKnockoutRatingSnapshot } from "../../src/data/world-cup-2026/ratings/validateRatingSnapshot.ts";
import { buildKnockoutRatingSnapshot } from "../../src/lib/tournament-2026/ratings/buildKnockoutRatingSnapshot.ts";
import { adaptRoundOf32ToSimulatorBracket } from "../../src/lib/tournament-2026/bracket/adaptToSimulatorBracket.ts";
import type { GeneratedRoundOf32Match } from "../../src/lib/tournament-2026/types.ts";
import type { Match, RatingsByTeamId, TeamRating } from "../../src/lib/simulator/types.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import { computeKnockoutRatingSnapshotChecksum } from "./knockoutRatingChecksum.ts";
import {
  compareCanonicalMatchIds,
  computeQualificationChecksum,
  computeRatingLinkageChecksum,
  computeRoundOf32Checksum,
  computeSimulatorInputChecksum,
} from "./officialArtifactChecksums.ts";
import {
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
} from "./officialSnapshotPaths.ts";
import { buildOfficialSnapshotOrchestrationStatus } from "./officialOrchestrationStatus.ts";
import {
  OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY,
  OFFICIAL_SNAPSHOT_CHECKSUM,
} from "./buildOfficialQualification.ts";
import { writeJsonAtomically } from "./atomicJson.ts";

const KNOCKOUT_RATING_REPORT_FILE = "data/generated/world-cup-2026/knockout-rating-report.json";
const EXPECTED_RATING_CHECKSUM =
  "f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5";

type QualificationArtifact = Record<string, unknown> & {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  qualifyingThirdPlaceGroupKey: string;
  qualifiers: { teamId: string; displayName: string }[];
  eliminatedThirdPlacedTeams: { teamId: string }[];
};

type RoundArtifact = Record<string, unknown> & {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  matches: {
    matchId: string;
    participantAId: string;
    participantBId: string;
  }[];
};

type RatingReport = {
  ratingSnapshotId: string;
  ratingSnapshotVersion: string;
  modelVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  divisor: number;
  ratingChecksum: string;
  outputChecksum: string;
  records: {
    teamId: string;
    preTournamentRating: number;
    groupStageDelta: number;
    knockoutRating: number;
  }[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUnique(values: readonly string[], context: string): void {
  assert(new Set(values).size === values.length, `${context} contains duplicate IDs.`);
}

function buildRatingsByTeamId(records: readonly { teamId: string; knockoutRating: number }[]): RatingsByTeamId {
  const ratings: RatingsByTeamId = {};
  for (const record of records) {
    const base = worldFootballEloDevelopmentByTeamId[record.teamId];
    if (!base) {
      throw new Error(`Missing base compatibility rating fields for "${record.teamId}".`);
    }
    ratings[record.teamId] = {
      ...base,
      teamId: record.teamId,
      modelVersion: "v2",
      overall: record.knockoutRating,
    };
  }
  return ratings;
}

function toGeneratedRoundOf32(round: RoundArtifact): GeneratedRoundOf32Match[] {
  return [...round.matches]
    .sort((left, right) => compareCanonicalMatchIds(left.matchId, right.matchId))
    .map((match) => ({
      matchId: match.matchId,
      homeTeamId: match.participantAId,
      awayTeamId: match.participantBId,
      sourceMetadata: {
        homeSource: { type: "group_position", group: "A", position: 1, label: "artifact" },
        awaySource: { type: "group_position", group: "A", position: 2, label: "artifact" },
      },
    })) as GeneratedRoundOf32Match[];
}

function ratingForArtifact(rating: TeamRating) {
  return {
    teamId: rating.teamId,
    modelVersion: rating.modelVersion,
    overall: rating.overall,
    attack: rating.attack,
    defense: rating.defense,
    recentForm: rating.recentForm,
    squadStrength: rating.squadStrength,
    penalties: rating.penalties,
  };
}

function normalizeMatch(match: Match) {
  return {
    id: match.id,
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    ...(match.nextMatchId ? { nextMatchId: match.nextMatchId } : {}),
    ...(match.nextSlot ? { nextSlot: match.nextSlot } : {}),
  };
}

export function buildOfficialSimulatorInputArtifacts(
  snapshot: ReturnType<typeof loadTournamentSnapshot>,
  qualification: QualificationArtifact,
  round: RoundArtifact,
  ratingReport: RatingReport,
): {
  ratingLinkage: Record<string, unknown>;
  simulatorInput: Record<string, unknown>;
} {
  assert(snapshot.snapshot.snapshotVersion === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Official snapshot ID mismatch.");
  assert(snapshot.metadata.snapshotChecksum === OFFICIAL_SNAPSHOT_CHECKSUM, "Official snapshot checksum mismatch.");
  assert(qualification.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Qualification snapshot ID mismatch.");
  assert(qualification.tournamentSnapshotChecksum === snapshot.metadata.snapshotChecksum, "Qualification snapshot linkage mismatch.");
  assert(qualification.qualificationChecksum === computeQualificationChecksum(qualification), "Qualification checksum mismatch.");
  assert(qualification.qualifyingThirdPlaceGroupKey === OFFICIAL_QUALIFYING_THIRD_PLACE_GROUP_KEY, "Qualification third-place key mismatch.");
  assert(round.tournamentSnapshotId === OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID, "Round-of-32 snapshot ID mismatch.");
  assert(round.tournamentSnapshotChecksum === snapshot.metadata.snapshotChecksum, "Round-of-32 snapshot linkage mismatch.");
  assert(round.qualificationChecksum === qualification.qualificationChecksum, "Round-of-32 qualification linkage mismatch.");
  assert(round.roundOf32Checksum === computeRoundOf32Checksum(round), "Round-of-32 checksum mismatch.");

  const ratingSnapshot = buildKnockoutRatingSnapshot({ tournamentSnapshot: snapshot });
  const normalizedRatingSnapshot = validateKnockoutRatingSnapshot(ratingSnapshot);
  const ratingChecksum = computeKnockoutRatingSnapshotChecksum(ratingSnapshot);
  assert(ratingChecksum === EXPECTED_RATING_CHECKSUM, "Post-group-stage rating checksum changed.");
  assert(ratingReport.ratingChecksum === ratingChecksum && ratingReport.outputChecksum === ratingChecksum, "Rating report checksum mismatch.");
  assert(ratingReport.tournamentSnapshotChecksum === snapshot.metadata.snapshotChecksum, "Rating report snapshot linkage mismatch.");
  assert(ratingReport.modelVersion === KNOCKOUT_RATING_MODEL_VERSION, "Rating report model version mismatch.");
  assert(ratingReport.divisor === KNOCKOUT_RATING_DIVISOR, "Rating report divisor must remain 400.");
  assert(normalizedRatingSnapshot.records.length === 48, "Rating snapshot must contain all 48 teams.");
  assertUnique(normalizedRatingSnapshot.records.map((record) => record.teamId), "Rating records");

  const qualifierIds = qualification.qualifiers.map((team) => team.teamId);
  assert(qualifierIds.length === 32, "Simulator input requires exactly 32 qualifiers.");
  assertUnique(qualifierIds, "Qualified teams");
  const ratingRecordsByTeamId = new Map(normalizedRatingSnapshot.records.map((record) => [record.teamId, record]));
  const missingQualifiedRatings = qualifierIds.filter((teamId) => !ratingRecordsByTeamId.has(teamId));
  assert(missingQualifiedRatings.length === 0, `Missing qualified team ratings: ${missingQualifiedRatings.join(", ")}.`);

  const ratingsByTeamId = buildRatingsByTeamId(normalizedRatingSnapshot.records);
  const roundOf32Matches = toGeneratedRoundOf32(round);
  assert(roundOf32Matches.length === 16, "Simulator input requires 16 opening matches.");
  const openingParticipants = roundOf32Matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
  assertUnique(openingParticipants, "Opening-match participants");
  assert(openingParticipants.every((teamId) => qualifierIds.includes(teamId)), "Opening matches contain non-qualified teams.");
  for (const eliminated of qualification.eliminatedThirdPlacedTeams) {
    assert(!openingParticipants.includes(eliminated.teamId), `Eliminated team ${eliminated.teamId} appears in opening matches.`);
  }

  const championPathMatches = adaptRoundOf32ToSimulatorBracket(roundOf32Matches, ratingsByTeamId).map(normalizeMatch);
  assert(championPathMatches.length === 31, "Simulator input must contain 31 champion-path matches.");
  assert(championPathMatches.filter((match) => match.round === "round_of_32" && match.teamAId && match.teamBId).length === 16, "All 16 Round-of-32 matches must be populated.");
  assert(championPathMatches.filter((match) => match.round !== "round_of_32").every((match) => match.teamAId === null && match.teamBId === null), "Later rounds must remain unresolved.");
  assert(championPathMatches[championPathMatches.length - 1]?.id === "m104", "Champion path must end at final m104.");

  const qualifiedTeamRatings = qualifierIds.map((teamId) => {
    const rating = ratingsByTeamId[teamId];
    if (!rating) {
      throw new Error(`Missing simulator rating for qualifier "${teamId}".`);
    }
    return ratingForArtifact(rating);
  });

  const ratingLinkage: Record<string, unknown> = {
    generatedFileWarning: "Do not edit manually.",
    schemaVersion: "world-cup-2026-official-rating-linkage-v1",
    artifactVersion: `${snapshot.snapshot.snapshotVersion}-rating-linkage-r1`,
    tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
    tournamentSnapshotVersion: snapshot.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: snapshot.metadata.snapshotChecksum,
    qualificationChecksum: qualification.qualificationChecksum,
    roundOf32Checksum: round.roundOf32Checksum,
    ratingSnapshotId: ratingReport.ratingSnapshotId,
    ratingSnapshotVersion: ratingReport.ratingSnapshotVersion,
    ratingSnapshotChecksum: ratingChecksum,
    numericRatingChecksum: ratingChecksum,
    metadataChecksumPolicy:
      "This linkage checksum may change when tournament linkage changes; numericRatingChecksum tracks unchanged rating values.",
    modelVersion: KNOCKOUT_RATING_MODEL_VERSION,
    divisor: KNOCKOUT_RATING_DIVISOR,
    totalRatingRecordCount: normalizedRatingSnapshot.records.length,
    qualifiedRatingRecordCount: qualifiedTeamRatings.length,
    allQualifiersCovered: true,
    productionRatingsOverwritten: false,
    qualifiedTeamRatings,
  };
  ratingLinkage.ratingLinkageChecksum = computeRatingLinkageChecksum(ratingLinkage);

  const simulatorInput: Record<string, unknown> = {
    generatedFileWarning: "Do not edit manually.",
    schemaVersion: "world-cup-2026-official-simulator-input-v1",
    artifactVersion: `${snapshot.snapshot.snapshotVersion}-simulator-input-r1`,
    tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
    tournamentSnapshotVersion: snapshot.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: snapshot.metadata.snapshotChecksum,
    qualificationChecksum: qualification.qualificationChecksum,
    roundOf32Checksum: round.roundOf32Checksum,
    ratingSnapshotId: ratingReport.ratingSnapshotId,
    ratingSnapshotVersion: ratingReport.ratingSnapshotVersion,
    ratingSnapshotChecksum: ratingChecksum,
    ratingLinkageChecksum: ratingLinkage.ratingLinkageChecksum,
    modelVersion: KNOCKOUT_RATING_MODEL_VERSION,
    divisor: KNOCKOUT_RATING_DIVISOR,
    openingRoundMatchCount: 16,
    championPathMatchCount: 31,
    laterRoundsStatus: "unresolved_until_simulation",
    matches: championPathMatches,
    qualifiedTeamRatings,
  };
  simulatorInput.simulatorInputChecksum = computeSimulatorInputChecksum(simulatorInput);
  simulatorInput.matches = championPathMatches.map((match) => ({
    ...match,
    simulatorInputChecksum: simulatorInput.simulatorInputChecksum,
  }));
  simulatorInput.simulatorInputChecksum = computeSimulatorInputChecksum(simulatorInput);

  return { ratingLinkage, simulatorInput };
}

export function buildOfficialSimulatorInput(): {
  ratingLinkageChecksum: string;
  simulatorInputChecksum: string;
} {
  const snapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
  const qualification = readJson<QualificationArtifact>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
  const round = readJson<RoundArtifact>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
  const ratingReport = readJson<RatingReport>(KNOCKOUT_RATING_REPORT_FILE);
  const { ratingLinkage, simulatorInput } = buildOfficialSimulatorInputArtifacts(
    snapshot,
    qualification,
    round,
    ratingReport,
  );

  writeJsonAtomically(OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE, ratingLinkage);
  writeJsonAtomically(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE, simulatorInput);
  const snapshotChecksum = snapshot.metadata.snapshotChecksum;
  if (!snapshotChecksum) {
    throw new Error("Official simulator-input builder cannot update orchestration status without a snapshot checksum.");
  }
  writeJsonAtomically(
    OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
    buildOfficialSnapshotOrchestrationStatus({
      snapshot: snapshot.snapshot,
      snapshotChecksum,
    }),
  );
  return {
    ratingLinkageChecksum: String(ratingLinkage.ratingLinkageChecksum),
    simulatorInputChecksum: String(simulatorInput.simulatorInputChecksum),
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildOfficialSimulatorInput();
  console.log(
    `Built official simulator input ${result.simulatorInputChecksum} and rating linkage ${result.ratingLinkageChecksum}.`,
  );
}
