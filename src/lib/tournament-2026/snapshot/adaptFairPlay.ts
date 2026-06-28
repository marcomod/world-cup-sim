import type { FairPlayByTeamId } from "../types";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/types";

export function adaptSnapshotFairPlay(snapshot: ValidatedTournamentSnapshot): FairPlayByTeamId {
  return Object.fromEntries(
    snapshot.snapshot.fairPlay.map((record) => [
      record.teamId,
      { teamId: record.teamId, deductionPoints: record.deductionPoints },
    ]),
  ) as FairPlayByTeamId;
}
