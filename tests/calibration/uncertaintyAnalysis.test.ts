import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  analyzeHistoricalEloUncertainty,
  calculateMeanDelta,
  calculateMetricLosses,
  calculatePairedBootstrap,
  classifyEvidence,
  createPairedLossObservations,
  createUncertaintyAnalysisArtifacts,
  FROZEN_UNCERTAINTY_PROTOCOL,
  quantileSorted,
  roundUncertaintyAnalysisNumber,
  type PairedLossObservation,
  type SplitUncertaintyResult,
  type UncertaintyAnalysisResult,
} from "@/scripts/calibration/uncertainty-analysis";
import type { HistoricalPredictionObservation } from "@/scripts/calibration/sequential-elo";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  loadValidatedHistoricalDataset,
  type ValidatedHistoricalDataset,
} from "@/scripts/historical-pipeline/validateHistoricalDataset";

const DIVISOR_COMPARISON_DIRECTORY =
  "data/generated/calibration/divisor-comparison";
const HOLDOUT_EVALUATION_DIRECTORY =
  "data/generated/calibration/holdout-evaluation";
const UNCERTAINTY_ANALYSIS_DIRECTORY =
  "data/generated/calibration/uncertainty-analysis";

async function readFilesUnder(
  paths: string[],
): Promise<Array<{ path: string; contents: string }>> {
  const files: Array<{ path: string; contents: string }> = [];

  for (const path of paths) {
    const pathStat = await stat(path);
    if (pathStat.isDirectory()) {
      const entries = await readdir(path);
      files.push(...await readFilesUnder(entries.map((entry) => `${path}/${entry}`)));
    } else if (/\.(ts|tsx)$/u.test(path)) {
      files.push({ path, contents: await readFile(path, "utf8") });
    }
  }

  return files;
}

function createObservation(input: {
  matchId: string;
  tournamentYear: number;
  probability: number;
  observed?: 0 | 1;
}): HistoricalPredictionObservation {
  return {
    matchId: input.matchId,
    tournamentYear: input.tournamentYear,
    date: `${input.tournamentYear}-07-01`,
    stage: "final",
    homeTeamId: "arg",
    awayTeamId: "bra",
    preMatchHomeRating: 1500,
    preMatchAwayRating: 1500,
    predictedHomeScore: input.probability,
    observedHomeScore: input.observed ?? 1,
    outcomeStatus: "decisive",
    winnerTeamId: "arg",
    wentToExtraTime: false,
    decidedByPenalties: false,
  };
}

function createPairedLoss(input: {
  matchId?: string;
  tournamentYear?: number;
  brierDelta: number;
  logLossDelta: number;
}): PairedLossObservation {
  return {
    matchId: input.matchId ?? "match-1",
    tournamentYear: input.tournamentYear ?? 2010,
    date: `${input.tournamentYear ?? 2010}-07-01`,
    split: "validation",
    observedOutcome: 1,
    selectedProbability: 0.7,
    referenceProbability: 0.6,
    selectedBrierLoss: 0.09,
    referenceBrierLoss: 0.16,
    brierDelta: input.brierDelta,
    selectedLogLoss: 0.3,
    referenceLogLoss: 0.5,
    logLossDelta: input.logLossDelta,
  };
}

function createMetricResult(input: {
  split: "development" | "validation" | "holdout";
  metric: "brierScore" | "logLoss";
  observedMeanDelta: number;
  upperBound: number;
}): SplitUncertaintyResult["brierScore"] {
  return {
    split: input.split,
    metric: input.metric,
    sampleSize: 10,
    observedMeanDelta: input.observedMeanDelta,
    observedTotalLossDifference: input.observedMeanDelta * 10,
    bootstrapMeanDelta: input.observedMeanDelta,
    bootstrapMedianDelta: input.observedMeanDelta,
    confidenceLevel: 0.95,
    lowerBound: input.observedMeanDelta - 0.01,
    upperBound: input.upperBound,
    proportionFavoringSelected: input.observedMeanDelta < 0 ? 1 : 0,
    proportionFavoringReference: input.observedMeanDelta > 0 ? 1 : 0,
    proportionEqual: 0,
    replicationCount: 100000,
    seed: 2026200400,
    method: "paired_match_percentile",
    deltaDirection: "selected_minus_reference",
  };
}

