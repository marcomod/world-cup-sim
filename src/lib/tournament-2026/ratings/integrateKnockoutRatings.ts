import type { RatingsByTeamId, TeamRatingV2 } from "@/src/lib/simulator/types";
import { validateKnockoutRatingSnapshot } from "@/src/data/world-cup-2026/ratings";
import type { KnockoutRatingSnapshot } from "@/src/data/world-cup-2026/ratings";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { buildTournamentState } from "@/src/lib/tournament-2026/snapshot/buildTournamentState";
import type { TournamentStateResult } from "@/src/lib/tournament-2026/snapshot/types";

function ratingToTeamRating(record: { teamId: string; knockoutRating: number }): TeamRatingV2 {
  return {
    teamId: record.teamId,
    modelVersion: "v2",
    overall: record.knockoutRating,
    attack: 80,
    defense: 80,
    recentForm: 80,
    squadStrength: 80,
    penalties: 80,
  };
}

export function buildTournamentStateWithKnockoutRatings(input: {
  tournamentSnapshot: ValidatedTournamentSnapshot;
  ratingSnapshot: KnockoutRatingSnapshot;
}): TournamentStateResult {
  const ratingSnapshot = validateKnockoutRatingSnapshot(input.ratingSnapshot);
  const tournamentChecksum = input.tournamentSnapshot.metadata.snapshotChecksum;
  if (!tournamentChecksum || ratingSnapshot.tournamentSnapshotChecksum !== tournamentChecksum) {
    throw new Error("Knockout rating snapshot does not match the tournament snapshot checksum.");
  }

  const ratingsByTeamId = Object.fromEntries(
    ratingSnapshot.records.map((record) => [record.teamId, ratingToTeamRating(record)]),
  ) as RatingsByTeamId;
  const state = buildTournamentState(input.tournamentSnapshot, {
    ratingsByTeamId,
    rankingMode: "official",
  });

  if (state.status === "knockout_ready") {
    for (const match of state.roundOf32) {
      if (!ratingsByTeamId[match.homeTeamId] || !ratingsByTeamId[match.awayTeamId]) {
        throw new Error("Knockout rating snapshot is missing a qualified-team rating.");
      }
    }
  }

  return state;
}
