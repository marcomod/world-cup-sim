import type { TeamId } from "../../src/lib/simulator/types.ts";
import { teamAliasEntries } from "./teamAliases.ts";
import type {
  NormalizedTeamRatingRecord,
  RawTeamRatingRecord,
  TeamAliasEntry,
} from "./schemas.ts";

export function normalizeAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function createAliasResolver(
  aliasEntries: TeamAliasEntry[] = teamAliasEntries,
): Map<string, TeamId> {
  const aliasesByName = new Map<string, TeamId>();

  for (const entry of aliasEntries) {
    const entryAliases = new Set<string>();

    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeAlias(alias);

      if (!normalizedAlias) {
        throw new Error(`Alias for team "${entry.teamId}" cannot be empty.`);
      }

      if (entryAliases.has(normalizedAlias)) {
        throw new Error(
          `Duplicate alias "${alias}" for teamId "${entry.teamId}".`,
        );
      }

      entryAliases.add(normalizedAlias);

      const existingTeamId = aliasesByName.get(normalizedAlias);

      if (existingTeamId) {
        if (existingTeamId === entry.teamId) {
          throw new Error(
            `Duplicate alias "${alias}" for teamId "${entry.teamId}".`,
          );
        }

        throw new Error(
          `Conflicting alias "${alias}" maps to both "${existingTeamId}" and "${entry.teamId}".`,
        );
      }

      aliasesByName.set(normalizedAlias, entry.teamId);
    }
  }

  return aliasesByName;
}

export function resolveTeamIdFromSourceName(
  sourceName: string,
  aliasEntries: TeamAliasEntry[] = teamAliasEntries,
): TeamId {
  const normalizedSourceName = normalizeAlias(sourceName);
  const teamId = createAliasResolver(aliasEntries).get(normalizedSourceName);

  if (!teamId) {
    throw new Error(`Unknown source team name "${sourceName}". Add an explicit alias.`);
  }

  return teamId;
}

export function normalizeRawTeamRatingRecord(
  record: RawTeamRatingRecord,
  aliasEntries: TeamAliasEntry[] = teamAliasEntries,
): NormalizedTeamRatingRecord {
  return {
    teamId: resolveTeamIdFromSourceName(record.sourceName, aliasEntries),
    sourceName: record.sourceName.trim(),
    overall: record.sourceElo,
    sourceDate: record.sourceDate,
    sourceNote: record.sourceNote,
  };
}

export function normalizeRawTeamRatingRecords(
  records: RawTeamRatingRecord[],
  aliasEntries: TeamAliasEntry[] = teamAliasEntries,
): NormalizedTeamRatingRecord[] {
  return records.map((record) => normalizeRawTeamRatingRecord(record, aliasEntries));
}
