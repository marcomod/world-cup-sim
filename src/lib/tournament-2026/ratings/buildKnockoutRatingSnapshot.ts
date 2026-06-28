import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import {
  KNOCKOUT_RATING_DIVISOR,
  KNOCKOUT_RATING_K_FACTOR,
  KNOCKOUT_RATING_K_FACTOR_POLICY_ID,
  KNOCKOUT_RATING_MODEL_VERSION,
  KNOCKOUT_RATING_SNAPSHOT_SCHEMA_VERSION,
  type KnockoutRatingSnapshot,
} from "@/src/data/world-cup-2026/ratings/types";
import { deriveSnapshotState, type ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { updateRatingsFromGroupStage, type InitialRatingByTeamId } from "./updateRatingsFromGroupStage";

export function buildKnockoutRatingSnapshot(input: {
  tournamentSnapshot: ValidatedTournamentSnapshot;
  initialRatingsByTeamId?: InitialRatingByTeamId;
}): KnockoutRatingSnapshot {
  const tournamentSnapshot = input.tournamentSnapshot;
  const derivedState = deriveSnapshotState(tournamentSnapshot.snapshot.fixtures);
  if (derivedState !== "group_stage_complete") {
    throw new Error("Knockout rating snapshot generation requires a complete official group-stage snapshot.");
  }
  if (!tournamentSnapshot.metadata.snapshotChecksum) {
    throw new Error("Knockout rating snapshot generation requires a tournament snapshot checksum.");
  }

  const teamIds = tournamentSnapshot.snapshot.teams.map((team) => team.id);
  const records = updateRatingsFromGroupStage({
    fixtures: tournamentSnapshot.snapshot.fixtures,
    teamIds,
    initialRatingsByTeamId: input.initialRatingsByTeamId ?? worldFootballEloDevelopmentByTeamId,
  });

  return {
    schemaVersion: KNOCKOUT_RATING_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: "world-cup-2026-knockout-ratings",
    snapshotVersion: `${tournamentSnapshot.snapshot.snapshotVersion}-ratings-r1`,
    tournamentSnapshotId: tournamentSnapshot.snapshot.snapshotId,
    tournamentSnapshotVersion: tournamentSnapshot.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: tournamentSnapshot.metadata.snapshotChecksum,
    modelVersion: KNOCKOUT_RATING_MODEL_VERSION,
    divisor: KNOCKOUT_RATING_DIVISOR,
    kFactor: KNOCKOUT_RATING_K_FACTOR,
    kFactorPolicy: {
      value: KNOCKOUT_RATING_K_FACTOR,
      policyId: KNOCKOUT_RATING_K_FACTOR_POLICY_ID,
      rationale:
        "K=20 matches the existing project sequential Elo reconstruction baseline and is a conservative pre-registered update for three neutral-site group matches. It was selected before any 2026 knockout outcomes and is not tuned from knockout results.",
      selectedBeforeKnockoutResults: true,
    },
    initialRatingSource: {
      sourceName: "World Football Elo Ratings",
      modelVersion: "v2",
      snapshotLabel: "world-football-elo-development",
      snapshotDate: "2026-06-18",
      sourceUrl: "https://eloratings.net/",
      sourceArtifact: "data/generated/world-football-elo-development/team-ratings-v2.json",
      inputChecksum: "aa2737ecf28cff98d0606c0b26ac7f65125f5590860711c82b9c27115f4dd684",
      metadataChecksum: "923a704518087b76966bd2cd2e0705a4e1402d6002bb13e3a8ef4eda31f575a2",
      teamIdentityMappingVersion: "official-world-cup-2026-team-identities-v1",
      ratingBasis: "World Football Elo values preserved as overall ratings.",
      normalizationNotes:
        "The development rating artifact uses Elo-derived compatibility proxy fields; this refresh reads only overall ratings.",
    },
    completedMatchCount: tournamentSnapshot.snapshot.fixtures.filter((fixture) => fixture.status === "completed").length,
    fixtureRangeUsed: {
      firstFifaMatchNumber: 1,
      lastFifaMatchNumber: 72,
    },
    records,
    sources: Object.values(tournamentSnapshot.snapshot.sources).filter((source) => source !== null),
  };
}
