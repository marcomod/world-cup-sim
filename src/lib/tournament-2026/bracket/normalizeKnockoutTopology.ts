import { compareCodePoints } from "../constants";
import type {
  AdvancementOutcome,
  KnockoutMatchRound,
  KnockoutTopologyMatch,
  ParticipantSlot,
} from "../types";

export interface NormalizedTopologyAdvancement {
  outcome: AdvancementOutcome;
  toMatchId: string;
  toSlot: ParticipantSlot;
}

export interface NormalizedTopologyEntry {
  matchId: string;
  round: KnockoutMatchRound;
  championPath: boolean;
  advancements: readonly NormalizedTopologyAdvancement[];
}

function compareAdvancements(
  left: NormalizedTopologyAdvancement,
  right: NormalizedTopologyAdvancement,
): number {
  return (
    compareCodePoints(left.outcome, right.outcome) ||
    compareCodePoints(left.toMatchId, right.toMatchId) ||
    compareCodePoints(left.toSlot, right.toSlot)
  );
}

export function normalizeKnockoutTopology(
  topology: readonly KnockoutTopologyMatch[],
): readonly NormalizedTopologyEntry[] {
  return [...topology]
    .sort((left, right) => compareCodePoints(left.matchId, right.matchId))
    .map((match) => ({
      matchId: match.matchId,
      round: match.round,
      championPath: match.championPath,
      advancements: match.advancements
        .map((advancement) => ({
          outcome: advancement.outcome,
          toMatchId: advancement.toMatchId,
          toSlot: advancement.toSlot,
        }))
        .sort(compareAdvancements),
    }));
}

export function serializeNormalizedKnockoutTopology(
  normalizedTopology: readonly NormalizedTopologyEntry[],
): string {
  return `[${normalizedTopology
    .map(
      (match) =>
        `{"advancements":[${match.advancements
          .map(
            (advancement) =>
              `{"outcome":${JSON.stringify(advancement.outcome)},"toMatchId":${JSON.stringify(
                advancement.toMatchId,
              )},"toSlot":${JSON.stringify(advancement.toSlot)}}`,
          )
          .join(",")}],"championPath":${JSON.stringify(match.championPath)},"matchId":${JSON.stringify(
          match.matchId,
        )},"round":${JSON.stringify(match.round)}}`,
    )
    .join(",")}]`;
}
