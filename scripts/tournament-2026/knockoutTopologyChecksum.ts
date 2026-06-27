import { createHash } from "node:crypto";
import {
  normalizeKnockoutTopology,
  serializeNormalizedKnockoutTopology,
} from "../../src/lib/tournament-2026/bracket/normalizeKnockoutTopology.ts";
import type { KnockoutTopologyMatch } from "../../src/lib/tournament-2026/types.ts";

export function computeKnockoutTopologyChecksum(
  topology: readonly KnockoutTopologyMatch[],
): string {
  const normalized = normalizeKnockoutTopology(topology);
  const serialized = serializeNormalizedKnockoutTopology(normalized);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
