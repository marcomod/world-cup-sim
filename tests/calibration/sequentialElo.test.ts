import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type {
  HistoricalTeamId,
  NormalizedHistoricalMatch,
} from "@/scripts/historical-pipeline/schemas";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  loadValidatedHistoricalDataset,
} from "@/scripts/historical-pipeline/validateHistoricalDataset";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  calculateHistoricalEloExpectedScore,
  compareCodePoints,
  createHistoricalEloArtifacts,
  createHistoricalEloGeneratedMetadata,
  getObservedHomeScore,
  reconstructHistoricalElo,
  roundForSerialization,
  updateHistoricalEloRatings,
} from "@/scripts/calibration/sequential-elo";

const SOURCE_CHECKSUM =
  "60229eccd1652be38de9e8945696393b89cf3e482ded26cce7a20ed0c4f043ab";

function createMatch(
  overrides: Partial<NormalizedHistoricalMatch> = {},
): NormalizedHistoricalMatch {
  return {
    matchId: "historical:test-match",
    sourceMatchId: "test-match",
    tournamentYear: 2002,
    date: "2002-06-01",
    stage: "group_stage",
    teamAId: "team-a",
    teamBId: "team-b",
    teamAGoals: 1,
    teamBGoals: 0,
    wentToExtraTime: false,
    wentToPenalties: false,
    source: "test",
    outcomeStatus: "decisive",
    winnerTeamId: "team-a",
    ...overrides,
  } as NormalizedHistoricalMatch;
}

async function readFilesUnder(paths: string[]): Promise<{ path: string; contents: string }[]> {
  const files: { path: string; contents: string }[] = [];

  for (const path of paths) {
    const pathStat = await stat(path);

    if (pathStat.isDirectory()) {
      const entries = await readdir(path);
      files.push(...(await readFilesUnder(entries.map((entry) => `${path}/${entry}`))));
      continue;
    }

    if (/\.(ts|tsx)$/u.test(path)) {
      files.push({ path, contents: await readFile(path, "utf8") });
    }
  }

  return files;
}

describe("sequential Elo expected score", () => {
  it("returns 0.5 for equal ratings and respects rating direction", () => {
    expect(
      calculateHistoricalEloExpectedScore({
        homeRating: 1500,
        awayRating: 1500,
        divisor: 400,
      }),
    ).toBe(0.5);
    expect(
      calculateHistoricalEloExpectedScore({
        homeRating: 1600,
        awayRating: 1500,
        divisor: 400,
      }),
    ).toBeGreaterThan(0.5);
    expect(
      calculateHistoricalEloExpectedScore({
        homeRating: 1400,
        awayRating: 1500,
        divisor: 400,
      }),
    ).toBeLessThan(0.5);
  });

  it("is symmetric when teams are swapped with zero home advantage", () => {
    const home = calculateHistoricalEloExpectedScore({
      homeRating: 1675,
      awayRating: 1510,
      divisor: 400,
      homeAdvantage: 0,
    });
    const away = calculateHistoricalEloExpectedScore({
      homeRating: 1510,
      awayRating: 1675,
      divisor: 400,
      homeAdvantage: 0,
    });

    expect(home + away).toBeCloseTo(1, 14);
  });

  it("rejects invalid divisors and non-finite ratings", () => {
    expect(() =>
      calculateHistoricalEloExpectedScore({
        homeRating: 1500,
        awayRating: 1500,
        divisor: 0,
      }),
    ).toThrow(/divisor must be a positive finite number/);
    expect(() =>
      calculateHistoricalEloExpectedScore({
        homeRating: Number.NaN,
        awayRating: 1500,
        divisor: 400,
      }),
    ).toThrow(/homeRating must be finite/);
  });

  it("keeps extreme finite rating gaps strictly within probability bounds", () => {
    const strongHome = calculateHistoricalEloExpectedScore({
      homeRating: 10000,
      awayRating: -10000,
      divisor: 400,
    });
    const weakHome = calculateHistoricalEloExpectedScore({
      homeRating: -10000,
      awayRating: 10000,
      divisor: 400,
    });

    expect(Number.isFinite(strongHome)).toBe(true);
    expect(Number.isFinite(weakHome)).toBe(true);
    expect(strongHome).toBeGreaterThan(0.5);
    expect(strongHome).toBeLessThan(1);
    expect(weakHome).toBeGreaterThan(0);
    expect(weakHome).toBeLessThan(0.5);
    expect(strongHome + weakHome).toBeCloseTo(1, 15);
  });

  it("retains the standard formula for ordinary rating differences", () => {
    const expected = 1 / (1 + 10 ** ((1500 - 1600) / 400));

    expect(
      calculateHistoricalEloExpectedScore({
        homeRating: 1600,
        awayRating: 1500,
        divisor: 400,
      }),
    ).toBeCloseTo(expected, 15);
  });
});

