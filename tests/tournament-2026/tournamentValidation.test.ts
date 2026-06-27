import { describe, expect, it } from "vitest";
import { worldCup2026Tournament } from "@/src/data/world-cup-2026/tournament";
import { validateTournament2026Data } from "@/src/lib/tournament-2026";

describe("2026 tournament validation", () => {
  it("validates the static 12-group, 48-team tournament data", () => {
    expect(() => validateTournament2026Data(worldCup2026Tournament)).not.toThrow();
  });

  it("rejects duplicate group-stage match IDs", () => {
    const duplicate = {
      ...worldCup2026Tournament,
      groupStageMatches: [
        worldCup2026Tournament.groupStageMatches[0],
        {
          ...worldCup2026Tournament.groupStageMatches[1],
          id: worldCup2026Tournament.groupStageMatches[0].id,
        },
        ...worldCup2026Tournament.groupStageMatches.slice(2),
      ],
    };

    expect(() => validateTournament2026Data(duplicate)).toThrow(/Duplicate group-stage match ID/);
  });

  it("rejects invalid fixture shape and results", () => {
    expect(() =>
      validateTournament2026Data({
        ...worldCup2026Tournament,
        groupStageMatches: [
          { ...worldCup2026Tournament.groupStageMatches[0], awayTeamId: "arg" },
          ...worldCup2026Tournament.groupStageMatches.slice(1),
        ],
      }),
    ).toThrow(/outside Group A/);

    expect(() =>
      validateTournament2026Data({
        ...worldCup2026Tournament,
        groupStageMatches: [
          {
            ...worldCup2026Tournament.groupStageMatches[0],
            homeTeamId: worldCup2026Tournament.groupStageMatches[0].awayTeamId,
          },
          ...worldCup2026Tournament.groupStageMatches.slice(1),
        ],
      }),
    ).toThrow(/same team twice/);

    expect(() =>
      validateTournament2026Data({
        ...worldCup2026Tournament,
        groupStageMatches: [
          {
            ...worldCup2026Tournament.groupStageMatches[0],
            status: "scheduled",
            result: { homeGoals: 1, awayGoals: 0 },
          },
          ...worldCup2026Tournament.groupStageMatches.slice(1),
        ],
      }),
    ).toThrow(/Scheduled/);

    expect(() =>
      validateTournament2026Data({
        ...worldCup2026Tournament,
        groupStageMatches: [
          {
            ...worldCup2026Tournament.groupStageMatches[0],
            status: "completed",
            result: { homeGoals: -1, awayGoals: 0 },
          },
          ...worldCup2026Tournament.groupStageMatches.slice(1),
        ],
      }),
    ).toThrow(/invalid goals/);
  });
});
