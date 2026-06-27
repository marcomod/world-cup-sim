import type { Match, MatchSlot, TeamId } from "@/src/lib/simulator/types";

export type { TeamId };

export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type GroupPosition = 1 | 2 | 3 | 4;

export type GroupStageMatchStatus = "scheduled" | "completed";

export interface GroupStageMatchResult {
  homeGoals: number;
  awayGoals: number;
}

export interface GroupStageMatch {
  id: string;
  group: GroupId;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: GroupStageMatchStatus;
  result: GroupStageMatchResult | null;
}

export interface TournamentGroup {
  id: GroupId;
  teamIds: readonly TeamId[];
}

export interface Tournament2026Data {
  version: string;
  groups: readonly TournamentGroup[];
  groupStageMatches: readonly GroupStageMatch[];
}

export interface FairPlayRecord {
  teamId: TeamId;
  deductionPoints: number;
}

export type FairPlayByTeamId = Readonly<Record<TeamId, FairPlayRecord>>;

export type RankingMode = "official" | "development_fallback";

export interface GroupTableRow {
  teamId: TeamId;
  group: GroupId;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type TieBreakCriterion =
  | "overall_points"
  | "overall_goal_difference"
  | "overall_goals_for"
  | "head_to_head_points"
  | "head_to_head_goal_difference"
  | "head_to_head_goals_for"
  | "fair_play"
  | "deterministic_fallback";

export interface RankedGroupTeam extends GroupTableRow {
  position: GroupPosition;
  appliedTieBreakers: readonly TieBreakCriterion[];
}

export interface ThirdPlacedTeam extends RankedGroupTeam {
  thirdPlaceRank: number;
  qualified: boolean;
}

export interface QualificationResult {
  groupWinners: Record<GroupId, RankedGroupTeam>;
  groupRunnersUp: Record<GroupId, RankedGroupTeam>;
  thirdPlacedTeams: readonly ThirdPlacedTeam[];
  qualifiedThirdPlacedTeams: readonly ThirdPlacedTeam[];
}

export type RoundOf32ParticipantSource =
  | { type: "group_position"; group: GroupId; position: 1 | 2; label: string }
  | {
      type: "third_place";
      eligibleGroups: readonly GroupId[];
      assignmentKey: string;
      label: string;
    };

export interface RoundOf32SlotDefinition {
  matchId: string;
  homeSource: RoundOf32ParticipantSource;
  awaySource: RoundOf32ParticipantSource;
  nextMatchId: string;
  nextSlot: MatchSlot;
}

export type ThirdPlaceAssignmentKey = string;

export type ThirdPlaceSlotId =
  | "third_vs_1A"
  | "third_vs_1B"
  | "third_vs_1D"
  | "third_vs_1E"
  | "third_vs_1G"
  | "third_vs_1I"
  | "third_vs_1K"
  | "third_vs_1L";

export type ThirdPlaceAssignment = Readonly<Record<ThirdPlaceSlotId, GroupId>>;

export interface ThirdPlaceSlotAssignment {
  assignmentKey: ThirdPlaceSlotId;
  group: GroupId;
}

export type KnockoutMatchRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type AdvancementOutcome = "winner" | "loser";

export type ParticipantSlot = MatchSlot;

export interface KnockoutAdvancement {
  outcome: AdvancementOutcome;
  toMatchId: string;
  toSlot: ParticipantSlot;
}

export interface KnockoutTopologyMatch {
  matchId: string;
  round: KnockoutMatchRound;
  advancements: readonly KnockoutAdvancement[];
  championPath: boolean;
}

export interface GeneratedRoundOf32Match {
  matchId: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  sourceMetadata: {
    homeSource: RoundOf32ParticipantSource;
    awaySource: RoundOf32ParticipantSource;
  };
}

export interface GeneratedKnockoutBracket {
  matches: Match[];
}
