import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  HistoricalEloGeneratedMetadata,
  HistoricalPredictionObservation,
  SequentialEloReconstructionResult,
  TeamRatingState,
} from "./types.ts";

export const HISTORICAL_ELO_NUMERIC_PRECISION = 6;
export const GENERATED_FILE_WARNING = "Do not edit manually." as const;

export interface HistoricalEloArtifacts {
  observationsJson: string;
  finalRatingsJson: string;
  metadataJson: string;
}

export function createHistoricalEloGeneratedMetadata(input: {
  result: SequentialEloReconstructionResult;
  sourceFile: string;
  sourceChecksumSha256: string;
}): HistoricalEloGeneratedMetadata {
  return {
    generatedFileWarning: GENERATED_FILE_WARNING,
    ...input.result.metadata,
    sourceFile: input.sourceFile,
    sourceChecksumSha256: input.sourceChecksumSha256,
    numericPrecision: HISTORICAL_ELO_NUMERIC_PRECISION,
    numericSerializationPolicy:
      "Calculations retain full precision; generated ratings and probabilities are rounded to 6 decimal places and negative zero is serialized as zero.",
    generationTimestampPolicy:
      "No wall-clock timestamp is written; identical validated input and configuration produce byte-stable artifacts.",
  };
}

export function createHistoricalEloArtifacts(input: {
  result: SequentialEloReconstructionResult;
  metadata: HistoricalEloGeneratedMetadata;
}): HistoricalEloArtifacts {
  return {
    observationsJson: toJson({
      generatedFileWarning: GENERATED_FILE_WARNING,
      modelVersion: input.result.metadata.modelVersion,
      observations: input.result.observations.map(serializeObservation),
    }),
    finalRatingsJson: toJson({
      generatedFileWarning: GENERATED_FILE_WARNING,
      modelVersion: input.result.metadata.modelVersion,
      finalRatings: input.result.finalRatings.map(serializeTeamRating),
    }),
    metadataJson: toJson(input.metadata),
  };
}

export async function writeHistoricalEloArtifacts(input: {
  artifacts: HistoricalEloArtifacts;
  observationsPath: string;
  finalRatingsPath: string;
  metadataPath: string;
}): Promise<void> {
  await Promise.all([
    writeTextFile(input.observationsPath, input.artifacts.observationsJson),
    writeTextFile(input.finalRatingsPath, input.artifacts.finalRatingsJson),
    writeTextFile(input.metadataPath, input.artifacts.metadataJson),
  ]);
}

function serializeObservation(
  observation: HistoricalPredictionObservation,
): HistoricalPredictionObservation {
  return {
    ...observation,
    preMatchHomeRating: roundForSerialization(observation.preMatchHomeRating),
    preMatchAwayRating: roundForSerialization(observation.preMatchAwayRating),
    predictedHomeScore: roundForSerialization(observation.predictedHomeScore),
  };
}

function serializeTeamRating(team: TeamRatingState): TeamRatingState {
  return { ...team, rating: roundForSerialization(team.rating) };
}

export function roundForSerialization(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot serialize a non-finite sequential Elo value.");
  }

  const rounded = Number(value.toFixed(HISTORICAL_ELO_NUMERIC_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

