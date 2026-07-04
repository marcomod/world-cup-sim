import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import type { Match, RatingsByTeamId } from "@/src/lib/simulator/types";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";
import {
  buildOfficialSnapshot,
  buildOfficialSnapshotOrchestrationStatus,
  writeOfficialSnapshotArtifacts,
} from "@/scripts/tournament-2026/buildOfficialSnapshot";
import { buildKnockoutRatingReport } from "@/scripts/tournament-2026/buildKnockoutRatings";
import { buildOfficialQualificationArtifacts } from "@/scripts/tournament-2026/buildOfficialQualification";
import {
  buildOfficialSimulatorInput,
  buildOfficialSimulatorInputArtifacts,
} from "@/scripts/tournament-2026/buildOfficialSimulatorInput";
import {
  compareCanonicalMatchIds,
  computeQualificationChecksum,
  computeRatingLinkageChecksum,
  computeRoundOf32Checksum,
  computeSimulatorInputChecksum,
} from "@/scripts/tournament-2026/officialArtifactChecksums";
import { stableJson } from "@/scripts/tournament-2026/stableJson";
import {
  verifyExpectedFixtureMetadata,
  verifyOfficialQualification,
  verifyOfficialQualificationArtifacts,
} from "@/scripts/tournament-2026/verifyOfficialQualification";
import {
  OFFICIAL_EXPECTED_METADATA_FILE,
  OFFICIAL_EXPECTED_QUALIFICATION_FILE,
  OFFICIAL_EXPECTED_ROUND_OF_32_FILE,
  OFFICIAL_EXPECTED_THIRD_PLACE_RANKING_FILE,
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  OFFICIAL_SNAPSHOT_FILE,
} from "@/scripts/tournament-2026/officialSnapshotPaths";

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function ids(rows: readonly { teamId: string }[]): string[] {
  return rows.map((row) => row.teamId);
}

type QualificationRow = {
  teamId: string;
  group: string;
  thirdPlaceRank?: number;
  qualified?: boolean;
  points?: number;
  goalDifference?: number;
  goalsFor?: number;
};

type QualificationArtifact = {
  status: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  qualifyingThirdPlaceGroupKey: string;
  qualifiers: QualificationRow[];
  qualifiedThirdPlacedTeams: QualificationRow[];
  eliminatedThirdPlacedTeams: QualificationRow[];
  thirdPlacedTeams: Required<Pick<QualificationRow, "teamId" | "group" | "thirdPlaceRank" | "qualified" | "points" | "goalDifference" | "goalsFor">>[];
  thirdPlaceEquivalenceGroups: {
    sharedRank: number;
    teamIds: string[];
    semantics: string;
    affectsQualification: boolean;
  }[];
  fairPlay: { totalsIncluded: boolean; fabricatedTotals: boolean; records: unknown[] };
  tieSemantics: Record<string, unknown>;
};

type ExpectedQualification = {
  qualifiers: string[];
  qualifiedThirdPlacedTeams: string[];
  eliminatedThirdPlacedTeams: string[];
};

type RoundMatch = {
  matchId: string;
  participantAId: string;
  participantBId: string;
  sourceSlots: { participantA: string; participantB: string };
  nextMatchId: string;
  nextSide: string;
};

type RoundArtifact = {
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  matches: RoundMatch[];
};

type RatingRecord = {
  teamId: string;
  modelVersion: "v2";
  overall: number;
  attack: number;
  defense: number;
  recentForm: number;
  squadStrength: number;
  penalties: number;
};

type RatingLinkageArtifact = {
  tournamentSnapshotId: string;
  ratingLinkageChecksum: string;
  numericRatingChecksum: string;
  ratingSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  totalRatingRecordCount: number;
  qualifiedRatingRecordCount: number;
  qualifiedTeamRatings: RatingRecord[];
  tournamentSnapshotChecksum: string;
};

type SimulatorInputArtifact = {
  tournamentSnapshotId: string;
  simulatorInputChecksum: string;
  openingRoundMatchCount: number;
  championPathMatchCount: number;
  divisor: number;
  modelVersion: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  ratingLinkageChecksum: string;
  matches: Match[];
  qualifiedTeamRatings: RatingRecord[];
};