function createSplitResult(input: {
  split: "development" | "validation" | "holdout";
  brierDelta: number;
  brierUpperBound: number;
}): SplitUncertaintyResult {
  return {
    split: input.split,
    sampleSize: 10,
    brierScore: createMetricResult({
      split: input.split,
      metric: "brierScore",
      observedMeanDelta: input.brierDelta,
      upperBound: input.brierUpperBound,
    }),
    logLoss: createMetricResult({
      split: input.split,
      metric: "logLoss",
      observedMeanDelta: input.brierDelta,
      upperBound: input.brierUpperBound,
    }),
  };
}

async function getArtifactInputs(): Promise<
  Parameters<typeof analyzeHistoricalEloUncertainty>[0]["artifacts"]
> {
  const [
    divisorComparisonRankingJson,
    divisorComparisonCandidatesJson,
    divisorComparisonMetadataJson,
    holdoutResultJson,
    holdoutByCohortJson,
    holdoutMetadataJson,
  ] = await Promise.all([
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/ranking.json`, "utf8"),
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/candidates.json`, "utf8"),
    readFile(`${DIVISOR_COMPARISON_DIRECTORY}/metadata.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/result.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/by-cohort.json`, "utf8"),
    readFile(`${HOLDOUT_EVALUATION_DIRECTORY}/metadata.json`, "utf8"),
  ]);
  return {
    divisorComparisonRankingJson,
    divisorComparisonCandidatesJson,
    divisorComparisonMetadataJson,
    holdoutResultJson,
    holdoutByCohortJson,
    holdoutMetadataJson,
  };
}

describe("frozen uncertainty protocol", () => {
  it("uses the exact descriptive uncertainty protocol", () => {
    expect(FROZEN_UNCERTAINTY_PROTOCOL).toEqual({
      selectedDivisor: 200,
      referenceDivisor: 400,
      cohort: "knockout_decisive_only",
      metrics: ["brierScore", "logLoss"],
      deltaDirection: "selected_minus_reference",
      bootstrapMethod: "paired_match_percentile",
      bootstrapReplications: 100000,
      confidenceLevel: 0.95,
      seed: 2026200400,
      splits: ["development", "validation", "holdout"],
    });
    expect(Object.isFrozen(FROZEN_UNCERTAINTY_PROTOCOL)).toBe(true);
    expect(Object.isFrozen(FROZEN_UNCERTAINTY_PROTOCOL.metrics)).toBe(true);
    expect(Object.isFrozen(FROZEN_UNCERTAINTY_PROTOCOL.splits)).toBe(true);
  });

  it("cannot be mutated at runtime", () => {
    expect(() => {
      (FROZEN_UNCERTAINTY_PROTOCOL as { selectedDivisor: number }).selectedDivisor = 250;
    }).toThrow();
    expect(FROZEN_UNCERTAINTY_PROTOCOL.selectedDivisor).toBe(200);
  });
});

