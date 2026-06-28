import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";

export const fixturePath = (name: string): string =>
  join(process.cwd(), "src/data/world-cup-2026/snapshots/fixtures", name);

export function readSnapshotFixture(name: string): TournamentSnapshot {
  return JSON.parse(readFileSync(fixturePath(name), "utf8")) as TournamentSnapshot;
}

export function completeSnapshot(): TournamentSnapshot {
  return readSnapshotFixture("synthetic-complete.snapshot.json");
}

export function validatedCompleteSnapshot() {
  return loadTournamentSnapshot(fixturePath("synthetic-complete.snapshot.json"));
}

export function loadSnapshotFixture(name: string) {
  return loadTournamentSnapshot(fixturePath(name));
}

export function cloneSnapshot(snapshot: TournamentSnapshot): TournamentSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TournamentSnapshot;
}