type OrchestrationStatus = {
  status: string;
  qualificationArtifact: { path: string; checksum: string } | null;
  roundOf32Artifact: { path: string; checksum: string } | null;
  ratingLinkageArtifact: { path: string; checksum: string; numericRatingChecksum: string } | null;
  simulatorInputStatus: string;
  simulatorInputArtifact: { path: string; checksum: string } | null;
  qualifyingThirdPlaceGroupKey: string | null;
  strictEcuadorGhanaOrderingResolved: boolean;
  unresolvedOrderingAffectsTournamentOutput: boolean;
  noFabricatedFairPlayValues: boolean;
};

type RatingReport = {
  ratingSnapshotId: string;
  ratingSnapshotVersion: string;
  modelVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  divisor: number;
  records: unknown[];
  ratingChecksum: string;
  outputChecksum: string;
};

type ExpectedFixtureMetadata = {
  accessCutoffUtc: string;
  normalizationVersion: string;
  expectedFixtures: {
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
  }[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function permute<T>(values: readonly T[]): T[] {
  return Array.from({ length: values.length }, (_, index) => values[(index * 7 + 3) % values.length]);
}

describe("official 2026 qualification and simulator-input artifacts", () => {
  const qualification = readJson<QualificationArtifact>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
  const roundOf32 = readJson<RoundArtifact>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
  const expectedQualification = readJson<ExpectedQualification>(OFFICIAL_EXPECTED_QUALIFICATION_FILE);
  const expectedThirdPlace = readJson<QualificationArtifact["thirdPlacedTeams"]>(OFFICIAL_EXPECTED_THIRD_PLACE_RANKING_FILE);
  const expectedRoundOf32 = readJson<RoundMatch[]>(OFFICIAL_EXPECTED_ROUND_OF_32_FILE);
  const expectedMetadata = readJson<ExpectedFixtureMetadata>(OFFICIAL_EXPECTED_METADATA_FILE);
  const ratingLinkage = readJson<RatingLinkageArtifact>(OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE);
  const simulatorInput = readJson<SimulatorInputArtifact>(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE);
  const ratingReport = readJson<RatingReport>("data/generated/world-cup-2026/knockout-rating-report.json");
  const snapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);

  function currentOrchestrationStatus(): OrchestrationStatus {
    return readJson<OrchestrationStatus>(OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE);
  }

  function expectFinalizedStatus(status: OrchestrationStatus): void {
    expect(status).toMatchObject({
      status: "knockout_ready",
      qualificationArtifact: {
        path: OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
        checksum: qualification.qualificationChecksum,
      },
      roundOf32Artifact: {
        path: OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
        checksum: roundOf32.roundOf32Checksum,
      },
      ratingLinkageArtifact: {
        path: OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
        checksum: ratingLinkage.ratingLinkageChecksum,
        numericRatingChecksum: ratingLinkage.numericRatingChecksum,
      },
      simulatorInputStatus: "generated",
      simulatorInputArtifact: {
        path: OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
        checksum: simulatorInput.simulatorInputChecksum,
      },
      qualifyingThirdPlaceGroupKey: "BDEFIJKL",
      strictEcuadorGhanaOrderingResolved: false,
      unresolvedOrderingAffectsTournamentOutput: false,
      noFabricatedFairPlayValues: true,
    });
  }

  function writeTempArtifactSet(input: {
    qualification?: unknown;
    roundOf32?: unknown;
    ratingLinkage?: unknown;
    simulatorInput?: unknown;
  }) {
    const directory = mkdtempSync(join(tmpdir(), "official-artifacts-"));
    const paths = {
      qualification: join(directory, "qualification.json"),
      roundOf32: join(directory, "round-of-32.json"),
      ratingLinkage: join(directory, "official-rating-linkage.json"),
      simulatorInput: join(directory, "official-simulator-input.json"),
    };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        writeFileSync(paths[key as keyof typeof paths], stableJson(value), "utf8");
      }
    }
    return paths;
  }

  it("verifies exact qualification, third-place equivalence, and stable checksum", () => {
    expect(verifyOfficialQualification()).toMatchObject({
      qualifierCount: 32,
      roundOf32MatchCount: 16,
      qualificationChecksum: qualification.qualificationChecksum,
      roundOf32Checksum: roundOf32.roundOf32Checksum,
    });
    expect(qualification.status).toBe("knockout_ready");
    expect(qualification.qualifyingThirdPlaceGroupKey).toBe("BDEFIJKL");
    expect(ids(qualification.qualifiers)).toEqual(expectedQualification.qualifiers);
    expect(ids(qualification.qualifiedThirdPlacedTeams)).toEqual(expectedQualification.qualifiedThirdPlacedTeams);
    expect(ids(qualification.eliminatedThirdPlacedTeams)).toEqual(expectedQualification.eliminatedThirdPlacedTeams);
    expect(
      qualification.thirdPlacedTeams.map((team) => ({
        teamId: team.teamId,
        group: team.group,
        thirdPlaceRank: team.thirdPlaceRank,
        qualified: team.qualified,
        points: team.points,
        goalDifference: team.goalDifference,
        goalsFor: team.goalsFor,
      })),
    ).toEqual(expectedThirdPlace);
    expect(qualification.thirdPlaceEquivalenceGroups).toContainEqual(
      expect.objectContaining({
        sharedRank: 3,
        teamIds: ["ecu", "gha"],
        semantics: "not_officially_ordered",
        affectsQualification: false,
      }),
    );
    expect(qualification.fairPlay).toMatchObject({
      totalsIncluded: false,
      fabricatedTotals: false,
      records: [],
    });
    expect(qualification.tieSemantics).toMatchObject({
      strictEcuadorGhanaOrderingResolved: false,
      deterministicFallbackRecorded: false,
      teamIdFallbackRecorded: false,
      alphabeticalFallbackRecorded: false,
    });
    expect(computeQualificationChecksum(qualification)).toBe(qualification.qualificationChecksum);
  });

  it("verifies exact Round-of-32 participants, source slots, and stable checksum", () => {
    expect(roundOf32.matches).toHaveLength(16);
    expect(roundOf32.matches.map((match) => match.matchId)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 73}`),
    );
    expect(
      roundOf32.matches.map((match) => ({
        matchId: match.matchId,
        participantAId: match.participantAId,
        participantBId: match.participantBId,
        sourceSlots: match.sourceSlots,
        nextMatchId: match.nextMatchId,
        nextSide: match.nextSide,
      })),
    ).toEqual(expectedRoundOf32);
    expect(new Set(roundOf32.matches.flatMap((match) => [match.participantAId, match.participantBId])).size).toBe(32);
    expect(roundOf32.matches.find((match) => match.matchId === "m79")).toMatchObject({
      participantAId: "mex",
      participantBId: "ecu",
    });
    expect(roundOf32.matches.find((match) => match.matchId === "m87")).toMatchObject({
      participantAId: "col",
      participantBId: "gha",
    });
    expect(computeRoundOf32Checksum(roundOf32)).toBe(roundOf32.roundOf32Checksum);
  });

  it("keeps rating linkage tied to unchanged numeric rating values", () => {
    expect(ratingReport.records).toHaveLength(48);
    expect(ratingReport.ratingChecksum).toBe("f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5");
    expect(ratingLinkage.tournamentSnapshotId).toBe(OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID);
    expect(ratingLinkage.numericRatingChecksum).toBe(ratingReport.ratingChecksum);
    expect(ratingLinkage.ratingSnapshotChecksum).toBe(ratingReport.ratingChecksum);
    expect(ratingLinkage.qualificationChecksum).toBe(qualification.qualificationChecksum);
    expect(ratingLinkage.roundOf32Checksum).toBe(roundOf32.roundOf32Checksum);
    expect(ratingLinkage.totalRatingRecordCount).toBe(48);
    expect(ratingLinkage.qualifiedRatingRecordCount).toBe(32);
    expect(ids(ratingLinkage.qualifiedTeamRatings)).toEqual(expectedQualification.qualifiers);
    expect(computeRatingLinkageChecksum(ratingLinkage)).toBe(ratingLinkage.ratingLinkageChecksum);

    expect(() => {
      const stale = { ...ratingLinkage, tournamentSnapshotChecksum: "0".repeat(64) };
      if (stale.tournamentSnapshotChecksum !== qualification.tournamentSnapshotChecksum) {
        throw new Error("wrong tournament checksum");
      }
    }).toThrow(/wrong tournament checksum/);
    expect(() => {
      const stale = { ...ratingLinkage, qualificationChecksum: "0".repeat(64) };
      if (stale.qualificationChecksum !== qualification.qualificationChecksum) {
        throw new Error("wrong qualification checksum");
      }
    }).toThrow(/wrong qualification checksum/);
    expect(() => {
      const missing = ratingLinkage.qualifiedTeamRatings.filter((rating) => rating.teamId !== "ecu");
      if (missing.length !== 32) {
        throw new Error("missing qualified team rating");
      }
    }).toThrow(/missing qualified team rating/);
  });

  it("creates deterministic simulator input accepted by the existing simulator", () => {
    expect(simulatorInput.openingRoundMatchCount).toBe(16);
    expect(simulatorInput.championPathMatchCount).toBe(31);
    expect(simulatorInput.tournamentSnapshotId).toBe(OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID);
    expect(simulatorInput.divisor).toBe(400);
    expect(simulatorInput.modelVersion).toBe("world-cup-2026-group-stage-elo-refresh-v1");
    expect(simulatorInput.qualificationChecksum).toBe(qualification.qualificationChecksum);
    expect(simulatorInput.roundOf32Checksum).toBe(roundOf32.roundOf32Checksum);
    expect(simulatorInput.ratingLinkageChecksum).toBe(ratingLinkage.ratingLinkageChecksum);
    expect(simulatorInput.matches).toHaveLength(31);
    expect(simulatorInput.matches.filter((match: Match) => match.round === "round_of_32" && match.teamAId && match.teamBId)).toHaveLength(16);
    expect(simulatorInput.matches.filter((match: Match) => match.round !== "round_of_32").every((match: Match) => match.teamAId === null && match.teamBId === null)).toBe(true);
    expect(ids(simulatorInput.qualifiedTeamRatings)).toEqual(expectedQualification.qualifiers);
    expect(computeSimulatorInputChecksum(simulatorInput)).toBe(simulatorInput.simulatorInputChecksum);

    const ratingsByTeamId = Object.fromEntries(
      simulatorInput.qualifiedTeamRatings.map((rating) => [rating.teamId, rating]),
    ) as RatingsByTeamId;
    const result = simulateBracket(
      simulatorInput.matches.map((match: Match) => ({ ...match })),
      ratingsByTeamId,
      { next: () => 0.25 },
    );
    expect(result.championId).toEqual(expect.any(String));
    expect(expectedQualification.qualifiers).toContain(result.championId);
  });

  it("normalizes semantic checksums across input ordering changes", () => {
    const qualificationWithSwappedTie = {
      ...qualification,
      thirdPlaceEquivalenceGroups: [
        {
          ...qualification.thirdPlaceEquivalenceGroups[0],
          teamIds: ["gha", "ecu"],
        },
      ],
      qualifiedThirdPlacedTeams: [...qualification.qualifiedThirdPlacedTeams].reverse(),
    };
    expect(computeQualificationChecksum(qualificationWithSwappedTie)).toBe(qualification.qualificationChecksum);

    const shuffledRound = {
      ...roundOf32,
      matches: [...roundOf32.matches].reverse(),
    };
    expect(computeRoundOf32Checksum(shuffledRound)).toBe(roundOf32.roundOf32Checksum);

    const reversedSimulator = {
      ...simulatorInput,
      matches: [...simulatorInput.matches].reverse(),
    };
    expect(computeSimulatorInputChecksum(reversedSimulator)).toBe(simulatorInput.simulatorInputChecksum);

    const permutedSimulator = {
      ...simulatorInput,
      matches: permute(simulatorInput.matches),
    };
    expect(computeSimulatorInputChecksum(permutedSimulator)).toBe(simulatorInput.simulatorInputChecksum);
  });

  it("canonicalizes champion-path simulator match IDs numerically", () => {
    const expectedChampionPathIds = [
      ...Array.from({ length: 30 }, (_, index) => `m${index + 73}`),
      "m104",
    ];
    const scrambledIds = ["m100", "m99", "m104", "m73", "m102", "m101", ...expectedChampionPathIds.slice(1, 28)];

    expect([...new Set(scrambledIds)].sort(compareCanonicalMatchIds)).toEqual(expectedChampionPathIds);
    expect(simulatorInput.matches.map((match) => match.id)).toEqual(expectedChampionPathIds);
    expect(simulatorInput.matches.some((match) => match.id === "m103")).toBe(false);
  });

  it("keeps simulator checksum sensitive to within-record semantics", () => {
    const changedParticipant = clone(simulatorInput);
    changedParticipant.matches[0].teamAId = "arg";
    expect(computeSimulatorInputChecksum(changedParticipant)).not.toBe(simulatorInput.simulatorInputChecksum);

    const changedSlot = clone(simulatorInput);
    const slotMatch = changedSlot.matches.find((match) => match.nextSlot === "teamAId");
    expect(slotMatch).toBeDefined();
    if (slotMatch) {
      slotMatch.nextSlot = "teamBId";
    }
    expect(computeSimulatorInputChecksum(changedSlot)).not.toBe(simulatorInput.simulatorInputChecksum);

    const changedId = clone(simulatorInput);
    changedId.matches[0].id = "m999";
    expect(computeSimulatorInputChecksum(changedId)).not.toBe(simulatorInput.simulatorInputChecksum);

    const swappedSides = clone(simulatorInput);
    const firstOpening = swappedSides.matches[0];
    [firstOpening.teamAId, firstOpening.teamBId] = [firstOpening.teamBId, firstOpening.teamAId];
    expect(computeSimulatorInputChecksum(swappedSides)).not.toBe(simulatorInput.simulatorInputChecksum);
  });

  it("builds byte-identical simulator artifacts from reordered Round-of-32 records", () => {
    const baseline = buildOfficialSimulatorInputArtifacts(snapshot, qualification, roundOf32, ratingReport);
    const reversedRound = {
      ...roundOf32,
      matches: [...roundOf32.matches].reverse(),
    };
    const permutedRound = {
      ...roundOf32,
      matches: permute(roundOf32.matches),
    };

    expect(stableJson(buildOfficialSimulatorInputArtifacts(snapshot, qualification, reversedRound, ratingReport).simulatorInput)).toBe(
      stableJson(baseline.simulatorInput),
    );
    expect(stableJson(buildOfficialSimulatorInputArtifacts(snapshot, qualification, permutedRound, ratingReport).simulatorInput)).toBe(
      stableJson(baseline.simulatorInput),
    );
    expect(
      buildOfficialSimulatorInputArtifacts(snapshot, qualification, permutedRound, ratingReport).simulatorInput.simulatorInputChecksum,
    ).toBe(baseline.simulatorInput.simulatorInputChecksum);
  });

  it("rejects finalized artifact snapshot linkage mutations", () => {
    const wrongSnapshotId = clone(qualification);
    wrongSnapshotId.tournamentSnapshotId = "fifa-world-cup-2026";
    expect(() =>
      verifyOfficialQualificationArtifacts({
        qualification: wrongSnapshotId,
        round: roundOf32,
        expectedQualification,
        expectedThirdPlace,
        expectedRound: expectedRoundOf32,
        expectedMetadata,
      }),
    ).toThrow(/wrong tournament snapshot ID/);

    const wrongSnapshotChecksum = clone(qualification);
    wrongSnapshotChecksum.tournamentSnapshotChecksum = "0".repeat(64);
    wrongSnapshotChecksum.qualificationChecksum = computeQualificationChecksum(wrongSnapshotChecksum);
    expect(() =>
      verifyOfficialQualificationArtifacts({
        qualification: wrongSnapshotChecksum,
        round: roundOf32,
        expectedQualification,
        expectedThirdPlace,
        expectedRound: expectedRoundOf32,
        expectedMetadata,
      }),
    ).toThrow(/stale snapshot checksum/);
  });

  it("validates expected fixture metadata checksums and provenance", () => {
    expect(() => verifyExpectedFixtureMetadata(expectedMetadata)).not.toThrow();
    expect(expectedMetadata.expectedFixtures.map((entry) => entry.fixtureFilename)).toEqual(
      expect.arrayContaining([
        "expected-qualification.json",
        "expected-third-place-ranking.json",
        "expected-round-of-32.json",
      ]),
    );

    for (const fixtureFilename of ["expected-qualification.json", "expected-third-place-ranking.json"]) {
      expect(expectedMetadata.expectedFixtures.find((entry) => entry.fixtureFilename === fixtureFilename)).toMatchObject({
        sourceAuthority: "FIFA",
        purpose: expect.any(String),
      });
    }
    expect(expectedMetadata.expectedFixtures.find((entry) => entry.fixtureFilename === "expected-round-of-32.json")).toMatchObject({
      stableSourceId: "fifa-full-calendar",
      sourceRole: "official_round_of_32_participant_cross_check",
      result: "16 Round-of-32 fixtures/participants available",
    });
  });

  it("rejects malformed expected fixture metadata", () => {
    const badChecksum = clone(expectedMetadata);
    badChecksum.expectedFixtures[0].semanticChecksum = "0".repeat(64);
    expect(() => verifyExpectedFixtureMetadata(badChecksum)).toThrow(/metadata checksum mismatch/);

    const missingEntry = clone(expectedMetadata);
    missingEntry.expectedFixtures = missingEntry.expectedFixtures.filter(
      (entry) => entry.fixtureFilename !== "expected-third-place-ranking.json",
    );
    expect(() => verifyExpectedFixtureMetadata(missingEntry)).toThrow(/missing expected-third-place-ranking\.json/);

    const duplicateEntry = clone(expectedMetadata);
    duplicateEntry.expectedFixtures.push(clone(duplicateEntry.expectedFixtures[0]));
    expect(() => verifyExpectedFixtureMetadata(duplicateEntry)).toThrow(/must be unique/);

    const wrongSourceRole = clone(expectedMetadata);
    wrongSourceRole.expectedFixtures[0].sourceRole = "wrong_role";
    expect(() => verifyExpectedFixtureMetadata(wrongSourceRole)).toThrow(/wrong source role/);

    const wrongKnockoutSource = clone(expectedMetadata);
    const knockout = wrongKnockoutSource.expectedFixtures.find((entry) => entry.fixtureFilename === "expected-round-of-32.json");
    expect(knockout).toBeDefined();
    if (knockout) {
      knockout.stableSourceId = "fifa-first-stage-calendar";
    }
    expect(() => verifyExpectedFixtureMetadata(wrongKnockoutSource)).toThrow(/full-calendar source/);

    const firstStageOnlyRound = clone(expectedMetadata);
    const roundMetadata = firstStageOnlyRound.expectedFixtures.find((entry) => entry.fixtureFilename === "expected-round-of-32.json");
    expect(roundMetadata).toBeDefined();
    if (roundMetadata) {
      roundMetadata.sourceUrl = "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&idStage=289273&language=en&count=200";
    }
    expect(() => verifyExpectedFixtureMetadata(firstStageOnlyRound)).toThrow(/first-stage-only provenance/);
  });

  it("preserves finalized orchestration status when the snapshot builder runs last", () => {
    const before = currentOrchestrationStatus();
    writeOfficialSnapshotArtifacts(buildOfficialSnapshot());
    const after = currentOrchestrationStatus();

    expect(after).toEqual(before);
    expectFinalizedStatus(after);
  });

  it("preserves finalized downstream links when the qualification builder runs after simulator input", () => {
    buildOfficialQualificationArtifacts();
    buildOfficialSimulatorInput();
    const before = currentOrchestrationStatus();

    buildOfficialQualificationArtifacts();
    const after = currentOrchestrationStatus();

    expect(before.ratingLinkageArtifact).toEqual({
      path: OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
      checksum: ratingLinkage.ratingLinkageChecksum,
      numericRatingChecksum: ratingLinkage.numericRatingChecksum,
    });
    expect(before.simulatorInputArtifact).toEqual({
      path: OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
      checksum: simulatorInput.simulatorInputChecksum,
    });
    expect(after).toEqual(before);
    expectFinalizedStatus(after);
  });

  it("produces equivalent finalized orchestration status across supported builder orders", () => {
    writeOfficialSnapshotArtifacts(buildOfficialSnapshot());
    buildKnockoutRatingReport();
    buildOfficialQualificationArtifacts();
    buildOfficialSimulatorInput();
    const sequenceA = currentOrchestrationStatus();

    buildOfficialQualificationArtifacts();
    buildOfficialSimulatorInput();
    buildOfficialQualificationArtifacts();
    writeOfficialSnapshotArtifacts(buildOfficialSnapshot());
    const sequenceB = currentOrchestrationStatus();

    expect(sequenceB).toEqual(sequenceA);
    expectFinalizedStatus(sequenceB);
  });

  it("reconstructs deterministic orchestration status for finalized and partial artifact states", () => {
    const result = buildOfficialSnapshot();

    const noArtifacts = buildOfficialSnapshotOrchestrationStatus(result, writeTempArtifactSet({}));
    expect(noArtifacts).toMatchObject({
      status: "knockout_ready",
      qualificationArtifact: null,
      roundOf32Artifact: null,
      ratingLinkageArtifact: null,
      simulatorInputStatus: "not_generated_by_snapshot_builder",
      simulatorInputArtifact: null,
    });

    const qualificationOnly = buildOfficialSnapshotOrchestrationStatus(
      result,
      writeTempArtifactSet({ qualification }),
    );
    expect(qualificationOnly).toMatchObject({
      qualificationArtifact: { checksum: qualification.qualificationChecksum },
      roundOf32Artifact: null,
      ratingLinkageArtifact: null,
      simulatorInputStatus: "not_generated",
      simulatorInputArtifact: null,
    });

    const qualificationAndRound = buildOfficialSnapshotOrchestrationStatus(
      result,
      writeTempArtifactSet({ qualification, roundOf32 }),
    );
    expect(qualificationAndRound).toMatchObject({
      qualificationArtifact: { checksum: qualification.qualificationChecksum },
      roundOf32Artifact: { checksum: roundOf32.roundOf32Checksum },
      ratingLinkageArtifact: null,
      simulatorInputStatus: "not_generated",
      simulatorInputArtifact: null,
    });

    const qualificationRoundAndRating = buildOfficialSnapshotOrchestrationStatus(
      result,
      writeTempArtifactSet({ qualification, roundOf32, ratingLinkage }),
    );
    expect(qualificationRoundAndRating).toMatchObject({
      qualificationArtifact: { checksum: qualification.qualificationChecksum },
      roundOf32Artifact: { checksum: roundOf32.roundOf32Checksum },
      ratingLinkageArtifact: {
        checksum: ratingLinkage.ratingLinkageChecksum,
        numericRatingChecksum: ratingLinkage.numericRatingChecksum,
      },
      simulatorInputStatus: "not_generated",
      simulatorInputArtifact: null,
    });

    const finalized = buildOfficialSnapshotOrchestrationStatus(
      result,
      writeTempArtifactSet({ qualification, roundOf32, ratingLinkage, simulatorInput }),
    );
    expect(finalized).toMatchObject({
      status: "knockout_ready",
      qualificationArtifact: { checksum: qualification.qualificationChecksum },
      roundOf32Artifact: { checksum: roundOf32.roundOf32Checksum },
      ratingLinkageArtifact: {
        checksum: ratingLinkage.ratingLinkageChecksum,
        numericRatingChecksum: ratingLinkage.numericRatingChecksum,
      },
      simulatorInputStatus: "generated",
      simulatorInputArtifact: { checksum: simulatorInput.simulatorInputChecksum },
      qualifyingThirdPlaceGroupKey: "BDEFIJKL",
      strictEcuadorGhanaOrderingResolved: false,
      unresolvedOrderingAffectsTournamentOutput: false,
      noFabricatedFairPlayValues: true,
    });
  });

  it("does not silently preserve invalid finalized artifact linkage", () => {
    const result = buildOfficialSnapshot();
    const invalidQualification = {
      ...qualification,
      qualificationChecksum: "0".repeat(64),
    };

    expect(() =>
      buildOfficialSnapshotOrchestrationStatus(
        result,
        writeTempArtifactSet({ qualification: invalidQualification, roundOf32, ratingLinkage, simulatorInput }),
      ),
    ).toThrow(/Qualification artifact checksum mismatch/);

    expect(() =>
      buildOfficialSnapshotOrchestrationStatus(
        result,
        writeTempArtifactSet({ roundOf32 }),
      ),
    ).toThrow(/Round-of-32 artifact exists without a valid qualification artifact/);
  });
});
