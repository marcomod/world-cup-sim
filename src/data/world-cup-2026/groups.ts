import type { TournamentGroup } from "@/src/lib/tournament-2026/types";

// Development static registry for the official 2026 group draw. This is not
// live data and does not contain match results.
export const worldCup2026Groups: readonly TournamentGroup[] = [
  { id: "A", teamIds: ["mex", "rsa", "kor", "cze"] },
  { id: "B", teamIds: ["can", "bih", "qat", "sui"] },
  { id: "C", teamIds: ["bra", "mar", "hai", "sco"] },
  { id: "D", teamIds: ["usa", "par", "aus", "tur"] },
  { id: "E", teamIds: ["ger", "cuw", "civ", "ecu"] },
  { id: "F", teamIds: ["ned", "jpn", "swe", "tun"] },
  { id: "G", teamIds: ["bel", "egy", "irn", "nzl"] },
  { id: "H", teamIds: ["esp", "cpv", "ksa", "uru"] },
  { id: "I", teamIds: ["fra", "sen", "irq", "nor"] },
  { id: "J", teamIds: ["arg", "alg", "aut", "jor"] },
  { id: "K", teamIds: ["por", "cod", "uzb", "col"] },
  { id: "L", teamIds: ["eng", "cro", "gha", "pan"] },
];
