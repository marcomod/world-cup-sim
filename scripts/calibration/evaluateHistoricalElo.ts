import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  HistoricalEloGeneratedMetadata,
  HistoricalPredictionObservation,
} from "./sequential-elo/types.ts";
import {
  EVALUATION_COHORT_NAMES,
  EVALUATION_GENERATED_FILE_WARNING,
  EVALUATION_MODEL_VERSION,
  EVALUATION_NUMERIC_PRECISION,
  EVALUATION_SPLIT_NAMES,
  createEvaluationArtifacts,
  evaluateHistoricalObservations,
  validateSourceObservations,
  writeEvaluationArtifacts,
  type EvaluationReportMetadata,
} from "./evaluation/index.ts";

const SOURCE_OBSERVATIONS_PATH =
  "data/generated/calibration/historical-elo/observations.json";
const SOURCE_METADATA_PATH =
  "data/generated/calibration/historical-elo/metadata.json";
const OUTPUT_DIRECTORY = "data/generated/calibration/evaluation";
const SUMMARY_PATH = `${OUTPUT_DIRECTORY}/summary.json`;
const BY_COHORT_PATH = `${OUTPUT_DIRECTORY}/by-cohort.json`;
const METADATA_PATH = `${OUTPUT_DIRECTORY}/metadata.json`;

interface ObservationDocument {
  generatedFileWarning: string;
  modelVersion: string;
  observations: HistoricalPredictionObservation[];
}

export async function generateHistoricalEvaluationArtifacts(): Promise<{
  observationCount: number;
  resultCount: number;
}> {
  const observationBuffer = await readFile(resolve(SOURCE_OBSERVATIONS_PATH));
  const observationChecksum = createHash("sha256")
    .update(observationBuffer)
    .digest("hex");
  const observationDocument = parseObservationDocument(observationBuffer.toString("utf8"));
  const reconstructionMetadata = parseReconstructionMetadata(
    await readFile(resolve(SOURCE_METADATA_PATH), "utf8"),
  );
  if (observationDocument.modelVersion !== reconstructionMetadata.modelVersion) {
    throw new Error(
      "Historical Elo observation and reconstruction metadata model versions do not match.",
    );
  }
  if (observationDocument.observations.length !== reconstructionMetadata.matchCount) {
    throw new Error(
      "Historical Elo observation count does not match reconstruction metadata.",
    );
  }
  validateSourceObservations(observationDocument.observations);

  const metadata: EvaluationReportMetadata = {
    generatedFileWarning: EVALUATION_GENERATED_FILE_WARNING,
    evaluationModelVersion: EVALUATION_MODEL_VERSION,
    sourceObservationFile: SOURCE_OBSERVATIONS_PATH,
    sourceObservationChecksumSha256: observationChecksum,
    sourceReconstructionMetadata: reconstructionMetadata,
    cohorts: EVALUATION_COHORT_NAMES,
    splits: EVALUATION_SPLIT_NAMES,
    numericPrecision: EVALUATION_NUMERIC_PRECISION,
    numericSerializationPolicy:
      "Metrics retain full precision during calculation and are rounded to 6 decimal places only in generated JSON; negative zero is serialized as zero.",
    generationTimestampPolicy:
      "No wall-clock timestamp is written; identical source observations produce byte-stable evaluation artifacts.",
    binaryTargetPolicy:
      "Only decisive non-shootout matches are binary-scored. Draws, replay-era non-decisive ties, and penalty shootouts are excluded from binary metrics; penalties_only remains descriptive.",
    sampleSizePolicy:
      "Every result reports selectedSampleSize and scoredSampleSize explicitly; excludedFromBinaryScoring equals selectedSampleSize minus scoredSampleSize, and zero-scored results use null metrics.",
    knockoutStagePolicy:
      "group_stage_playoff is included as a knockout tiebreak/elimination stage and contributes five full-history records; final_group_stage and other group formats are excluded from knockout cohorts.",
    holdoutPolicy:
      "The 2022 holdout is reported but must not be used for tuning or model selection.",
  };
  const report = evaluateHistoricalObservations({
    observations: observationDocument.observations,
    metadata,
  });
  const artifacts = createEvaluationArtifacts(report);

  await writeEvaluationArtifacts({
    artifacts,
    summaryPath: SUMMARY_PATH,
    byCohortPath: BY_COHORT_PATH,
    metadataPath: METADATA_PATH,
  });

  for (const result of report.results) {
    console.log(
      `${result.cohort}/${result.split}: selected ${result.selectedSampleSize}, scored ${result.scoredSampleSize}.`,
    );
  }
  console.log(`Evaluation artifacts: ${SUMMARY_PATH}, ${BY_COHORT_PATH}, ${METADATA_PATH}.`);

  return {
    observationCount: observationDocument.observations.length,
    resultCount: report.results.length,
  };
}

function parseObservationDocument(contents: string): ObservationDocument {
  const parsed: unknown = JSON.parse(contents);
  if (
    !isRecord(parsed) ||
    parsed.generatedFileWarning !== "Do not edit manually." ||
    parsed.modelVersion !== "sequential-elo-v1" ||
    !Array.isArray(parsed.observations)
  ) {
    throw new Error("Historical Elo observation artifact has an invalid shape.");
  }
  return parsed as unknown as ObservationDocument;
}

function parseReconstructionMetadata(contents: string): HistoricalEloGeneratedMetadata {
  const parsed: unknown = JSON.parse(contents);
  if (
    !isRecord(parsed) ||
    parsed.generatedFileWarning !== "Do not edit manually." ||
    parsed.modelVersion !== "sequential-elo-v1" ||
    typeof parsed.sourceChecksumSha256 !== "string" ||
    !isRecord(parsed.config)
  ) {
    throw new Error("Historical Elo reconstruction metadata has an invalid shape.");
  }
  return parsed as unknown as HistoricalEloGeneratedMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function main(): Promise<void> {
  const summary = await generateHistoricalEvaluationArtifacts();
  console.log(
    `Historical Elo evaluation complete: ${summary.observationCount} source observations, ${summary.resultCount} cohort/split results.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical Elo evaluation failed: ${message}`);
    process.exitCode = 1;
  });
}
