import { describe, expect, it } from "vitest";
import { initialBracket } from "@/src/data/initialBracket";
import { mockTeams } from "@/src/data/mockTeams";
import { tournamentTeams } from "@/src/data/tournamentTeams";
import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import {
  teamRatingsV2ByTeamId,
  teamRatingsV2SourceMetadata,
} from "@/src/data/teamRatingsV2";
import {
  runMonteCarlo,
  runMonteCarloAccounting,
} from "@/src/lib/simulator/monteCarlo";
import {
  calculateMatchupProbability,
  calculateWinProbabilityFromOverall,
} from "@/src/lib/simulator/probability";
import { createSeededRng } from "@/src/lib/simulator/rng";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import { simulateMatch } from "@/src/lib/simulator/simulateMatch";
import type {
  Match,
  MatchSlot,
  MatchScore,
  RNG,
  TeamId,
  TeamRating,
} from "@/src/lib/simulator/types";

const incompatibleDemoTeamIds = ["den", "crc", "nga", "pol", "ita", "srb"];

const expectedBracketTopology: {
  id: string;
  nextMatchId?: string;
  nextSlot?: MatchSlot;
}[] = [
  { id: "r32-1", nextMatchId: "r16-1", nextSlot: "teamAId" },
  { id: "r32-2", nextMatchId: "r16-1", nextSlot: "teamBId" },
  { id: "r32-3", nextMatchId: "r16-2", nextSlot: "teamAId" },
  { id: "r32-4", nextMatchId: "r16-2", nextSlot: "teamBId" },
  { id: "r32-5", nextMatchId: "r16-3", nextSlot: "teamAId" },
  { id: "r32-6", nextMatchId: "r16-3", nextSlot: "teamBId" },
  { id: "r32-7", nextMatchId: "r16-4", nextSlot: "teamAId" },
  { id: "r32-8", nextMatchId: "r16-4", nextSlot: "teamBId" },
  { id: "r32-9", nextMatchId: "r16-5", nextSlot: "teamAId" },
  { id: "r32-10", nextMatchId: "r16-5", nextSlot: "teamBId" },
  { id: "r32-11", nextMatchId: "r16-6", nextSlot: "teamAId" },
  { id: "r32-12", nextMatchId: "r16-6", nextSlot: "teamBId" },
  { id: "r32-13", nextMatchId: "r16-7", nextSlot: "teamAId" },
  { id: "r32-14", nextMatchId: "r16-7", nextSlot: "teamBId" },
  { id: "r32-15", nextMatchId: "r16-8", nextSlot: "teamAId" },
  { id: "r32-16", nextMatchId: "r16-8", nextSlot: "teamBId" },
  { id: "r16-1", nextMatchId: "qf-1", nextSlot: "teamAId" },
  { id: "r16-2", nextMatchId: "qf-1", nextSlot: "teamBId" },
  { id: "r16-3", nextMatchId: "qf-2", nextSlot: "teamAId" },
  { id: "r16-4", nextMatchId: "qf-2", nextSlot: "teamBId" },
  { id: "r16-5", nextMatchId: "qf-3", nextSlot: "teamAId" },
  { id: "r16-6", nextMatchId: "qf-3", nextSlot: "teamBId" },
  { id: "r16-7", nextMatchId: "qf-4", nextSlot: "teamAId" },
  { id: "r16-8", nextMatchId: "qf-4", nextSlot: "teamBId" },
  { id: "qf-1", nextMatchId: "sf-1", nextSlot: "teamAId" },
  { id: "qf-2", nextMatchId: "sf-1", nextSlot: "teamBId" },
  { id: "qf-3", nextMatchId: "sf-2", nextSlot: "teamAId" },
  { id: "qf-4", nextMatchId: "sf-2", nextSlot: "teamBId" },
  { id: "sf-1", nextMatchId: "final", nextSlot: "teamAId" },
  { id: "sf-2", nextMatchId: "final", nextSlot: "teamBId" },
  { id: "final" },
];

function cloneInitialBracket(): Match[] {
  return initialBracket.map((match) => ({ ...match }));
}

function createFixedRng(values: number[]): RNG {
  let index = 0;

  return {
    next() {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;

      return value;
    },
  };
}

