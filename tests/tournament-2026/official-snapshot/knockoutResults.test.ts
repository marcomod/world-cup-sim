import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildKnockoutResultsArtifact,
  computeKnockoutResultsChecksum,
  type KnockoutResultSourceEntry,
  type KnockoutResultsArtifact,
  type KnockoutResultsSource,
} from "@/scripts/tournament-2026/buildKnockoutResults";
import { verifyKnockoutResults, verifyKnockoutResultsArtifacts } from "@/scripts/tournament-2026/verifyKnockoutResults";
import {
  OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE,
  OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
} from "@/scripts/tournament-2026/officialSnapshotPaths";
import { stableJson } from "@/scripts/tournament-2026/stableJson";
import {
  prepareMixedOfficialSimulatorBracket,
  runMixedOfficialMonteCarlo,
  simulateMixedOfficialBracket,
} from "@/src/lib/tournament-2026/bracket";
import { runMonteCarloAccounting } from "@/src/lib/simulator/monteCarlo";
import { createSeededRng } from "@/src/lib/simulator/rng";
import type { Match, RatingsByTeamId } from "@/src/lib/simulator/types";

type QualificationArtifact = Parameters<typeof buildKnockoutResultsArtifact>[0]["qualification"];
type RoundArtifact = Parameters<typeof buildKnockoutResultsArtifact>[0]["roundOf32"];

