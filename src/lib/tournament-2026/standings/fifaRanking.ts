import { compareCodePoints } from "../constants";
import type { FifaRankingByTeamId, GroupTableRow, TeamId } from "../types";

function assertValidFifaRankingRecords(fifaRankingByTeamId: FifaRankingByTeamId | undefined): void {
  if (!fifaRankingByTeamId) {
    return;
  }

  const seenTeamIds = new Set<TeamId>();
  const seenRanks = new Map<number, TeamId>();
  let rankingDate: string | null = null;

  for (const [key, record] of Object.entries(fifaRankingByTeamId)) {
    if (record.teamId !== key) {
      throw new Error(`FIFA ranking record key "${key}" does not match team "${record.teamId}".`);
    }

    if (seenTeamIds.has(record.teamId)) {
      throw new Error(`Duplicate FIFA ranking record for team "${record.teamId}".`);
    }
    seenTeamIds.add(record.teamId);

    if (!Number.isInteger(record.rank) || record.rank <= 0) {
      throw new Error(`FIFA ranking for team "${record.teamId}" must be a positive integer.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.rankingDate) || Number.isNaN(Date.parse(record.rankingDate))) {
      throw new Error(`FIFA ranking date for team "${record.teamId}" must be a valid ISO date.`);
    }

    if (rankingDate === null) {
      rankingDate = record.rankingDate;
    } else if (rankingDate !== record.rankingDate) {
      throw new Error("FIFA ranking records must use one ranking date.");
    }

    const duplicateTeamId = seenRanks.get(record.rank);
    if (duplicateTeamId) {
      throw new Error(
        `Duplicate FIFA ranking ${record.rank} for teams "${duplicateTeamId}" and "${record.teamId}".`,
      );
    }
    seenRanks.set(record.rank, record.teamId);
  }
}

export function getFifaRankingsForTie(
  teams: readonly GroupTableRow[],
  fifaRankingByTeamId: FifaRankingByTeamId | undefined,
  context: string,
): Map<TeamId, number> {
  assertValidFifaRankingRecords(fifaRankingByTeamId);

  const missing = teams
    .filter((team) => !fifaRankingByTeamId?.[team.teamId])
    .map((team) => team.teamId)
    .sort(compareCodePoints);

  if (missing.length > 0) {
    throw new Error(`${context} requires FIFA ranking data; missing records for ${missing.join(", ")}.`);
  }

  return new Map(
    teams.map((team) => {
      const record = fifaRankingByTeamId?.[team.teamId];
      if (!record) {
        throw new Error(`${context} requires FIFA ranking data; missing record for ${team.teamId}.`);
      }
      return [team.teamId, record.rank] as const;
    }),
  );
}
