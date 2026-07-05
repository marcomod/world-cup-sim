import { runMonteCarloAccounting } from "@/src/lib/simulator/monteCarlo";
import { simulateMatch } from "@/src/lib/simulator/simulateMatch";
import type {
  BracketSimulationOptions,
  Match,
  MatchScore,
  MonteCarloResult,
  RatingsByTeamId,
  RNG,
  TeamId,
  TournamentSimulationResult,
} from "@/src/lib/simulator/types";

type KnockoutArtifactScore = {
  participantAGoals: number;
  participantBGoals: number;
  decidedBy: MatchScore["decidedBy"];
  participantAPenalties?: number;
  participantBPenalties?: number;
};

type KnockoutArtifactParticipant = {
  teamId: TeamId;
  displayName: string;
  sourceSlot: string;
};

type CompletedKnockoutArtifactMatch = {
  matchId: string;
  participantA: KnockoutArtifactParticipant;
  participantB: KnockoutArtifactParticipant;
  score: KnockoutArtifactScore;
  winnerId: TeamId;
  resultStatus: "official_final";
};

type PendingKnockoutArtifactMatch = {
  matchId: string;
  knownParticipants: {
    participantA?: KnockoutArtifactParticipant;
    participantB?: KnockoutArtifactParticipant;
  };
  status: "pending";
};

export type MixedOfficialMatchStatus =
  | "official_completed"
  | "pending_simulation";

export interface MixedOfficialSimulatorMatch extends Match {
  officialResultLocked: boolean;
  officialResultStatus?: "official_final";
  mixedOfficialStatus: MixedOfficialMatchStatus;
}

export interface KnockoutResultsForSimulator {
  completedMatches: CompletedKnockoutArtifactMatch[];
  pendingMatches: PendingKnockoutArtifactMatch[];
}

export interface MixedOfficialMonteCarloOptions {
  matches: readonly MixedOfficialSimulatorMatch[];
  ratingsByTeamId: RatingsByTeamId;
  simulationCount: number;
  rng: RNG;
}

function toSimulatorScore(score: KnockoutArtifactScore): MatchScore {
  return {
    teamAGoals: score.participantAGoals,
    teamBGoals: score.participantBGoals,
    decidedBy: score.decidedBy,
    ...(score.participantAPenalties !== undefined ? { teamAPenalties: score.participantAPenalties } : {}),
    ...(score.participantBPenalties !== undefined ? { teamBPenalties: score.participantBPenalties } : {}),
  };
}

export function prepareMixedOfficialSimulatorBracket(
  matches: readonly Match[],
  knockoutResults: KnockoutResultsForSimulator,
): MixedOfficialSimulatorMatch[] {
  const completedById = new Map(
    knockoutResults.completedMatches.map((match) => [match.matchId, match]),
  );
  const pendingById = new Map(
    knockoutResults.pendingMatches.map((match) => [match.matchId, match]),
  );

  return matches.map((match) => {
    const completed = completedById.get(match.id);
    if (completed) {
      return {
        ...match,
        teamAId: completed.participantA.teamId,
        teamBId: completed.participantB.teamId,
        winnerId: completed.winnerId,
        score: toSimulatorScore(completed.score),
        officialResultLocked: true,
        officialResultStatus: completed.resultStatus,
        mixedOfficialStatus: "official_completed",
      };
    }

    const pending = pendingById.get(match.id);
    return {
      ...match,
      teamAId: pending?.knownParticipants.participantA?.teamId ?? match.teamAId,
      teamBId: pending?.knownParticipants.participantB?.teamId ?? match.teamBId,
      officialResultLocked: false,
      mixedOfficialStatus: "pending_simulation",
    };
  });
}

export function simulateMixedOfficialBracket(
  matches: readonly MixedOfficialSimulatorMatch[],
  ratingsByTeamId: RatingsByTeamId,
  rng: RNG,
  options: BracketSimulationOptions = {},
): TournamentSimulationResult {
  const simulatedMatches = matches.map((match) => ({ ...match }));
  const matchesById = new Map(simulatedMatches.map((match) => [match.id, match]));

  for (const match of simulatedMatches) {
    const result = match.officialResultLocked
      ? {
          winnerId: match.winnerId,
          score: match.score,
        }
      : simulateMatch(match, ratingsByTeamId, rng, options);

    if (!result.winnerId) {
      throw new Error(`Officially locked match "${match.id}" is missing a winner.`);
    }

    match.winnerId = result.winnerId;

    if (result.score) {
      match.score = result.score;
    }

    if (!match.nextMatchId) {
      continue;
    }

    if (!match.nextSlot) {
      throw new Error(`Match "${match.id}" has nextMatchId but no nextSlot.`);
    }

    const nextMatch = matchesById.get(match.nextMatchId);

    if (!nextMatch) {
      throw new Error(`Match "${match.id}" advances to missing match "${match.nextMatchId}".`);
    }

    const existingParticipant = nextMatch[match.nextSlot];
    if (existingParticipant && existingParticipant !== result.winnerId) {
      throw new Error(`Official routing conflict from "${match.id}" into "${match.nextMatchId}".`);
    }
    nextMatch[match.nextSlot] = result.winnerId;
  }

  const finalMatch = simulatedMatches[simulatedMatches.length - 1];

  if (!finalMatch || finalMatch.round !== "final") {
    throw new Error("Cannot determine champion because the final match is missing or not last.");
  }

  if (!finalMatch.winnerId) {
    throw new Error(`Cannot determine champion because final match "${finalMatch.id}" has no winner.`);
  }

  return {
    championId: finalMatch.winnerId,
    matches: simulatedMatches,
  };
}

export function runMixedOfficialMonteCarlo(
  options: MixedOfficialMonteCarloOptions,
): MonteCarloResult {
  return runMonteCarloAccounting({
    ...options,
    simulateTournament: simulateMixedOfficialBracket,
  });
}
