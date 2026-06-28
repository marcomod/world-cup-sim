import type { FifaRankingByTeamId } from "../types";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/types";

export function adaptSnapshotFifaRanking(snapshot: ValidatedTournamentSnapshot): FifaRankingByTeamId {
  return Object.fromEntries(
    snapshot.snapshot.fifaRanking.map((record) => [
      record.teamId,
      { teamId: record.teamId, rank: record.rank, rankingDate: record.rankingDate },
    ]),
  ) as FifaRankingByTeamId;
}
