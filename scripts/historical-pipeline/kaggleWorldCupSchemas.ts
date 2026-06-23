export const KAGGLE_WORLD_CUP_HEADERS = [
  "home_team",
  "away_team",
  "home_score",
  "home_xg",
  "home_penalty",
  "away_score",
  "away_xg",
  "away_penalty",
  "home_manager",
  "home_captain",
  "away_manager",
  "away_captain",
  "Attendance",
  "Venue",
  "Officials",
  "Round",
  "Date",
  "Score",
  "Referee",
  "Notes",
  "Host",
  "Year",
  "home_goal",
  "away_goal",
  "home_goal_long",
  "away_goal_long",
  "home_own_goal",
  "away_own_goal",
  "home_penalty_goal",
  "away_penalty_goal",
  "home_penalty_miss_long",
  "away_penalty_miss_long",
  "home_penalty_shootout_goal_long",
  "away_penalty_shootout_goal_long",
  "home_penalty_shootout_miss_long",
  "away_penalty_shootout_miss_long",
  "home_red_card",
  "away_red_card",
  "home_yellow_red_card",
  "away_yellow_red_card",
  "home_yellow_card_long",
  "away_yellow_card_long",
  "home_substitute_in_long",
  "away_substitute_in_long",
] as const;

export const KAGGLE_WORLD_CUP_ROUNDS = [
  "Final",
  "Third-place match",
  "Semi-finals",
  "Quarter-finals",
  "Round of 16",
  "Group stage",
  "Second group stage",
  "First group stage",
  "Second round",
  "First round",
  "Group stage play-off",
  "Final stage",
] as const;

export type KaggleWorldCupRound = (typeof KAGGLE_WORLD_CUP_ROUNDS)[number];

export interface KaggleWorldCupSourceRow {
  sourceRowNumber: number;
  home_team: string;
  away_team: string;
  home_score: string;
  home_xg: string;
  home_penalty: string;
  away_score: string;
  away_xg: string;
  away_penalty: string;
  home_manager: string;
  home_captain: string;
  away_manager: string;
  away_captain: string;
  Attendance: string;
  Venue: string;
  Officials: string;
  Round: string;
  Date: string;
  Score: string;
  Referee: string;
  Notes: string;
  Host: string;
  Year: string;
  home_goal: string;
  away_goal: string;
  home_goal_long: string;
  away_goal_long: string;
  home_own_goal: string;
  away_own_goal: string;
  home_penalty_goal: string;
  away_penalty_goal: string;
  home_penalty_miss_long: string;
  away_penalty_miss_long: string;
  home_penalty_shootout_goal_long: string;
  away_penalty_shootout_goal_long: string;
  home_penalty_shootout_miss_long: string;
  away_penalty_shootout_miss_long: string;
  home_red_card: string;
  away_red_card: string;
  home_yellow_red_card: string;
  away_yellow_red_card: string;
  home_yellow_card_long: string;
  away_yellow_card_long: string;
  home_substitute_in_long: string;
  away_substitute_in_long: string;
}

export interface KaggleWorldCupProvenance {
  sourceName: string;
  sourceUrl: string;
  datasetAuthor: string;
  accessDate: string;
  licence: string;
  attribution: string;
  redistributionStatus: string;
  expectedFilename: string;
  fileSizeBytes: number;
  sha256: string;
  rowCount: number;
  yearRange: [number, number];
  sourceVersionOrUpdateDate: string | null;
  sourceVersionBasis: string;
  rawFileModified: boolean;
  notes: string[];
}
