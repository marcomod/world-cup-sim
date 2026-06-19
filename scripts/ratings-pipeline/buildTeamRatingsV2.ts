import { mockTeams } from "../../src/data/mockTeams.ts";
import type { Team, TeamId, TeamRatingV2 } from "../../src/lib/simulator/types.ts";
import type { NormalizedTeamRatingRecord } from "./schemas.ts";

const MIN_PROXY_VALUE = 72;
const MAX_PROXY_SPREAD = 23;
const DEFAULT_EQUAL_ELO_RATIO = 0.5;
const DEFAULT_PENALTIES = 80;
const FIXTURE_TEAM_COUNT = 32;

interface BuildTeamRatingsV2Options {
  teams?: Team[];
  expectedTeamCount?: number;
}

export function buildTeamRatingsV2(
  records: NormalizedTeamRatingRecord[],
  options: BuildTeamRatingsV2Options = {},
): Record<TeamId, TeamRatingV2> {
  const teams = options.teams ?? mockTeams;
  assertTeamSet(teams, options.expectedTeamCount ?? FIXTURE_TEAM_COUNT);

  const minOverall = Math.min(...records.map((record) => record.overall));
  const maxOverall = Math.max(...records.map((record) => record.overall));
  const recordsByTeamId = new Map(records.map((record) => [record.teamId, record]));

  return Object.fromEntries(
    teams.map((team) => {
      const record = recordsByTeamId.get(team.id);

      if (!record) {
        throw new Error(`Cannot build TeamRatingV2: missing normalized record for "${team.id}".`);
      }

      const proxyValue = calculateEloDerivedProxy(record.overall, minOverall, maxOverall);

      return [
        team.id,
        {
          teamId: team.id,
          modelVersion: "v2",
          overall: record.overall,
          attack: proxyValue,
          defense: proxyValue,
          recentForm: proxyValue,
          squadStrength: proxyValue,
          penalties: DEFAULT_PENALTIES,
        },
      ];
    }),
  );
}

export function calculateEloDerivedProxy(
  overall: number,
  minOverall: number,
  maxOverall: number,
): number {
  const ratio =
    minOverall === maxOverall
      ? DEFAULT_EQUAL_ELO_RATIO
      : (overall - minOverall) / (maxOverall - minOverall);

  return Math.round(MIN_PROXY_VALUE + MAX_PROXY_SPREAD * ratio);
}

function assertTeamSet(teams: Team[], expectedTeamCount: number): void {
  if (teams.length !== expectedTeamCount) {
    throw new Error(
      `Cannot build TeamRatingV2: expected ${expectedTeamCount} teams but found ${teams.length}.`,
    );
  }

  const seenTeamIds = new Set<TeamId>();

  for (const team of teams) {
    if (seenTeamIds.has(team.id)) {
      throw new Error(
        `Cannot build TeamRatingV2 fixture: duplicate mock team ID "${team.id}".`,
      );
    }

    seenTeamIds.add(team.id);
  }
}
