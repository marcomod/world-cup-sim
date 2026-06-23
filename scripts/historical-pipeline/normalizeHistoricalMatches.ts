import {
  historicalTeamAliasEntries,
  resolveHistoricalTeamId,
  validateHistoricalTeamAliases,
} from "./historicalTeamAliases.ts";
import type {
  HistoricalCalibrationScope,
  HistoricalStage,
  HistoricalTeamAliasEntry,
  NormalizedHistoricalMatch,
  RawHistoricalMatch,
} from "./schemas.ts";
import {
  isKnockoutHistoricalStage,
  validateHistoricalMatches,
} from "./validateHistoricalMatches.ts";

const STAGES_BY_SOURCE_NAME = new Map<string, HistoricalStage>([
  ["group_stage", "group_stage"],
  ["group stage", "group_stage"],
  ["first_group_stage", "first_group_stage"],
  ["first group stage", "first_group_stage"],
  ["second_group_stage", "second_group_stage"],
  ["second group stage", "second_group_stage"],
  ["final_group_stage", "final_group_stage"],
  ["final group stage", "final_group_stage"],
  ["group_stage_playoff", "group_stage_playoff"],
  ["group stage play-off", "group_stage_playoff"],
  ["round_of_32", "round_of_32"],
  ["round of 32", "round_of_32"],
  ["round_of_16", "round_of_16"],
  ["round of 16", "round_of_16"],
  ["quarterfinal", "quarterfinal"],
  ["quarterfinals", "quarterfinal"],
  ["quarter-final", "quarterfinal"],
  ["quarter-finals", "quarterfinal"],
  ["semifinal", "semifinal"],
  ["semifinals", "semifinal"],
  ["semi-final", "semifinal"],
  ["semi-finals", "semifinal"],
  ["third_place", "third_place"],
  ["third place", "third_place"],
  ["third-place play-off", "third_place"],
  ["final", "final"],
]);

export interface NormalizeHistoricalMatchesOptions {
  source: string;
  scope?: HistoricalCalibrationScope;
  aliasEntries?: readonly HistoricalTeamAliasEntry[];
}

export function normalizeHistoricalMatches(
  rawMatches: readonly RawHistoricalMatch[],
  options: NormalizeHistoricalMatchesOptions,
): NormalizedHistoricalMatch[] {
  const source = options.source.trim();

  if (!source) {
    throw new Error("Historical normalization requires a non-empty source identifier.");
  }

  const aliasEntries = options.aliasEntries ?? historicalTeamAliasEntries;
  validateHistoricalTeamAliases(aliasEntries);

  const normalizedMatches = rawMatches.map((rawMatch) =>
    normalizeHistoricalMatch(rawMatch, source, aliasEntries),
  );

  validateHistoricalMatches(normalizedMatches);

  const sortedMatches = [...normalizedMatches].sort(
    (matchA, matchB) =>
      matchA.date.localeCompare(matchB.date) || matchA.matchId.localeCompare(matchB.matchId),
  );

  if ((options.scope ?? "all_matches") === "knockout_only") {
    return sortedMatches.filter((match) => isKnockoutHistoricalStage(match.stage));
  }

  return sortedMatches;
}

function normalizeHistoricalMatch(
  rawMatch: RawHistoricalMatch,
  source: string,
  aliasEntries: readonly HistoricalTeamAliasEntry[],
): NormalizedHistoricalMatch {
  const stage = resolveHistoricalStage(rawMatch.stage);
  const teamAId = resolveHistoricalTeamId(rawMatch.homeTeam, aliasEntries);
  const teamBId = resolveHistoricalTeamId(rawMatch.awayTeam, aliasEntries);
  const outcomeStatus = resolveOutcomeStatus(rawMatch, stage);
  const winnerTeamId = resolveWinner(rawMatch, teamAId, teamBId, outcomeStatus);
  const matchId = createDeterministicMatchId(rawMatch, source, stage, teamAId, teamBId);
  const baseMatch = {
    matchId,
    ...(rawMatch.sourceMatchId ? { sourceMatchId: rawMatch.sourceMatchId } : {}),
    tournamentYear: rawMatch.tournamentYear,
    date: rawMatch.date,
    stage,
    teamAId,
    teamBId,
    teamAGoals: rawMatch.homeGoals,
    teamBGoals: rawMatch.awayGoals,
    wentToExtraTime: rawMatch.extraTime,
    wentToPenalties: rawMatch.penalties,
    ...(rawMatch.homePenaltyGoals === undefined
      ? {}
      : { teamAPenaltyGoals: rawMatch.homePenaltyGoals }),
    ...(rawMatch.awayPenaltyGoals === undefined
      ? {}
      : { teamBPenaltyGoals: rawMatch.awayPenaltyGoals }),
    source,
  };

  if (outcomeStatus === "decisive") {
    if (!winnerTeamId) {
      throw new Error(`Decisive historical match "${matchId}" does not identify a winner.`);
    }

    return { ...baseMatch, outcomeStatus, winnerTeamId };
  }

  return { ...baseMatch, outcomeStatus, winnerTeamId: null };
}

function resolveHistoricalStage(sourceStage: string): HistoricalStage {
  const normalizedStage = sourceStage.trim().toLocaleLowerCase("en-US");
  const stage = STAGES_BY_SOURCE_NAME.get(normalizedStage);

  if (!stage) {
    throw new Error(`Unknown historical match stage "${sourceStage}".`);
  }

  return stage;
}

function resolveWinner(
  match: RawHistoricalMatch,
  teamAId: string,
  teamBId: string,
  outcomeStatus: RawHistoricalMatch["outcomeStatus"],
): string | null {
  if (outcomeStatus !== "decisive") {
    return null;
  }

  if (match.penalties) {
    return Number(match.homePenaltyGoals) > Number(match.awayPenaltyGoals)
      ? teamAId
      : teamBId;
  }

  if (match.homeGoals === match.awayGoals) {
    return null;
  }

  return match.homeGoals > match.awayGoals ? teamAId : teamBId;
}

function resolveOutcomeStatus(
  match: RawHistoricalMatch,
  stage: HistoricalStage,
): NonNullable<RawHistoricalMatch["outcomeStatus"]> {
  if (match.outcomeStatus) {
    return match.outcomeStatus;
  }

  if (match.penalties || match.homeGoals !== match.awayGoals) {
    return "decisive";
  }

  return isKnockoutHistoricalStage(stage) ? "non_decisive" : "draw";
}

function createDeterministicMatchId(
  match: RawHistoricalMatch,
  source: string,
  stage: HistoricalStage,
  teamAId: string,
  teamBId: string,
): string {
  const sourceKey = slugify(source);
  const recordKey = match.sourceMatchId
    ? slugify(match.sourceMatchId)
    : [match.tournamentYear, match.date, stage, teamAId, teamBId].join(":");

  if (!sourceKey || !recordKey) {
    throw new Error("Historical match could not be assigned a deterministic matchId.");
  }

  return `${sourceKey}:${recordKey}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
