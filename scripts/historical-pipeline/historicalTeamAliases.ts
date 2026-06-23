import type {
  HistoricalTeamAliasEntry,
  HistoricalTeamId,
} from "./schemas.ts";

// Predecessor states retain pipeline-local identities. They are not silently
// collapsed into modern national teams for future historical analysis.
export const historicalTeamAliasEntries: readonly HistoricalTeamAliasEntry[] = [
  { teamId: "alg", aliases: ["Algeria"] },
  { teamId: "ang", aliases: ["Angola"] },
  { teamId: "arg", aliases: ["Argentina"] },
  { teamId: "aus", aliases: ["Australia"] },
  { teamId: "aut", aliases: ["Austria"] },
  { teamId: "bel", aliases: ["Belgium"] },
  { teamId: "bol", aliases: ["Bolivia"] },
  { teamId: "bih", aliases: ["Bosnia and Herzegovina"] },
  { teamId: "bra", aliases: ["Brazil"] },
  { teamId: "bul", aliases: ["Bulgaria"] },
  { teamId: "cmr", aliases: ["Cameroon"] },
  { teamId: "can", aliases: ["Canada"] },
  { teamId: "chi", aliases: ["Chile"] },
  { teamId: "chn", aliases: ["China PR"] },
  { teamId: "col", aliases: ["Colombia"] },
  { teamId: "crc", aliases: ["Costa Rica"] },
  { teamId: "cro", aliases: ["Croatia"] },
  { teamId: "cub", aliases: ["Cuba"] },
  { teamId: "civ", aliases: ["Côte d'Ivoire", "Cote d'Ivoire", "Ivory Coast"] },
  { teamId: "cze", aliases: ["Czech Republic", "Czechia"] },
  { teamId: "czechoslovakia", aliases: ["Czechoslovakia"] },
  { teamId: "den", aliases: ["Denmark"] },
  { teamId: "dutch-east-indies", aliases: ["Dutch East Indies"] },
  { teamId: "ecu", aliases: ["Ecuador"] },
  { teamId: "egy", aliases: ["Egypt"] },
  { teamId: "slv", aliases: ["El Salvador"] },
  { teamId: "eng", aliases: ["England"] },
  { teamId: "fra", aliases: ["France"] },
  { teamId: "fr-yugoslavia", aliases: ["FR Yugoslavia"] },
  { teamId: "ger", aliases: ["Germany"] },
  { teamId: "germany-dr", aliases: ["Germany DR"] },
  { teamId: "gha", aliases: ["Ghana"] },
  { teamId: "gre", aliases: ["Greece"] },
  { teamId: "hai", aliases: ["Haiti"] },
  { teamId: "hon", aliases: ["Honduras"] },
  { teamId: "hun", aliases: ["Hungary"] },
  { teamId: "irn", aliases: ["IR Iran", "Iran"] },
  { teamId: "isl", aliases: ["Iceland"] },
  { teamId: "irq", aliases: ["Iraq"] },
  { teamId: "isr", aliases: ["Israel"] },
  { teamId: "ita", aliases: ["Italy"] },
  { teamId: "jam", aliases: ["Jamaica"] },
  { teamId: "jpn", aliases: ["Japan"] },
  { teamId: "prk", aliases: ["Korea DPR", "North Korea"] },
  { teamId: "kor", aliases: ["South Korea", "Korea Republic"] },
  { teamId: "kuw", aliases: ["Kuwait"] },
  { teamId: "mex", aliases: ["Mexico"] },
  { teamId: "mar", aliases: ["Morocco"] },
  { teamId: "ned", aliases: ["Netherlands", "Holland"] },
  { teamId: "nzl", aliases: ["New Zealand"] },
  { teamId: "nga", aliases: ["Nigeria"] },
  { teamId: "nir", aliases: ["Northern Ireland"] },
  { teamId: "nor", aliases: ["Norway"] },
  { teamId: "pan", aliases: ["Panama"] },
  { teamId: "par", aliases: ["Paraguay"] },
  { teamId: "per", aliases: ["Peru"] },
  { teamId: "pol", aliases: ["Poland"] },
  { teamId: "por", aliases: ["Portugal"] },
  { teamId: "qat", aliases: ["Qatar"] },
  { teamId: "irl", aliases: ["Republic of Ireland"] },
  { teamId: "rou", aliases: ["Romania"] },
  { teamId: "rus", aliases: ["Russia", "Russian Federation"] },
  { teamId: "ksa", aliases: ["Saudi Arabia"] },
  { teamId: "sco", aliases: ["Scotland"] },
  { teamId: "sen", aliases: ["Senegal"] },
  { teamId: "srb", aliases: ["Serbia"] },
  {
    teamId: "serbia-and-montenegro",
    aliases: ["Serbia and Montenegro"],
  },
  { teamId: "svk", aliases: ["Slovakia"] },
  { teamId: "svn", aliases: ["Slovenia"] },
  { teamId: "rsa", aliases: ["South Africa"] },
  { teamId: "soviet-union", aliases: ["Soviet Union", "USSR"] },
  { teamId: "esp", aliases: ["Spain"] },
  { teamId: "swe", aliases: ["Sweden"] },
  { teamId: "sui", aliases: ["Switzerland"] },
  { teamId: "tog", aliases: ["Togo"] },
  { teamId: "tri", aliases: ["Trinidad and Tobago"] },
  { teamId: "tun", aliases: ["Tunisia"] },
  { teamId: "tur", aliases: ["Türkiye", "Turkey", "Turkiye"] },
  { teamId: "ukr", aliases: ["Ukraine"] },
  { teamId: "uae", aliases: ["United Arab Emirates"] },
  { teamId: "usa", aliases: ["United States", "USA", "United States of America"] },
  { teamId: "uru", aliases: ["Uruguay"] },
  { teamId: "wal", aliases: ["Wales"] },
  { teamId: "west-germany", aliases: ["West Germany", "Germany FR"] },
  { teamId: "yugoslavia", aliases: ["Yugoslavia"] },
  { teamId: "zaire", aliases: ["Zaire"] },
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