describe("sequential Elo rating updates", () => {
  it("moves ratings in the observed direction and preserves their sum", () => {
    const homeWin = updateHistoricalEloRatings({
      homeRating: 1500,
      awayRating: 1500,
      expectedHomeScore: 0.5,
      observedHomeScore: 1,
      kFactor: 20,
    });
    const awayWin = updateHistoricalEloRatings({
      homeRating: 1500,
      awayRating: 1500,
      expectedHomeScore: 0.5,
      observedHomeScore: 0,
      kFactor: 20,
    });

    expect(homeWin.postMatchHomeRating).toBeGreaterThan(1500);
    expect(homeWin.postMatchAwayRating).toBeLessThan(1500);
    expect(awayWin.postMatchHomeRating).toBeLessThan(1500);
    expect(
      homeWin.postMatchHomeRating + homeWin.postMatchAwayRating,
    ).toBeCloseTo(3000, 14);
  });

  it("moves a draw toward equality and leaves equal ratings unchanged", () => {
    const unequal = updateHistoricalEloRatings({
      homeRating: 1600,
      awayRating: 1400,
      expectedHomeScore: 0.75,
      observedHomeScore: 0.5,
      kFactor: 20,
    });
    const equal = updateHistoricalEloRatings({
      homeRating: 1500,
      awayRating: 1500,
      expectedHomeScore: 0.5,
      observedHomeScore: 0.5,
      kFactor: 20,
    });

    expect(unequal.postMatchHomeRating).toBeLessThan(1600);
    expect(unequal.postMatchAwayRating).toBeGreaterThan(1400);
    expect(equal.postMatchHomeRating).toBe(1500);
    expect(equal.postMatchAwayRating).toBe(1500);
  });

  it("uses both pre-match ratings and supports a zero K-factor", () => {
    const update = updateHistoricalEloRatings({
      homeRating: 1700,
      awayRating: 1300,
      expectedHomeScore: 0.9,
      observedHomeScore: 0,
      kFactor: 0,
    });

    expect(update).toEqual({
      preMatchHomeRating: 1700,
      preMatchAwayRating: 1300,
      postMatchHomeRating: 1700,
      postMatchAwayRating: 1300,
    });
  });
});

describe("historical outcome conversion", () => {
  it("maps decisive home and away wins to 1 and 0", () => {
    expect(getObservedHomeScore(createMatch())).toBe(1);
    expect(
      getObservedHomeScore(
        createMatch({ teamAGoals: 0, teamBGoals: 1, winnerTeamId: "team-b" }),
      ),
    ).toBe(0);
  });

  it("maps group draws, non-decisive ties, and shootouts to 0.5", () => {
    expect(
      getObservedHomeScore(
        createMatch({
          teamAGoals: 1,
          teamBGoals: 1,
          outcomeStatus: "draw",
          winnerTeamId: null,
        }),
      ),
    ).toBe(0.5);
    expect(
      getObservedHomeScore(
        createMatch({
          stage: "quarterfinal",
          teamAGoals: 1,
          teamBGoals: 1,
          wentToExtraTime: true,
          outcomeStatus: "non_decisive",
          winnerTeamId: null,
        }),
      ),
    ).toBe(0.5);
    expect(
      getObservedHomeScore(
        createMatch({
          stage: "round_of_16",
          teamAGoals: 1,
          teamBGoals: 1,
          wentToExtraTime: true,
          wentToPenalties: true,
          teamAPenaltyGoals: 4,
          teamBPenaltyGoals: 3,
          winnerTeamId: "team-a",
        }),
      ),
    ).toBe(0.5);
  });
});

