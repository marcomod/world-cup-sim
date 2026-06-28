import { createHash } from "node:crypto";
import {
  normalizeKnockoutRatingSnapshot,
  serializeKnockoutRatingSnapshot,
} from "../../src/data/world-cup-2026/ratings/normalizeRatingSnapshot.ts";
import type { KnockoutRatingSnapshot } from "../../src/data/world-cup-2026/ratings/types.ts";

export function computeKnockoutRatingSnapshotChecksum(snapshot: KnockoutRatingSnapshot): string {
  const normalized = normalizeKnockoutRatingSnapshot(snapshot);
  return createHash("sha256").update(serializeKnockoutRatingSnapshot(normalized), "utf8").digest("hex");
}
