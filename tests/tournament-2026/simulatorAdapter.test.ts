import { describe, expect, it } from "vitest";
import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import { teamRatingsV2ByTeamId } from "@/src/data/teamRatingsV2";
import { createSeededRng } from "@/src/lib/simulator/rng";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import {
  adaptRoundOf32ToSimulatorBracket,
  generateRoundOf32,
  knockoutTopology,
  qualifyTeams,
} from "@/src/lib/tournament-2026";
import { buildRankedTables } from "./helpers";

describe("simulator adapter", () => {
  it("adapts generated matches to the existing simulator bracket from champion-path topology", () => {
    const qualification = qualifyTeams(buildRankedTables(), { allowDeterministicFallback: true });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const bracket = adaptRoundOf32ToSimulatorBracket(roundOf32, teamRatingsV2ByTeamId);
    const championPathTopology = knockoutTopology.filter((match) => match.championPath);

    expect(bracket).toHaveLength(31);
    expect(bracket.map((match) => match.id)).toEqual(championPathTopology.map((match) => match.matchId));

    for (const match of bracket) {
      const topology = championPathTopology.find((candidate) => candidate.matchId === match.id);
      const winnerAdvancement = topology?.advancements.find((advancement) => advancement.outcome === "winner");
      expect(match.nextMatchId).toBe(winnerAdvancement?.toMatchId);
      expect(match.nextSlot).toBe(winnerAdvancement?.toSlot);
    }
  });

  it("keeps canonical third-place loser links out of the champion-path simulator adapter", () => {
    const qualification = qualifyTeams(buildRankedTables(), { allowDeterministicFallback: true });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const bracket = adaptRoundOf32ToSimulatorBracket(roundOf32, teamRatingsV2ByTeamId);
    const semifinalA = knockoutTopology.find((match) => match.matchId === "m101");
    const semifinalB = knockoutTopology.find((match) => match.matchId === "m102");

    expect(semifinalA?.advancements).toEqual([
      { outcome: "winner", toMatchId: "m104", toSlot: "teamAId" },
      { outcome: "loser", toMatchId: "m103", toSlot: "teamAId" },
    ]);
    expect(semifinalB?.advancements).toEqual([
      { outcome: "winner", toMatchId: "m104", toSlot: "teamBId" },
      { outcome: "loser", toMatchId: "m103", toSlot: "teamBId" },
    ]);
    expect(bracket.some((match) => match.id === "m103")).toBe(false);
    expect(bracket.find((match) => match.id === "m101")?.nextMatchId).toBe("m104");
    expect(bracket.find((match) => match.id === "m102")?.nextMatchId).toBe("m104");
  });

  it("keeps simulator output deterministic", () => {
    const qualification = qualifyTeams(buildRankedTables(), {
      allowDeterministicFallback: true,
    });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const bracket = adaptRoundOf32ToSimulatorBracket(roundOf32, teamRatingsV2ByTeamId);
    const resultA = simulateBracket(bracket, teamRatingsV2ByTeamId, createSeededRng(2026));
    const resultB = simulateBracket(bracket, teamRatingsV2ByTeamId, createSeededRng(2026));

    expect(resultA).toEqual(resultB);
  });

  it("fails when an active rating is missing", () => {
    const qualification = qualifyTeams(buildRankedTables(), { allowDeterministicFallback: true });
    const roundOf32 = generateRoundOf32(qualification, roundOf32SlotDefinitions);
    const ratingsWithoutMexico = { ...teamRatingsV2ByTeamId };
    delete ratingsWithoutMexico.mex;

    expect(() => adaptRoundOf32ToSimulatorBracket(roundOf32, ratingsWithoutMexico)).toThrow(
      /without active ratings/,
    );
  });
});
