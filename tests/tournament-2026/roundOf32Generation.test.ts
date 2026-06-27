import { describe, expect, it } from "vitest";
import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import {
  generateRoundOf32,
  qualifyTeams,
} from "@/src/lib/tournament-2026";
import { buildRankedTables } from "./helpers";

describe("Round-of-32 generation", () => {
  it("generates 16 Round-of-32 matches and consumes exactly 32 qualified teams", () => {
    const qualification = qualifyTeams(buildRankedTables(), { allowDeterministicFallback: true });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const teamIds = roundOf32.flatMap((match) => [match.homeTeamId, match.awayTeamId]);

    expect(roundOf32).toHaveLength(16);
    expect(new Set(teamIds).size).toBe(32);
    expect(roundOf32.map((match) => match.matchId)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 73}`),
    );
  });

  it("is deterministic with reversed qualified third-place input order", () => {
    const qualification = qualifyTeams(buildRankedTables(), { allowDeterministicFallback: true });
    const reversed = {
      ...qualification,
      qualifiedThirdPlacedTeams: [...qualification.qualifiedThirdPlacedTeams].reverse(),
    };

    expect(generateRoundOf32(reversed, roundOf32SlotDefinitions)).toEqual(
      generateRoundOf32(qualification, roundOf32SlotDefinitions),
    );
  });
});
