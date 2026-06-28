import { GROUP_IDS } from "../constants";
import type { TournamentGroup } from "../types";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/types";

export function adaptSnapshotTeams(snapshot: ValidatedTournamentSnapshot): readonly TournamentGroup[] {
  return GROUP_IDS.map((groupId) => ({
    id: groupId,
    teamIds: snapshot.snapshot.teams
      .filter((team) => team.group === groupId)
      .map((team) => team.id),
  }));
}
