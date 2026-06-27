import type { GroupId } from "./types";

export const GROUP_IDS: readonly GroupId[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;

export const GROUP_STAGE_MATCHES_PER_GROUP = 6;
export const GROUP_STAGE_MATCHES_PER_TEAM = 3;
export const TOURNAMENT_2026_TEAM_COUNT = 48;
export const GROUP_COUNT = 12;
export const TEAMS_PER_GROUP = 4;
export const ROUND_OF_32_MATCH_COUNT = 16;

export function compareCodePointStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

export const compareCodePoints = compareCodePointStrings;

export function isGroupId(value: string): value is GroupId {
  return GROUP_IDS.includes(value as GroupId);
}
