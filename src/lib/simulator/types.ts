export type TeamId = string;

export interface Team {
  id: TeamId;
  name: string;
  abbreviation: string;
  flagUrl?: string;
  confederation?: string;
}

export type TeamsById = Partial<Record<TeamId, Team>>;

export interface TeamRating {
  teamId: TeamId;
  overall: number;
  attack: number;
  defense: number;
  recentForm?: number;
  squadStrength?: number;
  penalties?: number;
}

export type TournamentRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final";

export type MatchSlot = "teamAId" | "teamBId";

export interface Match {
  id: string;
  round: TournamentRound;
  teamAId: TeamId | null;
  teamBId: TeamId | null;
  nextMatchId?: string;
  nextSlot?: MatchSlot;
  winnerId?: TeamId;
}

export interface RNG {
  next(): number;
}

export interface MatchupProbability {
  teamAId: TeamId;
  teamBId: TeamId;
  teamAWinProbability: number;
  teamBWinProbability: number;
}

export interface MatchSimulationResult {
  winnerId: TeamId;
  loserId: TeamId;
  teamAWinProbability: number;
  teamBWinProbability: number;
}

export interface TournamentSimulationResult {
  championId: TeamId;
  matches: Match[];
}

export type RatingsByTeamId = Record<TeamId, TeamRating>;
