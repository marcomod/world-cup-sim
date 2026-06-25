import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import { EVALUATION_MODEL_VERSION } from "../evaluation/types.ts";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  SEQUENTIAL_ELO_MODEL_VERSION,
} from "../sequential-elo/index.ts";
import {
  CURRENT_PRODUCTION_DIVISOR,
  DIVISOR_CANDIDATES,
  DIVISOR_COMPARISON_MODEL_VERSION,
  DIVISOR_SELECTION_PROTOCOL,
  validateCandidateExecutionOrder,
} from "./candidateDivisors.ts";
import { evaluateDivisorCandidate } from "./evaluateCandidate.ts";
import { rankDivisorCandidates } from "./rankCandidates.ts";
import { reconstructDivisorCandidate } from "./reconstructCandidate.ts";
import type {
  DivisorCandidate,
  DivisorComparisonResult,
  DivisorRankingCandidate,
} from "./types.ts";

export function compareHistoricalEloDivisors(input: {
  normalizedMatches: readonly NormalizedHistoricalMatch[];
  sourceChecksumSha256: string;
  candidateExecutionOrder?: readonly number[];
}): DivisorComparisonResult {
  const executionOrder = input.candidateExecutionOrder ?? DIVISOR_CANDIDATES;
  validateCandidateExecutionOrder(executionOrder);

  const candidates = executionOrder.map((divisor) =>
    evaluateDivisorCandidate(
      reconstructDivisorCandidate({
        matches: input.normalizedMatches,
        divisor,
        sourceChecksumSha256: input.sourceChecksumSha256,
      }),
    ),
  );
  const orderedCandidates = [...candidates].sort(
    (left, right) => left.divisor - right.divisor,
  );
  validateDivisorCandidateConsistency(
    orderedCandidates,
    input.sourceChecksumSha256,
  );
  const rankingInput: DivisorRankingCandidate[] = orderedCandidates.map(
    (candidate) => ({
      divisor: candidate.divisor,
      development: candidate.development,
      validation: candidate.validation,
    }),
  );
  const ranked = rankDivisorCandidates({
    candidates: rankingInput,
    protocol: DIVISOR_SELECTION_PROTOCOL,
  });
  const reference = orderedCandidates[0];

  return {
    candidates: orderedCandidates,
    ranking: ranked.ranking,
    selectionDecision: ranked.selectionDecision,
    metadata: {
      generatedFileWarning: "Do not edit manually.",
      comparisonModelVersion: DIVISOR_COMPARISON_MODEL_VERSION,
      historicalReconstructionModelVersion: SEQUENTIAL_ELO_MODEL_VERSION,
      evaluationModelVersion: EVALUATION_MODEL_VERSION,
      sourceDatasetChecksumSha256: input.sourceChecksumSha256,
      observationIdentityChecksumSha256:
        reference.reconstruction.observationIdentityChecksumSha256,
      candidateGrid: [...DIVISOR_CANDIDATES],
      fixedBaselineParameters: {
        initialRating: BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating,
        kFactor: BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor,
        homeAdvantage: BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage,
        penaltyUpdateOutcome: BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome,
        nonDecisiveUpdateOutcome:
          BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome,
      },
      productionDivisor: CURRENT_PRODUCTION_DIVISOR,
      selectionProtocol: DIVISOR_SELECTION_PROTOCOL,
      holdoutStatus: "sealed_unopened",
      numericPrecision: 6,
      numericSerializationPolicy:
        "Ranking uses full-precision metrics; generated numbers are rounded to 6 decimal places and negative zero is serialized as zero.",
      generationTimestampPolicy:
        "No wall-clock timestamp is written; identical validated input produces byte-stable artifacts.",
      baselineCompatibilityPolicy:
        "Divisor 400 matches baseline cohort membership, sample counts, and 6-decimal Brier/log-loss, mean-prediction, and observed-rate results. Development accuracy differs at the exact 0.5 threshold because comparison uses full-precision in-memory probabilities while the standalone baseline evaluator reads 6-decimal serialized probabilities; accuracy is secondary and is not used for ranking.",
      developmentAccuracyCompatibility: {
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
      },
    },
  };
}

export function validateDivisorCandidateConsistency(
  candidates: readonly DivisorCandidate[],
  sourceChecksumSha256: string,
): void {
  if (candidates.length === 0) {
    throw new Error("Historical Elo divisor comparison requires candidate results.");
  }

  const reference = candidates[0];
  for (const candidate of candidates) {
    validateCandidateConfig(candidate);
    if (candidate.reconstruction.sourceChecksumSha256 !== sourceChecksumSha256) {
      throw new Error(
        `Historical Elo divisor ${candidate.divisor} has a mismatched source checksum.`,
      );
    }
    for (const field of [
      "observationIdentityChecksumSha256",
      "matchCount",
      "observationCount",
      "teamCount",
      "firstDate",
      "lastDate",
      "multiMatchDateCount",
      "matchesOnMultiMatchDates",
      "maxMatchesOnSingleDate",
    ] as const) {
      if (candidate.reconstruction[field] !== reference.reconstruction[field]) {
        throw new Error(
          `Historical Elo divisor ${candidate.divisor} has mismatched reconstruction field "${field}".`,
        );
      }
    }
    validateDiagnosticSampleSizes(candidate, reference);
  }
}

function validateCandidateConfig(candidate: DivisorCandidate): void {
  const config = candidate.reconstructionConfig;
  if (
    config.divisor !== candidate.divisor ||
    config.initialRating !== BASELINE_SEQUENTIAL_ELO_CONFIG.initialRating ||
    config.kFactor !== BASELINE_SEQUENTIAL_ELO_CONFIG.kFactor ||
    config.homeAdvantage !== BASELINE_SEQUENTIAL_ELO_CONFIG.homeAdvantage ||
    config.penaltyUpdateOutcome !==
      BASELINE_SEQUENTIAL_ELO_CONFIG.penaltyUpdateOutcome ||
    config.nonDecisiveUpdateOutcome !==
      BASELINE_SEQUENTIAL_ELO_CONFIG.nonDecisiveUpdateOutcome
  ) {
    throw new Error(
      `Historical Elo divisor ${candidate.divisor} changed a fixed baseline parameter.`,
    );
  }
}

function validateDiagnosticSampleSizes(
  candidate: DivisorCandidate,
  reference: DivisorCandidate,
): void {
  if (candidate.supportingDiagnostics.length !== reference.supportingDiagnostics.length) {
    throw new Error(
      `Historical Elo divisor ${candidate.divisor} has missing supporting diagnostics.`,
    );
  }

  for (let index = 0; index < reference.supportingDiagnostics.length; index += 1) {
    const actual = candidate.supportingDiagnostics[index];
    const expected = reference.supportingDiagnostics[index];
    if (
      actual.cohort !== expected.cohort ||
      actual.split !== expected.split ||
      actual.selectedSampleSize !== expected.selectedSampleSize ||
      actual.scoredSampleSize !== expected.scoredSampleSize
    ) {
      throw new Error(
        `Historical Elo divisor ${candidate.divisor} has mismatched supporting diagnostic "${expected.cohort}/${expected.split}".`,
      );
    }
  }
}
