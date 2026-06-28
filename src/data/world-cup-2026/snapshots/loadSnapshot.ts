import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { computeTournamentSnapshotChecksum } from "./snapshotChecksum";
import { validateTournamentSnapshot } from "./validateSnapshot";
import type { ValidatedTournamentSnapshot } from "./types";

export function loadTournamentSnapshot(filePath: string): ValidatedTournamentSnapshot {
  const fileLabel = basename(filePath);
  let raw: string;

  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read tournament snapshot "${fileLabel}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Unable to parse tournament snapshot "${fileLabel}" as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    const validated = validateTournamentSnapshot(parsed);
    return {
      ...validated,
      metadata: {
        ...validated.metadata,
        snapshotChecksum: computeTournamentSnapshotChecksum(parsed),
      },
    };
  } catch (error) {
    throw new Error(
      `Invalid tournament snapshot "${fileLabel}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
