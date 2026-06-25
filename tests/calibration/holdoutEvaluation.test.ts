import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
} from "@/scripts/calibration/divisor-comparison";
import {
  compareHoldoutCandidates,
  createHoldoutEvaluationArtifacts,
  FROZEN_HOLDOUT_PROTOCOL,
  HOLDOUT_CANDIDATE_DIVISORS,
  roundHoldoutEvaluationNumber,
  type HoldoutEvaluationResult,
} from "@/scripts/calibration/holdout-evaluation";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  loadValidatedHistoricalDataset,
  type ValidatedHistoricalDataset,
} from "@/scripts/historical-pipeline/validateHistoricalDataset";

async function readFilesUnder(
  directory: string,
): Promise<Array<{ path: string; contents: string }>> {
  const entries = await readdir(directory);
  const files: Array<{ path: string; contents: string }> = [];

  for (const entry of entries) {
    const path = `${directory}/${entry}`;
    const entryStat = await stat(path);
    if (entryStat.isDirectory()) {
      files.push(...await readFilesUnder(path));
    } else if (/\.(ts|tsx)$/u.test(path)) {
      files.push({ path, contents: await readFile(path, "utf8") });
    }
  }

  return files;
}

describe("frozen holdout protocol", () => {
  it("uses the exact one-time holdout protocol", () => {
    expect(FROZEN_HOLDOUT_PROTOCOL).toEqual({
      selectedDivisor: 200,
      referenceDivisor: 400,
      primaryCohort: "knockout_decisive_only",
      primaryMetric: "brierScore",
      secondaryMetric: "logLoss",
      holdoutSplit: "holdout",
      holdoutTournamentYear: 2022,
    });
    expect(Object.isFrozen(FROZEN_HOLDOUT_PROTOCOL)).toBe(true);
    expect(HOLDOUT_CANDIDATE_DIVISORS).toEqual([200, 400]);
    expect(Object.isFrozen(HOLDOUT_CANDIDATE_DIVISORS)).toBe(true);
    expect(DIVISOR_CANDIDATES).toEqual([200, 250, 300, 350, 400, 450, 500, 600]);
    expect(CURRENT_PRODUCTION_DIVISOR).toBe(400);
  });

  it("cannot be mutated at runtime", () => {
    expect(() => {
      (FROZEN_HOLDOUT_PROTOCOL as { selectedDivisor: number }).selectedDivisor = 250;
    }).toThrow();
    expect(FROZEN_HOLDOUT_PROTOCOL.selectedDivisor).toBe(200);
  });
});

