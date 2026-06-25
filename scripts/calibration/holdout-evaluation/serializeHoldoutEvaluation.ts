import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  HoldoutEvaluationArtifacts,
  HoldoutEvaluationResult,
} from "./types.ts";

export const HOLDOUT_EVALUATION_NUMERIC_PRECISION = 6 as const;

export function createHoldoutEvaluationArtifacts(
  result: HoldoutEvaluationResult,
): HoldoutEvaluationArtifacts {
  return {
    resultJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      holdoutEvaluationModelVersion:
        result.metadata.holdoutEvaluationModelVersion,
      frozenProtocol: result.frozenProtocol,
      primaryComparison: result.primaryComparison,
      decisionSummary: result.decisionSummary,
      productionStatement:
        "Production remains divisor 400; no automatic production change was applied.",
    })),
    byCohortJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      holdoutEvaluationModelVersion:
        result.metadata.holdoutEvaluationModelVersion,
      candidates: result.candidates,
    })),
    metadataJson: toJson(roundUnknownNumbers(result.metadata)),
  };
}

export async function writeHoldoutEvaluationArtifacts(input: {
  artifacts: HoldoutEvaluationArtifacts;
  resultPath: string;
  byCohortPath: string;
  metadataPath: string;
}): Promise<void> {
  await Promise.all([
    writeTextFile(input.resultPath, input.artifacts.resultJson),
    writeTextFile(input.byCohortPath, input.artifacts.byCohortJson),
    writeTextFile(input.metadataPath, input.artifacts.metadataJson),
  ]);
}

export function roundHoldoutEvaluationNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot serialize a non-finite holdout evaluation value.");
  }
  const rounded = Number(value.toFixed(HOLDOUT_EVALUATION_NUMERIC_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundUnknownNumbers(value: unknown): unknown {
  if (typeof value === "number") {
    return roundHoldoutEvaluationNumber(value);
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