describe("paired uncertainty losses", () => {
  it("calculates per-match Brier and log-loss deltas as selected minus reference", () => {
    const selected = createObservation({
      matchId: "2010-final",
      tournamentYear: 2010,
      probability: 0.8,
    });
    const reference = createObservation({
      matchId: "2010-final",
      tournamentYear: 2010,
      probability: 0.6,
    });
    const losses = createPairedLossObservations({
      selectedObservations: [selected],
      referenceObservations: [reference],
    });

    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({
      matchId: "2010-final",
      split: "validation",
      brierDelta: expect.any(Number),
      logLossDelta: expect.any(Number),
    });
    expect(losses[0].brierDelta).toBeLessThan(0);
    expect(losses[0].logLossDelta).toBeLessThan(0);
    expect(calculateMetricLosses({
      matchId: "single",
      predictedProbability: 0.5,
      observedOutcome: 1,
    }).brierLoss)
      .toBe(0.25);
  });

  it("rejects selected-only, reference-only, and mismatched paired observations", () => {
    const selected = createObservation({
      matchId: "2010-final",
      tournamentYear: 2010,
      probability: 0.8,
    });
    const reference = createObservation({
      matchId: "2010-final",
      tournamentYear: 2010,
      probability: 0.6,
    });

    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [],
      }),
    ).toThrow(/Unmatched selected divisor.*2010-final/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [
          reference,
          createObservation({
            matchId: "2010-third-place",
            tournamentYear: 2010,
            probability: 0.7,
          }),
        ],
      }),
    ).toThrow(/Unmatched reference divisor.*2010-third-place/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [
          selected,
          createObservation({
            matchId: "2010-semi-final-a",
            tournamentYear: 2010,
            probability: 0.7,
          }),
        ],
        referenceObservations: [
          reference,
          createObservation({
            matchId: "2010-semi-final-b",
            tournamentYear: 2010,
            probability: 0.7,
          }),
        ],
      }),
    ).toThrow(/Unmatched selected divisor.*2010-semi-final-a/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected, selected],
        referenceObservations: [reference],
      }),
    ).toThrow(/Duplicate historical evaluation observation/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [reference, reference],
      }),
    ).toThrow(/Duplicate historical evaluation observation/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [
          {
            ...reference,
            observedHomeScore: 0,
            winnerTeamId: "bra",
          },
        ],
      }),
    ).toThrow(/mismatched actual result/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [
          {
            ...reference,
            tournamentYear: 2014,
            date: "2014-07-01",
          },
        ],
      }),
    ).toThrow(/mismatched tournament year/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [
          {
            ...reference,
            tournamentYear: 2022,
            date: "2022-07-01",
          },
        ],
      }),
    ).toThrow(/Unmatched selected divisor.*2010-final/);
    expect(() =>
      createPairedLossObservations({
        selectedObservations: [selected],
        referenceObservations: [
          {
            ...reference,
            stage: "group_stage",
          },
        ],
      }),
    ).toThrow(/Unmatched selected divisor.*2010-final/);
  });

  it("pairs exact match-ID sets regardless of input order", () => {
    const selected = [
      createObservation({
        matchId: "2010-final",
        tournamentYear: 2010,
        probability: 0.8,
      }),
      createObservation({
        matchId: "2010-semi-final",
        tournamentYear: 2010,
        probability: 0.65,
      }),
    ];
    const reference = [
      createObservation({
        matchId: "2010-semi-final",
        tournamentYear: 2010,
        probability: 0.55,
      }),
      createObservation({
        matchId: "2010-final",
        tournamentYear: 2010,
        probability: 0.6,
      }),
    ];

    expect(createPairedLossObservations({
      selectedObservations: selected,
      referenceObservations: reference,
    })).toEqual(createPairedLossObservations({
      selectedObservations: [...selected].reverse(),
      referenceObservations: [...reference].reverse(),
    }));
  });
});

