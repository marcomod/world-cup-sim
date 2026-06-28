import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildKnockoutRatingSnapshot } from "@/src/lib/tournament-2026/ratings/buildKnockoutRatingSnapshot";
import { buildTournamentStateWithKnockoutRatings } from "@/src/lib/tournament-2026/ratings/integrateKnockoutRatings";
import { validateKnockoutRatingSnapshot } from "@/src/data/world-cup-2026/ratings";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";
import { OFFICIAL_SNAPSHOT_FILE } from "@/scripts/tournament-2026/officialSnapshotPaths";

describe("World Cup 2026 knockout rating snapshot", () => {
  it("builds and validates a deterministic 48-team rating snapshot linked to the official tournament checksum", () => {
    const tournamentSnapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
    const ratingSnapshot = buildKnockoutRatingSnapshot({ tournamentSnapshot });
    const validated = validateKnockoutRatingSnapshot(ratingSnapshot);

    expect(validated.records).toHaveLength(48);
    expect(validated.divisor).toBe(400);
    expect(validated.kFactor).toBe(20);
    expect(validated.kFactorPolicy).toMatchObject({
      value: 20,
      policyId: "project-sequential-elo-k20-neutral-v1",
      selectedBeforeKnockoutResults: true,
    });
    expect(validated.initialRatingSource).toMatchObject({
      sourceName: "World Football Elo Ratings",
      snapshotDate: "2026-06-18",
      inputChecksum: "aa2737ecf28cff98d0606c0b26ac7f65125f5590860711c82b9c27115f4dd684",
    });
    expect(validated.completedMatchCount).toBe(72);
    expect(validated.fixtureRangeUsed).toEqual({ firstFifaMatchNumber: 1, lastFifaMatchNumber: 72 });
    expect(validated.tournamentSnapshotChecksum).toBe(tournamentSnapshot.metadata.snapshotChecksum);
    expect(new Set(validated.records.map((record) => record.teamId)).size).toBe(48);
    for (const record of validated.records) {
      expect(Number.isFinite(record.preTournamentRating)).toBe(true);
      expect(Number.isFinite(record.groupStageDelta)).toBe(true);
      expect(Number.isFinite(record.knockoutRating)).toBe(true);
      expect(record.preTournamentRating + record.groupStageDelta).toBeCloseTo(record.knockoutRating, 9);
    }
  });

  it("keeps rating JSON and Markdown report metadata aligned", () => {
    const report = JSON.parse(readFileSync("data/generated/world-cup-2026/knockout-rating-report.json", "utf8")) as {
      ratingSnapshotId: string;
      ratingSnapshotVersion: string;
      tournamentSnapshotId: string;
      tournamentSnapshotChecksum: string;
      initialRatingSource: { sourceName: string; snapshotDate: string };
      kFactorPolicy: { policyId: string };
      completedMatchCount: number;
      ratingChecksum: string;
    };
    const markdown = readFileSync("data/generated/world-cup-2026/knockout-rating-report.md", "utf8");

    expect(markdown).toContain(report.ratingSnapshotId);
    expect(markdown).toContain(report.ratingSnapshotVersion);
    expect(markdown).toContain(report.tournamentSnapshotId);
    expect(markdown).toContain(report.tournamentSnapshotChecksum);
    expect(markdown).toContain(report.initialRatingSource.sourceName);
    expect(markdown).toContain(report.initialRatingSource.snapshotDate);
    expect(markdown).toContain(report.kFactorPolicy.policyId);
    expect(markdown).toContain(`Matches processed: ${report.completedMatchCount}`);
    expect(markdown).toContain(report.ratingChecksum);
  });

  it("rejects mismatched tournament checksum linkage", () => {
    const tournamentSnapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
    const ratingSnapshot = {
      ...buildKnockoutRatingSnapshot({ tournamentSnapshot }),
      tournamentSnapshotChecksum: "0".repeat(64),
    };
    expect(() => buildTournamentStateWithKnockoutRatings({ tournamentSnapshot, ratingSnapshot })).toThrow(
      /does not match the tournament snapshot checksum/,
    );
  });

  it("fails when a qualified team rating is missing", () => {
    const tournamentSnapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
    const ratingSnapshot = buildKnockoutRatingSnapshot({ tournamentSnapshot });
    const missingRecordSnapshot = {
      ...ratingSnapshot,
      records: ratingSnapshot.records.filter((record) => record.teamId !== ratingSnapshot.records[0].teamId),
    };
    expect(() => buildTournamentStateWithKnockoutRatings({ tournamentSnapshot, ratingSnapshot: missingRecordSnapshot })).toThrow(
      /exactly 48 rating records/,
    );
  });
});
