import { createHash } from "node:crypto";
import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import {
  BASELINE_SEQUENTIAL_ELO_CONFIG,
  reconstructHistoricalElo,
} from "../sequential-elo/index.ts";
import { validateCandidateDivisor } from "./candidateDivisors.ts";
import type { DivisorCandidateReconstruction } from "./types.ts";

export function reconstructDivisorCandidate(input: {
  matches: readonly NormalizedHistoricalMatch[];
  divisor: number;
  sourceChecksumSha256: string;
}): DivisorCandidateReconstruction {
  validateCandidateDivisor(input.divisor);
  validateChecksum(input.sourceChecksumSha256);

  const config = {
    ...BASELINE_SEQUENTIAL_ELO_CONFIG,
    divisor: input.divisor,
  };
  const result = reconstructHistoricalElo(input.matches, config);
  const observationIdentityChecksumSha256 = createHash("sha256")
    .update(result.observations.map((observation) => observation.matchId).join("\n"))
    .digest("hex");

  return {
    divisor: input.divisor,
    config: { ...result.metadata.config },
    result,
    summary: {
      sourceChecksumSha256: input.sourceChecksumSha256,
      observationIdentityChecksumSha256,
      matchCount: result.metadata.matchCount,
      observationCount: result.observations.length,
      teamCount: result.metadata.teamCount,
      firstDate: result.metadata.firstDate,
      lastDate: result.metadata.lastDate,
      multiMatchDateCount: result.metadata.multiMatchDateCount,
      matchesOnMultiMatchDates: result.metadata.matchesOnMultiMatchDates,
      maxMatchesOnSingleDate: result.metadata.maxMatchesOnSingleDate,
    },
  };
}

function validateChecksum(checksum: string): void {
  if (!/^[0-9a-f]{64}$/u.test(checksum)) {
    throw new Error(
      "Historical Elo divisor comparison requires a lowercase SHA-256 source checksum.",
    );
  }
}