type SimulatorInputArtifact = {
  matches: Match[];
  qualifiedTeamRatings: RatingsByTeamId[string][];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const qualification = readJson<QualificationArtifact>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
const roundOf32 = readJson<RoundArtifact>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
const knockoutSource = readJson<KnockoutResultsSource>(OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE);
const simulatorInput = readJson<SimulatorInputArtifact>(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE);

const expectedCompletedRoundOf32Results: KnockoutResultSourceEntry[] = [
  {
    matchId: "m73",
    participantAId: "rsa",
    participantBId: "can",
    score: {
      participantAGoals: 0,
      participantBGoals: 1,
      decidedBy: "regular_time",
    },
    winnerId: "can",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m74",
    participantAId: "ger",
    participantBId: "par",
    score: {
      participantAGoals: 1,
      participantBGoals: 1,
      decidedBy: "penalties",
      participantAPenalties: 3,
      participantBPenalties: 4,
    },
    winnerId: "par",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m75",
    participantAId: "ned",
    participantBId: "mar",
    score: {
      participantAGoals: 1,
      participantBGoals: 1,
      decidedBy: "penalties",
      participantAPenalties: 2,
      participantBPenalties: 3,
    },
    winnerId: "mar",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m76",
    participantAId: "bra",
    participantBId: "jpn",
    score: {
      participantAGoals: 2,
      participantBGoals: 1,
      decidedBy: "regular_time",
    },
    winnerId: "bra",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m77",
    participantAId: "fra",
    participantBId: "swe",
    score: {
      participantAGoals: 3,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "fra",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m78",
    participantAId: "civ",
    participantBId: "nor",
    score: {
      participantAGoals: 1,
      participantBGoals: 2,
      decidedBy: "regular_time",
    },
    winnerId: "nor",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m79",
    participantAId: "mex",
    participantBId: "ecu",
    score: {
      participantAGoals: 2,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "mex",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m80",
    participantAId: "eng",
    participantBId: "cod",
    score: {
      participantAGoals: 2,
      participantBGoals: 1,
      decidedBy: "regular_time",
    },
    winnerId: "eng",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m81",
    participantAId: "usa",
    participantBId: "bih",
    score: {
      participantAGoals: 2,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "usa",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m82",
    participantAId: "bel",
    participantBId: "sen",
    score: {
      participantAGoals: 3,
      participantBGoals: 2,
      decidedBy: "extra_time",
    },
    winnerId: "bel",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m83",
    participantAId: "por",
    participantBId: "cro",
    score: {
      participantAGoals: 2,
      participantBGoals: 1,
      decidedBy: "regular_time",
    },
    winnerId: "por",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m84",
    participantAId: "esp",
    participantBId: "aut",
    score: {
      participantAGoals: 3,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "esp",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m85",
    participantAId: "sui",
    participantBId: "alg",
    score: {
      participantAGoals: 2,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "sui",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m86",
    participantAId: "arg",
    participantBId: "cpv",
    score: {
      participantAGoals: 3,
      participantBGoals: 2,
      decidedBy: "extra_time",
    },
    winnerId: "arg",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m87",
    participantAId: "col",
    participantBId: "gha",
    score: {
      participantAGoals: 1,
      participantBGoals: 0,
      decidedBy: "regular_time",
    },
    winnerId: "col",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
  {
    matchId: "m88",
    participantAId: "aus",
    participantBId: "egy",
    score: {
      participantAGoals: 1,
      participantBGoals: 1,
      decidedBy: "penalties",
      participantAPenalties: 2,
      participantBPenalties: 4,
    },
    winnerId: "egy",
    resultStatus: "official_final",
    resultSource: "official-public-result-entry",
  },
];

const m73Result: KnockoutResultSourceEntry = {
  matchId: "m73",
  participantAId: "rsa",
  participantBId: "can",
  score: {
    participantAGoals: 1,
    participantBGoals: 0,
    decidedBy: "regular_time",
  },
  winnerId: "rsa",
  resultStatus: "official_final",
  resultSource: "manual-official-knockout-results",
};

const m74Result: KnockoutResultSourceEntry = {
  matchId: "m74",
  participantAId: "ger",
  participantBId: "par",
  score: {
    participantAGoals: 2,
    participantBGoals: 1,
    decidedBy: "extra_time",
  },
  winnerId: "ger",
  resultStatus: "official_final",
  resultSource: "manual-official-knockout-results",
};

function buildWithResults(results: KnockoutResultSourceEntry[]): KnockoutResultsArtifact {
  return buildKnockoutResultsArtifact({
    qualification,
    roundOf32,
    source: {
      ...knockoutSource,
      results,
    },
  });
}

function ratingsByTeamId(): RatingsByTeamId {
  return Object.fromEntries(
    simulatorInput.qualifiedTeamRatings.map((rating) => [rating.teamId, rating]),
  );
}

describe("official knockout results artifact", () => {
  it("builds and verifies the checked-in source with completed Round-of-32 results", () => {
    const artifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const verification = verifyKnockoutResults();

    expect(knockoutSource.results).toHaveLength(16);
    expect(artifact.completedMatchCount).toBe(16);
    expect(artifact.pendingMatchCount).toBe(16);
    expect(artifact.resultChecksum).toBe(
      "179e9f53a4502a987413fba547dbc32a4d85bee42aa1eb56a84781866a5747a1",
    );
    expect(artifact.completedMatches.map((match) => match.matchId)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 73}`),
    );
    expect(artifact.pendingMatches.map((match) => match.matchId)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 89}`),
    );
    expect(artifact.pendingMatches.find((match) => match.matchId === "m90")).toMatchObject({
      knownParticipants: {
        participantA: { teamId: "can" },
        participantB: { teamId: "mar" },
      },
      unresolvedParticipantSlots: {},
    });

    for (const pending of artifact.pendingMatches) {
      expect(pending.status).toBe("pending");
      expect("score" in pending).toBe(false);
      expect("winnerId" in pending).toBe(false);
    }

    expect(verification).toMatchObject({
      completedMatchCount: 16,
      pendingMatchCount: 16,
      resultChecksum: "179e9f53a4502a987413fba547dbc32a4d85bee42aa1eb56a84781866a5747a1",
    });
  });

  it("records the exact official Round-of-32 results in the source and generated artifact", () => {
    const artifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const sourceResultsById = new Map(knockoutSource.results.map((result) => [result.matchId, result]));
    const completedById = new Map(artifact.completedMatches.map((match) => [match.matchId, match]));

    expect(knockoutSource.results.map((result) => result.matchId)).toEqual(
      expectedCompletedRoundOf32Results.map((result) => result.matchId),
    );

    for (const expected of expectedCompletedRoundOf32Results) {
      expect(sourceResultsById.get(expected.matchId)).toEqual(expected);
      expect(completedById.get(expected.matchId)).toMatchObject({
        matchId: expected.matchId,
        participantA: { teamId: expected.participantAId },
        participantB: { teamId: expected.participantBId },
        score: expected.score,
        winnerId: expected.winnerId,
        resultStatus: "official_final",
      });
    }
  });

  it("propagates Round-of-32 winners into pending Round-of-16 slots without future scores", () => {
    const artifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const pendingById = new Map(artifact.pendingMatches.map((match) => [match.matchId, match]));
    const roundOf16 = artifact.pendingMatches.filter((match) => match.round === "round_of_16");
    const roundOf16TeamIds = new Set(
      roundOf16.flatMap((match) => [
        match.knownParticipants.participantA?.teamId,
        match.knownParticipants.participantB?.teamId,
      ]).filter((teamId): teamId is string => teamId !== undefined),
    );

    expect(roundOf16.map((match) => match.matchId)).toEqual([
      "m89",
      "m90",
      "m91",
      "m92",
      "m93",
      "m94",
      "m95",
      "m96",
    ]);
    expect(
      Object.fromEntries(
        roundOf16.map((match) => [
          match.matchId,
          [
            match.knownParticipants.participantA?.teamId,
            match.knownParticipants.participantB?.teamId,
          ],
        ]),
      ),
    ).toEqual({
      m89: ["par", "fra"],
      m90: ["can", "mar"],
      m91: ["bra", "nor"],
      m92: ["mex", "eng"],
      m93: ["por", "esp"],
      m94: ["usa", "bel"],
      m95: ["arg", "egy"],
      m96: ["sui", "col"],
    });

    for (const completed of artifact.completedMatches) {
      const routing = completed.nextMatchRouting.find((route) => route.outcome === "winner");
      expect(routing).toBeDefined();
      expect(routing?.toMatchId).toMatch(/^m(?:89|9[0-6])$/);
      const nextMatch = pendingById.get(String(routing?.toMatchId));
      expect(nextMatch).toBeDefined();
      expect(nextMatch?.round).toBe("round_of_16");
      const side = routing?.toSlot === "teamAId" ? "participantA" : "participantB";
      expect(nextMatch?.knownParticipants[side]?.teamId).toBe(completed.winnerId);
      expect(roundOf16TeamIds.has(completed.loserId)).toBe(false);
    }

    for (const pending of roundOf16) {
      expect(pending.status).toBe("pending");
      expect(pending.unresolvedParticipantSlots).toEqual({});
      expect("score" in pending).toBe(false);
      expect("winnerId" in pending).toBe(false);
    }
  });

  it("accepts a completed official result and propagates the winner to the routed next match side", () => {
    const artifact = buildWithResults([m73Result]);

    expect(artifact.completedMatches).toHaveLength(1);
    expect(artifact.completedMatches[0]).toMatchObject({
      matchId: "m73",
      winnerId: "rsa",
      loserId: "can",
      resultStatus: "official_final",
      nextMatchRouting: [{ outcome: "winner", toMatchId: "m90", toSlot: "teamAId" }],
    });
    expect(artifact.pendingMatches.find((match) => match.matchId === "m90")).toMatchObject({
      knownParticipants: {
        participantA: { teamId: "rsa" },
      },
      unresolvedParticipantSlots: {
        participantB: "winner of m75",
      },
    });
  });

  it("rejects invalid winners, duplicate results, unknown match IDs, and impossible scores", () => {
    expect(() =>
      buildWithResults([
        {
          ...m73Result,
          winnerId: "mex",
        },
      ]),
    ).toThrow(/winner must be one of the participants/);

    expect(() =>
      buildWithResults([
        {
          ...m73Result,
          winnerId: "can",
        },
      ]),
    ).toThrow(/winner does not match the score/);

    expect(() => buildWithResults([m73Result, m73Result])).toThrow(/Duplicate result/);

    expect(() =>
      buildWithResults([
        {
          ...m73Result,
          matchId: "m999",
        },
      ]),
    ).toThrow(/unknown match ID/);

    expect(() =>
      buildWithResults([
        {
          ...m73Result,
          score: {
            participantAGoals: 1,
            participantBGoals: 1,
            decidedBy: "regular_time",
          },
        },
      ]),
    ).toThrow(/drawn score requires penalties/);
  });

  it("rejects completed future matches whose prerequisite participants are unresolved", () => {
    expect(() =>
      buildWithResults([
        {
          matchId: "m90",
          participantAId: "rsa",
          participantBId: "ned",
          score: {
            participantAGoals: 1,
            participantBGoals: 0,
            decidedBy: "regular_time",
          },
          winnerId: "rsa",
          resultStatus: "official_final",
          resultSource: "manual-official-knockout-results",
        },
      ]),
    ).toThrow(/unresolved prerequisite participants/);
  });

  it("rejects source participant mismatches and stale lineage checksums", () => {
    expect(() =>
      buildWithResults([
        {
          ...m73Result,
          participantAId: "mex",
          winnerId: "mex",
        },
      ]),
    ).toThrow(/participant A does not match/);

    expect(() =>
      buildKnockoutResultsArtifact({
        qualification,
        roundOf32,
        source: {
          ...knockoutSource,
          topologyChecksum: "0".repeat(64),
          results: [],
        },
      }),
    ).toThrow(/stale topology checksum/);
  });

  it("rejects fabricated pending participants and wrong artifact routing in the verifier", () => {
    const artifact = buildWithResults([m73Result]);
    const fabricatedPending = clone(artifact);
    const pendingM90 = fabricatedPending.pendingMatches.find((match) => match.matchId === "m90");
    expect(pendingM90).toBeDefined();
    if (pendingM90) {
      pendingM90.knownParticipants.participantB = {
        teamId: "fake",
        displayName: "Fabricated",
        sourceSlot: "winner of m75",
      };
    }
    fabricatedPending.resultChecksum = computeKnockoutResultsChecksum(fabricatedPending);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: { ...knockoutSource, results: [m73Result] },
        artifact: fabricatedPending,
      }),
    ).toThrow(/semantics/);

    const wrongRouting = clone(artifact);
    wrongRouting.completedMatches[0].nextMatchRouting = [
      { outcome: "winner", toMatchId: "m90", toSlot: "teamBId" },
    ];
    wrongRouting.resultChecksum = computeKnockoutResultsChecksum(wrongRouting);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: { ...knockoutSource, results: [m73Result] },
        artifact: wrongRouting,
      }),
    ).toThrow(/semantics/);
  });

  it("keeps the checksum stable when source result order changes", () => {
    const ordered = buildWithResults([m73Result, m74Result]);
    const reordered = buildWithResults([m74Result, m73Result]);

    expect(reordered.resultChecksum).toBe(ordered.resultChecksum);
    expect(stableJson(reordered)).toBe(stableJson(ordered));
  });

  it("passes verification only for the exact canonical generated artifact bytes", () => {
    const artifact = buildWithResults(knockoutSource.results);
    const canonicalText = stableJson(artifact);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: knockoutSource,
        artifactText: canonicalText,
      }),
    ).not.toThrow();
  });

  it("rejects semantic-equivalent raw artifact text when object keys are reordered", () => {
    const artifact = buildWithResults(knockoutSource.results);
    const reordered = {
      schemaVersion: artifact.schemaVersion,
      generatedFileWarning: artifact.generatedFileWarning,
      ...artifact,
    };

    expect(reordered).toEqual(artifact);
    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: knockoutSource,
        artifactText: stableJson(reordered),
      }),
    ).toThrow(/raw bytes differ.*regenerate/i);
  });

  it("rejects semantic-equivalent raw artifact text when whitespace is not canonical", () => {
    const artifact = buildWithResults(knockoutSource.results);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: knockoutSource,
        artifactText: `${JSON.stringify(artifact, null, 4)}\n`,
      }),
    ).toThrow(/raw bytes differ.*regenerate/i);
  });
});

