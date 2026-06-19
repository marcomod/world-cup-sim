import { describe, expect, it } from "vitest";
import { tournamentTeams } from "@/src/data/tournamentTeams";
import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import { calculateWinProbabilityFromOverall } from "@/src/lib/simulator/probability";
import type { TeamId } from "@/src/lib/simulator/types";

const teamsById = new Map(tournamentTeams.map((team) => [team.id, team]));

interface MatchupExample {
  category: string;
  teamAId: TeamId;
  teamBId: TeamId;
  lowerBound: number;
  upperBound: number;
}

const representativeMatchups: MatchupExample[] = [
  {
    category: "elite vs elite",
    teamAId: "esp",
    teamBId: "arg",
    lowerBound: 0.45,
    upperBound: 0.55,
  },
  {
    category: "elite vs strong",
    teamAId: "fra",
    teamBId: "mex",
    lowerBound: 0.68,
    upperBound: 0.85,
  },
  {
    category: "elite vs average",
    teamAId: "eng",
    teamBId: "usa",
    lowerBound: 0.75,
    upperBound: 0.9,
  },
  {
    category: "elite vs weak",
    teamAId: "arg",
    teamBId: "cuw",
    lowerBound: 0.94,
    upperBound: 0.995,
  },
  {
    category: "average vs average",
    teamAId: "usa",
    teamBId: "par",
    lowerBound: 0.47,
    upperBound: 0.53,
  },
  {
    category: "weak vs weak",
    teamAId: "qat",
    teamBId: "cuw",
    lowerBound: 0.45,
    upperBound: 0.56,
  },
];

const regressionMatchups = [
  {
    label: "Spain (2129) vs Argentina (2128)",
    teamAId: "esp",
    teamBId: "arg",
    expectedTeamAProbability: 0.5014391117091528,
  },
  {
    label: "France (2084) vs Mexico (1881)",
    teamAId: "fra",
    teamBId: "mex",
    expectedTeamAProbability: 0.7628849803052542,
  },
  {
    label: "England (2055) vs United States (1780)",
    teamAId: "eng",
    teamBId: "usa",
    expectedTeamAProbability: 0.8296328234313434,
  },
  {
    label: "Argentina (2128) vs Curacao (1427)",
    teamAId: "arg",
    teamBId: "cuw",
    expectedTeamAProbability: 0.9826264546512044,
  },
  {
    label: "Qatar (1437) vs Curacao (1427)",
    teamAId: "qat",
    teamBId: "cuw",
    expectedTeamAProbability: 0.5143871841659987,
  },
] as const;

function getOverall(teamId: TeamId): number {
  const rating = worldFootballEloDevelopmentByTeamId[teamId];

  if (!rating) {
    throw new Error(`Missing World Football Elo development rating for "${teamId}".`);
  }

  return rating.overall;
}

function getTeamName(teamId: TeamId): string {
  return teamsById.get(teamId)?.name ?? teamId;
}

function getTeamAWinProbability(teamAId: TeamId, teamBId: TeamId): number {
  return calculateWinProbabilityFromOverall(getOverall(teamAId), getOverall(teamBId));
}

function formatPercent(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

function createRepresentativeMatchupTable(): string {
  const rows = representativeMatchups.map((matchup) => {
    const teamAOverall = getOverall(matchup.teamAId);
    const teamBOverall = getOverall(matchup.teamBId);
    const teamAProbability = getTeamAWinProbability(matchup.teamAId, matchup.teamBId);

    return [
      getTeamName(matchup.teamAId),
      String(teamAOverall),
      getTeamName(matchup.teamBId),
      String(teamBOverall),
      formatPercent(teamAProbability),
    ].join(" | ");
  });

  return ["Team A | Elo A | Team B | Elo B | Team A win %", ...rows].join("\n");
}

describe("World Football Elo probability sanity", () => {
  it("keeps representative real-development-rating matchups in broad sanity bands", () => {
    for (const matchup of representativeMatchups) {
      const probability = getTeamAWinProbability(matchup.teamAId, matchup.teamBId);

      expect(probability, matchup.category).toBeGreaterThan(matchup.lowerBound);
      expect(probability, matchup.category).toBeLessThan(matchup.upperBound);
    }
  });

  it("prints a concise representative matchup table", () => {
    const table = createRepresentativeMatchupTable();

    process.stdout.write(`\n${table}\n`);

    expect(table).toContain("Team A | Elo A | Team B | Elo B | Team A win %");
    expect(table).toContain("Spain | 2129 | Argentina | 2128 | 50.1%");
    expect(table).toContain("Argentina | 2128 | Curaçao | 1427 | 98.3%");
  });
});

describe("probability formula guarantees", () => {
  it("returns 50% for equal ratings", () => {
    expect(calculateWinProbabilityFromOverall(1800, 1800)).toBe(0.5);
    expect(getTeamAWinProbability("usa", "par")).toBe(0.5);
  });

  it("returns complementary probabilities when teams are swapped", () => {
    const spainOverFrance = getTeamAWinProbability("esp", "fra");
    const franceOverSpain = getTeamAWinProbability("fra", "esp");

    expect(spainOverFrance + franceOverSpain).toBeCloseTo(1, 12);
  });

  it("keeps representative probabilities between 0 and 1", () => {
    for (const matchup of representativeMatchups) {
      const probability = getTeamAWinProbability(matchup.teamAId, matchup.teamBId);

      expect(probability).toBeGreaterThan(0);
      expect(probability).toBeLessThan(1);
    }
  });

  it("gives every higher-rated representative team more than 50%", () => {
    for (const matchup of representativeMatchups) {
      if (getOverall(matchup.teamAId) <= getOverall(matchup.teamBId)) {
        continue;
      }

      expect(getTeamAWinProbability(matchup.teamAId, matchup.teamBId)).toBeGreaterThan(
        0.5,
      );
    }
  });

  it("makes larger Elo gaps produce larger favourite probabilities", () => {
    const eliteVsElite = getTeamAWinProbability("esp", "arg");
    const eliteVsEliteGap = getTeamAWinProbability("esp", "fra");
    const eliteVsStrong = getTeamAWinProbability("esp", "mex");
    const eliteVsWeak = getTeamAWinProbability("esp", "cuw");

    expect(eliteVsElite).toBeLessThan(eliteVsEliteGap);
    expect(eliteVsEliteGap).toBeLessThan(eliteVsStrong);
    expect(eliteVsStrong).toBeLessThan(eliteVsWeak);
  });

  it("returns identical probabilities for identical Elo differences", () => {
    const usaOverSweden = getTeamAWinProbability("usa", "swe");
    const paraguayOverSweden = getTeamAWinProbability("par", "swe");

    expect(getOverall("usa") - getOverall("swe")).toBe(25);
    expect(getOverall("par") - getOverall("swe")).toBe(25);
    expect(usaOverSweden).toBe(paraguayOverSweden);
  });
});

describe("real-team probability regression snapshots", () => {
  it.each(regressionMatchups)(
    "$label stays aligned with the current Elo-difference formula",
    ({ teamAId, teamBId, expectedTeamAProbability }) => {
      expect(getTeamAWinProbability(teamAId, teamBId)).toBeCloseTo(
        expectedTeamAProbability,
        12,
      );
    },
  );
});
