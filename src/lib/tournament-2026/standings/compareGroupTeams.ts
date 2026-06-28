import type {
  FairPlayByTeamId,
  FifaRankingByTeamId,
  GroupId,
  GroupStageMatch,
  GroupTableRow,
  RankedGroupTeam,
  RankingMode,
} from "../types";
import { rankGroupTableRows } from "./tieBreakers";

export interface RankGroupOptions {
  fairPlayByTeamId?: FairPlayByTeamId;
  fifaRankingByTeamId?: FifaRankingByTeamId;
  rankingMode?: RankingMode;
  allowDeterministicFallback?: boolean;
}

export function rankGroupTeams(
  groupId: GroupId,
  table: readonly GroupTableRow[],
  matches: readonly GroupStageMatch[],
  options: RankGroupOptions = {},
): readonly RankedGroupTeam[] {
  const ranked = rankGroupTableRows(groupId, table, matches, options);

  return ranked.map(({ row, criteria }, index) => ({
    ...row,
    position: (index + 1) as RankedGroupTeam["position"],
    appliedTieBreakers: criteria,
  }));
}