function getScoreWinnerId(match: Match, score: MatchScore): TeamId {
  if (!match.teamAId || !match.teamBId) {
    throw new Error("Cannot determine score winner for incomplete match.");
  }

  if (score.decidedBy === "penalties") {
    return (score.teamAPenalties ?? 0) > (score.teamBPenalties ?? 0)
      ? match.teamAId
      : match.teamBId;
  }

  return score.teamAGoals > score.teamBGoals ? match.teamAId : match.teamBId;
}

function createTestRating(teamId: TeamId, overall: number): TeamRating {
  return {
    teamId,
    overall,
    attack: 80,
    defense: 80,
  };
}

function createSimpleMatch(): Match {
  return {
    id: "test-match",
    round: "round_of_32",
    teamAId: "arg",
    teamBId: "fra",
  };
}

function sequenceFromSeed(seed: number, length: number): number[] {
  const rng = createSeededRng(seed);

  return Array.from({ length }, () => rng.next());
}

describe("probability model", () => {
  it("returns 0.5 / 0.5 for equal overall ratings", () => {
    const probability = calculateMatchupProbability(
      createTestRating("a", 1800),
      createTestRating("b", 1800),
    );

    expect(probability.teamAWinProbability).toBeCloseTo(0.5);
    expect(probability.teamBWinProbability).toBeCloseTo(0.5);
  });

  it("gives the higher overall rating a higher win probability", () => {
    const strongerTeamProbability = calculateWinProbabilityFromOverall(1900, 1800);

    expect(strongerTeamProbability).toBeGreaterThan(0.5);
  });

  it("keeps probabilities between 0 and 1 and sums team probabilities to 1", () => {
    const probability = calculateMatchupProbability(
      createTestRating("a", 2000),
      createTestRating("b", 1600),
    );

    expect(probability.teamAWinProbability).toBeGreaterThan(0);
    expect(probability.teamAWinProbability).toBeLessThan(1);
    expect(probability.teamBWinProbability).toBeGreaterThan(0);
    expect(probability.teamBWinProbability).toBeLessThan(1);
    expect(
      probability.teamAWinProbability + probability.teamBWinProbability,
    ).toBeCloseTo(1);
  });
});

describe("seeded RNG", () => {
  it("returns the same sequence for the same seed", () => {
    expect(sequenceFromSeed(42, 8)).toEqual(sequenceFromSeed(42, 8));
  });

  it("returns different sequences for different seeds", () => {
    expect(sequenceFromSeed(1, 5)).not.toEqual(sequenceFromSeed(2, 5));
  });

  it("returns values in [0, 1)", () => {
    for (const value of sequenceFromSeed(123, 100)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("bracket simulation", () => {
  it("does not mutate the input bracket", () => {
    const matches = cloneInitialBracket();
    const before = structuredClone(matches);

    simulateBracket(matches, teamRatingsV2ByTeamId, createSeededRng(100));

    expect(matches).toEqual(before);
  });

  it("returns exactly one champion and every completed match has a winner", () => {
    const result = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(101),
    );

    expect(result.championId).toBeTruthy();
    expect(result.matches).toHaveLength(31);
    expect(result.matches.every((match) => Boolean(match.winnerId))).toBe(true);
    expect(result.matches.filter((match) => match.round === "final")).toHaveLength(1);
  });

  it("advances winners into the configured next-round slots", () => {
    const result = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(102),
    );
    const matchesById = new Map(result.matches.map((match) => [match.id, match]));

    for (const match of result.matches) {
      if (!match.nextMatchId || !match.nextSlot) {
        continue;
      }

      expect(matchesById.get(match.nextMatchId)?.[match.nextSlot]).toBe(match.winnerId);
    }
  });

  it("produces the same bracket result for the same seed", () => {
    const resultA = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(103),
    );
    const resultB = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(103),
    );

    expect(resultA).toEqual(resultB);
  });

  it("remains scoreless by default", () => {
    const result = simulateBracket(
      cloneInitialBracket(),
      teamRatingsV2ByTeamId,
      createSeededRng(104),
    );

    expect(result.matches.every((match) => match.score === undefined)).toBe(true);
  });
});

describe("scoreline simulation", () => {
  it("requires scoreRng when includeScoreline is true", () => {
    const missingScoreRngOptions = {
      includeScoreline: true,
    } as Parameters<typeof simulateMatch>[3];

    expect(() =>
      simulateMatch(
        createSimpleMatch(),
        teamRatingsV2ByTeamId,
        createSeededRng(200),
        missingScoreRngOptions,
      ),
    ).toThrow(/without scoreRng/);
  });

  it("returns displayed score winners that match winnerId", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const match = createSimpleMatch();
      const result = simulateMatch(
        match,
        teamRatingsV2ByTeamId,
        createSeededRng(seed),
        {
          includeScoreline: true,
          scoreRng: createSeededRng(seed + 1_000),
        },
      );

      expect(result.score).toBeDefined();
      expect(getScoreWinnerId(match, result.score!)).toBe(result.winnerId);
    }
  });

  it("keeps penalty match goals tied and stores shootout scores separately", () => {
    const match = createSimpleMatch();
    const result = simulateMatch(
      match,
      teamRatingsV2ByTeamId,
      createFixedRng([0]),
      {
        includeScoreline: true,
        scoreRng: createFixedRng([
          0.01,
          0.01,
          0.01,
          0.01,
          0.1,
          0.9,
          0.1,
          0.9,
          0.1,
          0.9,
        ]),
      },
    );

    expect(result.score?.decidedBy).toBe("penalties");
    expect(result.score?.teamAGoals).toBe(result.score?.teamBGoals);
    expect(result.score?.teamAPenalties).toBeDefined();
    expect(result.score?.teamBPenalties).toBeDefined();
    expect(result.score?.teamAPenalties).not.toBe(result.score?.teamBPenalties);
    expect(getScoreWinnerId(match, result.score!)).toBe(result.winnerId);
  });

  it("is deterministic for the same winner RNG seed and score RNG seed", () => {
    const resultA = simulateMatch(
      createSimpleMatch(),
      teamRatingsV2ByTeamId,
      createSeededRng(201),
      { includeScoreline: true, scoreRng: createSeededRng(202) },
    );
    const resultB = simulateMatch(
      createSimpleMatch(),
      teamRatingsV2ByTeamId,
      createSeededRng(201),
      { includeScoreline: true, scoreRng: createSeededRng(202) },
    );

    expect(resultA).toEqual(resultB);
  });
});

