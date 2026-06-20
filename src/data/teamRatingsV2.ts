import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import type { TeamId, TeamRatingV2 } from "@/src/lib/simulator/types";

export interface TeamRatingsV2SourceMetadata {
  sourceName: string;
  snapshotDate: string;
  developmentSnapshot: boolean;
  refreshRequiredAfterGroupStage: boolean;
}

// Legacy manual V2 ratings are kept for comparison and rollback while the app
// runtime uses the generated World Football Elo development snapshot below.
export const legacyManualTeamRatingsV2ByTeamId: Record<TeamId, TeamRatingV2> = {
  arg: { teamId: "arg", modelVersion: "v2", overall: 1992, attack: 92, defense: 88, recentForm: 91, squadStrength: 92, penalties: 89 },
  fra: { teamId: "fra", modelVersion: "v2", overall: 1984, attack: 93, defense: 87, recentForm: 89, squadStrength: 93, penalties: 86 },
  bra: { teamId: "bra", modelVersion: "v2", overall: 1962, attack: 91, defense: 86, recentForm: 86, squadStrength: 91, penalties: 84 },
  eng: { teamId: "eng", modelVersion: "v2", overall: 1950, attack: 90, defense: 86, recentForm: 88, squadStrength: 90, penalties: 82 },
  esp: { teamId: "esp", modelVersion: "v2", overall: 1943, attack: 89, defense: 87, recentForm: 89, squadStrength: 89, penalties: 83 },
  por: { teamId: "por", modelVersion: "v2", overall: 1922, attack: 90, defense: 84, recentForm: 86, squadStrength: 89, penalties: 84 },
  ned: { teamId: "ned", modelVersion: "v2", overall: 1914, attack: 88, defense: 86, recentForm: 86, squadStrength: 87, penalties: 83 },
  ger: { teamId: "ger", modelVersion: "v2", overall: 1908, attack: 88, defense: 84, recentForm: 84, squadStrength: 88, penalties: 85 },
  aut: { teamId: "aut", modelVersion: "v2", overall: 1886, attack: 84, defense: 89, recentForm: 83, squadStrength: 85, penalties: 84 },
  cro: { teamId: "cro", modelVersion: "v2", overall: 1870, attack: 84, defense: 84, recentForm: 85, squadStrength: 84, penalties: 87 },
  bel: { teamId: "bel", modelVersion: "v2", overall: 1868, attack: 86, defense: 83, recentForm: 82, squadStrength: 85, penalties: 82 },
  uru: { teamId: "uru", modelVersion: "v2", overall: 1860, attack: 85, defense: 84, recentForm: 84, squadStrength: 84, penalties: 82 },
  col: { teamId: "col", modelVersion: "v2", overall: 1852, attack: 85, defense: 83, recentForm: 85, squadStrength: 84, penalties: 81 },
  mar: { teamId: "mar", modelVersion: "v2", overall: 1816, attack: 81, defense: 84, recentForm: 83, squadStrength: 81, penalties: 80 },
  usa: { teamId: "usa", modelVersion: "v2", overall: 1812, attack: 82, defense: 81, recentForm: 81, squadStrength: 83, penalties: 79 },
  sui: { teamId: "sui", modelVersion: "v2", overall: 1808, attack: 81, defense: 83, recentForm: 80, squadStrength: 82, penalties: 81 },
  sco: { teamId: "sco", modelVersion: "v2", overall: 1802, attack: 81, defense: 82, recentForm: 80, squadStrength: 82, penalties: 80 },
  mex: { teamId: "mex", modelVersion: "v2", overall: 1796, attack: 82, defense: 82, recentForm: 80, squadStrength: 82, penalties: 80 },
  jpn: { teamId: "jpn", modelVersion: "v2", overall: 1790, attack: 82, defense: 80, recentForm: 82, squadStrength: 81, penalties: 79 },
  sen: { teamId: "sen", modelVersion: "v2", overall: 1778, attack: 81, defense: 80, recentForm: 80, squadStrength: 81, penalties: 78 },
  kor: { teamId: "kor", modelVersion: "v2", overall: 1766, attack: 80, defense: 79, recentForm: 80, squadStrength: 80, penalties: 78 },
  ecu: { teamId: "ecu", modelVersion: "v2", overall: 1760, attack: 80, defense: 80, recentForm: 79, squadStrength: 79, penalties: 77 },
  swe: { teamId: "swe", modelVersion: "v2", overall: 1744, attack: 79, defense: 78, recentForm: 77, squadStrength: 80, penalties: 79 },
  civ: { teamId: "civ", modelVersion: "v2", overall: 1738, attack: 81, defense: 77, recentForm: 77, squadStrength: 79, penalties: 78 },
  aus: { teamId: "aus", modelVersion: "v2", overall: 1718, attack: 77, defense: 78, recentForm: 77, squadStrength: 76, penalties: 77 },
  can: { teamId: "can", modelVersion: "v2", overall: 1710, attack: 79, defense: 75, recentForm: 77, squadStrength: 77, penalties: 76 },
  uzb: { teamId: "uzb", modelVersion: "v2", overall: 1702, attack: 79, defense: 76, recentForm: 76, squadStrength: 77, penalties: 76 },
  gha: { teamId: "gha", modelVersion: "v2", overall: 1686, attack: 77, defense: 75, recentForm: 75, squadStrength: 76, penalties: 75 },
  ksa: { teamId: "ksa", modelVersion: "v2", overall: 1668, attack: 75, defense: 75, recentForm: 74, squadStrength: 74, penalties: 75 },
  qat: { teamId: "qat", modelVersion: "v2", overall: 1650, attack: 74, defense: 74, recentForm: 73, squadStrength: 73, penalties: 74 },
  jor: { teamId: "jor", modelVersion: "v2", overall: 1640, attack: 73, defense: 75, recentForm: 73, squadStrength: 73, penalties: 75 },
  nzl: { teamId: "nzl", modelVersion: "v2", overall: 1612, attack: 72, defense: 72, recentForm: 72, squadStrength: 72, penalties: 73 },
};

export const teamRatingsV2ByTeamId: Record<TeamId, TeamRatingV2> =
  worldFootballEloDevelopmentByTeamId;

export const teamRatingsV2SourceMetadata = {
  sourceName: "World Football Elo Ratings",
  snapshotDate: "2026-06-18",
  developmentSnapshot: true,
  refreshRequiredAfterGroupStage: true,
} as const satisfies TeamRatingsV2SourceMetadata;
