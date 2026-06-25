import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  calculateClassificationAccuracy,
  type EvaluationObservation,
} from "@/scripts/calibration/evaluation";
import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
  DIVISOR_SELECTION_PROTOCOL,
  compareHistoricalEloDivisors,
  createDivisorComparisonArtifacts,
  rankDivisorCandidates,
  roundDivisorComparisonNumber,
  validateAscendingCandidateGrid,
  validateCandidateExecutionOrder,
  validateDivisorCandidateConsistency,
  type DivisorCandidate,
  type DivisorCandidateMetrics,
  type DivisorComparisonResult,
  type DivisorRankingCandidate,
} from "@/scripts/calibration/divisor-comparison";
import { roundForSerialization } from "@/scripts/calibration/sequential-elo";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  loadValidatedHistoricalDataset,
  type ValidatedHistoricalDataset,
} from "@/scripts/historical-pipeline/validateHistoricalDataset";

function createMetrics(input: {
  brierScore?: number | null;
  logLoss?: number | null;
} = {}): DivisorCandidateMetrics {
  return {
    selectedSampleSize: 10,
    scoredSampleSize: 10,
    brierScore: input.brierScore === undefined ? 0.2 : input.brierScore,
    logLoss: input.logLoss === undefined ? 0.6 : input.logLoss,
    accuracy: 0.7,
    meanPredictedProbability: 0.55,
    observedHomeWinRate: 0.6,
  };
}

function createRankingCandidate(input: {
  divisor: number;
  validationBrier?: number | null;
  validationLogLoss?: number | null;
  developmentBrier?: number | null;
  developmentLogLoss?: number | null;
}): DivisorRankingCandidate {
  return {
    divisor: input.divisor,
    validation: createMetrics({
      brierScore: input.validationBrier,
      logLoss: input.validationLogLoss,
    }),
    development: createMetrics({
      brierScore: input.developmentBrier,
      logLoss: input.developmentLogLoss,
    }),
  };
}

function createCompleteRankingGrid(
  candidates: readonly DivisorRankingCandidate[] = [],
): DivisorRankingCandidate[] {
  const overridesByDivisor = new Map(
    candidates.map((candidate) => [candidate.divisor, candidate]),
  );

  return DIVISOR_CANDIDATES.map((divisor, index) =>
    overridesByDivisor.get(divisor) ?? createRankingCandidate({
      divisor,
      validationBrier: 0.8 + index / 100,
      validationLogLoss: 1.2 + index / 100,
      developmentBrier: 0.8 + index / 100,
      developmentLogLoss: 1.2 + index / 100,
    }),
  );
}

function rankSynthetic(candidates: readonly DivisorRankingCandidate[]): number[] {
  return rankDivisorCandidates({
    candidates: createCompleteRankingGrid(candidates),
  }).ranking.map((entry) => entry.divisor);
}