describe("Monte Carlo", () => {
  it("does not mutate the input bracket", () => {
    const matches = cloneInitialBracket();
    const before = structuredClone(matches);

    runMonteCarlo({
      matches,
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 20,
      rng: createSeededRng(300),
    });

    expect(matches).toEqual(before);
  });

  it("requires simulationCount to be a positive integer", () => {
    const baseOptions = {
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      rng: createSeededRng(301),
    };

    expect(() => runMonteCarlo({ ...baseOptions, simulationCount: 0 })).toThrow(
      /positive integer/,
    );
    expect(() => runMonteCarlo({ ...baseOptions, simulationCount: -1 })).toThrow(
      /positive integer/,
    );
    expect(() => runMonteCarlo({ ...baseOptions, simulationCount: 1.5 })).toThrow(
      /positive integer/,
    );
  });

  it("returns valid, monotonic probabilities whose champion probabilities sum to 1", () => {
    const result = runMonteCarlo({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 250,
      rng: createSeededRng(302),
    });
    const championProbabilitySum = result.teamOdds.reduce(
      (sum, odds) => sum + odds.championProbability,
      0,
    );

    expect(championProbabilitySum).toBeCloseTo(1);

    for (const odds of result.teamOdds) {
      const probabilities = [
        odds.roundOf16Probability,
        odds.quarterfinalProbability,
        odds.semifinalProbability,
        odds.finalProbability,
        odds.championProbability,
      ];

      for (const probability of probabilities) {
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(1);
      }

      expect(odds.roundOf16Probability).toBeGreaterThanOrEqual(
        odds.quarterfinalProbability,
      );
      expect(odds.quarterfinalProbability).toBeGreaterThanOrEqual(
        odds.semifinalProbability,
      );
      expect(odds.semifinalProbability).toBeGreaterThanOrEqual(odds.finalProbability);
      expect(odds.finalProbability).toBeGreaterThanOrEqual(odds.championProbability);
    }
  });

  it("is deterministic for identical seeds", () => {
    const resultA = runMonteCarlo({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 100,
      rng: createSeededRng(303),
    });
    const resultB = runMonteCarlo({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 100,
      rng: createSeededRng(303),
    });

    expect(resultA).toEqual(resultB);
  });

  it("keeps baseline Monte Carlo on the shared odds accounting path", () => {
    const directResult = runMonteCarlo({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 100,
      rng: createSeededRng(305),
    });
    const sharedAccountingResult = runMonteCarloAccounting({
      matches: cloneInitialBracket(),
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 100,
      rng: createSeededRng(305),
      simulateTournament: (matches, ratingsByTeamId, rng) =>
        simulateBracket([...matches], ratingsByTeamId, rng),
    });

    expect(directResult).toEqual(sharedAccountingResult);
  });

  it("remains scoreless", () => {
    const matches = cloneInitialBracket();

    runMonteCarlo({
      matches,
      ratingsByTeamId: teamRatingsV2ByTeamId,
      simulationCount: 20,
      rng: createSeededRng(304),
    });

    expect(matches.every((match) => match.score === undefined)).toBe(true);
  });
});

