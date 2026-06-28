import { compareCodePoints, GROUP_IDS } from "@/src/lib/tournament-2026/constants";
import type {
  NormalizedTournamentSnapshot,
  SnapshotFairPlayRecord,
  SnapshotFifaRankingRecord,
  SnapshotFixture,
  SnapshotTeam,
  SourceReference,
  TournamentSnapshot,
  TournamentSnapshotSources,
  TournamentSnapshotState,
} from "./types";

function sourceReference(source: SourceReference): SourceReference {
  return {
    authority: source.authority,
    title: source.title,
    url: source.url,
    publishedDate: source.publishedDate,
    accessedDate: source.accessedDate,
    version: source.version,
    checksum: source.checksum,
  };
}

function normalizeSources(sources: TournamentSnapshotSources): TournamentSnapshotSources {
  return {
    teams: sourceReference(sources.teams),
    groups: sourceReference(sources.groups),
    fixtures: sourceReference(sources.fixtures),
    results: sources.results ? sourceReference(sources.results) : null,
    fairPlay: sources.fairPlay ? sourceReference(sources.fairPlay) : null,
    fifaRanking: sources.fifaRanking ? sourceReference(sources.fifaRanking) : null,
  };
}

export function deriveSnapshotState(fixtures: readonly SnapshotFixture[]): TournamentSnapshotState {
  const completedCount = fixtures.filter((fixture) => fixture.status === "completed").length;

  if (completedCount === 0) {
    return "structure_only";
  }

  if (completedCount === fixtures.length) {
    return "group_stage_complete";
  }

  return "group_stage_in_progress";
}

export function normalizeTournamentSnapshot(snapshot: TournamentSnapshot): NormalizedTournamentSnapshot {
  const teams = [...snapshot.teams]
    .map((team): SnapshotTeam => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      fifaCode: team.fifaCode,
      group: team.group,
    }))
    .sort(
      (left, right) =>
        GROUP_IDS.indexOf(left.group) - GROUP_IDS.indexOf(right.group) || compareCodePoints(left.id, right.id),
    );

  const fixtures = [...snapshot.fixtures]
    .map((fixture): SnapshotFixture => ({
      id: fixture.id,
      fifaMatchNumber: fixture.fifaMatchNumber,
      group: fixture.group,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      kickoffUtc: fixture.kickoffUtc,
      venueId: fixture.venueId,
      status: fixture.status,
      result: fixture.result
        ? { homeGoals: fixture.result.homeGoals, awayGoals: fixture.result.awayGoals }
        : null,
    }))
    .sort(
      (left, right) => left.fifaMatchNumber - right.fifaMatchNumber || compareCodePoints(left.id, right.id),
    );

  const fairPlay = [...snapshot.fairPlay]
    .map((record): SnapshotFairPlayRecord => ({
      teamId: record.teamId,
      yellowCards: record.yellowCards,
      indirectRedCards: record.indirectRedCards,
      directRedCards: record.directRedCards,
      yellowAndDirectRedCards: record.yellowAndDirectRedCards,
      deductionPoints: record.deductionPoints,
    }))
    .sort((left, right) => compareCodePoints(left.teamId, right.teamId));

  const fifaRanking = [...snapshot.fifaRanking]
    .map((record): SnapshotFifaRankingRecord => ({
      teamId: record.teamId,
      rank: record.rank,
      rankingDate: record.rankingDate,
    }))
    .sort((left, right) => compareCodePoints(left.teamId, right.teamId));

  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    snapshotVersion: snapshot.snapshotVersion,
    tournament: snapshot.tournament,
    state: snapshot.state,
    derivedState: deriveSnapshotState(fixtures),
    teams,
    fixtures,
    fairPlay,
    fifaRanking,
    sources: normalizeSources(snapshot.sources),
  };
}