async function readFilesUnder(
  paths: string[],
): Promise<{ path: string; contents: string }[]> {
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

describe("divisor candidate grid", () => {
  it("uses the exact fixed ascending grid once and includes divisor 400", () => {
    expect(DIVISOR_CANDIDATES).toEqual([200, 250, 300, 350, 400, 450, 500, 600]);
    expect(new Set(DIVISOR_CANDIDATES).size).toBe(8);
    expect(DIVISOR_CANDIDATES).toContain(CURRENT_PRODUCTION_DIVISOR);
    expect(Object.isFrozen(DIVISOR_CANDIDATES)).toBe(true);
    expect(DIVISOR_SELECTION_PROTOCOL).toMatchObject({
      primaryCohort: "knockout_decisive_only",
      primaryMetric: "validation_brier_score",
      secondaryMetric: "validation_log_loss",
      rankingPrecision: "full_precision",
      eligibleSplits: ["development", "validation"],
      excludedSplits: ["holdout", "full_history"],
      accuracyUsedForSelection: false,
    });
    expect(() => validateAscendingCandidateGrid(DIVISOR_CANDIDATES)).not.toThrow();
  });

  it("rejects invalid, duplicate, unsorted, missing, and unexpected candidates", () => {
    expect(() => validateAscendingCandidateGrid([0, 400])).toThrow(/positive finite/);
    expect(() => validateAscendingCandidateGrid([-1, 400])).toThrow(/positive finite/);
    expect(() => validateAscendingCandidateGrid([Number.NaN, 400])).toThrow(
      /positive finite/,
    );
    expect(() => validateAscendingCandidateGrid([Number.POSITIVE_INFINITY, 400]))
      .toThrow(/positive finite/);
    expect(() => validateAscendingCandidateGrid([Number.NEGATIVE_INFINITY, 400]))
      .toThrow(/positive finite/);
    expect(() => validateAscendingCandidateGrid([400, 400])).toThrow(/Duplicate/);
    expect(() => validateAscendingCandidateGrid([400, 350])).toThrow(/ascending/);
    expect(() => validateCandidateExecutionOrder(DIVISOR_CANDIDATES.slice(1))).toThrow(
      /exactly 8/,
    );
    expect(() => validateCandidateExecutionOrder([
      ...DIVISOR_CANDIDATES.slice(0, 7),
      700,
    ])).toThrow(/Unexpected/);
  });
});

describe("divisor candidate ranking", () => {
  it("ranks lower validation Brier score first", () => {
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 400, validationBrier: 0.2 }),
      createRankingCandidate({ divisor: 450, validationBrier: 0.19 }),
    ]).slice(0, 2)).toEqual([450, 400]);
  });

  it("uses validation log loss after a validation Brier tie", () => {
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 350, validationLogLoss: 0.59 }),
      createRankingCandidate({ divisor: 400, validationLogLoss: 0.6 }),
    ]).slice(0, 2)).toEqual([350, 400]);
  });

  it("uses development Brier after validation metric ties", () => {
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 400, developmentBrier: 0.2 }),
      createRankingCandidate({ divisor: 450, developmentBrier: 0.19 }),
    ]).slice(0, 2)).toEqual([450, 400]);
  });

  it("uses development log loss after both Brier and validation log-loss ties", () => {
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 400, developmentLogLoss: 0.6 }),
      createRankingCandidate({ divisor: 450, developmentLogLoss: 0.59 }),
    ]).slice(0, 2)).toEqual([450, 400]);
  });

  it("uses distance from 400 and then the smaller divisor", () => {
    const current = createRankingCandidate({ divisor: 400, validationBrier: 0.3 });
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 300 }),
      createRankingCandidate({ divisor: 350 }),
      current,
    ]).slice(0, 3)).toEqual([350, 300, 400]);
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 350 }),
      current,
      createRankingCandidate({ divisor: 450 }),
    ]).slice(0, 3)).toEqual([350, 450, 400]);
  });

  it("uses full precision rather than serialized values", () => {
    expect(roundDivisorComparisonNumber(0.2000004)).toBe(0.2);
    expect(roundDivisorComparisonNumber(0.2000005)).toBe(0.2);
    expect(rankSynthetic([
      createRankingCandidate({ divisor: 350, validationBrier: 0.2000004 }),
      createRankingCandidate({ divisor: 400, validationBrier: 0.2000005 }),
    ]).slice(0, 2)).toEqual([350, 400]);
  });

  it("is independent of candidate input order", () => {
    const candidates = createCompleteRankingGrid([
      createRankingCandidate({ divisor: 350, validationBrier: 0.19 }),
      createRankingCandidate({ divisor: 400, validationBrier: 0.2 }),
      createRankingCandidate({ divisor: 450, validationBrier: 0.21 }),
    ]);

    expect(rankDivisorCandidates({ candidates })).toEqual(
      rankDivisorCandidates({ candidates: [...candidates].reverse() }),
    );
  });

  it("requires the exact fixed grid and rejects duplicate or unexpected results", () => {
    const complete = createCompleteRankingGrid();
    const duplicate = [...complete];
    duplicate[0] = structuredClone(duplicate[1]);

    expect(() => rankDivisorCandidates({ candidates: complete })).not.toThrow();
    expect(() => rankDivisorCandidates({
      candidates: duplicate,
    })).toThrow(/Duplicate/);
    expect(() => rankDivisorCandidates({
      candidates: complete.slice(1),
    })).toThrow(/Missing.*200/);
    expect(() => rankDivisorCandidates({
      candidates: [
        ...complete,
        createRankingCandidate({ divisor: 700 }),
      ],
    })).toThrow(/Unexpected.*700/);
    expect(() => rankDivisorCandidates({
      candidates: [
        createRankingCandidate({ divisor: 350 }),
        createRankingCandidate({ divisor: 400 }),
      ],
    })).toThrow(/Missing.*200/);
    expect(rankDivisorCandidates({ candidates: [...complete].reverse() })).toEqual(
      rankDivisorCandidates({ candidates: complete }),
    );
  });

  it("rejects every null primary ranking metric independently", () => {
    for (const [split, field] of [
      ["validation", "brierScore"],
      ["validation", "logLoss"],
      ["development", "brierScore"],
      ["development", "logLoss"],
    ] as const) {
      const candidates = createCompleteRankingGrid();
      candidates[0][split][field] = null;
      expect(() => rankDivisorCandidates({ candidates }), `${split}.${field}`)
        .toThrow(/finite primary metric/);
    }
  });

  it("rejects every invalid divisor through the public ranker", () => {
    for (const divisor of [
      -1,
      0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const candidates = createCompleteRankingGrid();
      candidates[0] = createRankingCandidate({ divisor });
      expect(() => rankDivisorCandidates({ candidates }), String(divisor))
        .toThrow(/positive finite/);
    }
  });

  it("rejects primary selected and scored sample mismatches for both splits", () => {
    for (const [split, field] of [
      ["development", "selectedSampleSize"],
      ["development", "scoredSampleSize"],
      ["validation", "selectedSampleSize"],
      ["validation", "scoredSampleSize"],
    ] as const) {
      const candidates = createCompleteRankingGrid();
      candidates[1][split][field] += field === "selectedSampleSize" ? 1 : -1;
      expect(() => rankDivisorCandidates({ candidates }), `${split}.${field}`)
        .toThrow(/mismatched.*sample sizes/);
    }
  });

  it("keeps holdout data outside the ranking input and behavior", () => {
    const rankingHasHoldout: "holdout" extends keyof DivisorRankingCandidate
      ? true
      : false = false;
    const candidates = createCompleteRankingGrid([
      createRankingCandidate({ divisor: 350, validationBrier: 0.19 }),
      createRankingCandidate({ divisor: 400, validationBrier: 0.2 }),
    ]);
    const hypothetical = candidates.map((candidate, index) => ({
      candidate,
      holdoutBrierScore: index === 0 ? 1 : 0,
    }));

    expect(rankingHasHoldout).toBe(false);
    expect(rankSynthetic(hypothetical.map((entry) => entry.candidate))).toEqual(
      rankSynthetic(candidates),
    );
  });
});

