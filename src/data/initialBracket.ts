import type { Match } from "@/src/lib/simulator/types";

export const initialBracket: Match[] = [
  { id: "r32-1", round: "round_of_32", teamAId: "arg", teamBId: "nzl", nextMatchId: "r16-1", nextSlot: "teamAId" },
  { id: "r32-2", round: "round_of_32", teamAId: "sco", teamBId: "mar", nextMatchId: "r16-1", nextSlot: "teamBId" },
  { id: "r32-3", round: "round_of_32", teamAId: "por", teamBId: "gha", nextMatchId: "r16-2", nextSlot: "teamAId" },
  { id: "r32-4", round: "round_of_32", teamAId: "mex", teamBId: "jpn", nextMatchId: "r16-2", nextSlot: "teamBId" },
  { id: "r32-5", round: "round_of_32", teamAId: "esp", teamBId: "jor", nextMatchId: "r16-3", nextSlot: "teamAId" },
  { id: "r32-6", round: "round_of_32", teamAId: "cro", teamBId: "kor", nextMatchId: "r16-3", nextSlot: "teamBId" },
  { id: "r32-7", round: "round_of_32", teamAId: "bel", teamBId: "aus", nextMatchId: "r16-4", nextSlot: "teamAId" },
  { id: "r32-8", round: "round_of_32", teamAId: "bra", teamBId: "can", nextMatchId: "r16-4", nextSlot: "teamBId" },
  { id: "r32-9", round: "round_of_32", teamAId: "fra", teamBId: "qat", nextMatchId: "r16-5", nextSlot: "teamAId" },
  { id: "r32-10", round: "round_of_32", teamAId: "uru", teamBId: "sen", nextMatchId: "r16-5", nextSlot: "teamBId" },
  { id: "r32-11", round: "round_of_32", teamAId: "ger", teamBId: "uzb", nextMatchId: "r16-6", nextSlot: "teamAId" },
  { id: "r32-12", round: "round_of_32", teamAId: "usa", teamBId: "sui", nextMatchId: "r16-6", nextSlot: "teamBId" },
  { id: "r32-13", round: "round_of_32", teamAId: "eng", teamBId: "ksa", nextMatchId: "r16-7", nextSlot: "teamAId" },
  { id: "r32-14", round: "round_of_32", teamAId: "col", teamBId: "swe", nextMatchId: "r16-7", nextSlot: "teamBId" },
  { id: "r32-15", round: "round_of_32", teamAId: "ned", teamBId: "ecu", nextMatchId: "r16-8", nextSlot: "teamAId" },
  { id: "r32-16", round: "round_of_32", teamAId: "aut", teamBId: "civ", nextMatchId: "r16-8", nextSlot: "teamBId" },

  { id: "r16-1", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-1", nextSlot: "teamAId" },
  { id: "r16-2", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-1", nextSlot: "teamBId" },
  { id: "r16-3", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-2", nextSlot: "teamAId" },
  { id: "r16-4", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-2", nextSlot: "teamBId" },
  { id: "r16-5", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-3", nextSlot: "teamAId" },
  { id: "r16-6", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-3", nextSlot: "teamBId" },
  { id: "r16-7", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-4", nextSlot: "teamAId" },
  { id: "r16-8", round: "round_of_16", teamAId: null, teamBId: null, nextMatchId: "qf-4", nextSlot: "teamBId" },

  { id: "qf-1", round: "quarterfinal", teamAId: null, teamBId: null, nextMatchId: "sf-1", nextSlot: "teamAId" },
  { id: "qf-2", round: "quarterfinal", teamAId: null, teamBId: null, nextMatchId: "sf-1", nextSlot: "teamBId" },
  { id: "qf-3", round: "quarterfinal", teamAId: null, teamBId: null, nextMatchId: "sf-2", nextSlot: "teamAId" },
  { id: "qf-4", round: "quarterfinal", teamAId: null, teamBId: null, nextMatchId: "sf-2", nextSlot: "teamBId" },

  { id: "sf-1", round: "semifinal", teamAId: null, teamBId: null, nextMatchId: "final", nextSlot: "teamAId" },
  { id: "sf-2", round: "semifinal", teamAId: null, teamBId: null, nextMatchId: "final", nextSlot: "teamBId" },

  { id: "final", round: "final", teamAId: null, teamBId: null },
];
