import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  UncertaintyAnalysisArtifacts,
  UncertaintyAnalysisResult,
} from "./types.ts";

export const UNCERTAINTY_ANALYSIS_NUMERIC_PRECISION = 6 as const;

export function createUncertaintyAnalysisArtifacts(
  result: UncertaintyAnalysisResult,
): UncertaintyAnalysisArtifacts {
  return {
    summaryJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      uncertaintyAnalysisModelVersion:
        result.metadata.uncertaintyAnalysisModelVersion,
      frozenProtocol: result.frozenProtocol,
      candidateSummaries: result.candidateSummaries,
      splitResults: result.splitResults.map((split) => ({
        split: split.split,
        sampleSize: split.sampleSize,
        brierScore: summarizeBootstrapMetric(split.brierScore),
        logLoss: summarizeBootstrapMetric(split.logLoss),
      })),
      evidenceClassification: result.evidenceClassification,
      productionDecision: result.productionDecision,
      productionStatement:
        "Production remains divisor 400; no automatic production change was applied.",
    })),
    bootstrapJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      uncertaintyAnalysisModelVersion:
        result.metadata.uncertaintyAnalysisModelVersion,
      bootstrapMethod: result.frozenProtocol.bootstrapMethod,
      confidenceLevel: result.frozenProtocol.confidenceLevel,
      replicationCount: result.frozenProtocol.bootstrapReplications,
      splitResults: result.splitResults,
    })),
    tournamentSensitivityJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      uncertaintyAnalysisModelVersion:
        result.metadata.uncertaintyAnalysisModelVersion,
      tournamentSensitivity: result.tournamentSensitivity,
    })),
    metadataJson: toJson(roundUnknownNumbers(result.metadata)),
  };
}

export async function writeUncertaintyAnalysisArtifacts(input: {
  artifacts: UncertaintyAnalysisArtifacts;
  summaryPath: string;
  bootstrapPath: string;
  tournamentSensitivityPath: string;
  metadataPath: string;
}): Promise<void> {
  await Promise.all([
    writeTextFile(input.summaryPath, input.artifacts.summaryJson),
    writeTextFile(input.bootstrapPath, input.artifacts.bootstrapJson),
    writeTextFile(
      input.tournamentSensitivityPath,
      input.artifacts.tournamentSensitivityJson,
    ),
    writeTextFile(input.metadataPath, input.artifacts.metadataJson),
  ]);
}

export function roundUncertaintyAnalysisNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot serialize a non-finite uncertainty analysis value.");
  }
  const rounded = Number(value.toFixed(UNCERTAINTY_ANALYSIS_NUMERIC_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function summarizeBootstrapMetric(
  metric: UncertaintyAnalysisResult["splitResults"][number]["brierScore"],
): {
  metric: string;
  sampleSize: number;
  observedMeanDelta: number;
  lowerBound: number;
  upperBound: number;
  proportionFavoringSelected: number;
  proportionFavoringReference: number;
  proportionEqual: number;
} {
  return {
    metric: metric.metric,
    sampleSize: metric.sampleSize,
    observedMeanDelta: metric.observedMeanDelta,
    lowerBound: metric.lowerBound,
    upperBound: metric.upperBound,
    proportionFavoringSelected: metric.proportionFavoringSelected,
    proportionFavoringReference: metric.proportionFavoringReference,
    proportionEqual: metric.proportionEqual,
  };
}

function roundUnknownNumbers(value: unknown): unknown {
  if (typeof value === "number") {
    return roundUncertaintyAnalysisNumber(value);
  }
  if (Array.isArray(value)) {
    return value.map(roundUnknownNumbers);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, roundUnknownNumbers(nested)]),
    );
  }
  return value;
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
