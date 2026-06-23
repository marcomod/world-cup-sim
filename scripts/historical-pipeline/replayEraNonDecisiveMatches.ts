import type { HistoricalStage } from "./schemas.ts";

const GROUP_STAGES = new Set<HistoricalStage>([
  "group_stage",
  "first_group_stage",
  "second_group_stage",
  "final_group_stage",
]);

export interface KaggleSourceMatchKeyParts {
  year: string;
  date: string;
  round: string;
  homeTeam: string;
  awayTeam: string;
}

export interface NonDecisiveMatchCandidate {
  sourceMatchId?: string;
  stage: HistoricalStage;
  teamAGoals: number;
  teamBGoals: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
}

export function createKaggleSourceMatchId(parts: KaggleSourceMatchKeyParts): string {
  return [parts.year, parts.date, parts.round, parts.homeTeam, parts.awayTeam]
    .map(normalizeKeyPart)
    .join("|");
}

// The source labels the 1938 first knockout round as "Round of 16". These
// exact source tuples are the only rows established as non-decisive replay-era ties.
export const REPLAY_ERA_NON_DECISIVE_SOURCE_IDS: ReadonlySet<string> = new Set([
  createKaggleSourceMatchId({
    year: "1934",
    date: "1934-05-31",
    round: "Quarter-finals",
    homeTeam: "Italy",
    awayTeam: "Spain",
  }),
  createKaggleSourceMatchId({
    year: "1938",
    date: "1938-06-04",
    round: "Round of 16",
    homeTeam: "Switzerland",
    awayTeam: "Germany",
  }),
  createKaggleSourceMatchId({
    year: "1938",
    date: "1938-06-05",
    round: "Round of 16",
    homeTeam: "Cuba",
    awayTeam: "Romania",
  }),
  createKaggleSourceMatchId({
    year: "1938",
    date: "1938-06-12",
    round: "Quarter-finals",
    homeTeam: "Brazil",
    awayTeam: "Czechoslovakia",
  }),
]);

export function isAllowlistedReplayEraNonDecisiveMatch(
  candidate: NonDecisiveMatchCandidate,
): boolean {
  return (
    candidate.sourceMatchId !== undefined &&
    REPLAY_ERA_NON_DECISIVE_SOURCE_IDS.has(candidate.sourceMatchId) &&
    !GROUP_STAGES.has(candidate.stage) &&
    candidate.teamAGoals === candidate.teamBGoals &&
    candidate.wentToExtraTime &&
    !candidate.wentToPenalties
  );
}

function normalizeKeyPart(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}
