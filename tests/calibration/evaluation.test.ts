import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  calculateBrierScore,
  calculateCalibrationBuckets,
  calculateClassificationAccuracy,
  calculateEvaluationMetrics,
  calculateLogLoss,
  createEvaluationArtifacts,
  evaluateHistoricalObservations,
  selectEvaluationCohort,
  type EvaluationObservation,
  type EvaluationReportMetadata,
  type EvaluationResult,
} from "@/scripts/calibration/evaluation";
import type { HistoricalPredictionObservation } from "@/scripts/calibration/sequential-elo";

const OBSERVATIONS_PATH =
  "data/generated/calibration/historical-elo/observations.json";
const EVALUATION_METADATA_PATH =
  "data/generated/calibration/evaluation/metadata.json";

function createEvaluationObservation(
  overrides: Partial<EvaluationObservation> = {},
): EvaluationObservation {
  return {
    matchId: "evaluation-match",
    tournamentYear: 2018,
    date: "2018-06-01",
    stage: "group_stage",
    homeTeamId: "home",
    awayTeamId: "away",
    predictedProbability: 0.7,
    observedOutcome: 1,
    ...overrides,
  };
}

function createHistoricalObservation(
  overrides: Partial<HistoricalPredictionObservation> = {},
): HistoricalPredictionObservation {
  const observation: HistoricalPredictionObservation = {
    matchId: "historical-match",
    tournamentYear: 2018,
    date: "2018-06-01",
    stage: "group_stage",
    homeTeamId: "home",
    awayTeamId: "away",
    preMatchHomeRating: 1500,
    preMatchAwayRating: 1500,
    predictedHomeScore: 0.5,
    observedHomeScore: 1,
    outcomeStatus: "decisive",
    winnerTeamId: "home",
    wentToExtraTime: false,
    decidedByPenalties: false,
    ...overrides,
  };

  if (overrides.tournamentYear !== undefined && overrides.date === undefined) {
    observation.date = `${overrides.tournamentYear}-06-01`;
  }

  return observation;
}

function createTestEvaluationMetadata(): EvaluationReportMetadata {
  return {
    generatedFileWarning: "Do not edit manually.",
    evaluationModelVersion: "historical-elo-evaluation-v1",
    sourceObservationFile: "test-observations.json",
    sourceObservationChecksumSha256: "test-checksum",
    sourceReconstructionMetadata: {
      generatedFileWarning: "Do not edit manually.",
      modelVersion: "sequential-elo-v1",
      matchCount: 0,
      teamCount: 0,
      firstDate: null,
      lastDate: null,
      multiMatchDateCount: 0,
      matchesOnMultiMatchDates: 0,
      maxMatchesOnSingleDate: 0,
      sameDayOrderingPolicy: "Test ordering policy.",
      config: {
        initialRating: 1500,
        kFactor: 20,
        divisor: 400,
        homeAdvantage: 0,
        penaltyUpdateOutcome: "draw",
        nonDecisiveUpdateOutcome: "draw",
      },
      sourceFile: "test-source.csv",
      sourceChecksumSha256: "test-source-checksum",
      numericPrecision: 6,
      numericSerializationPolicy: "Test numeric policy.",
      generationTimestampPolicy: "No timestamp.",
    },
    cohorts: [
      "all_matches",
      "knockout_only",
      "decisive_only",
      "knockout_decisive_only",
      "penalties_only",
      "extra_time_only",
    ],
    splits: ["development", "validation", "holdout", "full_history"],
    numericPrecision: 6,
    numericSerializationPolicy: "Test numeric policy.",
    generationTimestampPolicy: "No timestamp.",
    binaryTargetPolicy: "Test binary target policy.",
    sampleSizePolicy: "Test sample size policy.",
    knockoutStagePolicy: "Test knockout policy.",
    holdoutPolicy: "Test holdout policy.",
  };
}

function findResult(
  results: readonly EvaluationResult[],
  cohort: EvaluationResult["cohort"],
  split: EvaluationResult["split"],
): EvaluationResult {
  const result = results.find(
    (candidate) => candidate.cohort === cohort && candidate.split === split,
  );

  if (!result) {
    throw new Error(`Missing evaluation result for ${cohort}/${split}.`);
  }

  return result;
}

