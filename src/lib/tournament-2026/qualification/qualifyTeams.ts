import { GROUP_IDS } from "../constants";
import { rankThirdPlacedTeams, type RankThirdPlacedTeamsOptions } from "../standings";
import type { GroupId, QualificationResult, RankedGroupTeam } from "../types";

export function qualifyTeams(
  groupTables: Readonly<Record<GroupId, readonly RankedGroupTeam[]>>,
  options: RankThirdPlacedTeamsOptions = {},
): QualificationResult {
  const groupWinners = {} as Record<GroupId, RankedGroupTeam>;
  const groupRunnersUp = {} as Record<GroupId, RankedGroupTeam>;

  for (const groupId of GROUP_IDS) {
    const table = groupTables[groupId];
    if (!table || table.length !== 4) {
      throw new Error(`Group ${groupId} must contain exactly four ranked teams.`);
    }

    if (table.some((team) => team.played !== 3)) {
      throw new Error(`Group ${groupId} is incomplete and cannot produce qualifiers.`);
    }

    const winner = table.find((team) => team.position === 1);
    const runnerUp = table.find((team) => team.position === 2);

    if (!winner || !runnerUp) {
      throw new Error(`Group ${groupId} is missing winner or runner-up rows.`);
    }

    groupWinners[groupId] = winner;
    groupRunnersUp[groupId] = runnerUp;
  }

  const thirdPlacedTeams = rankThirdPlacedTeams(groupTables, options);
  const qualifiedThirdPlacedTeams = thirdPlacedTeams.filter((team) => team.qualified);
  const qualifiedIds = [
    ...Object.values(groupWinners).map((team) => team.teamId),
    ...Object.values(groupRunnersUp).map((team) => team.teamId),
    ...qualifiedThirdPlacedTeams.map((team) => team.teamId),
  ];

  if (qualifiedIds.length !== 32 || new Set(qualifiedIds).size !== 32) {
    throw new Error("Qualification must produce exactly 32 unique teams.");
  }

  return {
    groupWinners,
    groupRunnersUp,
    thirdPlacedTeams,
    qualifiedThirdPlacedTeams,
  };
}
