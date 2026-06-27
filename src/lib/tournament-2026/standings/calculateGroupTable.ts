import { compareCodePoints } from "../constants";
import type {
  GroupId,
  GroupStageMatch,
  GroupTableRow,
  TeamId,
} from "../types";

function assertCompletedResult(match: GroupStageMatch): asserts match is GroupStageMatch & {
  result: { homeGoals: number; awayGoals: number };
} {
  if (match.status !== "completed") {
    return;
  }

  if (!match.result) {
    throw new Error(`Completed group match "${match.id}" is missing a result.`);
  }

  const goals = [match.result.homeGoals, match.result.awayGoals];
  if (!goals.every((goal) => Number.isInteger(goal) && goal >= 0)) {
    throw new Error(`Completed group match "${match.id}" has invalid goals.`);
  }
}

export function calculateGroupTable(
  groupId: GroupId,
  teamIds: readonly TeamId[],
  matches: readonly GroupStageMatch[],
): readonly GroupTableRow[] {
  const teamSet = new Set(teamIds);
  if (teamSet.size !== teamIds.length) {
    throw new Error(`Group ${groupId} contains duplicate team IDs.`);
  }

  const rows = new Map<TeamId, GroupTableRow>(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        group: groupId,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );

  const groupMatches = matches.filter((match) => match.group === groupId);

  for (const match of groupMatches) {
    if (!teamSet.has(match.homeTeamId) || !teamSet.has(match.awayTeamId)) {
      throw new Error(`Group ${groupId} match "${match.id}" contains a team outside the group.`);
    }

    if (match.homeTeamId === match.awayTeamId) {
      throw new Error(`Group ${groupId} match "${match.id}" contains the same team twice.`);
    }

    if (match.status === "scheduled") {
      if (match.result) {
        throw new Error(`Scheduled group match "${match.id}" must not contain a result.`);
      }
      continue;
    }

    assertCompletedResult(match);

    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) {
      throw new Error(`Group ${groupId} match "${match.id}" references an unknown team.`);
    }

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.result.homeGoals;
    home.goalsAgainst += match.result.awayGoals;
    away.goalsFor += match.result.awayGoals;
    away.goalsAgainst += match.result.homeGoals;

    if (match.result.homeGoals > match.result.awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (match.result.homeGoals < match.result.awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const table = [...rows.values()].map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
  }));

  const completedMatches = groupMatches.filter((match) => match.status === "completed").length;
  const playedTotal = table.reduce((sum, row) => sum + row.played, 0);
  const goalsForTotal = table.reduce((sum, row) => sum + row.goalsFor, 0);
  const goalsAgainstTotal = table.reduce((sum, row) => sum + row.goalsAgainst, 0);

  for (const row of table) {
    if (row.wins + row.draws + row.losses !== row.played) {
      throw new Error(`Group ${groupId} table invariant failed for team "${row.teamId}".`);
    }
  }

  if (playedTotal !== completedMatches * 2) {
    throw new Error(`Group ${groupId} played total does not match completed fixtures.`);
  }

  if (goalsForTotal !== goalsAgainstTotal) {
    throw new Error(`Group ${groupId} goals-for total does not match goals-against total.`);
  }

  return table.sort((left, right) => compareCodePoints(left.teamId, right.teamId));
}