describe("sequential historical Elo reconstruction", () => {
  const firstMatch = createMatch({ matchId: "match-a", date: "2002-06-01" });
  const secondMatch = createMatch({
    matchId: "match-b",
    date: "2002-06-02",
    teamAId: "team-a",
    teamBId: "team-c",
    winnerTeamId: "team-c",
    teamAGoals: 0,
    teamBGoals: 1,
  });

  it("records predictions before simultaneous updates and carries ratings forward", () => {
    const result = reconstructHistoricalElo([firstMatch, secondMatch]);

    expect(result.observations[0]).toMatchObject({
      preMatchHomeRating: 1500,
      preMatchAwayRating: 1500,
      predictedHomeScore: 0.5,
    });
    expect(result.observations[1].preMatchHomeRating).toBeGreaterThan(1500);
    expect(result.observations[1].preMatchAwayRating).toBe(1500);
    expect(result.updates[0].postMatchHomeRating).toBe(
      result.observations[1].preMatchHomeRating,
    );
  });

  it("sorts independently of caller order and uses match ID for same-day ties", () => {
    const sameDayA = createMatch({ matchId: "same-day:a", date: "2002-06-03" });
    const sameDayB = createMatch({ matchId: "same-day:b", date: "2002-06-03" });
    const forward = reconstructHistoricalElo([sameDayB, secondMatch, sameDayA]);
    const reversed = reconstructHistoricalElo([sameDayA, secondMatch, sameDayB]);

    expect(forward).toEqual(reversed);
    expect(forward.observations.map((observation) => observation.matchId)).toEqual([
      "match-b",
      "same-day:a",
      "same-day:b",
    ]);
    expect(forward.metadata.multiMatchDateCount).toBe(1);
    expect(forward.metadata.matchesOnMultiMatchDates).toBe(2);
  });

  it("uses locale-independent code-point ordering for match and team IDs", () => {
    const ids = ["a", "A", "a-1", "a1", "10", "2", "_"];
    const expected = ["10", "2", "A", "_", "a", "a-1", "a1"];
    const orderedIds = [...ids].sort(compareCodePoints);
    const matches = ids.map((matchId, index) =>
      createMatch({
        matchId,
        teamAId: `home-${index}`,
        teamBId: matchId,
        winnerTeamId: `home-${index}`,
      }),
    );
    const result = reconstructHistoricalElo(matches.reverse());

    expect(orderedIds).toEqual(expected);
    expect(result.observations.map((observation) => observation.matchId)).toEqual(
      expected,
    );
    expect(result.finalRatings.map((team) => team.teamId)).toEqual(
      [...result.finalRatings.map((team) => team.teamId)].sort(compareCodePoints),
    );
  });

  it("does not let future matches change earlier observations", () => {
    const firstOnly = reconstructHistoricalElo([firstMatch]);
    const withFuture = reconstructHistoricalElo([firstMatch, secondMatch]);

    expect(withFuture.observations[0]).toEqual(firstOnly.observations[0]);
    expect(withFuture.updates[0]).toEqual(firstOnly.updates[0]);
  });

  it("keeps predecessor and successor identities in separate rating states", () => {
    const result = reconstructHistoricalElo([
      createMatch({
        matchId: "west-germany",
        teamAId: "west-germany",
        winnerTeamId: "west-germany",
      }),
      createMatch({
        matchId: "germany",
        date: "2002-06-02",
        teamAId: "ger",
        teamBId: "team-c",
        winnerTeamId: "ger",
      }),
    ]);
    const germanyObservation = result.observations.find(
      (observation) => observation.homeTeamId === "ger",
    );

    expect(germanyObservation?.preMatchHomeRating).toBe(1500);
    expect(result.finalRatings.map((team) => team.teamId)).toContain("west-germany");
    expect(result.finalRatings.map((team) => team.teamId)).toContain("ger");
  });

  it("is repeatable and does not mutate the input", () => {
    const input = [secondMatch, firstMatch];
    const original = structuredClone(input);

    expect(reconstructHistoricalElo(input)).toEqual(reconstructHistoricalElo(input));
    expect(input).toEqual(original);
  });

  it("supports empty input with explicit null date metadata", () => {
    const result = reconstructHistoricalElo([]);

    expect(result.observations).toEqual([]);
    expect(result.updates).toEqual([]);
    expect(result.finalRatings).toEqual([]);
    expect(result.metadata).toMatchObject({
      matchCount: 0,
      teamCount: 0,
      firstDate: null,
      lastDate: null,
      multiMatchDateCount: 0,
      matchesOnMultiMatchDates: 0,
      maxMatchesOnSingleDate: 0,
    });
  });

  it("rejects duplicate IDs and identical participating teams", () => {
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "duplicate" }),
        createMatch({ matchId: "duplicate", date: "2002-06-02" }),
      ]),
    ).toThrow(/duplicate matchId "duplicate"/);
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "same-team", teamBId: "team-a" }),
      ]),
    ).toThrow(/same-team.*same team twice/);
  });

  it("rejects every malformed match ID before reconstruction", () => {
    const malformedIds: unknown[] = [undefined, null, 42, {}, "", "   "];

    for (const matchId of malformedIds) {
      expect(() =>
        reconstructHistoricalElo([
          createMatch({ matchId: matchId as string }),
        ]),
      ).toThrow(/<unknown>.*invalid matchId.*non-empty string/);
    }

    expect(
      reconstructHistoricalElo([createMatch({ matchId: "valid-match-id" })])
        .observations[0].matchId,
    ).toBe("valid-match-id");
  });

  it("rejects invalid normalized winner combinations", () => {
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "null-winner", winnerTeamId: null }),
      ]),
    ).toThrow(/null-winner.*decisive.*null winner/);
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "outside-winner", winnerTeamId: "team-c" }),
      ]),
    ).toThrow(/outside-winner.*outside its participating teams/);

    for (const outcomeStatus of ["draw", "non_decisive"] as const) {
      expect(() =>
        reconstructHistoricalElo([
          createMatch({
            matchId: `${outcomeStatus}-winner`,
            teamAGoals: 1,
            teamBGoals: 1,
            outcomeStatus,
            winnerTeamId: "team-a",
          }),
        ]),
      ).toThrow(/non-null winner/);
    }
  });

  it("rejects malformed dates and penalty metadata", () => {
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "bad-date", date: "2002-02-30" }),
      ]),
    ).toThrow(/bad-date.*invalid date/);
    expect(() =>
      reconstructHistoricalElo([
        createMatch({
          matchId: "bad-penalties",
          teamAGoals: 1,
          teamBGoals: 1,
          wentToPenalties: true,
          winnerTeamId: "team-a",
        }),
      ]),
    ).toThrow(/bad-penalties.*penalties without extra time/);
  });

  it("rejects malformed normalized status and numeric match data", () => {
    expect(() =>
      reconstructHistoricalElo([
        createMatch({
          matchId: "bad-status",
          outcomeStatus: "unknown" as NormalizedHistoricalMatch["outcomeStatus"],
        }),
      ]),
    ).toThrow(/bad-status.*invalid outcomeStatus/);
    expect(() =>
      reconstructHistoricalElo([
        createMatch({ matchId: "bad-goals", teamAGoals: Number.NaN }),
      ]),
    ).toThrow(/bad-goals.*invalid teamAGoals/);
  });

  it("copies and freezes config metadata against later mutation", () => {
    const config = { ...BASELINE_SEQUENTIAL_ELO_CONFIG };
    const result = reconstructHistoricalElo([firstMatch], config);
    const originalMetadata = structuredClone(result.metadata);
    const originalObservations = structuredClone(result.observations);
    const originalFinalRatings = structuredClone(result.finalRatings);
    const originalArtifacts = createHistoricalEloArtifacts({
      result,
      metadata: createHistoricalEloGeneratedMetadata({
        result,
        sourceFile: EXPECTED_KAGGLE_MATCH_FILE,
        sourceChecksumSha256: SOURCE_CHECKSUM,
      }),
    });

    config.kFactor = 99;

    expect(result.metadata).toEqual(originalMetadata);
    expect(result.observations).toEqual(originalObservations);
    expect(result.finalRatings).toEqual(originalFinalRatings);
    expect(
      createHistoricalEloArtifacts({
        result,
        metadata: createHistoricalEloGeneratedMetadata({
          result,
          sourceFile: EXPECTED_KAGGLE_MATCH_FILE,
          sourceChecksumSha256: SOURCE_CHECKSUM,
        }),
      }),
    ).toEqual(originalArtifacts);
    expect(Object.isFrozen(result.metadata.config)).toBe(true);
    expect(() => Object.assign(result.metadata.config, { kFactor: 99 })).toThrow();
  });
});

