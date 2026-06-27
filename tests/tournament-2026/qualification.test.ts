import { describe, expect, it } from "vitest";
import { worldCup2026Groups } from "@/src/data/world-cup-2026/groups";
import { worldCup2026Tournament } from "@/src/data/world-cup-2026/tournament";
import { compareCodePoints, qualifyTeams, rankThirdPlacedTeams } from "@/src/lib/tournament-2026";
import type { GroupId, RankedGroupTeam } from "@/src/lib/tournament-2026";
import { buildRankedTables } from "./helpers";

describe("qualification", () => {
  it("qualifies 12 winners, 12 runners-up, and eight third-placed teams", () => {
    const tables = buildRankedTables();
    const qualification = qualifyTeams(tables, { allowDeterministicFallback: true });

    expect(Object.values(qualification.groupWinners)).toHaveLength(12);
    expect(Object.values(qualification.groupRunnersUp)).toHaveLength(12);
    expect(qualification.thirdPlacedTeams).toHaveLength(12);
    expect(qualification.qualifiedThirdPlacedTeams).toHaveLength(8);
    expect([...qualification.qualifiedThirdPlacedTeams.map((team) => team.group)].sort(compareCodePoints)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
    ]);
  });

  it("fails qualification for incomplete group stages", () => {
    const tables = buildRankedTables(worldCup2026Groups, worldCup2026Tournament.groupStageMatches);

    expect(() => qualifyTeams(tables, { allowDeterministicFallback: true })).toThrow(/incomplete/);
  });

  it("ranks third-placed teams deterministically from reversed group inputs", () => {
    const tables = buildRankedTables();
    const reversedTables = Object.fromEntries(Object.entries(tables).reverse()) as Record<
      GroupId,
      readonly RankedGroupTeam[]
    >;

    expect(rankThirdPlacedTeams(reversedTables, { allowDeterministicFallback: true })).toEqual(
      rankThirdPlacedTeams(tables, { allowDeterministicFallback: true }),
    );
  });
});