async function readFilesUnder(paths: string[]): Promise<{ path: string; contents: string }[]> {
  const files: { path: string; contents: string }[] = [];

  for (const path of paths) {
    const pathStat = await stat(path);
    if (pathStat.isDirectory()) {
      const entries = await readdir(path);
      files.push(...(await readFilesUnder(entries.map((entry) => `${path}/${entry}`))));
    } else if (/\.(ts|tsx)$/u.test(path)) {
      files.push({ path, contents: await readFile(path, "utf8") });
    }
  }

  return files;
}

describe("historical evaluation metrics", () => {
  it("calculates Brier score for perfect, known, and worse predictions", () => {
    const perfect = [
      createEvaluationObservation({ matchId: "p1", predictedProbability: 1 }),
      createEvaluationObservation({
        matchId: "p2",
        predictedProbability: 0,
        observedOutcome: 0,
      }),
    ];
    const known = [
      createEvaluationObservation({ matchId: "k1", predictedProbability: 0.8 }),
      createEvaluationObservation({
        matchId: "k2",
        predictedProbability: 0.3,
        observedOutcome: 0,
      }),
    ];
    const worse = known.map((observation) => ({
      ...observation,
      predictedProbability: 1 - observation.predictedProbability,
    }));

    expect(calculateBrierScore(perfect)).toBe(0);
    expect(calculateBrierScore(known)).toBeCloseTo(0.065, 14);
    expect(calculateBrierScore(worse)).toBeGreaterThan(calculateBrierScore(known));
  });

  it("calculates finite clipped log loss and rejects invalid probabilities", () => {
    const observations = [
      createEvaluationObservation({ matchId: "l1", predictedProbability: 0.8 }),
      createEvaluationObservation({
        matchId: "l2",
        predictedProbability: 0.3,
        observedOutcome: 0,
      }),
    ];
    const expected = (-Math.log(0.8) - Math.log(0.7)) / 2;

    expect(calculateLogLoss(observations)).toBeCloseTo(expected, 14);
    expect(Number.isFinite(calculateLogLoss([
      createEvaluationObservation({ matchId: "zero", predictedProbability: 0 }),
      createEvaluationObservation({
        matchId: "one",
        predictedProbability: 1,
        observedOutcome: 0,
      }),
    ]))).toBe(true);
    expect(() => calculateLogLoss([
      createEvaluationObservation({ predictedProbability: 1.1 }),
    ])).toThrow(/invalid predictedProbability/);
  });

  it("uses a home-win classification at exactly 0.5", () => {
    expect(calculateClassificationAccuracy([
      createEvaluationObservation({ predictedProbability: 0.5, observedOutcome: 1 }),
      createEvaluationObservation({
        matchId: "below",
        predictedProbability: 0.499,
        observedOutcome: 0,
      }),
    ])).toBe(1);
  });

  it("rejects empty, duplicate, and non-binary metric inputs", () => {
    expect(() => calculateBrierScore([])).toThrow(/at least one scored observation/);
    expect(() => calculateEvaluationMetrics([
      createEvaluationObservation(),
      createEvaluationObservation(),
    ])).toThrow(/Duplicate evaluation observation/);
    expect(() => calculateBrierScore([
      createEvaluationObservation({ observedOutcome: 0.5 as 0 | 1 }),
    ])).toThrow(/binary observedOutcome/);
  });
});

describe("evaluation calibration buckets", () => {
  it("places every exact internal boundary in its upper bucket", () => {
    const probabilities = Array.from({ length: 11 }, (_, index) => index / 10);
    const buckets = calculateCalibrationBuckets(
      probabilities.map((predictedProbability, index) =>
        createEvaluationObservation({
          matchId: `boundary-${index}`,
          predictedProbability,
        }),
      ),
    );

    expect(buckets[0].sampleSize).toBe(1);
    for (let index = 1; index < 9; index += 1) {
      expect(buckets[index].sampleSize, `bucket ${index}`).toBe(1);
    }
    expect(buckets[9].sampleSize).toBe(2);
    expect(buckets.reduce((sum, bucket) => sum + bucket.sampleSize, 0)).toBe(11);
  });

  it("uses fixed boundaries, includes 1.0 in the final bucket, and preserves empties", () => {
    const probabilities = [0, 0.099, 0.1, 0.899, 0.9, 1];
    const buckets = calculateCalibrationBuckets(
      probabilities.map((predictedProbability, index) =>
        createEvaluationObservation({
          matchId: `bucket-${index}`,
          predictedProbability,
          observedOutcome: index % 2 === 0 ? 1 : 0,
        }),
      ),
    );

    expect(buckets).toHaveLength(10);
    expect(buckets[0].sampleSize).toBe(2);
    expect(buckets[1].sampleSize).toBe(1);
    expect(buckets[8].sampleSize).toBe(1);
    expect(buckets[9].sampleSize).toBe(2);
    expect(buckets[9].includesUpperBound).toBe(true);
    expect(buckets[2]).toMatchObject({
      sampleSize: 0,
      meanPredictedProbability: null,
      observedHomeWinRate: null,
      absoluteCalibrationError: null,
    });
    expect(buckets.reduce((sum, bucket) => sum + bucket.sampleSize, 0)).toBe(
      probabilities.length,
    );
  });
});