describe("paired bootstrap", () => {
  it("uses deterministic percentile bootstrap output", () => {
    const observations = [
      createPairedLoss({ matchId: "a", brierDelta: -0.1, logLossDelta: -0.2 }),
      createPairedLoss({ matchId: "b", brierDelta: 0.03, logLossDelta: 0.04 }),
      createPairedLoss({ matchId: "c", brierDelta: -0.02, logLossDelta: -0.05 }),
    ];
    const result = calculatePairedBootstrap({
      observations,
      split: "validation",
      metric: "brierScore",
    });

    expect(result).toEqual(calculatePairedBootstrap({
      observations: [...observations].reverse(),
      split: "validation",
      metric: "brierScore",
    }));
    expect(result.sampleSize).toBe(3);
    expect(result.observedMeanDelta).toBeCloseTo(calculateMeanDelta(observations, "brierScore"));
    expect(result.lowerBound).toBeLessThanOrEqual(result.upperBound);
    expect(result.proportionFavoringSelected + result.proportionFavoringReference + result.proportionEqual)
      .toBeCloseTo(1);
  });

  it("reports exact ties deterministically", () => {
    const result = calculatePairedBootstrap({
      observations: [
        createPairedLoss({ matchId: "a", brierDelta: 0, logLossDelta: 0 }),
        createPairedLoss({ matchId: "b", brierDelta: 0, logLossDelta: 0 }),
      ],
      split: "validation",
      metric: "logLoss",
    });

    expect(result.observedMeanDelta).toBe(0);
    expect(result.lowerBound).toBe(0);
    expect(result.upperBound).toBe(0);
    expect(result.proportionEqual).toBe(1);
  });

  it("detects clearly selected-better and reference-better synthetic examples", () => {
    const selectedBetter = calculatePairedBootstrap({
      observations: [
        createPairedLoss({ matchId: "a", brierDelta: -0.1, logLossDelta: -0.2 }),
        createPairedLoss({ matchId: "b", brierDelta: -0.05, logLossDelta: -0.1 }),
      ],
      split: "validation",
      metric: "brierScore",
    });
    const referenceBetter = calculatePairedBootstrap({
      observations: [
        createPairedLoss({ matchId: "a", brierDelta: 0.1, logLossDelta: 0.2 }),
        createPairedLoss({ matchId: "b", brierDelta: 0.05, logLossDelta: 0.1 }),
      ],
      split: "validation",
      metric: "brierScore",
    });

    expect(selectedBetter.proportionFavoringSelected).toBe(1);
    expect(selectedBetter.proportionFavoringReference).toBe(0);
    expect(referenceBetter.proportionFavoringSelected).toBe(0);
    expect(referenceBetter.proportionFavoringReference).toBe(1);
  });

  it("uses standard quantile interpolation", () => {
    expect(quantileSorted([42], 0.025)).toBe(42);
    expect(quantileSorted([10, 20], 0)).toBe(10);
    expect(quantileSorted([10, 20], 0.025)).toBe(10.25);
    expect(quantileSorted([10, 20], 0.975)).toBe(19.75);
    expect(quantileSorted([10, 20], 1)).toBe(20);
    expect(quantileSorted([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.025)).toBe(1.1);
    expect(quantileSorted([1, 2, 3, 4, 5], 0.975)).toBe(4.9);
    expect(quantileSorted([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([2, 2, 2, 2], 0.975)).toBe(2);
    expect(quantileSorted([-10, -5, 5, 10], 0.5)).toBe(0);
  });
});

describe("uncertainty evidence classification", () => {
  const splitResults = {
    development: createSplitResult({
      split: "development",
      brierDelta: -0.001,
      brierUpperBound: 0.001,
    }),
    validation: createSplitResult({
      split: "validation",
      brierDelta: -0.01,
      brierUpperBound: -0.001,
    }),
    holdout: createSplitResult({
      split: "holdout",
      brierDelta: -0.005,
      brierUpperBound: 0.001,
    }),
  };

  it("classifies adoption-review support only when validation, holdout, interval, and tournament checks align", () => {
    expect(classifyEvidence({
      splitResults: Object.values(splitResults),
      validationTournamentCountFavoringSelected: 2,
    })).toBe("supports_adoption_review");
    expect(classifyEvidence({
      splitResults: Object.values(splitResults),
      validationTournamentCountFavoringSelected: 1,
    })).toBe("mixed_or_uncertain");
    expect(classifyEvidence({
      splitResults: [
        splitResults.development,
        createSplitResult({
          split: "validation",
          brierDelta: -0.01,
          brierUpperBound: 0.001,
        }),
        splitResults.holdout,
      ],
      validationTournamentCountFavoringSelected: 2,
    })).toBe("mixed_or_uncertain");
  });

  it("classifies reference support only when validation and holdout both favor reference", () => {
    expect(classifyEvidence({
      splitResults: [
        splitResults.development,
        createSplitResult({
          split: "validation",
          brierDelta: 0.01,
          brierUpperBound: 0.02,
        }),
        createSplitResult({
          split: "holdout",
          brierDelta: 0.01,
          brierUpperBound: 0.02,
        }),
      ],
      validationTournamentCountFavoringSelected: 0,
    })).toBe("supports_retaining_reference");
  });
});

describe("historical Elo uncertainty analysis", () => {
  const integrationIt = existsSync(EXPECTED_KAGGLE_MATCH_FILE) ? it : it.skip;
  let datasetPromise: Promise<ValidatedHistoricalDataset> | undefined;
  let resultPromise: Promise<UncertaintyAnalysisResult> | undefined;

  async function getDataset(): Promise<ValidatedHistoricalDataset> {
    datasetPromise ??= loadValidatedHistoricalDataset();
    return datasetPromise;
  }

  async function getResult(): Promise<UncertaintyAnalysisResult> {
    resultPromise ??= Promise.all([getDataset(), getArtifactInputs()]).then(
      ([dataset, artifacts]) =>
        analyzeHistoricalEloUncertainty({
          normalizedMatches: dataset.normalizedMatches,
          sourceChecksumSha256: dataset.summary.checksum,
          artifacts,
        }),
    );
    return resultPromise;
  }

  integrationIt("analyzes the fixed 200-vs-400 comparison without changing production", async () => {
    const result = await getResult();

    expect(result.candidateSummaries.map((candidate) => candidate.divisor)).toEqual([200, 400]);
    for (const candidate of result.candidateSummaries) {
      expect(candidate).toMatchObject({
        matchCount: 964,
        observationCount: 964,
        teamCount: 86,
        firstDate: "1930-07-13",
        lastDate: "2022-12-18",
      });
    }
    expect(result.metadata.fixedCandidateGrid)
      .toEqual([200, 250, 300, 350, 400, 450, 500, 600]);
    expect(result.metadata.holdoutStatus).toBe("opened_once_evaluated");
    expect(result.metadata.noTuningPolicy).toMatch(/does not rerank/u);
    expect(result.productionDecision).toMatchObject({
      decision: "defer_production_adoption",
      productionDivisor: 400,
      productionChangeApplied: false,
      leadingResearchCandidate: 200,
    });
  });

  integrationIt("reports exact split sample sizes and expected observed deltas", async () => {
    const result = await getResult();
    const expected = {
      development: {
        sampleSize: 163,
        brierScore: -0.003277,
        logLoss: -0.008064,
      },
      validation: {
        sampleSize: 38,
        brierScore: -0.019370,
        logLoss: -0.044069,
      },
      holdout: {
        sampleSize: 11,
        brierScore: -0.013225,
        logLoss: -0.034032,
      },
    } as const;

    for (const split of result.splitResults) {
      const splitExpected = expected[split.split];
      expect(split.sampleSize).toBe(splitExpected.sampleSize);
      expect(roundUncertaintyAnalysisNumber(split.brierScore.observedMeanDelta))
        .toBe(splitExpected.brierScore);
      expect(roundUncertaintyAnalysisNumber(split.logLoss.observedMeanDelta))
        .toBe(splitExpected.logLoss);
      expect(split.brierScore.lowerBound).toBeLessThanOrEqual(split.brierScore.upperBound);
      expect(split.logLoss.lowerBound).toBeLessThanOrEqual(split.logLoss.upperBound);
      expect(split.brierScore.proportionFavoringSelected).toBeGreaterThan(0);
      expect(split.logLoss.proportionFavoringSelected).toBeGreaterThan(0);
    }
  });

  integrationIt("reports validation tournament sensitivity and leave-one-out checks", async () => {
    const result = await getResult();

    expect(result.tournamentSensitivity.validationByTournament.map((entry) => ({
      year: entry.tournamentYear,
      sampleSize: entry.sampleSize,
      favors: entry.favors.brierScore,
    }))).toEqual([
      { year: 2010, sampleSize: 14, favors: "selected" },
      { year: 2014, sampleSize: 12, favors: "selected" },
      { year: 2018, sampleSize: 12, favors: "selected" },
    ]);
    expect(result.tournamentSensitivity.validationLeaveOneTournamentOut.map((entry) => ({
      excluded: entry.excludedTournamentYear,
      sampleSize: entry.sampleSize,
      favors: entry.favors.brierScore,
    }))).toEqual([
      { excluded: 2010, sampleSize: 24, favors: "selected" },
      { excluded: 2014, sampleSize: 26, favors: "selected" },
      { excluded: 2018, sampleSize: 26, favors: "selected" },
    ]);
    expect(result.tournamentSensitivity.developmentSummary.brierScore.tournamentCount).toBe(17);
    expect(result.tournamentSensitivity.developmentSummary.logLoss.tournamentCount).toBe(17);
  });

  integrationIt("is independent of candidate execution order", async () => {
    const [dataset, artifacts] = await Promise.all([getDataset(), getArtifactInputs()]);
    const forward = await getResult();
    const reversed = analyzeHistoricalEloUncertainty({
      normalizedMatches: dataset.normalizedMatches,
      sourceChecksumSha256: dataset.summary.checksum,
      artifacts,
      candidateExecutionOrder: [400, 200],
    });

    expect(reversed).toEqual(forward);
  });

  integrationIt("rejects changed sealed comparison and holdout artifacts", async () => {
    const [dataset, artifacts] = await Promise.all([getDataset(), getArtifactInputs()]);
    const changedRanking = JSON.stringify({
      ...JSON.parse(artifacts.divisorComparisonRankingJson),
      selectionDecision: {
        ...JSON.parse(artifacts.divisorComparisonRankingJson).selectionDecision,
        holdoutStatus: "opened_once_evaluated",
      },
    });
    const changedHoldout = JSON.stringify({
      ...JSON.parse(artifacts.holdoutMetadataJson),
      candidateDivisors: [400, 200],
    });

    expect(() =>
      analyzeHistoricalEloUncertainty({
        normalizedMatches: dataset.normalizedMatches,
        sourceChecksumSha256: dataset.summary.checksum,
        artifacts: {
          ...artifacts,
          divisorComparisonRankingJson: changedRanking,
        },
      }),
    ).toThrow(/pre-holdout comparison/);
    expect(() =>
      analyzeHistoricalEloUncertainty({
        normalizedMatches: dataset.normalizedMatches,
        sourceChecksumSha256: dataset.summary.checksum,
        artifacts: {
          ...artifacts,
          holdoutMetadataJson: changedHoldout,
        },
      }),
    ).toThrow(/opened-once holdout/);
  });

  integrationIt("serializes deterministic checked-in uncertainty artifacts", async () => {
    const result = await getResult();
    const artifacts = createUncertaintyAnalysisArtifacts(result);
    const [summaryJson, bootstrapJson, tournamentSensitivityJson, metadataJson] =
      await Promise.all([
        readFile(`${UNCERTAINTY_ANALYSIS_DIRECTORY}/summary.json`, "utf8"),
        readFile(`${UNCERTAINTY_ANALYSIS_DIRECTORY}/bootstrap.json`, "utf8"),
        readFile(`${UNCERTAINTY_ANALYSIS_DIRECTORY}/tournament-sensitivity.json`, "utf8"),
        readFile(`${UNCERTAINTY_ANALYSIS_DIRECTORY}/metadata.json`, "utf8"),
      ]);

    expect(artifacts).toEqual({
      summaryJson,
      bootstrapJson,
      tournamentSensitivityJson,
      metadataJson,
    });
    expect(createUncertaintyAnalysisArtifacts(result)).toEqual(artifacts);
    expect(summaryJson).toMatch(/"productionDivisor": 400/u);
    expect(summaryJson).not.toMatch(/"productionChangeApplied": true/u);
    expect(bootstrapJson).not.toMatch(/timestamp":/iu);
    expect(metadataJson).not.toMatch(/\/Users\//u);
  });

  integrationIt("does not import calibration or historical pipeline code from runtime files", async () => {
    const files = await readFilesUnder([
      "app",
      "src/components",
      "src/lib/simulator",
      "src/data/teamRatingsV2.ts",
    ]);
    const violations = files.filter(({ contents }) =>
      /scripts\/calibration|scripts\/historical-pipeline|uncertainty-analysis/u.test(contents),
    );

    expect(violations).toEqual([]);
  });
});
