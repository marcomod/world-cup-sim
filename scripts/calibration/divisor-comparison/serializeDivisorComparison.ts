import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  DivisorComparisonArtifacts,
  DivisorComparisonResult,
} from "./types.ts";

export const DIVISOR_COMPARISON_NUMERIC_PRECISION = 6 as const;

export function createDivisorComparisonArtifacts(
  result: DivisorComparisonResult,
): DivisorComparisonArtifacts {
  return {
    rankingJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      comparisonModelVersion: result.metadata.comparisonModelVersion,
      selectionProtocol: result.metadata.selectionProtocol,
      selectionDecision: result.selectionDecision,
      ranking: result.ranking,
    })),
    candidatesJson: toJson(roundUnknownNumbers({
      generatedFileWarning: "Do not edit manually.",
      comparisonModelVersion: result.metadata.comparisonModelVersion,
      candidates: result.candidates,
    })),
    metadataJson: toJson(roundUnknownNumbers(result.metadata)),
  };
}

export async function writeDivisorComparisonArtifacts(input: {
  artifacts: DivisorComparisonArtifacts;
  rankingPath: string;
  candidatesPath: string;
  metadataPath: string;
}): Promise<void> {
  await Promise.all([
    writeTextFile(input.rankingPath, input.artifacts.rankingJson),
    writeTextFile(input.candidatesPath, input.artifacts.candidatesJson),
    writeTextFile(input.metadataPath, input.artifacts.metadataJson),
  ]);
}

export function roundDivisorComparisonNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot serialize a non-finite divisor comparison value.");
  }
  const rounded = Number(value.toFixed(DIVISOR_COMPARISON_NUMERIC_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundUnknownNumbers(value: unknown): unknown {
  if (typeof value === "number") {
    return roundDivisorComparisonNumber(value);
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