describe("evaluation cohorts and splits", () => {
  const observations = [
    createHistoricalObservation({ matchId: "group-decisive", tournamentYear: 2006 }),
    createHistoricalObservation({
      matchId: "draw",
      tournamentYear: 2010,
      observedHomeScore: 0.5,
      outcomeStatus: "draw",
      winnerTeamId: null,
    }),
    createHistoricalObservation({
      matchId: "non-decisive",
      tournamentYear: 2018,
      stage: "quarterfinal",
      observedHomeScore: 0.5,
      outcomeStatus: "non_decisive",
      winnerTeamId: null,
      wentToExtraTime: true,
    }),
    createHistoricalObservation({
      matchId: "penalties",
      tournamentYear: 2022,
      stage: "round_of_16",
      observedHomeScore: 0.5,
      wentToExtraTime: true,
      decidedByPenalties: true,
    }),
    createHistoricalObservation({
      matchId: "knockout-decisive",
      tournamentYear: 2022,
      stage: "semifinal",
    }),
  ];

  it("excludes draws, replay ties, and penalties from decisive binary scoring", () => {
    const all = selectEvaluationCohort({
      observations,
      cohort: "all_matches",
      split: "full_history",
    });
    const decisive = selectEvaluationCohort({
      observations,
      cohort: "decisive_only",
      split: "full_history",
    });
    const penalties = selectEvaluationCohort({
      observations,
      cohort: "penalties_only",
      split: "full_history",
    });

    expect(all.selectedObservations).toHaveLength(5);
    expect(all.scoredObservations.map((observation) => observation.matchId)).toEqual([
      "group-decisive",
      "knockout-decisive",
    ]);
    expect(decisive.selectedObservations).toHaveLength(2);
    expect(penalties.selectedObservations).toHaveLength(1);
    expect(penalties.scoredObservations).toEqual([]);
  });

  it("selects knockout and extra-time stages without changing binary policy", () => {
    const knockout = selectEvaluationCohort({
      observations,
      cohort: "knockout_only",
      split: "full_history",
    });
    const extraTime = selectEvaluationCohort({
      observations,
      cohort: "extra_time_only",
      split: "full_history",
    });

    expect(knockout.selectedObservations.map((observation) => observation.matchId)).toEqual([
      "non-decisive",
      "knockout-decisive",
      "penalties",
    ]);
    expect(knockout.scoredObservations.map((observation) => observation.matchId)).toEqual([
      "knockout-decisive",
    ]);
    expect(extraTime.selectedObservations).toHaveLength(2);
    expect(extraTime.scoredObservations).toEqual([]);
  });

  it("includes group-stage play-offs and excludes final group stages from knockout", () => {
    const stageObservations = [
      createHistoricalObservation({
        matchId: "playoff-decisive",
        stage: "group_stage_playoff",
      }),
      createHistoricalObservation({
        matchId: "playoff-penalties",
        stage: "group_stage_playoff",
        observedHomeScore: 0.5,
        wentToExtraTime: true,
        decidedByPenalties: true,
      }),
      createHistoricalObservation({
        matchId: "final-group",
        stage: "final_group_stage",
      }),
    ];
    const knockout = selectEvaluationCohort({
      observations: stageObservations,
      cohort: "knockout_only",
      split: "full_history",
    });
    const knockoutDecisive = selectEvaluationCohort({
      observations: stageObservations,
      cohort: "knockout_decisive_only",
      split: "full_history",
    });

    expect(knockout.selectedObservations.map((observation) => observation.matchId)).toEqual([
      "playoff-decisive",
      "playoff-penalties",
    ]);
    expect(knockoutDecisive.selectedObservations.map(
      (observation) => observation.matchId,
    )).toEqual(["playoff-decisive"]);
  });

  it("uses the documented tournament-year split boundaries", () => {
    for (const [split, expectedIds] of [
      ["development", ["group-decisive"]],
      ["validation", ["draw", "non-decisive"]],
      ["holdout", ["knockout-decisive", "penalties"]],
    ] as const) {
      expect(selectEvaluationCohort({
        observations,
        cohort: "all_matches",
        split,
      }).selectedObservations.map((observation) => observation.matchId)).toEqual(
        expectedIds,
      );
    }
  });

  it("rejects malformed cohort and split names", () => {
    expect(() => selectEvaluationCohort({
      observations,
      cohort: "unknown" as "all_matches",
      split: "full_history",
    })).toThrow(/Unknown evaluation cohort/);
    expect(() => selectEvaluationCohort({
      observations,
      cohort: "all_matches",
      split: "unknown" as "full_history",
    })).toThrow(/Unknown evaluation split/);
  });

  it("rejects malformed source observations before cohort classification", () => {
    const invalidCases: Array<{
      label: string;
      overrides: Partial<HistoricalPredictionObservation>;
      expected: RegExp;
    }> = [
      { label: "unknown stage", overrides: { stage: "unknown" as "final" }, expected: /unknown stage/ },
      { label: "unknown outcome", overrides: { outcomeStatus: "unknown" as "draw" }, expected: /unknown outcomeStatus/ },
      { label: "year zero", overrides: { tournamentYear: 0 }, expected: /unsupported tournamentYear/ },
      { label: "negative year", overrides: { tournamentYear: -1930 }, expected: /unsupported tournamentYear/ },
      { label: "fractional year", overrides: { tournamentYear: 2018.5 }, expected: /unsupported tournamentYear/ },
      { label: "unsupported year", overrides: { tournamentYear: 2016 }, expected: /unsupported tournamentYear/ },
      { label: "invalid date", overrides: { date: "2018-02-30" }, expected: /invalid date/ },
      { label: "invalid probability", overrides: { predictedHomeScore: Number.NaN }, expected: /invalid predictedHomeScore/ },
      { label: "out-of-range probability", overrides: { predictedHomeScore: 1.1 }, expected: /invalid predictedHomeScore/ },
      { label: "extra-time string", overrides: { wentToExtraTime: "true" as unknown as boolean }, expected: /invalid decision metadata/ },
      { label: "penalty number", overrides: { decidedByPenalties: 1 as unknown as boolean }, expected: /invalid decision metadata/ },
      { label: "identical teams", overrides: { awayTeamId: "home" }, expected: /same team twice/ },
      { label: "invalid winner", overrides: { winnerTeamId: "third" }, expected: /invalid decisive winner/ },
      { label: "draw winner", overrides: { outcomeStatus: "draw", observedHomeScore: 0.5 }, expected: /inconsistent draw metadata/ },
    ];

    for (const invalidCase of invalidCases) {
      expect(() => selectEvaluationCohort({
        observations: [createHistoricalObservation({
          matchId: `invalid-${invalidCase.label}`,
          ...invalidCase.overrides,
        })],
        cohort: "all_matches",
        split: "full_history",
      }), invalidCase.label).toThrow(invalidCase.expected);
    }

    for (const matchId of [undefined, null, 42, {}, "", "   "] as unknown[]) {
      expect(() => selectEvaluationCohort({
        observations: [createHistoricalObservation({ matchId: matchId as string })],
        cohort: "all_matches",
        split: "full_history",
      })).toThrow(/<unknown>.*invalid matchId/);
    }
  });

  it("rejects every malformed boolean form and accepts true and false", () => {
    const malformedBooleans: unknown[] = [
      null,
      undefined,
      {},
      [],
      "true",
      1,
    ];

    for (const field of ["wentToExtraTime", "decidedByPenalties"] as const) {
      for (const value of malformedBooleans) {
        expect(() => selectEvaluationCohort({
          observations: [createHistoricalObservation({
            [field]: value as boolean,
          })],
          cohort: "all_matches",
          split: "full_history",
        }), `${field}: ${String(value)}`).toThrow(/invalid decision metadata/);
      }
    }

    for (const wentToExtraTime of [false, true]) {
      expect(() => selectEvaluationCohort({
        observations: [createHistoricalObservation({ wentToExtraTime })],
        cohort: "all_matches",
        split: "full_history",
      })).not.toThrow();
    }

    expect(() => selectEvaluationCohort({
      observations: [createHistoricalObservation({ decidedByPenalties: false })],
      cohort: "all_matches",
      split: "full_history",
    })).not.toThrow();
    expect(() => selectEvaluationCohort({
      observations: [createHistoricalObservation({
        observedHomeScore: 0.5,
        wentToExtraTime: true,
        decidedByPenalties: true,
      })],
      cohort: "all_matches",
      split: "full_history",
    })).not.toThrow();
  });
});

