import type { TeamId } from "@/src/lib/simulator/types";

const FLAG_SPRITE_PATH = "/flags/team-flags.svg";
const FALLBACK_FLAG_SYMBOL = "fallback";

const teamFlagSymbolByTeamId: Readonly<Partial<Record<TeamId, string>>> = {
  arg: "arg",
  fra: "fra",
  bra: "bra",
  eng: "eng",
  esp: "esp",
  ger: "ger",
  por: "por",
  ned: "ned",
  aut: "aut",
  bel: "bel",
  cro: "cro",
  uru: "uru",
  col: "col",
  mex: "mex",
  usa: "usa",
  sui: "sui",
  sco: "sco",
  mar: "mar",
  jpn: "jpn",
  sen: "sen",
  kor: "kor",
  ecu: "ecu",
  swe: "swe",
  civ: "civ",
  aus: "aus",
  can: "can",
  uzb: "uzb",
  gha: "gha",
  ksa: "ksa",
  qat: "qat",
  jor: "jor",
  nzl: "nzl",
};

export const fallbackTeamFlagPath = `${FLAG_SPRITE_PATH}#${FALLBACK_FLAG_SYMBOL}`;

export function getTeamFlagPath(teamId: TeamId | null): string {
  if (!teamId) {
    return fallbackTeamFlagPath;
  }

  const symbol = teamFlagSymbolByTeamId[teamId];

  return symbol ? `${FLAG_SPRITE_PATH}#${symbol}` : fallbackTeamFlagPath;
}

export function hasTeamFlag(teamId: TeamId): boolean {
  return teamFlagSymbolByTeamId[teamId] !== undefined;
}