describe("mixed official knockout simulator adapter", () => {
  it("starts the current-state sandbox from locked official Round-of-32 winners and propagated Round-of-16 fixtures", () => {
    const currentArtifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const mixed = prepareMixedOfficialSimulatorBracket(
      simulatorInput.matches,
      currentArtifact,
    );
    const matchesById = new Map(mixed.map((match) => [match.id, match]));
    const completedById = new Map(
      currentArtifact.completedMatches.map((match) => [match.matchId, match]),
    );
    const officialLoserIds = new Set(
      currentArtifact.completedMatches.map((match) => match.loserId),
    );

    for (let matchNumber = 73; matchNumber <= 88; matchNumber += 1) {
      const matchId = `m${matchNumber}`;
      const completed = completedById.get(matchId);

      expect(completed).toBeDefined();
      expect(matchesById.get(matchId)).toMatchObject({
        officialResultLocked: true,
        mixedOfficialStatus: "official_completed",
        winnerId: completed?.winnerId,
        score: {
          teamAGoals: completed?.score.participantAGoals,
          teamBGoals: completed?.score.participantBGoals,
          decidedBy: completed?.score.decidedBy,
        },
      });
    }

    expect(
      Object.fromEntries(
        mixed
          .filter((match) => match.round === "round_of_16")
          .map((match) => [match.id, [match.teamAId, match.teamBId]]),
      ),
    ).toEqual({
      m89: ["par", "fra"],
      m90: ["can", "mar"],
      m91: ["bra", "nor"],
      m92: ["mex", "eng"],
      m93: ["por", "esp"],
      m94: ["usa", "bel"],
      m95: ["arg", "egy"],
      m96: ["sui", "col"],
    });

    for (const match of mixed.filter((match) => match.round !== "round_of_32")) {
      expect(officialLoserIds.has(String(match.teamAId))).toBe(false);
      expect(officialLoserIds.has(String(match.teamBId))).toBe(false);
    }
  });

  it("simulates only pending current-state matches without overwriting official completed results", () => {
    const currentArtifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const mixed = prepareMixedOfficialSimulatorBracket(
      simulatorInput.matches,
      currentArtifact,
    );
    const result = simulateMixedOfficialBracket(
      mixed,
      ratingsByTeamId(),
      createSeededRng(20260704),
      {
        includeScoreline: true,
        scoreRng: createSeededRng(20260705),
      },
    );
    const projectedById = new Map(result.matches.map((match) => [match.id, match]));
    const officialLoserIds = new Set(
      currentArtifact.completedMatches.map((match) => match.loserId),
    );

    for (const completed of currentArtifact.completedMatches) {
      expect(projectedById.get(completed.matchId)).toMatchObject({
        officialResultLocked: true,
        mixedOfficialStatus: "official_completed",
        winnerId: completed.winnerId,
        score: {
          teamAGoals: completed.score.participantAGoals,
          teamBGoals: completed.score.participantBGoals,
          decidedBy: completed.score.decidedBy,
        },
      });
    }

    for (const matchId of [
      "m89",
      "m90",
      "m91",
      "m92",
      "m93",
      "m94",
      "m95",
      "m96",
      "m97",
      "m98",
      "m99",
      "m100",
      "m101",
      "m102",
      "m104",
    ]) {
      const match = projectedById.get(matchId);

      expect(match).toMatchObject({
        officialResultLocked: false,
        mixedOfficialStatus: "pending_simulation",
      });
      expect(match?.winnerId).toEqual(expect.any(String));
    }

    for (const match of result.matches.filter((match) => match.round !== "round_of_32")) {
      expect(officialLoserIds.has(String(match.teamAId))).toBe(false);
      expect(officialLoserIds.has(String(match.teamBId))).toBe(false);
      expect(officialLoserIds.has(String(match.winnerId))).toBe(false);
    }

    expect(projectedById.get("m97")?.teamAId).toBe(projectedById.get("m89")?.winnerId);
    expect(projectedById.get("m97")?.teamBId).toBe(projectedById.get("m90")?.winnerId);
    expect(result.championId).toEqual(projectedById.get("m104")?.winnerId);
  });

  it("counts current-state tournament odds with official Round-of-32 winners locked", () => {
    const currentArtifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const mixed = prepareMixedOfficialSimulatorBracket(
      simulatorInput.matches,
      currentArtifact,
    );
    const result = runMixedOfficialMonteCarlo({
      matches: mixed,
      ratingsByTeamId: ratingsByTeamId(),
      simulationCount: 4,
      rng: { next: () => 0 },
    });
    const oddsByTeamId = new Map(result.teamOdds.map((row) => [row.teamId, row]));

    expect(result.simulationCount).toBe(4);
    expect(oddsByTeamId.get("can")?.roundOf16Probability).toBe(1);
    expect(oddsByTeamId.get("rsa")?.roundOf16Probability).toBe(0);
    expect(oddsByTeamId.get("rsa")?.championProbability).toBe(0);
    expect(
      result.teamOdds.some((row) => row.championProbability > 0),
    ).toBe(true);
  });

  it("uses shared Monte Carlo accounting with the mixed-official simulator", () => {
    const currentArtifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    const mixed = prepareMixedOfficialSimulatorBracket(
      simulatorInput.matches,
      currentArtifact,
    );
    const mixedOfficialResult = runMixedOfficialMonteCarlo({
      matches: mixed,
      ratingsByTeamId: ratingsByTeamId(),
      simulationCount: 50,
      rng: createSeededRng(20260706),
    });
    const sharedAccountingResult = runMonteCarloAccounting({
      matches: mixed,
      ratingsByTeamId: ratingsByTeamId(),
      simulationCount: 50,
      rng: createSeededRng(20260706),
      simulateTournament: simulateMixedOfficialBracket,
    });

    expect(mixedOfficialResult).toEqual(sharedAccountingResult);
  });

  it("locks completed official winners while leaving pending matches simulatable", () => {
    const lockedCanada = buildWithResults([
      {
        ...m73Result,
        score: {
          participantAGoals: 0,
          participantBGoals: 1,
          decidedBy: "regular_time",
        },
        winnerId: "can",
      },
    ]);
    const mixed = prepareMixedOfficialSimulatorBracket(simulatorInput.matches, lockedCanada);
    const m73 = mixed.find((match) => match.id === "m73");

    expect(m73).toMatchObject({
      officialResultLocked: true,
      mixedOfficialStatus: "official_completed",
      winnerId: "can",
    });

    const result = simulateMixedOfficialBracket(mixed, ratingsByTeamId(), { next: () => 0 });
    expect(result.matches.find((match) => match.id === "m73")?.winnerId).toBe("can");
    expect(result.matches.find((match) => match.id === "m90")?.teamAId).toBe("can");
    expect(result.championId).toEqual(expect.any(String));
  });

  it("keeps all pending official matches available for simulation", () => {
    const pendingArtifact = buildWithResults([]);
    const mixed = prepareMixedOfficialSimulatorBracket(simulatorInput.matches, pendingArtifact);

    expect(mixed.every((match) => match.officialResultLocked === false)).toBe(true);
    expect(mixed.find((match) => match.id === "m73")).toMatchObject({
      mixedOfficialStatus: "pending_simulation",
      teamAId: "rsa",
      teamBId: "can",
    });

    const result = simulateMixedOfficialBracket(mixed, ratingsByTeamId(), { next: () => 0 });
    expect(result.matches.find((match) => match.id === "m73")?.winnerId).toBe("rsa");
    expect(result.matches.find((match) => match.id === "m90")?.teamAId).toBe("rsa");
  });
});

