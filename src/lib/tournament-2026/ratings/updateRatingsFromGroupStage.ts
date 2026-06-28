import type { TeamId } from "@/src/lib/tournament-2026/types";
import type { SnapshotFixture } from "@/src/data/world-cup-2026/snapshots/types";
import {
  KNOCKOUT_RATING_DIVISOR,
  KNOCKOUT_RATING_K_FACTOR,
  type KnockoutRatingRecord,
} from "@/src/data/world-cup-2026/ratings/types";

export type InitialRatingByTeamId = Readonly<Record<TeamId, { overall: number }>>;

function expectedScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, -(teamRating - opponentRating) / KNOCKOUT_RATING_DIVISOR));
}

function actualHomeScore(result: { homeGoals: number; awayGoals: number }): number {
  if (result.homeGoals > result.awayGoals) {
    return 1;
  }
  if (result.homeGoals < result.awayGoals) {
    return 0;
  }
  return 0.5;
}

export function updateRatingsFromGroupStage(input: {
  fixtures: readonly SnapshotFixture[];
  teamIds: readonly TeamId[];
  initialRatingsByTeamId: InitialRatingByTeamId;
}): KnockoutRatingRecord[] {
  const ratings = new Map<TeamId, number>();
  const initialRatings = new Map<TeamId, number>();

  for (const teamId of input.teamIds) {
    const rating = input.initialRatingsByTeamId[teamId]?.overall;
    if (!Number.isFinite(rating)) {
      throw new Error(`Missing reliable initial rating for team "${teamId}".`);
    }
    ratings.set(teamId, rating);
    initialRatings.set(teamId, rating);
  }

  const completedFixtures = [...input.fixtures]
    .filter((fixture) => fixture.status === "completed")
    .sort((left, right) => left.fifaMatchNumber - right.fifaMatchNumber);

  for (const fixture of completedFixtures) {
    if (!fixture.result) {
      throw new Error(`Completed fixture "${fixture.id}" is missing a result.`);
    }
    const homeRating = ratings.get(fixture.homeTeamId);
    const awayRating = ratings.get(fixture.awayTeamId);
    if (homeRating === undefined || awayRating === undefined) {
      throw new Error(`Fixture "${fixture.id}" references a team without an initial rating.`);
    }

    const expectedHome = expectedScore(homeRating, awayRating);
    const actualHome = actualHomeScore(fixture.result);
    const deltaHome = KNOCKOUT_RATING_K_FACTOR * (actualHome - expectedHome);
    ratings.set(fixture.homeTeamId, homeRating + deltaHome);
    ratings.set(fixture.awayTeamId, awayRating - deltaHome);
  }

  return input.teamIds.map((teamId): KnockoutRatingRecord => {
    const preTournamentRating = initialRatings.get(teamId);
    const knockoutRating = ratings.get(teamId);
    if (preTournamentRating === undefined || knockoutRating === undefined) {
      throw new Error(`Missing final rating state for team "${teamId}".`);
    }
    return {
      teamId,
      preTournamentRating,
      groupStageDelta: knockoutRating - preTournamentRating,
      knockoutRating,
    };
  });
}