describe("historical Elo holdout evaluation", () => {
  const integrationIt = existsSync(EXPECTED_KAGGLE_MATCH_FILE) ? it : it.skip;
  let datasetPromise: Promise<ValidatedHistoricalDataset> | undefined;
  let resultPromise: Promise<HoldoutEvaluationResult> | undefined;

  async function getDataset(): Promise<ValidatedHistoricalDataset> {
    datasetPromise ??= loadValidatedHistoricalDataset();
    return datasetPromise;
  }

  async function getSealedComparison(): Promise<{
    rankingJson: string;
    metadataJson: string;
  }> {
    const [rankingJson, metadataJson] = await Promise.all([
      readFile("data/generated/calibration/divisor-comparison/ranking.json", "utf8"),
      readFile("data/generated/calibration/divisor-comparison/metadata.json", "utf8"),
    ]);
    return { rankingJson, metadataJson };
  }

  async function getResult(): Promise<HoldoutEvaluationResult> {
    resultPromise ??= Promise.all([getDataset(), getSealedComparison()]).then(
      ([dataset, sealedDivisorComparison]) =>
        compareHoldoutCandidates({
          normalizedMatches: dataset.normalizedMatches,
          sourceChecksumSha256: dataset.summary.checksum,
          sealedDivisorComparison,
        }),
    );
    return resultPromise;
  }

  integrationIt("transitions from sealed comparison metadata to holdout-only metadata", async () => {
    const sealed = await getSealedComparison();
    const result = await getResult();
    const comparisonMetadata = JSON.parse(sealed.metadataJson) as {
      holdoutStatus: string;
    };

    expect(comparisonMetadata.holdoutStatus).toBe("sealed_unopened");
    expect(result.metadata.holdoutStatus).toBe("opened_once_evaluated");
    expect(result.metadata.previouslySealedHoldoutStatus).toBe("sealed_unopened");
    expect(result.metadata.candidateDivisors).toEqual([200, 400]);
    expect(result.metadata.fixedCandidateGrid).toEqual(DIVISOR_CANDIDATES);
    expect(result.metadata.fixedBaselineParameters).toEqual({
      initialRating: 1500,
      kFactor: 20,
      homeAdvantage: 0,
      penaltyUpdateOutcome: "draw",
      nonDecisiveUpdateOutcome: "draw",
    });
    expect(result.metadata.noRetuningPolicy).toMatch(/descriptive only/u);
  });

  integrationIt("reconstructs both candidates independently with only divisor changed", async () => {
    const result = await getResult();

    expect(result.candidates.map((candidate) => candidate.divisor)).toEqual([200, 400]);
    for (const candidate of result.candidates) {
      expect(candidate.reconstruction).toMatchObject({
        matchCount: 964,
        observationCount: 964,
        teamCount: 86,
        firstDate: "1930-07-13",
        lastDate: "2022-12-18",
        multiMatchDateCount: 297,
        matchesOnMultiMatchDates: 883,
        maxMatchesOnSingleDate: 8,
      });
      expect(candidate.reconstructionConfig).toEqual({
        initialRating: 1500,
        kFactor: 20,
        divisor: candidate.divisor,
        homeAdvantage: 0,
        penaltyUpdateOutcome: "draw",
        nonDecisiveUpdateOutcome: "draw",
      });
    }
    expect(result.candidates[0].reconstruction.sourceChecksumSha256)
      .toBe(result.candidates[1].reconstruction.sourceChecksumSha256);
    expect(result.candidates[0].reconstruction.observationIdentityChecksumSha256)
      .toBe(result.candidates[1].reconstruction.observationIdentityChecksumSha256);
  });

  integrationIt("uses exact holdout cohort counts for both candidates", async () => {
    const result = await getResult();
    const expectedCounts = {
      all_matches: [64, 49, 15],
      decisive_only: [49, 49, 0],
      knockout_only: [16, 11, 5],
      knockout_decisive_only: [11, 11, 0],
    } as const;

    for (const candidate of result.candidates) {
      for (const cohort of candidate.cohorts) {
        const [selected, scored, excluded] = expectedCounts[cohort.cohort];
        expect(cohort.selectedSampleSize, `${candidate.divisor}/${cohort.cohort} selected`)
          .toBe(selected);
        expect(cohort.scoredSampleSize, `${candidate.divisor}/${cohort.cohort} scored`)
          .toBe(scored);
        expect(cohort.excludedFromBinaryScoring, `${candidate.divisor}/${cohort.cohort} excluded`)
          .toBe(excluded);
        expect(cohort.metrics).not.toBeNull();
        expect(Object.values(cohort.metrics!).every(Number.isFinite)).toBe(true);
      }
    }
  });

  integrationIt("reports the frozen primary holdout comparison without reranking", async () => {
    const result = await getResult();
    const comparison = result.primaryComparison;

    expect(comparison).toMatchObject({
      selectedDivisor: 200,
      referenceDivisor: 400,
      cohort: "knockout_decisive_only",
      split: "holdout",
      selectedSampleSize: 11,
      scoredSampleSize: 11,
      accuracyPolicy: "secondary_not_used_for_selection",
    });
    expect(roundHoldoutEvaluationNumber(comparison.selected.brierScore)).toBe(0.136992);
    expect(roundHoldoutEvaluationNumber(comparison.reference.brierScore)).toBe(0.150217);
    expect(roundHoldoutEvaluationNumber(comparison.deltas.brierScore)).toBe(-0.013225);
    expect(comparison.deltaDirection.brierScore).toBe("favors_selected");
    expect(roundHoldoutEvaluationNumber(comparison.selected.logLoss)).toBe(0.448079);
    expect(roundHoldoutEvaluationNumber(comparison.reference.logLoss)).toBe(0.482111);
    expect(roundHoldoutEvaluationNumber(comparison.deltas.logLoss)).toBe(-0.034032);
    expect(comparison.deltaDirection.logLoss).toBe("favors_selected");
    expect(comparison.selected.accuracy).toBe(comparison.reference.accuracy);
    expect(result.decisionSummary).toMatchObject({
      conclusion: "holdout_favors_selected_divisor",
      conclusionBasis: "primary_holdout_brier_score_delta",
      productionDivisor: 400,
      productionChangeApplied: false,
      protocolRetuned: false,
      gridExpanded: false,
      significanceClaimed: false,
      furtherTuningOnHoldoutAllowed: false,
    });

    const selectedAllMatches = result.candidates[0].cohorts.find(
      (cohort) => cohort.cohort === "all_matches",
    )!;
    const referenceAllMatches = result.candidates[1].cohorts.find(
      (cohort) => cohort.cohort === "all_matches",
    )!;
    expect(selectedAllMatches.metrics!.brierScore)
      .toBeGreaterThan(referenceAllMatches.metrics!.brierScore);
    expect(result.decisionSummary.conclusion).toBe("holdout_favors_selected_divisor");
  });

  integrationIt("is independent of candidate execution order", async () => {
    const [dataset, sealedDivisorComparison] = await Promise.all([
      getDataset(),
      getSealedComparison(),
    ]);
    const forward = await getResult();
    const reversed = compareHoldoutCandidates({
      normalizedMatches: dataset.normalizedMatches,
      sourceChecksumSha256: dataset.summary.checksum,
      sealedDivisorComparison,
      candidateExecutionOrder: [400, 200],
    });

    expect(reversed).toEqual(forward);
  });

  integrationIt("serializes deterministic checked-in artifacts", async () => {
    const result = await getResult();
    const artifacts = createHoldoutEvaluationArtifacts(result);
    const [resultJson, byCohortJson, metadataJson] = await Promise.all([
      readFile("data/generated/calibration/holdout-evaluation/result.json", "utf8"),
      readFile("data/generated/calibration/holdout-evaluation/by-cohort.json", "utf8"),
      readFile("data/generated/calibration/holdout-evaluation/metadata.json", "utf8"),
    ]);

    expect(artifacts).toEqual({ resultJson, byCohortJson, metadataJson });
    expect(createHoldoutEvaluationArtifacts(result)).toEqual(artifacts);
    expect(resultJson).not.toMatch(/"ranking"/u);
    expect(byCohortJson).not.toMatch(/"ranking"/u);
    expect(metadataJson).not.toMatch(/timestamp":/iu);
    expect(metadataJson).not.toMatch(/\/Users\//u);
  });

  integrationIt("rejects unsealed or changed comparison artifacts", async () => {
    const [dataset, sealedDivisorComparison] = await Promise.all([
      getDataset(),
      getSealedComparison(),
    ]);

    expect(() =>
      compareHoldoutCandidates({
        normalizedMatches: dataset.normalizedMatches,
        sourceChecksumSha256: dataset.summary.checksum,
        sealedDivisorComparison: {
          ...sealedDivisorComparison,
          metadataJson: sealedDivisorComparison.metadataJson.replace(
            '"holdoutStatus": "sealed_unopened"',
            '"holdoutStatus": "opened_once_evaluated"',
          ),
        },
      })
    ).toThrow(/sealed/u);
    expect(() =>
      compareHoldoutCandidates({
        normalizedMatches: dataset.normalizedMatches,
        sourceChecksumSha256: dataset.summary.checksum,
        sealedDivisorComparison,
        candidateExecutionOrder: [200, 200],
      })
    ).toThrow(/Duplicate/u);
  });

  it("does not import ranking code from the holdout evaluation layer", async () => {
    const holdoutFiles = await readFilesUnder("scripts/calibration/holdout-evaluation");
    const source = holdoutFiles.map((file) => file.contents).join("\n");

    expect(source).not.toMatch(/rankDivisorCandidates/u);
    expect(source).not.toMatch(/rankCandidates/u);
  });
});

describe("holdout evaluation runtime isolation", () => {
  it("keeps holdout evaluation out of runtime app and simulator files", async () => {
    const runtimeFiles = [
      ...await readFilesUnder("app"),
      ...await readFilesUnder("src/components"),
      ...await readFilesUnder("src/lib/simulator"),
      { path: "src/data/teamRatingsV2.ts", contents: await readFile("src/data/teamRatingsV2.ts", "utf8") },
      { path: "src/lib/simulator/probability.ts", contents: await readFile("src/lib/simulator/probability.ts", "utf8") },
    ];
    const forbiddenImport =
      /holdout-evaluation|evaluateHistoricalEloHoldout|generated\/calibration\/holdout-evaluation/u;

    for (const file of runtimeFiles) {
      expect(file.contents, file.path).not.toMatch(forbiddenImport);
    }
  });
});
