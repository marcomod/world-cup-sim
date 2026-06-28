import type {
  FifaRankingByTeamId,
  GroupId,
  QualificationResult,
  RankedGroupTeam,
  RankingMode,
  TeamId,
  TournamentGroup,
} from "../types";
import type { Match, RatingsByTeamId } from "@/src/lib/simulator/types";
import type {
  TournamentSnapshotMetadata,
  ValidatedTournamentSnapshot,
} from "@/src/data/world-cup-2026/snapshots/types";
import type { GeneratedRoundOf32Match } from "../types";

export interface TournamentStateAuditRecord extends TournamentSnapshotMetadata {
  completedFixtureCount: number;
  remainingFixtureCount: number;
  tournamentDomainVersion: "world-cup-2026-domain-v1";
  annexCChecksum: string;
  topologyChecksum: string;
  activeRatingsModelVersion: string;
}

export interface TournamentStateBase {
  snapshotMetadata: TournamentStateAuditRecord;
  groups: readonly TournamentGroup[];
  groupTables: Readonly<Record<GroupId, readonly RankedGroupTeam[]>>;
  completedMatchCount: number;
  remainingMatchCount: number;
}

export interface IncompleteTournamentState extends TournamentStateBase {
  status: "group_stage_incomplete";
}

export interface KnockoutReadyTournamentState extends TournamentStateBase {
  status: "knockout_ready";
  qualification: QualificationResult;
  roundOf32: readonly GeneratedRoundOf32Match[];
  simulatorBracket: readonly Match[];
}

export interface OfficialTieUnresolvedTournamentState extends TournamentStateBase {
  status: "official_tie_unresolved";
  reason: string;
}

export type TournamentStateResult =
  | IncompleteTournamentState
  | KnockoutReadyTournamentState
  | OfficialTieUnresolvedTournamentState;

export interface BuildTournamentStateOptions {
  rankingMode?: RankingMode;
  ratingsByTeamId: RatingsByTeamId;
}

export interface SnapshotAdapterContext {
  validatedSnapshot: ValidatedTournamentSnapshot;
}

export type SnapshotFifaRankingByTeamId = FifaRankingByTeamId;
export type SnapshotTeamId = TeamId;
