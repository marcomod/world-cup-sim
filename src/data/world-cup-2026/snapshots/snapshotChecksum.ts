import { createHash } from "node:crypto";
import { validateTournamentSnapshot } from "./validateSnapshot";
import type { NormalizedTournamentSnapshot } from "./types";

export function serializeNormalizedTournamentSnapshot(snapshot: NormalizedTournamentSnapshot): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    snapshotVersion: snapshot.snapshotVersion,
    tournament: snapshot.tournament,
    derivedState: snapshot.derivedState,
    teams: snapshot.teams,
    fixtures: snapshot.fixtures,
    fairPlay: snapshot.fairPlay,
    fifaRanking: snapshot.fifaRanking,
    sources: snapshot.sources,
  });
}

export function computeTournamentSnapshotChecksum(snapshot: unknown): string {
  const { snapshot: normalized } = validateTournamentSnapshot(snapshot);
  return createHash("sha256")
    .update(Buffer.from(serializeNormalizedTournamentSnapshot(normalized), "utf8"))
    .digest("hex");
}
