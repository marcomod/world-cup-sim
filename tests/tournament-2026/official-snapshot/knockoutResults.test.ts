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
  simulateMixedOfficialBracket,
} from "@/src/lib/tournament-2026/bracket";
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
const emptySource = readJson<KnockoutResultsSource>(OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE);
const simulatorInput = readJson<SimulatorInputArtifact>(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE);

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
      ...emptySource,
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
  it("builds and verifies the checked-in empty source as all pending", () => {
    const artifact = buildWithResults([]);

    expect(artifact.completedMatchCount).toBe(0);
    expect(artifact.pendingMatchCount).toBe(32);
    expect(artifact.completedMatches).toEqual([]);
    expect(artifact.pendingMatches.map((match) => match.matchId)).toEqual(
      Array.from({ length: 32 }, (_, index) => `m${index + 73}`),
    );
    expect(artifact.pendingMatches.find((match) => match.matchId === "m73")).toMatchObject({
      knownParticipants: {
        participantA: { teamId: "rsa" },
        participantB: { teamId: "can" },
      },
      unresolvedParticipantSlots: {},
    });
    expect(artifact.pendingMatches.find((match) => match.matchId === "m90")).toMatchObject({
      unresolvedParticipantSlots: {
        participantA: "winner of m73",
        participantB: "winner of m75",
      },
    });
    expect(verifyKnockoutResults()).toMatchObject({
      completedMatchCount: 0,
      pendingMatchCount: 32,
      resultChecksum: artifact.resultChecksum,
    });
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
          ...emptySource,
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
        source: { ...emptySource, results: [m73Result] },
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
        source: { ...emptySource, results: [m73Result] },
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
    const artifact = buildWithResults([]);
    const canonicalText = stableJson(artifact);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: emptySource,
        artifactText: canonicalText,
      }),
    ).not.toThrow();
  });

  it("rejects semantic-equivalent raw artifact text when object keys are reordered", () => {
    const artifact = buildWithResults([]);
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
        source: emptySource,
        artifactText: stableJson(reordered),
      }),
    ).toThrow(/raw bytes differ.*regenerate/i);
  });

  it("rejects semantic-equivalent raw artifact text when whitespace is not canonical", () => {
    const artifact = buildWithResults([]);

    expect(() =>
      verifyKnockoutResultsArtifacts({
        qualification,
        roundOf32,
        source: emptySource,
        artifactText: `${JSON.stringify(artifact, null, 4)}\n`,
      }),
    ).toThrow(/raw bytes differ.*regenerate/i);
  });
});

describe("mixed official knockout simulator adapter", () => {
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
