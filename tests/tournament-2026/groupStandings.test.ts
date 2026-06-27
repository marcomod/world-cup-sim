import { describe, expect, it } from "vitest";
import { worldCup2026Groups } from "@/src/data/world-cup-2026/groups";
import { worldCup2026Tournament } from "@/src/data/world-cup-2026/tournament";
import { calculateGroupTable } from "@/src/lib/tournament-2026";
import { createMatch } from "./helpers";

describe("group standings", () => {
  it("calculates wins, draws, losses, goals, points, and ignores scheduled matches", () => {
    const group = worldCup2026Groups[0];
    const matches = [
      createMatch("a-1", "A", group.teamIds[0], group.teamIds[1], 2, 1),
      { ...worldCup2026Tournament.groupStageMatches[1], status: "scheduled" as const, result: null },
    ];

    const table = calculateGroupTable("A", group.teamIds, matches);
    const winner = table.find((row) => row.teamId === group.teamIds[0]);
    const idle = table.find((row) => row.teamId === group.teamIds[2]);

    expect(winner).toMatchObject({ played: 1, wins: 1, goalsFor: 2, goalsAgainst: 1, points: 3 });
    expect(idle).toMatchObject({ played: 0, points: 0 });
  });

  it("is deterministic when match order is reversed", () => {
    const group = worldCup2026Groups[0];
    const matches = [
      createMatch("a-1", "A", group.teamIds[0], group.teamIds[1], 2, 1),
      createMatch("a-2", "A", group.teamIds[2], group.teamIds[3], 1, 1),
      createMatch("a-3", "A", group.teamIds[0], group.teamIds[2], 0, 0),
    ];

    expect(calculateGroupTable("A", group.teamIds, matches)).toEqual(
      calculateGroupTable("A", group.teamIds, [...matches].reverse()),
    );
  });
});
