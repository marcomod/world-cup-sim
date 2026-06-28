import {
  KNOCKOUT_RATING_DIVISOR,
  KNOCKOUT_RATING_K_FACTOR,
  KNOCKOUT_RATING_K_FACTOR_POLICY_ID,
  KNOCKOUT_RATING_MODEL_VERSION,
  KNOCKOUT_RATING_SNAPSHOT_SCHEMA_VERSION,
} from "./types";
import { normalizeKnockoutRatingSnapshot } from "./normalizeRatingSnapshot";
import type { KnockoutRatingSnapshot, NormalizedKnockoutRatingSnapshot } from "./types";

function assertFiniteNumber(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be finite.`);
  }
}

export function validateKnockoutRatingSnapshot(
  snapshot: KnockoutRatingSnapshot,
): NormalizedKnockoutRatingSnapshot {
  if (snapshot.schemaVersion !== KNOCKOUT_RATING_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported knockout rating schema "${snapshot.schemaVersion}".`);
  }
  if (snapshot.modelVersion !== KNOCKOUT_RATING_MODEL_VERSION) {
    throw new Error(`Unsupported knockout rating model "${snapshot.modelVersion}".`);
  }
  if (snapshot.divisor !== KNOCKOUT_RATING_DIVISOR) {
    throw new Error("Knockout rating snapshot divisor must remain 400.");
  }
  if (snapshot.kFactor !== KNOCKOUT_RATING_K_FACTOR) {
    throw new Error(`Knockout rating snapshot kFactor must be ${KNOCKOUT_RATING_K_FACTOR}.`);
  }
  if (
    snapshot.kFactorPolicy.value !== KNOCKOUT_RATING_K_FACTOR ||
    snapshot.kFactorPolicy.policyId !== KNOCKOUT_RATING_K_FACTOR_POLICY_ID ||
    snapshot.kFactorPolicy.selectedBeforeKnockoutResults !== true ||
    snapshot.kFactorPolicy.rationale.trim() === ""
  ) {
    throw new Error("Knockout rating snapshot must include the approved K-factor policy metadata.");
  }
  if (
    snapshot.initialRatingSource.sourceName.trim() === "" ||
    snapshot.initialRatingSource.snapshotDate.trim() === "" ||
    !/^[a-f0-9]{64}$/.test(snapshot.initialRatingSource.inputChecksum) ||
    !/^[a-f0-9]{64}$/.test(snapshot.initialRatingSource.metadataChecksum)
  ) {
    throw new Error("Knockout rating snapshot must include complete initial-rating source metadata.");
  }
  if (snapshot.completedMatchCount !== 72) {
    throw new Error("Knockout rating snapshot must record exactly 72 processed group matches.");
  }
  if (
    snapshot.fixtureRangeUsed.firstFifaMatchNumber !== 1 ||
    snapshot.fixtureRangeUsed.lastFifaMatchNumber !== 72
  ) {
    throw new Error("Knockout rating snapshot fixture range must cover FIFA match numbers 1 through 72.");
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.tournamentSnapshotChecksum)) {
    throw new Error("Knockout rating snapshot must reference a valid tournament snapshot checksum.");
  }
  if (snapshot.records.length !== 48) {
    throw new Error("Knockout rating snapshot must contain exactly 48 rating records.");
  }

  const seen = new Set<string>();
  for (const record of snapshot.records) {
    if (typeof record.teamId !== "string" || record.teamId.trim() === "") {
      throw new Error("Knockout rating record teamId must be a non-empty string.");
    }
    if (seen.has(record.teamId)) {
      throw new Error(`Duplicate knockout rating record for team "${record.teamId}".`);
    }
    seen.add(record.teamId);

    assertFiniteNumber(record.preTournamentRating, `ratings.${record.teamId}.preTournamentRating`);
    assertFiniteNumber(record.groupStageDelta, `ratings.${record.teamId}.groupStageDelta`);
    assertFiniteNumber(record.knockoutRating, `ratings.${record.teamId}.knockoutRating`);
    if (Math.abs(record.preTournamentRating + record.groupStageDelta - record.knockoutRating) > 1e-9) {
      throw new Error(`Knockout rating arithmetic mismatch for team "${record.teamId}".`);
    }
  }

  return {
    ...normalizeKnockoutRatingSnapshot(snapshot),
    ratingChecksum: null,
  };
}
