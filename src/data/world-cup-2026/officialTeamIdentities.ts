import type { GroupId, TeamId } from "@/src/lib/tournament-2026/types";

export interface OfficialTeamIdentity {
  id: TeamId;
  fifaCode: string;
  officialName: string;
  localDisplayName: string;
  shortName: string;
  group: GroupId;
  sourceNames: readonly string[];
  aliases: readonly string[];
}

export const officialWorldCup2026TeamIdentities: readonly OfficialTeamIdentity[] = [
  {
    id: "cze",
    fifaCode: "CZE",
    officialName: "Czechia",
    localDisplayName: "Czech Republic",
    shortName: "Czechia",
    group: "A",
    sourceNames: ["Czechia"],
    aliases: ["CZE", "Czech Republic", "Czechia"],
  },
  {
    id: "kor",
    fifaCode: "KOR",
    officialName: "Korea Republic",
    localDisplayName: "South Korea",
    shortName: "South Korea",
    group: "A",
    sourceNames: ["Korea Republic"],
    aliases: ["KOR", "Korea Republic", "South Korea"],
  },
  {
    id: "mex",
    fifaCode: "MEX",
    officialName: "Mexico",
    localDisplayName: "Mexico",
    shortName: "Mexico",
    group: "A",
    sourceNames: ["Mexico"],
    aliases: ["MEX", "Mexico"],
  },
  {
    id: "rsa",
    fifaCode: "RSA",
    officialName: "South Africa",
    localDisplayName: "South Africa",
    shortName: "South Africa",
    group: "A",
    sourceNames: ["South Africa"],
    aliases: ["RSA", "South Africa"],
  },
  {
    id: "bih",
    fifaCode: "BIH",
    officialName: "Bosnia and Herzegovina",
    localDisplayName: "Bosnia and Herzegovina",
    shortName: "Bosnia and Herzegovina",
    group: "B",
    sourceNames: ["Bosnia and Herzegovina"],
    aliases: ["BIH", "Bosnia and Herzegovina"],
  },
  {
    id: "can",
    fifaCode: "CAN",
    officialName: "Canada",
    localDisplayName: "Canada",
    shortName: "Canada",
    group: "B",
    sourceNames: ["Canada"],
    aliases: ["CAN", "Canada"],
  },
  {
    id: "qat",
    fifaCode: "QAT",
    officialName: "Qatar",
    localDisplayName: "Qatar",
    shortName: "Qatar",
    group: "B",
    sourceNames: ["Qatar"],
    aliases: ["QAT", "Qatar"],
  },
  {
    id: "sui",
    fifaCode: "SUI",
    officialName: "Switzerland",
    localDisplayName: "Switzerland",
    shortName: "Switzerland",
    group: "B",
    sourceNames: ["Switzerland"],
    aliases: ["SUI", "Switzerland"],
  },
  {
    id: "bra",
    fifaCode: "BRA",
    officialName: "Brazil",
    localDisplayName: "Brazil",
    shortName: "Brazil",
    group: "C",
    sourceNames: ["Brazil"],
    aliases: ["BRA", "Brazil"],
  },
  {
    id: "hai",
    fifaCode: "HAI",
    officialName: "Haiti",
    localDisplayName: "Haiti",
    shortName: "Haiti",
    group: "C",
    sourceNames: ["Haiti"],
    aliases: ["HAI", "Haiti"],
  },
  {
    id: "mar",
    fifaCode: "MAR",
    officialName: "Morocco",
    localDisplayName: "Morocco",
    shortName: "Morocco",
    group: "C",
    sourceNames: ["Morocco"],
    aliases: ["MAR", "Morocco"],
  },
  {
    id: "sco",
    fifaCode: "SCO",
    officialName: "Scotland",
    localDisplayName: "Scotland",
    shortName: "Scotland",
    group: "C",
    sourceNames: ["Scotland"],
    aliases: ["SCO", "Scotland"],
  },
  {
    id: "aus",
    fifaCode: "AUS",
    officialName: "Australia",
    localDisplayName: "Australia",
    shortName: "Australia",
    group: "D",
    sourceNames: ["Australia"],
    aliases: ["AUS", "Australia"],
  },
  {
    id: "par",
    fifaCode: "PAR",
    officialName: "Paraguay",
    localDisplayName: "Paraguay",
    shortName: "Paraguay",
    group: "D",
    sourceNames: ["Paraguay"],
    aliases: ["PAR", "Paraguay"],
  },
  {
    id: "tur",
    fifaCode: "TUR",
    officialName: "Türkiye",
    localDisplayName: "Turkey",
    shortName: "Turkey",
    group: "D",
    sourceNames: ["Türkiye"],
    aliases: ["TUR", "Turkey", "Türkiye"],
  },
  {
    id: "usa",
    fifaCode: "USA",
    officialName: "USA",
    localDisplayName: "United States",
    shortName: "USA",
    group: "D",
    sourceNames: ["USA"],
    aliases: ["USA", "United States"],
  },
  {
    id: "civ",
    fifaCode: "CIV",
    officialName: "Côte d'Ivoire",
    localDisplayName: "Ivory Coast",
    shortName: "Ivory Coast",
    group: "E",
    sourceNames: ["Côte d'Ivoire"],
    aliases: ["CIV", "Côte d'Ivoire", "Ivory Coast"],
  },
  {
    id: "cuw",
    fifaCode: "CUW",
    officialName: "Curaçao",
    localDisplayName: "Curaçao",
    shortName: "Curaçao",
    group: "E",
    sourceNames: ["Curaçao"],
    aliases: ["CUW", "Curaçao"],
  },
  {
    id: "ecu",
    fifaCode: "ECU",
    officialName: "Ecuador",
    localDisplayName: "Ecuador",
    shortName: "Ecuador",
    group: "E",
    sourceNames: ["Ecuador"],
    aliases: ["ECU", "Ecuador"],
  },
  {
    id: "ger",
    fifaCode: "GER",
    officialName: "Germany",
    localDisplayName: "Germany",
    shortName: "Germany",
    group: "E",
    sourceNames: ["Germany"],
    aliases: ["GER", "Germany"],
  },
  {
    id: "jpn",
    fifaCode: "JPN",
    officialName: "Japan",
    localDisplayName: "Japan",
    shortName: "Japan",
    group: "F",
    sourceNames: ["Japan"],
    aliases: ["JPN", "Japan"],
  },
  {
    id: "ned",
    fifaCode: "NED",
    officialName: "Netherlands",
    localDisplayName: "Netherlands",
    shortName: "Netherlands",
    group: "F",
    sourceNames: ["Netherlands"],
    aliases: ["NED", "Netherlands"],
  },
  {
    id: "swe",
    fifaCode: "SWE",
    officialName: "Sweden",
    localDisplayName: "Sweden",
    shortName: "Sweden",
    group: "F",
    sourceNames: ["Sweden"],
    aliases: ["SWE", "Sweden"],
  },
  {
    id: "tun",
    fifaCode: "TUN",
    officialName: "Tunisia",
    localDisplayName: "Tunisia",
    shortName: "Tunisia",
    group: "F",
    sourceNames: ["Tunisia"],
    aliases: ["TUN", "Tunisia"],
  },
  {
    id: "bel",
    fifaCode: "BEL",
    officialName: "Belgium",
    localDisplayName: "Belgium",
    shortName: "Belgium",
    group: "G",
    sourceNames: ["Belgium"],
    aliases: ["BEL", "Belgium"],
  },
  {
    id: "egy",
    fifaCode: "EGY",
    officialName: "Egypt",
    localDisplayName: "Egypt",
    shortName: "Egypt",
    group: "G",
    sourceNames: ["Egypt"],
    aliases: ["EGY", "Egypt"],
  },
  {
    id: "irn",
    fifaCode: "IRN",
    officialName: "IR Iran",
    localDisplayName: "Iran",
    shortName: "Iran",
    group: "G",
    sourceNames: ["IR Iran"],
    aliases: ["IR Iran", "IRN", "Iran"],
  },
  {
    id: "nzl",
    fifaCode: "NZL",
    officialName: "New Zealand",
    localDisplayName: "New Zealand",
    shortName: "New Zealand",
    group: "G",
    sourceNames: ["New Zealand"],
    aliases: ["NZL", "New Zealand"],
  },
  {
    id: "cpv",
    fifaCode: "CPV",
    officialName: "Cabo Verde",
    localDisplayName: "Cape Verde",
    shortName: "Cape Verde",
    group: "H",
    sourceNames: ["Cabo Verde"],
    aliases: ["CPV", "Cabo Verde", "Cape Verde"],
  },
  {
    id: "esp",
    fifaCode: "ESP",
    officialName: "Spain",
    localDisplayName: "Spain",
    shortName: "Spain",
    group: "H",
    sourceNames: ["Spain"],
    aliases: ["ESP", "Spain"],
  },
  {
    id: "ksa",
    fifaCode: "KSA",
    officialName: "Saudi Arabia",
    localDisplayName: "Saudi Arabia",
    shortName: "Saudi Arabia",
    group: "H",
    sourceNames: ["Saudi Arabia"],
    aliases: ["KSA", "Saudi Arabia"],
  },
  {
    id: "uru",
    fifaCode: "URU",
    officialName: "Uruguay",
    localDisplayName: "Uruguay",
    shortName: "Uruguay",
    group: "H",
    sourceNames: ["Uruguay"],
    aliases: ["URU", "Uruguay"],
  },
  {
    id: "fra",
    fifaCode: "FRA",
    officialName: "France",
    localDisplayName: "France",
    shortName: "France",
    group: "I",
    sourceNames: ["France"],
    aliases: ["FRA", "France"],
  },
  {
    id: "irq",
    fifaCode: "IRQ",
    officialName: "Iraq",
    localDisplayName: "Iraq",
    shortName: "Iraq",
    group: "I",
    sourceNames: ["Iraq"],
    aliases: ["IRQ", "Iraq"],
  },
  {
    id: "nor",
    fifaCode: "NOR",
    officialName: "Norway",
    localDisplayName: "Norway",
    shortName: "Norway",
    group: "I",
    sourceNames: ["Norway"],
    aliases: ["NOR", "Norway"],
  },
  {
    id: "sen",
    fifaCode: "SEN",
    officialName: "Senegal",
    localDisplayName: "Senegal",
    shortName: "Senegal",
    group: "I",
    sourceNames: ["Senegal"],
    aliases: ["SEN", "Senegal"],
  },
  {
    id: "alg",
    fifaCode: "ALG",
    officialName: "Algeria",
    localDisplayName: "Algeria",
    shortName: "Algeria",
    group: "J",
    sourceNames: ["Algeria"],
    aliases: ["ALG", "Algeria"],
  },
  {
    id: "arg",
    fifaCode: "ARG",
    officialName: "Argentina",
    localDisplayName: "Argentina",
    shortName: "Argentina",
    group: "J",
    sourceNames: ["Argentina"],
    aliases: ["ARG", "Argentina"],
  },
  {
    id: "aut",
    fifaCode: "AUT",
    officialName: "Austria",
    localDisplayName: "Austria",
    shortName: "Austria",
    group: "J",
    sourceNames: ["Austria"],
    aliases: ["AUT", "Austria"],
  },
  {
    id: "jor",
    fifaCode: "JOR",
    officialName: "Jordan",
    localDisplayName: "Jordan",
    shortName: "Jordan",
    group: "J",
    sourceNames: ["Jordan"],
    aliases: ["JOR", "Jordan"],
  },
  {
    id: "cod",
    fifaCode: "COD",
    officialName: "Congo DR",
    localDisplayName: "DR Congo",
    shortName: "DR Congo",
    group: "K",
    sourceNames: ["Congo DR"],
    aliases: ["COD", "Congo DR", "DR Congo"],
  },
  {
    id: "col",
    fifaCode: "COL",
    officialName: "Colombia",
    localDisplayName: "Colombia",
    shortName: "Colombia",
    group: "K",
    sourceNames: ["Colombia"],
    aliases: ["COL", "Colombia"],
  },
  {
    id: "por",
    fifaCode: "POR",
    officialName: "Portugal",
    localDisplayName: "Portugal",
    shortName: "Portugal",
    group: "K",
    sourceNames: ["Portugal"],
    aliases: ["POR", "Portugal"],
  },
  {
    id: "uzb",
    fifaCode: "UZB",
    officialName: "Uzbekistan",
    localDisplayName: "Uzbekistan",
    shortName: "Uzbekistan",
    group: "K",
    sourceNames: ["Uzbekistan"],
    aliases: ["UZB", "Uzbekistan"],
  },
  {
    id: "cro",
    fifaCode: "CRO",
    officialName: "Croatia",
    localDisplayName: "Croatia",
    shortName: "Croatia",
    group: "L",
    sourceNames: ["Croatia"],
    aliases: ["CRO", "Croatia"],
  },
  {
    id: "eng",
    fifaCode: "ENG",
    officialName: "England",
    localDisplayName: "England",
    shortName: "England",
    group: "L",
    sourceNames: ["England"],
    aliases: ["ENG", "England"],
  },
  {
    id: "gha",
    fifaCode: "GHA",
    officialName: "Ghana",
    localDisplayName: "Ghana",
    shortName: "Ghana",
    group: "L",
    sourceNames: ["Ghana"],
    aliases: ["GHA", "Ghana"],
  },
  {
    id: "pan",
    fifaCode: "PAN",
    officialName: "Panama",
    localDisplayName: "Panama",
    shortName: "Panama",
    group: "L",
    sourceNames: ["Panama"],
    aliases: ["PAN", "Panama"],
  },
];

