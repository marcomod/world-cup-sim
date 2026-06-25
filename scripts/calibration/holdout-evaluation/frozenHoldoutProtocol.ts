import { createHash } from "node:crypto";
import type { FrozenHoldoutProtocol } from "./types.ts";

export const HOLDOUT_EVALUATION_MODEL_VERSION =
  "historical-elo-holdout-evaluation-v1" as const;

export const HOLDOUT_EVALUATION_COHORTS = Object.freeze([
  "all_matches",
  "decisive_only",
  "knockout_only",
  "knockout_decisive_only",
] as const);

export const HOLDOUT_CANDIDATE_DIVISORS = Object.freeze([200, 400] as const);

export const FROZEN_HOLDOUT_PROTOCOL: Readonly<FrozenHoldoutProtocol> = Object.freeze({
  selectedDivisor: 200,
  referenceDivisor: 400,
  primaryCohort: "knockout_decisive_only",
  primaryMetric: "brierScore",
  secondaryMetric: "logLoss",
  holdoutSplit: "holdout",
  holdoutTournamentYear: 2022,
});

export function getFrozenHoldoutProtocolChecksum(): string {
  return createStableSha256(FROZEN_HOLDOUT_PROTOCOL);
}

export function createStableSha256(value: unknown): string {
  return createHash("sha256").update(`${JSON.stringify(value)}\n`).digest("hex");
}

export function createTextSha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}
