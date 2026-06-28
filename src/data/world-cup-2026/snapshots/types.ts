import type { GroupId, TeamId } from "@/src/lib/tournament-2026/types";

export type TournamentSnapshotVersion = string;
export type TournamentSnapshotState =
  | "structure_only"
  | "group_stage_in_progress"
  | "group_stage_complete";

export interface SnapshotTeam {
  id: TeamId;
  name: string;
  shortName: string;
  fifaCode: string;
  group: GroupId;
}

export type SnapshotFixtureStatus = "scheduled" | "completed";

export interface SnapshotFixtureResult {
  homeGoals: number;
  awayGoals: number;
}

export interface SnapshotFixture {
  id: string;
  fifaMatchNumber: number;
  group: GroupId;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  kickoffUtc: string;
  venueId: string | null;
  status: SnapshotFixtureStatus;
  result: SnapshotFixtureResult | null;
}

export interface SnapshotFairPlayRecord {
  teamId: TeamId;
  yellowCards: number;
  indirectRedCards: number;
  directRedCards: number;
  yellowAndDirectRedCards: number;
  deductionPoints: number;
}

export interface SnapshotFifaRankingRecord {
  teamId: TeamId;
  rank: number;
  rankingDate: string;
}

export interface SourceReference {
  authority: string;
  title: string;
  url: string;
  publishedDate: string | null;
  accessedDate: string;
  version: string | null;
  checksum: string | null;
}

export interface TournamentSnapshotSources {
  teams: SourceReference;
  groups: SourceReference;
  fixtures: SourceReference;
  results: SourceReference | null;
  fairPlay: SourceReference | null;
  fifaRanking: SourceReference | null;
}

export interface TournamentSnapshot {
  schemaVersion: string;
  snapshotId: string;
  snapshotVersion: TournamentSnapshotVersion;
  tournament: "fifa-world-cup-2026";
  state: TournamentSnapshotState;
  teams: readonly SnapshotTeam[];
  fixtures: readonly SnapshotFixture[];
  fairPlay: readonly SnapshotFairPlayRecord[];
  fifaRanking: readonly SnapshotFifaRankingRecord[];
  sources: TournamentSnapshotSources;
}

export interface NormalizedTournamentSnapshot extends TournamentSnapshot {
  derivedState: TournamentSnapshotState;
}

export interface TournamentSnapshotMetadata {
  schemaVersion: string;
  snapshotId: string;
  snapshotVersion: TournamentSnapshotVersion;
  tournament: "fifa-world-cup-2026";
  declaredState: TournamentSnapshotState;
  derivedState: TournamentSnapshotState;
  snapshotChecksum: string | null;
  sourceReferences: TournamentSnapshotSources;
}

export interface ValidatedTournamentSnapshot {
  snapshot: NormalizedTournamentSnapshot;
  metadata: TournamentSnapshotMetadata;
}