export function normalizeOfficialTeamAlias(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function validateOfficialWorldCup2026TeamIdentities(
  identities: readonly OfficialTeamIdentity[] = officialWorldCup2026TeamIdentities,
): void {
  if (identities.length !== 48) {
    throw new Error("Official World Cup 2026 identity map must contain exactly 48 teams.");
  }

  const ids = new Set<string>();
  const fifaCodes = new Set<string>();
  const aliases = new Map<string, string>();

  for (const identity of identities) {
    if (ids.has(identity.id)) {
      throw new Error(`Duplicate official team ID "${identity.id}".`);
    }
    ids.add(identity.id);

    if (fifaCodes.has(identity.fifaCode)) {
      throw new Error(`Duplicate official FIFA code "${identity.fifaCode}".`);
    }
    fifaCodes.add(identity.fifaCode);

    for (const alias of identity.aliases) {
      const normalized = normalizeOfficialTeamAlias(alias);
      const existing = aliases.get(normalized);
      if (existing && existing !== identity.id) {
        throw new Error(`Conflicting official team alias "${alias}" maps to "${existing}" and "${identity.id}".`);
      }
      aliases.set(normalized, identity.id);
    }
  }
}

export function resolveOfficialWorldCup2026TeamAlias(sourceName: string): OfficialTeamIdentity {
  validateOfficialWorldCup2026TeamIdentities();
  const normalized = normalizeOfficialTeamAlias(sourceName);
  const matches = officialWorldCup2026TeamIdentities.filter((team) =>
    team.aliases.some((alias) => normalizeOfficialTeamAlias(alias) === normalized),
  );

  if (matches.length === 0) {
    throw new Error(`Unknown World Cup 2026 source team "${sourceName}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous World Cup 2026 source team "${sourceName}".`);
  }

  return matches[0];
}
