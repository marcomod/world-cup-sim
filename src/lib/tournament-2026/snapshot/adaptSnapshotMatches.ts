import type { GroupStageMatch } from "../types";
import type { ValidatedTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/types";

export function adaptSnapshotMatches(snapshot: ValidatedTournamentSnapshot): readonly GroupStageMatch[] {
  return snapshot.snapshot.fixtures.map((fixture) => ({
    id: fixture.id,
    group: fixture.group,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    status: fixture.status,
    result: fixture.result
      ? { homeGoals: fixture.result.homeGoals, awayGoals: fixture.result.awayGoals }
      : null,
  }));
}
