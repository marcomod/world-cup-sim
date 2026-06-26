import { createHash } from "node:crypto";
import type { FrozenUncertaintyProtocol } from "./types.ts";

export const UNCERTAINTY_ANALYSIS_MODEL_VERSION =
  "historical-elo-uncertainty-analysis-v1" as const;

export const FROZEN_UNCERTAINTY_PROTOCOL: Readonly<FrozenUncertaintyProtocol> =
  Object.freeze({
    selectedDivisor: 200,
    referenceDivisor: 400,
    cohort: "knockout_decisive_only",
    metrics: Object.freeze(["brierScore", "logLoss"] as const),
    deltaDirection: "selected_minus_reference",
    bootstrapMethod: "paired_match_percentile",
    bootstrapReplications: 100000,
    confidenceLevel: 0.95,
    seed: 2026200400,
    splits: Object.freeze(["development", "validation", "holdout"] as const),
  });

export function createTextSha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function createStableSeed(input: string): number {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0);
}
