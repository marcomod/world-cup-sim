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
  modelVersion?: "v1" | "v2";
  overall: number;
  attack: number;
  defense: number;
  recentForm?: number;
  squadStrength?: number;
  penalties?: number;
}

export interface TeamRatingV2 extends TeamRating {
  modelVersion: "v2";
  recentForm: number;
  squadStrength: number;
  penalties: number;
}

export type TournamentRound =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "final";

export type MatchSlot = "teamAId" | "teamBId";

export interface MatchScore {
  teamAGoals: number;
  teamBGoals: number;
  decidedBy: "regular_time" | "extra_time" | "penalties";
  teamAPenalties?: number;
  teamBPenalties?: number;
}

export interface Match {
  id: string;
  round: TournamentRound;
  teamAId: TeamId | null;
  teamBId: TeamId | null;
  nextMatchId?: string;
  nextSlot?: MatchSlot;
  winnerId?: TeamId;
  score?: MatchScore;
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
  score?: MatchScore;
}

export type MatchSimulationOptions =
  | {
      includeScoreline?: false;
      scoreRng?: never;
    }
  | {
      includeScoreline: true;
      scoreRng: RNG;
    };

export type BracketSimulationOptions = MatchSimulationOptions;

export interface TournamentSimulationResult {
  championId: TeamId;
  matches: Match[];
}

export interface TeamTournamentOdds {
  teamId: TeamId;
  roundOf16Probability: number;
  quarterfinalProbability: number;
  semifinalProbability: number;
  finalProbability: number;
  championProbability: number;
}

export interface MonteCarloOptions {
  matches: Match[];
  ratingsByTeamId: RatingsByTeamId;
  simulationCount: number;
  rng: RNG;
}

export interface MonteCarloResult {
  simulationCount: number;
  teamOdds: TeamTournamentOdds[];
}

export type RatingsByTeamId = Record<TeamId, TeamRating>;
