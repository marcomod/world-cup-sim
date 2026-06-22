import type {
  HistoricalTeamAliasEntry,
  HistoricalTeamId,
} from "./schemas.ts";

// Predecessor states retain pipeline-local identities. They are not silently
// collapsed into modern national teams for future historical analysis.
export const historicalTeamAliasEntries: readonly HistoricalTeamAliasEntry[] = [
  { teamId: "arg", aliases: ["Argentina"] },
  { teamId: "bel", aliases: ["Belgium"] },
  { teamId: "bra", aliases: ["Brazil"] },
  { teamId: "chi", aliases: ["Chile"] },
  { teamId: "cro", aliases: ["Croatia"] },
  { teamId: "civ", aliases: ["Côte d'Ivoire", "Cote d'Ivoire", "Ivory Coast"] },
  { teamId: "cze", aliases: ["Czech Republic", "Czechia"] },
  { teamId: "czechoslovakia", aliases: ["Czechoslovakia"] },
  { teamId: "eng", aliases: ["England"] },
  { teamId: "fra", aliases: ["France"] },
  { teamId: "ger", aliases: ["Germany"] },
  { teamId: "gha", aliases: ["Ghana"] },
  { teamId: "ita", aliases: ["Italy"] },
  { teamId: "jpn", aliases: ["Japan"] },
  { teamId: "kor", aliases: ["South Korea", "Korea Republic"] },
  { teamId: "mex", aliases: ["Mexico"] },
  { teamId: "mar", aliases: ["Morocco"] },
  { teamId: "ned", aliases: ["Netherlands", "Holland"] },
  { teamId: "nga", aliases: ["Nigeria"] },
  { teamId: "pol", aliases: ["Poland"] },
  { teamId: "por", aliases: ["Portugal"] },
  { teamId: "rus", aliases: ["Russia", "Russian Federation"] },
  { teamId: "soviet-union", aliases: ["Soviet Union", "USSR"] },
  { teamId: "esp", aliases: ["Spain"] },
  { teamId: "swe", aliases: ["Sweden"] },
  { teamId: "sui", aliases: ["Switzerland"] },
  { teamId: "usa", aliases: ["United States", "USA", "United States of America"] },
  { teamId: "uru", aliases: ["Uruguay"] },
  { teamId: "west-germany", aliases: ["West Germany", "Germany FR"] },
  { teamId: "yugoslavia", aliases: ["Yugoslavia"] },
] as const;

const AMBIGUOUS_HISTORICAL_NAMES = new Set(
  ["Korea", "Congo", "Ireland", "Germany/Yugoslavia", "Yugoslavia/Serbia"].map(
    normalizeHistoricalTeamName,
  ),
);

export function normalizeHistoricalTeamName(sourceName: string): string {
  return sourceName.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function validateHistoricalTeamAliases(
  aliasEntries: readonly HistoricalTeamAliasEntry[] = historicalTeamAliasEntries,
): void {
  const seenTeamIds = new Set<HistoricalTeamId>();
  const aliasesByName = new Map<string, HistoricalTeamId>();

  for (const entry of aliasEntries) {
    if (!entry.teamId.trim()) {
      throw new Error("Historical team alias entry has an empty teamId.");
    }

    if (seenTeamIds.has(entry.teamId)) {
      throw new Error(`Duplicate historical alias entry for teamId "${entry.teamId}".`);
    }

    seenTeamIds.add(entry.teamId);
    const entryAliases = new Set<string>();

    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeHistoricalTeamName(alias);

      if (!normalizedAlias) {
        throw new Error(`Historical alias for teamId "${entry.teamId}" cannot be empty.`);
      }

      if (AMBIGUOUS_HISTORICAL_NAMES.has(normalizedAlias)) {
        throw new Error(
          `Historical alias "${alias}" for teamId "${entry.teamId}" is ambiguous and must not be mapped.`,
        );
      }

      if (entryAliases.has(normalizedAlias)) {
        throw new Error(
          `Duplicate historical alias "${alias}" within teamId "${entry.teamId}".`,
        );
      }

      entryAliases.add(normalizedAlias);
      const existingTeamId = aliasesByName.get(normalizedAlias);

      if (existingTeamId && existingTeamId !== entry.teamId) {
        throw new Error(
          `Conflicting historical alias "${alias}" maps to both "${existingTeamId}" and "${entry.teamId}".`,
        );
      }

      aliasesByName.set(normalizedAlias, entry.teamId);
    }
  }
}

export function resolveHistoricalTeamId(
  sourceName: string,
  aliasEntries: readonly HistoricalTeamAliasEntry[] = historicalTeamAliasEntries,
): HistoricalTeamId {
  validateHistoricalTeamAliases(aliasEntries);
  const normalizedName = normalizeHistoricalTeamName(sourceName);

  if (AMBIGUOUS_HISTORICAL_NAMES.has(normalizedName)) {
    throw new Error(
      `Ambiguous historical team name "${sourceName}" requires an explicit identity and cannot be guessed.`,
    );
  }

  for (const entry of aliasEntries) {
    if (entry.aliases.some((alias) => normalizeHistoricalTeamName(alias) === normalizedName)) {
      return entry.teamId;
    }
  }

  throw new Error(
    `Unknown historical team name "${sourceName}". Add an explicit alias before normalization.`,
  );
}