describe("zero-scored public evaluation results", () => {
  it("returns null metrics for an empty split and a draw-only decisive cohort", () => {
    const draw = createHistoricalObservation({
      matchId: "draw-only",
      observedHomeScore: 0.5,
      outcomeStatus: "draw",
      winnerTeamId: null,
    });
    const report = evaluateHistoricalObservations({
      observations: [draw],
      metadata: createTestEvaluationMetadata(),
    });

    expect(findResult(report.results, "all_matches", "holdout")).toMatchObject({
      selectedSampleSize: 0,
      scoredSampleSize: 0,
      excludedFromBinaryScoring: 0,
      metrics: null,
    });
    expect(findResult(report.results, "decisive_only", "full_history")).toMatchObject({
      selectedSampleSize: 0,
      scoredSampleSize: 0,
      excludedFromBinaryScoring: 0,
      metrics: null,
    });
    expect(findResult(report.results, "all_matches", "full_history")).toMatchObject({
      selectedSampleSize: 1,
      scoredSampleSize: 0,
      excludedFromBinaryScoring: 1,
      metrics: null,
    });
  });

  it("returns null metrics when knockout shootouts are entirely excluded", () => {
    const shootout = createHistoricalObservation({
      matchId: "shootout-only",
      tournamentYear: 2022,
      stage: "round_of_16",
      observedHomeScore: 0.5,
      wentToExtraTime: true,
      decidedByPenalties: true,
    });
    const report = evaluateHistoricalObservations({
      observations: [shootout],
      metadata: createTestEvaluationMetadata(),
    });

    expect(findResult(report.results, "knockout_only", "full_history")).toMatchObject({
      selectedSampleSize: 1,
      scoredSampleSize: 0,
      excludedFromBinaryScoring: 1,
      metrics: null,
    });
  });

  it("creates all 24 deterministic null-metric results for empty input", () => {
    const first = evaluateHistoricalObservations({
      observations: [],
      metadata: createTestEvaluationMetadata(),
    });
    const second = evaluateHistoricalObservations({
      observations: [],
      metadata: createTestEvaluationMetadata(),
    });

    expect(first).toEqual(second);
    expect(first.results).toHaveLength(24);
    for (const result of first.results) {
      expect(result).toMatchObject({
        selectedSampleSize: 0,
        scoredSampleSize: 0,
        excludedFromBinaryScoring: 0,
        metrics: null,
      });
    }
  });
});