describe("full historical divisor comparison", () => {
  const integrationIt = existsSync(EXPECTED_KAGGLE_MATCH_FILE) ? it : it.skip;
  let datasetPromise: Promise<ValidatedHistoricalDataset> | undefined;
  let comparisonPromise: Promise<DivisorComparisonResult> | undefined;

  function getDataset(): Promise<ValidatedHistoricalDataset> {
    datasetPromise ??= loadValidatedHistoricalDataset();
    return datasetPromise;
  }

  function getComparison(): Promise<DivisorComparisonResult> {
    comparisonPromise ??= getDataset().then((dataset) =>
      compareHistoricalEloDivisors({
        normalizedMatches: dataset.normalizedMatches,
        sourceChecksumSha256: dataset.summary.checksum,
      }),
    );
    return comparisonPromise;
  }

  integrationIt("reconstructs all candidates consistently and selects divisor 200", async () => {
    const result = await getComparison();

    expect(result.candidates).toHaveLength(8);
    expect(result.candidates.map((candidate) => candidate.divisor)).toEqual(
      DIVISOR_CANDIDATES,
    );
    expect(result.ranking.map((entry) => entry.divisor)).toEqual(
      DIVISOR_CANDIDATES,
    );
    expect(result.selectionDecision).toMatchObject({
      provisionalSelectedDivisor: 200,
      productionDivisor: 400,
      productionChangeApplied: false,
      holdoutStatus: "sealed_unopened",
    });
    expect(result.metadata).toMatchObject({
      comparisonModelVersion: "historical-elo-divisor-comparison-v1",
      historicalReconstructionModelVersion: "sequential-elo-v1",
      evaluationModelVersion: "historical-elo-evaluation-v1",
      holdoutStatus: "sealed_unopened",
    });

    for (const candidate of result.candidates) {
      expect(candidate.reconstruction).toMatchObject({
        matchCount: 964,
        observationCount: 964,
        teamCount: 86,
        firstDate: "1930-07-13",
        lastDate: "2022-12-18",
      });
      expect(candidate.development.scoredSampleSize).toBe(163);
      expect(candidate.validation.scoredSampleSize).toBe(38);
      expect(candidate.reconstructionConfig).toEqual({
        initialRating: 1500,
        kFactor: 20,
        divisor: candidate.divisor,
        homeAdvantage: 0,
        penaltyUpdateOutcome: "draw",
        nonDecisiveUpdateOutcome: "draw",
      });
      for (const metrics of [
        candidate.development,
        candidate.validation,
        ...candidate.supportingDiagnostics,
      ]) {
        expect([
          metrics.brierScore,
          metrics.logLoss,
          metrics.accuracy,
          metrics.meanPredictedProbability,
          metrics.observedHomeWinRate,
        ].every((value) => value !== null && Number.isFinite(value))).toBe(true);
      }
    }
  });

  integrationIt("is deeply identical when candidate execution order is reversed", async () => {
    const dataset = await getDataset();
    const forward = await getComparison();
    const reversed = compareHistoricalEloDivisors({
      normalizedMatches: dataset.normalizedMatches,
      sourceChecksumSha256: dataset.summary.checksum,
      candidateExecutionOrder: [...DIVISOR_CANDIDATES].reverse(),
    });

    expect(reversed).toEqual(forward);
  });

  integrationIt("reproduces divisor 400 baseline continuous metrics and documents accuracy", async () => {
    const result = await getComparison();
    const baselineDocument = JSON.parse(
      await readFile("data/generated/calibration/evaluation/by-cohort.json", "utf8"),
    ) as {
      byCohort: Record<string, Array<{
        split: string;
        selectedSampleSize: number;
        scoredSampleSize: number;
        excludedFromBinaryScoring: number;
        metrics: {
          brierScore: number;
          logLoss: number;
          accuracy: number;
          meanPredictedProbability: number;
          observedHomeWinRate: number;
        } | null;
      }>>;
    };
    const candidate = result.candidates.find((entry) => entry.divisor === 400)!;
    const expectedDevelopmentAccuracy = {
      all_matches: {
        comparison: 0.647913,
        standaloneBaseline: 0.651543,
      },
      decisive_only: {
        comparison: 0.647913,
        standaloneBaseline: 0.651543,
      },
      knockout_only: {
        comparison: 0.601227,
        standaloneBaseline: 0.607362,
      },
      knockout_decisive_only: {
        comparison: 0.601227,
        standaloneBaseline: 0.607362,
      },
    } as const;

    for (const cohort of [
      "knockout_decisive_only",
      "decisive_only",
      "all_matches",
      "knockout_only",
    ] as const) {
      for (const split of ["development", "validation"] as const) {
        const candidateMetrics = cohort === "knockout_decisive_only"
          ? candidate[split]
          : candidate.supportingDiagnostics.find(
            (entry) => entry.cohort === cohort && entry.split === split,
          )!;
        const baseline = baselineDocument.byCohort[cohort].find(
          (entry) => entry.split === split,
        )!;

        expect(candidateMetrics.selectedSampleSize, `${cohort}/${split} selected`)
          .toBe(baseline.selectedSampleSize);
        expect(candidateMetrics.scoredSampleSize, `${cohort}/${split} scored`)
          .toBe(baseline.scoredSampleSize);
        expect(
          candidateMetrics.selectedSampleSize - candidateMetrics.scoredSampleSize,
          `${cohort}/${split} excluded`,
        ).toBe(baseline.excludedFromBinaryScoring);
        expect(roundDivisorComparisonNumber(candidateMetrics.brierScore!))
          .toBe(baseline.metrics?.brierScore);
        expect(roundDivisorComparisonNumber(candidateMetrics.logLoss!))
          .toBe(baseline.metrics?.logLoss);
        expect(roundDivisorComparisonNumber(candidateMetrics.meanPredictedProbability!))
          .toBe(baseline.metrics?.meanPredictedProbability);
        expect(roundDivisorComparisonNumber(candidateMetrics.observedHomeWinRate!))
          .toBe(baseline.metrics?.observedHomeWinRate);

        if (split === "development") {
          expect(
            roundDivisorComparisonNumber(candidateMetrics.accuracy!),
            `${cohort}/${split} comparison accuracy`,
          ).toBe(expectedDevelopmentAccuracy[cohort].comparison);
          expect(
            baseline.metrics?.accuracy,
            `${cohort}/${split} standalone baseline accuracy`,
          ).toBe(expectedDevelopmentAccuracy[cohort].standaloneBaseline);
        } else {
          expect(roundDivisorComparisonNumber(candidateMetrics.accuracy!))
            .toBe(baseline.metrics?.accuracy);
        }
      }
    }
  });

  it("shows why six-decimal probability serialization can change accuracy", () => {
    const observation: EvaluationObservation = {
      matchId: "threshold-rounding",
      tournamentYear: 2018,
      date: "2018-06-01",
      stage: "semifinal",
      homeTeamId: "home",
      awayTeamId: "away",
      predictedProbability: 0.4999996,
      observedOutcome: 1,
    };
    const serialized = {
      ...observation,
      predictedProbability: roundForSerialization(observation.predictedProbability),
    };

    expect(serialized.predictedProbability).toBe(0.5);
    expect(calculateClassificationAccuracy([observation])).toBe(0);
    expect(calculateClassificationAccuracy([serialized])).toBe(1);
  });

  integrationIt("matches checked-in deterministic artifacts without holdout scores", async () => {
    const result = await getComparison();
    const artifacts = createDivisorComparisonArtifacts(result);
    const [rankingJson, candidatesJson, metadataJson] = await Promise.all([
      readFile("data/generated/calibration/divisor-comparison/ranking.json", "utf8"),
      readFile("data/generated/calibration/divisor-comparison/candidates.json", "utf8"),
      readFile("data/generated/calibration/divisor-comparison/metadata.json", "utf8"),
    ]);

    expect(artifacts).toEqual({ rankingJson, candidatesJson, metadataJson });
    expect(createDivisorComparisonArtifacts(result)).toEqual(artifacts);
    expect(JSON.parse(metadataJson)).toMatchObject({ holdoutStatus: "sealed_unopened" });
    expect(candidatesJson).not.toMatch(/"split": "holdout"/u);
    expect(rankingJson).not.toMatch(/"holdout(?:Brier|LogLoss|Metrics|Scores)"/u);
  });

  integrationIt("rejects mismatched source, config, ordering, and diagnostic data", async () => {
    const result = await getComparison();
    const checksum = result.metadata.sourceDatasetChecksumSha256;

    for (const mutate of [
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.sourceChecksumSha256 = "0".repeat(64);
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstructionConfig.initialRating = 1400;
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstructionConfig.kFactor = 99;
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstructionConfig.homeAdvantage = 10;
      },
      (candidate: DivisorCandidate) => {
        (candidate.reconstructionConfig as { penaltyUpdateOutcome: string })
          .penaltyUpdateOutcome = "win";
      },
      (candidate: DivisorCandidate) => {
        (candidate.reconstructionConfig as { nonDecisiveUpdateOutcome: string })
          .nonDecisiveUpdateOutcome = "win";
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.observationIdentityChecksumSha256 = "0".repeat(64);
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.matchCount -= 1;
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.observationCount -= 1;
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.teamCount -= 1;
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.firstDate = "1930-07-14";
      },
      (candidate: DivisorCandidate) => {
        candidate.reconstruction.lastDate = "2022-12-17";
      },
      (candidate: DivisorCandidate) => {
        candidate.supportingDiagnostics[0].selectedSampleSize += 1;
      },
      (candidate: DivisorCandidate) => {
        candidate.supportingDiagnostics[0].scoredSampleSize += 1;
      },
    ]) {
      const candidates = structuredClone(result.candidates);
      mutate(candidates[1]);
      expect(() => validateDivisorCandidateConsistency(candidates, checksum)).toThrow();
    }
  });
});

describe("divisor comparison runtime isolation", () => {
  it("keeps comparison code and artifacts out of runtime modules", async () => {
    const files = await readFilesUnder([
      "app",
      "src/components",
      "src/lib/simulator",
      "src/data/teamRatingsV2.ts",
    ]);
    const forbiddenImport = /divisor-comparison|divisorComparison|generated\/calibration/u;

    for (const file of files) {
      expect(file.contents, file.path).not.toMatch(forbiddenImport);
    }
  });
});
