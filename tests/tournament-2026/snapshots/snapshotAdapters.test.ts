import { describe, expect, it } from "vitest";
import {
  adaptSnapshotFairPlay,
  adaptSnapshotFifaRanking,
  adaptSnapshotMatches,
  adaptSnapshotTeams,
} from "@/src/lib/tournament-2026";
import { validatedCompleteSnapshot } from "./helpers";

describe("snapshot adapters", () => {
  it("converts validated snapshots into existing tournament-domain inputs", () => {
    const snapshot = validatedCompleteSnapshot();

    const groups = adaptSnapshotTeams(snapshot);
    const matches = adaptSnapshotMatches(snapshot);
    const fairPlay = adaptSnapshotFairPlay(snapshot);
    const fifaRanking = adaptSnapshotFifaRanking(snapshot);

    expect(groups).toHaveLength(12);
    expect(groups[0]).toEqual({ id: "A", teamIds: ["cze", "kor", "mex", "rsa"] });
    expect(matches).toHaveLength(72);
    expect(matches.every((match) => match.status === "completed")).toBe(true);
    expect(fairPlay.mex).toEqual({ teamId: "mex", deductionPoints: 0 });
    expect(fifaRanking.mex).toEqual({ teamId: "mex", rank: 1, rankingDate: "2026-06-18" });
  });
});
