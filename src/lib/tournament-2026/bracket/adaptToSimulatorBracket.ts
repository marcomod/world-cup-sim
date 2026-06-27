import type { Match, RatingsByTeamId } from "@/src/lib/simulator/types";
import type { GeneratedRoundOf32Match } from "../types";
import { knockoutTopology } from "./knockoutTopology";

const simulatorRounds = {
  round_of_32: "round_of_32",
  round_of_16: "round_of_16",
  quarterfinal: "quarterfinal",
  semifinal: "semifinal",
  final: "final",
} as const;

function toSimulatorMatch(
  topologyId: string,
  teamAId: Match["teamAId"],
  teamBId: Match["teamBId"],
): Match {
  const topology = knockoutTopology.find((match) => match.matchId === topologyId);
  if (!topology || !topology.championPath || topology.round === "third_place") {
    throw new Error(`Missing champion-path topology for "${topologyId}".`);
  }

  const winnerAdvancement = topology.advancements.find((advancement) => advancement.outcome === "winner");

  return {
    id: topology.matchId,
    round: simulatorRounds[topology.round],
    teamAId,
    teamBId,
    // The existing simulator is champion-path-only. Tournament-domain loser
    // links to m103 remain in canonical topology and are intentionally omitted.
    ...(winnerAdvancement
      ? { nextMatchId: winnerAdvancement.toMatchId, nextSlot: winnerAdvancement.toSlot }
      : {}),
  };
}

export function adaptRoundOf32ToSimulatorBracket(
  roundOf32: readonly GeneratedRoundOf32Match[],
  ratingsByTeamId: RatingsByTeamId,
): Match[] {
  if (roundOf32.length !== 16) {
    throw new Error("Simulator adapter requires exactly 16 Round-of-32 matches.");
  }

  const missingRatings = roundOf32
    .flatMap((match) => [match.homeTeamId, match.awayTeamId])
    .filter((teamId) => !ratingsByTeamId[teamId]);

  if (missingRatings.length > 0) {
    throw new Error(`Generated bracket contains teams without active ratings: ${missingRatings.join(", ")}.`);
  }

  const firstRound = roundOf32.map((match) =>
    toSimulatorMatch(match.matchId, match.homeTeamId, match.awayTeamId),
  );

  const laterRoundMatches = knockoutTopology
    .filter((match) => match.championPath && match.round !== "round_of_32")
    .map((match) => toSimulatorMatch(match.matchId, null, null));

  return [...firstRound, ...laterRoundMatches];
}