describe("rating-data integrity", () => {
  it("exports World Football Elo development ratings through the stable V2 boundary", () => {
    expect(teamRatingsV2ByTeamId).toBe(worldFootballEloDevelopmentByTeamId);
  });

  it("exposes stable metadata for the active V2 ratings source", () => {
    expect(teamRatingsV2SourceMetadata).toEqual({
      sourceName: "World Football Elo Ratings",
      snapshotDate: "2026-06-18",
      developmentSnapshot: true,
      refreshRequiredAfterGroupStage: true,
    });
  });

  it("keeps the demo team registry to exactly 32 unique tournament teams", () => {
    const demoTeamIds = mockTeams.map((team) => team.id);
    const tournamentTeamIds = new Set(tournamentTeams.map((team) => team.id));

    expect(mockTeams).toHaveLength(32);
    expect(new Set(demoTeamIds).size).toBe(32);

    for (const teamId of demoTeamIds) {
      expect(tournamentTeamIds.has(teamId)).toBe(true);
    }
  });

  it("keeps every demo team covered by World Football Elo development ratings", () => {
    for (const team of mockTeams) {
      expect(worldFootballEloDevelopmentByTeamId[team.id]).toBeDefined();
    }
  });

  it("removes the incompatible non-tournament demo teams from registry and bracket", () => {
    const demoTeamIds = new Set(mockTeams.map((team) => team.id));
    const bracketTeamIds = new Set(
      initialBracket.flatMap((match) => [match.teamAId, match.teamBId]).filter(Boolean),
    );

    for (const teamId of incompatibleDemoTeamIds) {
      expect(demoTeamIds.has(teamId)).toBe(false);
      expect(bracketTeamIds.has(teamId)).toBe(false);
    }
  });

  it("keeps Round of 32 bracket slots aligned with the 32 demo teams exactly once", () => {
    const demoTeamIds = mockTeams.map((team) => team.id).sort();
    const roundOf32TeamIds = initialBracket
      .filter((match) => match.round === "round_of_32")
      .flatMap((match) => [match.teamAId, match.teamBId])
      .filter((teamId): teamId is TeamId => Boolean(teamId))
      .sort();

    expect(roundOf32TeamIds).toHaveLength(32);
    expect(new Set(roundOf32TeamIds).size).toBe(32);
    expect(roundOf32TeamIds).toEqual(demoTeamIds);
  });

  it("preserves bracket match IDs and advancement topology", () => {
    expect(
      initialBracket.map((match) => ({
        id: match.id,
        nextMatchId: match.nextMatchId,
        nextSlot: match.nextSlot,
      })),
    ).toEqual(expectedBracketTopology);
  });

  it("has stable V2 ratings for every mock team and every Round of 32 bracket team", () => {
    const mockTeamIds = new Set(mockTeams.map((team) => team.id));
    const roundOf32TeamIds = initialBracket
      .filter((match) => match.round === "round_of_32")
      .flatMap((match) => [match.teamAId, match.teamBId])
      .filter((teamId): teamId is TeamId => Boolean(teamId));

    for (const teamId of mockTeamIds) {
      expect(teamRatingsV2ByTeamId[teamId]).toBeDefined();
    }

    for (const teamId of roundOf32TeamIds) {
      expect(teamRatingsV2ByTeamId[teamId]).toBeDefined();
    }
  });

  it("keeps every V2 normalized field between 0 and 100 and modelVersion set to v2", () => {
    for (const rating of Object.values(teamRatingsV2ByTeamId)) {
      expect(rating.modelVersion).toBe("v2");

      for (const field of [
        "attack",
        "defense",
        "recentForm",
        "squadStrength",
        "penalties",
      ] as const) {
        expect(rating[field]).toBeGreaterThanOrEqual(0);
        expect(rating[field]).toBeLessThanOrEqual(100);
      }
    }
  });
});