describe("sequential Elo generated artifacts", () => {
  it("uses byte-stable six-decimal serialization and normalizes negative zero", () => {
    const result = reconstructHistoricalElo([
      createMatch({ matchId: "serialization-match" }),
    ]);
    const metadata = createHistoricalEloGeneratedMetadata({
      result,
      sourceFile: EXPECTED_KAGGLE_MATCH_FILE,
      sourceChecksumSha256: SOURCE_CHECKSUM,
    });
    const first = createHistoricalEloArtifacts({ result, metadata });
    const second = createHistoricalEloArtifacts({ result, metadata });

    expect(first).toEqual(second);
    expect(first.observationsJson.endsWith("\n")).toBe(true);
    expect(roundForSerialization(-0.0000001)).toBe(0);
    expect(roundForSerialization(1.123456789)).toBe(1.123457);
  });
});

describe("full historical Elo reconstruction", () => {
  const testIfSourceExists = existsSync(EXPECTED_KAGGLE_MATCH_FILE) ? it : it.skip;

  testIfSourceExists("reconstructs all validated matches without the 2026 snapshot", async () => {
    const validatedDataset = await loadValidatedHistoricalDataset();
    const result = reconstructHistoricalElo(
      validatedDataset.normalizedMatches,
      { ...BASELINE_SEQUENTIAL_ELO_CONFIG },
    );

    expect(result.metadata).toMatchObject({
      matchCount: 964,
      teamCount: 86,
      firstDate: "1930-07-13",
      lastDate: "2022-12-18",
      multiMatchDateCount: 297,
      matchesOnMultiMatchDates: 883,
      maxMatchesOnSingleDate: 8,
    });
    expect(result.observations).toHaveLength(964);

    const firstAppearance = new Set<HistoricalTeamId>();
    for (const observation of result.observations) {
      if (!firstAppearance.has(observation.homeTeamId)) {
        expect(observation.preMatchHomeRating).toBe(1500);
        firstAppearance.add(observation.homeTeamId);
      }
      if (!firstAppearance.has(observation.awayTeamId)) {
        expect(observation.preMatchAwayRating).toBe(1500);
        firstAppearance.add(observation.awayTeamId);
      }

      expect(observation.predictedHomeScore).toBe(
        calculateHistoricalEloExpectedScore({
          homeRating: observation.preMatchHomeRating,
          awayRating: observation.preMatchAwayRating,
          divisor: 400,
          homeAdvantage: 0,
        }),
      );
      expect(typeof observation.matchId).toBe("string");
      expect(observation.matchId.trim()).not.toBe("");
    }

    expect(firstAppearance.size).toBe(86);
    expect(JSON.stringify(result)).not.toContain("worldFootballEloDevelopment");
    expect(JSON.stringify(result)).not.toContain("2026-06-18");

    const metadata = createHistoricalEloGeneratedMetadata({
      result,
      sourceFile: EXPECTED_KAGGLE_MATCH_FILE,
      sourceChecksumSha256: SOURCE_CHECKSUM,
    });
    const artifacts = createHistoricalEloArtifacts({ result, metadata });
    const [observationsJson, finalRatingsJson, metadataJson] = await Promise.all([
      readFile(
        "data/generated/calibration/historical-elo/observations.json",
        "utf8",
      ),
      readFile(
        "data/generated/calibration/historical-elo/final-ratings.json",
        "utf8",
      ),
      readFile("data/generated/calibration/historical-elo/metadata.json", "utf8"),
    ]);

    expect(artifacts.observationsJson).toBe(observationsJson);
    expect(artifacts.finalRatingsJson).toBe(finalRatingsJson);
    expect(artifacts.metadataJson).toBe(metadataJson);
  });

  testIfSourceExists("has no team appearing twice on the same date", async () => {
    const validatedDataset = await loadValidatedHistoricalDataset();
    const teamDates = new Set<string>();

    for (const match of validatedDataset.normalizedMatches) {
      for (const teamId of [match.teamAId, match.teamBId]) {
        const key = `${match.date}|${teamId}`;
        expect(teamDates.has(key), key).toBe(false);
        teamDates.add(key);
      }
    }

    expect(validatedDataset.normalizedMatches).toHaveLength(964);
  });

  testIfSourceExists("reads historical source bytes once per validated load", async () => {
    let sourceReadCount = 0;

    await loadValidatedHistoricalDataset({}, {
      readSourceFile: async (filePath) => {
        sourceReadCount += 1;
        return readFile(filePath);
      },
    });

    expect(sourceReadCount).toBe(1);
  });
});

describe("calibration runtime isolation", () => {
  it("keeps sequential Elo code out of runtime modules", async () => {
    const files = await readFilesUnder([
      "app",
      "src/components",
      "src/lib/simulator",
      "src/data/teamRatingsV2.ts",
    ]);
    const forbiddenImport = /scripts\/calibration|calibration\/sequential-elo/u;

    for (const file of files) {
      expect(file.contents, file.path).not.toMatch(forbiddenImport);
    }
  });
});
