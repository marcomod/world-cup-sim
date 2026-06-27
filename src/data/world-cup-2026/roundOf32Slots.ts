import type { GroupId, RoundOf32SlotDefinition } from "@/src/lib/tournament-2026/types";

const groupPosition = (group: GroupId, position: 1 | 2, label: string) =>
  ({ type: "group_position", group, position, label }) as const;

const thirdPlace = (
  assignmentKey: string,
  label: string,
  eligibleGroups: readonly GroupId[],
) =>
  ({
    type: "third_place",
    assignmentKey,
    label,
    eligibleGroups,
  }) as const;

// FIFA World Cup 26 Round of 32 schedule, static development encoding.
// Source reviewed from the published FIFA match schedule/regulations surfaced
// in the knockout-stage schedule. Version: round-of-32-slots-2026-v1.
export const roundOf32SlotDefinitions: readonly RoundOf32SlotDefinition[] = [
  {
    matchId: "m73",
    homeSource: groupPosition("A", 2, "2A"),
    awaySource: groupPosition("B", 2, "2B"),
    nextMatchId: "m90",
    nextSlot: "teamAId",
  },
  {
    matchId: "m74",
    homeSource: groupPosition("E", 1, "1E"),
    awaySource: thirdPlace("third_vs_1E", "3A/B/C/D/F", ["A", "B", "C", "D", "F"]),
    nextMatchId: "m89",
    nextSlot: "teamAId",
  },
  {
    matchId: "m75",
    homeSource: groupPosition("F", 1, "1F"),
    awaySource: groupPosition("C", 2, "2C"),
    nextMatchId: "m90",
    nextSlot: "teamBId",
  },
  {
    matchId: "m76",
    homeSource: groupPosition("C", 1, "1C"),
    awaySource: groupPosition("F", 2, "2F"),
    nextMatchId: "m91",
    nextSlot: "teamAId",
  },
  {
    matchId: "m77",
    homeSource: groupPosition("I", 1, "1I"),
    awaySource: thirdPlace("third_vs_1I", "3C/D/F/G/H", ["C", "D", "F", "G", "H"]),
    nextMatchId: "m89",
    nextSlot: "teamBId",
  },
  {
    matchId: "m78",
    homeSource: groupPosition("E", 2, "2E"),
    awaySource: groupPosition("I", 2, "2I"),
    nextMatchId: "m91",
    nextSlot: "teamBId",
  },
  {
    matchId: "m79",
    homeSource: groupPosition("A", 1, "1A"),
    awaySource: thirdPlace("third_vs_1A", "3C/E/F/H/I", ["C", "E", "F", "H", "I"]),
    nextMatchId: "m92",
    nextSlot: "teamAId",
  },
  {
    matchId: "m80",
    homeSource: groupPosition("L", 1, "1L"),
    awaySource: thirdPlace("third_vs_1L", "3E/H/I/J/K", ["E", "H", "I", "J", "K"]),
    nextMatchId: "m92",
    nextSlot: "teamBId",
  },
  {
    matchId: "m81",
    homeSource: groupPosition("D", 1, "1D"),
    awaySource: thirdPlace("third_vs_1D", "3B/E/F/I/J", ["B", "E", "F", "I", "J"]),
    nextMatchId: "m94",
    nextSlot: "teamAId",
  },
  {
    matchId: "m82",
    homeSource: groupPosition("G", 1, "1G"),
    awaySource: thirdPlace("third_vs_1G", "3A/E/H/I/J", ["A", "E", "H", "I", "J"]),
    nextMatchId: "m94",
    nextSlot: "teamBId",
  },
  {
    matchId: "m83",
    homeSource: groupPosition("K", 2, "2K"),
    awaySource: groupPosition("L", 2, "2L"),
    nextMatchId: "m93",
    nextSlot: "teamAId",
  },
  {
    matchId: "m84",
    homeSource: groupPosition("H", 1, "1H"),
    awaySource: groupPosition("J", 2, "2J"),
    nextMatchId: "m93",
    nextSlot: "teamBId",
  },
  {
    matchId: "m85",
    homeSource: groupPosition("B", 1, "1B"),
    awaySource: thirdPlace("third_vs_1B", "3E/F/G/I/J", ["E", "F", "G", "I", "J"]),
    nextMatchId: "m96",
    nextSlot: "teamAId",
  },
  {
    matchId: "m86",
    homeSource: groupPosition("J", 1, "1J"),
    awaySource: groupPosition("H", 2, "2H"),
    nextMatchId: "m95",
    nextSlot: "teamAId",
  },
  {
    matchId: "m87",
    homeSource: groupPosition("K", 1, "1K"),
    awaySource: thirdPlace("third_vs_1K", "3D/E/I/J/L", ["D", "E", "I", "J", "L"]),
    nextMatchId: "m96",
    nextSlot: "teamBId",
  },
  {
    matchId: "m88",
    homeSource: groupPosition("D", 2, "2D"),
    awaySource: groupPosition("G", 2, "2G"),
    nextMatchId: "m95",
    nextSlot: "teamBId",
  },
];
