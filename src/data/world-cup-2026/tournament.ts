import { worldCup2026Groups } from "./groups";
import type { GroupStageMatch, Tournament2026Data } from "@/src/lib/tournament-2026/types";

const GROUP_PAIRINGS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2],
];

function buildScheduledGroupMatches(): readonly GroupStageMatch[] {
  return worldCup2026Groups.flatMap((group) =>
    GROUP_PAIRINGS.map(([homeIndex, awayIndex], matchIndex) => ({
      id: `group-${group.id.toLowerCase()}-${matchIndex + 1}`,
      group: group.id,
      homeTeamId: group.teamIds[homeIndex],
      awayTeamId: group.teamIds[awayIndex],
      status: "scheduled" as const,
      result: null,
    })),
  );
}

export const worldCup2026Tournament: Tournament2026Data = {
  version: "2026-group-draw-development-v1",
  groups: worldCup2026Groups,
  groupStageMatches: buildScheduledGroupMatches(),
};