describe("knockout results isolation", () => {
  it("uses offline files without runtime fetches or current-time artifact fields", () => {
    const files = [
      "scripts/tournament-2026/buildKnockoutResults.ts",
      "scripts/tournament-2026/verifyKnockoutResults.ts",
      "src/lib/tournament-2026/bracket/adaptOfficialKnockoutResults.ts",
      "src/data/world-cup-2026/officialArtifacts.ts",
      OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
      OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE,
    ];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\bfetch\s*\(/);
      expect(text, file).not.toMatch(/XMLHttpRequest/);
      expect(text, file).not.toMatch(/https?\.request/);
    }

    const artifact = readJson<KnockoutResultsArtifact>(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE);
    expect(artifact.source.runtimeFetch).toBe(false);
    expect(JSON.stringify(artifact)).not.toMatch(/generatedAt|updatedAt|createdAt/);
  });

  it("keeps protected simulator math and rating artifacts untouched by knockout results", () => {
    const probabilitySource = readFileSync("src/lib/simulator/probability.ts", "utf8");
    const ratingTypesSource = readFileSync("src/data/world-cup-2026/ratings/types.ts", "utf8");

    expect(probabilitySource).toContain("ratingDiff / 400");
    expect(probabilitySource).not.toContain("knockout-results");
    expect(ratingTypesSource).toContain("KNOCKOUT_RATING_DIVISOR = 400");
    expect(ratingTypesSource).not.toContain("official-knockout-results");
    expect(readJson<{ ratingChecksum: string }>("data/generated/world-cup-2026/knockout-rating-report.json").ratingChecksum).toBe(
      "f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5",
    );
  });
});