describe("evaluation determinism and integration", () => {
  it("produces the same report and bytes when source order is reversed", async () => {
    const observationDocument = JSON.parse(
      await readFile(OBSERVATIONS_PATH, "utf8"),
    ) as { observations: HistoricalPredictionObservation[] };
    const metadata = JSON.parse(
      await readFile(EVALUATION_METADATA_PATH, "utf8"),
    ) as EvaluationReportMetadata;
    const forward = evaluateHistoricalObservations({
      observations: observationDocument.observations,
      metadata,
    });
    const reversed = evaluateHistoricalObservations({
      observations: [...observationDocument.observations].reverse(),
      metadata,
    });

    expect(reversed).toEqual(forward);
    expect(createEvaluationArtifacts(reversed)).toEqual(
      createEvaluationArtifacts(forward),
    );
  });

  it("matches checked-in artifacts and validates real cohort results", async () => {
    const observationDocument = JSON.parse(
      await readFile(OBSERVATIONS_PATH, "utf8"),
    ) as { observations: HistoricalPredictionObservation[] };
    const metadata = JSON.parse(
      await readFile(EVALUATION_METADATA_PATH, "utf8"),
    ) as EvaluationReportMetadata;
    const report = evaluateHistoricalObservations({
      observations: observationDocument.observations,
      metadata,
    });
    const artifacts = createEvaluationArtifacts(report);
    const [summaryJson, byCohortJson, metadataJson] = await Promise.all([
      readFile("data/generated/calibration/evaluation/summary.json", "utf8"),
      readFile("data/generated/calibration/evaluation/by-cohort.json", "utf8"),
      readFile(EVALUATION_METADATA_PATH, "utf8"),
    ]);

    expect(observationDocument.observations).toHaveLength(964);
    expect(artifacts.summaryJson).toBe(summaryJson);
    expect(artifacts.byCohortJson).toBe(byCohortJson);
    expect(artifacts.metadataJson).toBe(metadataJson);

    const expectedCounts: Record<string, readonly [number, number]> = {
      "all_matches/development": [708, 551],
      "all_matches/validation": [192, 150],
      "all_matches/holdout": [64, 49],
      "all_matches/full_history": [964, 750],
      "knockout_only/development": [187, 163],
      "knockout_only/validation": [48, 38],
      "knockout_only/holdout": [16, 11],
      "knockout_only/full_history": [251, 212],
      "decisive_only/development": [551, 551],
      "decisive_only/validation": [150, 150],
      "decisive_only/holdout": [49, 49],
      "decisive_only/full_history": [750, 750],
      "knockout_decisive_only/development": [163, 163],
      "knockout_decisive_only/validation": [38, 38],
      "knockout_decisive_only/holdout": [11, 11],
      "knockout_decisive_only/full_history": [212, 212],
      "penalties_only/development": [20, 0],
      "penalties_only/validation": [10, 0],
      "penalties_only/holdout": [5, 0],
      "penalties_only/full_history": [35, 0],
      "extra_time_only/development": [51, 25],
      "extra_time_only/validation": [17, 7],
      "extra_time_only/holdout": [5, 0],
      "extra_time_only/full_history": [73, 32],
    };

    expect(report.results).toHaveLength(24);
    for (const result of report.results) {
      const expected = expectedCounts[`${result.cohort}/${result.split}`];
      expect(
        [result.selectedSampleSize, result.scoredSampleSize],
        `${result.cohort}/${result.split}`,
      ).toEqual(expected);
      expect(result.selectedSampleSize).toBe(
        result.scoredSampleSize + result.excludedFromBinaryScoring,
      );
      expect(result.metrics?.sampleSize ?? 0).toBe(result.scoredSampleSize);
      if (result.metrics) {
        expect(result.metrics.calibrationBuckets.reduce(
          (sum, bucket) => sum + bucket.sampleSize,
          0,
        )).toBe(result.scoredSampleSize);
      }
    }

    expect(report.results.find(
      (result) => result.cohort === "penalties_only" && result.split === "full_history",
    )).toMatchObject({ scoredSampleSize: 0, metrics: null });
    expect(report.results.find(
      (result) => result.cohort === "extra_time_only" && result.split === "holdout",
    )).toMatchObject({ scoredSampleSize: 0, metrics: null });

    const decisive = report.results.find(
      (result) => result.cohort === "decisive_only" && result.split === "full_history",
    );
    expect(decisive?.metrics?.sampleSize).toBe(750);
    expect(report.results.every((result) => result.metrics === null || [
      result.metrics.brierScore,
      result.metrics.logLoss,
      result.metrics.accuracy,
    ].every(Number.isFinite))).toBe(true);

    const holdout = selectEvaluationCohort({
      observations: observationDocument.observations,
      cohort: "all_matches",
      split: "holdout",
    });
    expect(new Set(
      holdout.selectedObservations.map((observation) => observation.tournamentYear),
    )).toEqual(new Set([2022]));
    expect(holdout.scoredObservations).toHaveLength(49);

    const development = selectEvaluationCohort({
      observations: observationDocument.observations,
      cohort: "all_matches",
      split: "development",
    });
    const validation = selectEvaluationCohort({
      observations: observationDocument.observations,
      cohort: "all_matches",
      split: "validation",
    });
    const splitIdSets = [development, validation, holdout].map(
      (selection) => new Set(
        selection.selectedObservations.map((observation) => observation.matchId),
      ),
    );

    expect(new Set(splitIdSets.flatMap((ids) => [...ids])).size).toBe(964);
    expect([...splitIdSets[0]].some((id) => splitIdSets[1].has(id))).toBe(false);
    expect([...splitIdSets[0]].some((id) => splitIdSets[2].has(id))).toBe(false);
    expect([...splitIdSets[1]].some((id) => splitIdSets[2].has(id))).toBe(false);
  });

  it("keeps evaluation code and artifacts out of runtime modules", async () => {
    const files = await readFilesUnder([
      "app",
      "src/components",
      "src/lib/simulator",
      "src/data/teamRatingsV2.ts",
    ]);
    const forbiddenImport = /scripts\/calibration|generated\/calibration/u;

    for (const file of files) {
      expect(file.contents, file.path).not.toMatch(forbiddenImport);
    }
  });
});
