import type { KnockoutTopologyMatch } from "../types";

export const KNOCKOUT_TOPOLOGY_METADATA = {
  version: "fifa-world-cup-26-knockout-topology-may-2026-v2",
  sourceTitle: "Regulations for the FIFA World Cup 26",
  sourceUrl: "https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf",
  sourceDocumentDate: "May 2026",
} as const;

const winnerTo = (toMatchId: string, toSlot: "teamAId" | "teamBId") =>
  ({ outcome: "winner", toMatchId, toSlot }) as const;

const loserTo = (toMatchId: string, toSlot: "teamAId" | "teamBId") =>
  ({ outcome: "loser", toMatchId, toSlot }) as const;

export const knockoutTopology: readonly KnockoutTopologyMatch[] = [
  { matchId: "m73", round: "round_of_32", advancements: [winnerTo("m90", "teamAId")], championPath: true },
  { matchId: "m74", round: "round_of_32", advancements: [winnerTo("m89", "teamAId")], championPath: true },
  { matchId: "m75", round: "round_of_32", advancements: [winnerTo("m90", "teamBId")], championPath: true },
  { matchId: "m76", round: "round_of_32", advancements: [winnerTo("m91", "teamAId")], championPath: true },
  { matchId: "m77", round: "round_of_32", advancements: [winnerTo("m89", "teamBId")], championPath: true },
  { matchId: "m78", round: "round_of_32", advancements: [winnerTo("m91", "teamBId")], championPath: true },
  { matchId: "m79", round: "round_of_32", advancements: [winnerTo("m92", "teamAId")], championPath: true },
  { matchId: "m80", round: "round_of_32", advancements: [winnerTo("m92", "teamBId")], championPath: true },
  { matchId: "m81", round: "round_of_32", advancements: [winnerTo("m94", "teamAId")], championPath: true },
  { matchId: "m82", round: "round_of_32", advancements: [winnerTo("m94", "teamBId")], championPath: true },
  { matchId: "m83", round: "round_of_32", advancements: [winnerTo("m93", "teamAId")], championPath: true },
  { matchId: "m84", round: "round_of_32", advancements: [winnerTo("m93", "teamBId")], championPath: true },
  { matchId: "m85", round: "round_of_32", advancements: [winnerTo("m96", "teamAId")], championPath: true },
  { matchId: "m86", round: "round_of_32", advancements: [winnerTo("m95", "teamAId")], championPath: true },
  { matchId: "m87", round: "round_of_32", advancements: [winnerTo("m96", "teamBId")], championPath: true },
  { matchId: "m88", round: "round_of_32", advancements: [winnerTo("m95", "teamBId")], championPath: true },
  { matchId: "m89", round: "round_of_16", advancements: [winnerTo("m97", "teamAId")], championPath: true },
  { matchId: "m90", round: "round_of_16", advancements: [winnerTo("m97", "teamBId")], championPath: true },
  { matchId: "m91", round: "round_of_16", advancements: [winnerTo("m99", "teamAId")], championPath: true },
  { matchId: "m92", round: "round_of_16", advancements: [winnerTo("m99", "teamBId")], championPath: true },
  { matchId: "m93", round: "round_of_16", advancements: [winnerTo("m98", "teamAId")], championPath: true },
  { matchId: "m94", round: "round_of_16", advancements: [winnerTo("m98", "teamBId")], championPath: true },
  { matchId: "m95", round: "round_of_16", advancements: [winnerTo("m100", "teamAId")], championPath: true },
  { matchId: "m96", round: "round_of_16", advancements: [winnerTo("m100", "teamBId")], championPath: true },
  { matchId: "m97", round: "quarterfinal", advancements: [winnerTo("m101", "teamAId")], championPath: true },
  { matchId: "m98", round: "quarterfinal", advancements: [winnerTo("m101", "teamBId")], championPath: true },
  { matchId: "m99", round: "quarterfinal", advancements: [winnerTo("m102", "teamAId")], championPath: true },
  { matchId: "m100", round: "quarterfinal", advancements: [winnerTo("m102", "teamBId")], championPath: true },
  {
    matchId: "m101",
    round: "semifinal",
    advancements: [winnerTo("m104", "teamAId"), loserTo("m103", "teamAId")],
    championPath: true,
  },
  {
    matchId: "m102",
    round: "semifinal",
    advancements: [winnerTo("m104", "teamBId"), loserTo("m103", "teamBId")],
    championPath: true,
  },
  { matchId: "m103", round: "third_place", advancements: [], championPath: false },
  { matchId: "m104", round: "final", advancements: [], championPath: true },
];
