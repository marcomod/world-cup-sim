import type { NormalizedHistoricalMatch } from "../../historical-pipeline/schemas.ts";
import type {
  HistoricalPredictionObservation,
  PreMatchEloSnapshot,
} from "./types.ts";

export function getObservedHomeScore(
  match: NormalizedHistoricalMatch,
): 0 | 0.5 | 1 {
  if (match.wentToPenalties || match.outcomeStatus !== "decisive") {
    return 0.5;
  }

  return match.winnerTeamId === match.teamAId ? 1 : 0;
}

export function buildHistoricalPredictionObservation(input: {
  match: NormalizedHistoricalMatch;
  preMatch: PreMatchEloSnapshot;
  predictedHomeScore: number;
  observedHomeScore: 0 | 0.5 | 1;
}): HistoricalPredictionObservation {
  const { match, preMatch, predictedHomeScore, observedHomeScore } = input;

  return {
    matchId: match.matchId,
    tournamentYear: match.tournamentYear,
    date: match.date,
    stage: match.stage,
    homeTeamId: match.teamAId,
    awayTeamId: match.teamBId,
    preMatchHomeRating: preMatch.homeRating,
    preMatchAwayRating: preMatch.awayRating,
    predictedHomeScore,
    observedHomeScore,
    outcomeStatus: match.outcomeStatus,
    winnerTeamId: match.winnerTeamId,
    decidedByPenalties: match.wentToPenalties,
  };
}

