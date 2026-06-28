import { describe, expect, it } from "vitest";
import {
  computeTournamentSnapshotChecksum,
  serializeNormalizedTournamentSnapshot,
} from "@/src/data/world-cup-2026/snapshots/node";
import { normalizeTournamentSnapshot, validateTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import type { TournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { cloneSnapshot, completeSnapshot } from "./helpers";

function checksum(snapshot: TournamentSnapshot): string {
  return computeTournamentSnapshotChecksum(snapshot);
}

function expectChecksumChanges(
  label: string,
  mutate: (snapshot: TournamentSnapshot) => TournamentSnapshot,
): void {
  const baseline = completeSnapshot();
  const mutated = mutate(cloneSnapshot(baseline));
  expect(checksum(mutated), label).not.toBe(checksum(baseline));
}

function reorderObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).reverse()) as T;
}

describe("tournament snapshot checksum", () => {
  it("is stable under non-semantic array, object, and formatting changes", () => {
    const baseline = completeSnapshot();
    const reordered = cloneSnapshot(baseline);
    reordered.teams = [...reordered.teams].reverse();
    reordered.fixtures = [...reordered.fixtures].reverse();
    reordered.fairPlay = [...reordered.fairPlay].reverse();
    reordered.fifaRanking = [...reordered.fifaRanking].reverse();
    reordered.sources = reorderObject(reordered.sources as unknown as Record<string, unknown>) as typeof reordered.sources;
    reordered.sources.teams = reorderObject(reordered.sources.teams as unknown as Record<string, unknown>) as typeof reordered.sources.teams;
    reordered.fixtures = reordered.fixtures.map((fixture) => reorderObject(fixture as unknown as Record<string, unknown>) as typeof fixture);

    const compact = JSON.parse(JSON.stringify(reordered)) as TournamentSnapshot;
    const pretty = JSON.parse(JSON.stringify(reordered, null, 4)) as TournamentSnapshot;

    expect(checksum(reordered)).toBe(checksum(baseline));
    expect(checksum(compact)).toBe(checksum(baseline));
    expect(checksum(pretty)).toBe(checksum(baseline));
  });

  it("changes when snapshot identity or derived state changes", () => {
    expect(() =>
      checksum({ ...completeSnapshot(), schemaVersion: "different" }),
    ).toThrow(/Unsupported snapshot schemaVersion/);
    expectChecksumChanges("snapshotId", (snapshot) => ({ ...snapshot, snapshotId: "different" }));
    expectChecksumChanges("snapshotVersion", (snapshot) => ({ ...snapshot, snapshotVersion: "v2" }));
    expect(() =>
      checksum({ ...completeSnapshot(), tournament: "different" as "fifa-world-cup-2026" }),
    ).toThrow(/Snapshot tournament must/);

    expectChecksumChanges("derived state", (snapshot) => ({
      ...snapshot,
      state: "group_stage_in_progress",
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 ? { ...fixture, status: "scheduled", result: null } : fixture,
      ),
    }));
  });

  it("changes when team fields change", () => {
    expect(() =>
      checksum({
        ...completeSnapshot(),
        teams: completeSnapshot().teams.map((team, index) =>
          index === 0 ? { ...team, id: "changed" } : team,
        ),
      }),
    ).toThrow(/references an unknown team|must have exactly three fixtures/);

    expectChecksumChanges("team name", (snapshot) => ({
      ...snapshot,
      teams: snapshot.teams.map((team, index) => (index === 0 ? { ...team, name: `${team.name} X` } : team)),
    }));
    expectChecksumChanges("team shortName", (snapshot) => ({
      ...snapshot,
      teams: snapshot.teams.map((team, index) =>
        index === 0 ? { ...team, shortName: `${team.shortName}X` } : team,
      ),
    }));
    expectChecksumChanges("team fifaCode", (snapshot) => ({
      ...snapshot,
      teams: snapshot.teams.map((team, index) => (index === 0 ? { ...team, fifaCode: "ZZZ" } : team)),
    }));
    expect(() =>
      checksum({
        ...completeSnapshot(),
        teams: completeSnapshot().teams.map((team, index) => (index === 0 ? { ...team, group: "B" } : team)),
      }),
    ).toThrow(/Group A must contain exactly four teams/);
  });

  it("changes when fixture fields change", () => {
    expectChecksumChanges("fixture ID", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 ? { ...fixture, id: `${fixture.id}-changed` } : fixture,
      ),
    }));
    expectChecksumChanges("FIFA match number", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 ? { ...fixture, fifaMatchNumber: 72 } : index === 71 ? { ...fixture, fifaMatchNumber: 1 } : fixture,
      ),
    }));
    expect(() =>
      checksum({
        ...completeSnapshot(),
        fixtures: completeSnapshot().fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, group: "B" } : fixture,
        ),
      }),
    ).toThrow(/outside Group B/);
    expectChecksumChanges("fixture participants", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0
          ? { ...fixture, homeTeamId: fixture.awayTeamId, awayTeamId: fixture.homeTeamId }
          : fixture,
      ),
    }));
    expectChecksumChanges("kickoff time", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 ? { ...fixture, kickoffUtc: "2026-06-10T20:00:00.000Z" } : fixture,
      ),
    }));
    expectChecksumChanges("venue", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 ? { ...fixture, venueId: "venue-1" } : fixture,
      ),
    }));
    expectChecksumChanges("home goals", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 && fixture.result
          ? { ...fixture, result: { ...fixture.result, homeGoals: fixture.result.homeGoals + 1 } }
          : fixture,
      ),
    }));
    expectChecksumChanges("away goals", (snapshot) => ({
      ...snapshot,
      fixtures: snapshot.fixtures.map((fixture, index) =>
        index === 0 && fixture.result
          ? { ...fixture, result: { ...fixture.result, awayGoals: fixture.result.awayGoals + 1 } }
          : fixture,
      ),
    }));
  });

  it("changes when fair-play, ranking, or provenance fields change", () => {
    expectChecksumChanges("fair-play card count", (snapshot) => ({
      ...snapshot,
      fairPlay: snapshot.fairPlay.map((record, index) =>
        index === 0 ? { ...record, yellowCards: 1, deductionPoints: 1 } : record,
      ),
    }));
    const fairPlayIdentityBaseline = completeSnapshot();
    fairPlayIdentityBaseline.fairPlay = fairPlayIdentityBaseline.fairPlay.map((record, index) =>
      index === 0
        ? { ...record, yellowCards: 1, deductionPoints: 1 }
        : index === 1
          ? { ...record, directRedCards: 1, deductionPoints: 4 }
          : record,
    );
    const fairPlayIdentityMutation = cloneSnapshot(fairPlayIdentityBaseline);
    fairPlayIdentityMutation.fairPlay = fairPlayIdentityMutation.fairPlay.map((record, index) =>
      index === 0
        ? { ...record, teamId: fairPlayIdentityBaseline.fairPlay[1].teamId }
        : index === 1
          ? { ...record, teamId: fairPlayIdentityBaseline.fairPlay[0].teamId }
          : record,
    );
    expect(checksum(fairPlayIdentityMutation), "fair-play team identity").not.toBe(
      checksum(fairPlayIdentityBaseline),
    );
    expect(() =>
      checksum({
        ...completeSnapshot(),
        fairPlay: completeSnapshot().fairPlay.map((record, index) =>
          index === 0 ? { ...record, deductionPoints: 1 } : record,
        ),
      }),
    ).toThrow(/do not match card counts/);
    expectChecksumChanges("ranking rank", (snapshot) => ({
      ...snapshot,
      fifaRanking: snapshot.fifaRanking.map((record, index) =>
        index === 0 ? { ...record, rank: 100 } : index === 47 ? { ...record, rank: 1 } : record,
      ),
    }));
    expectChecksumChanges("ranking team identity", (snapshot) => ({
      ...snapshot,
      fifaRanking: snapshot.fifaRanking.map((record, index) =>
        index === 0
          ? { ...record, teamId: snapshot.fifaRanking[1].teamId }
          : index === 1
            ? { ...record, teamId: snapshot.fifaRanking[0].teamId }
            : record,
      ),
    }));
    expectChecksumChanges("ranking date", (snapshot) => ({
      ...snapshot,
      fifaRanking: snapshot.fifaRanking.map((record) => ({ ...record, rankingDate: "2026-06-19" })),
    }));

    for (const field of ["authority", "title", "url", "publishedDate", "accessedDate", "version", "checksum"] as const) {
      expectChecksumChanges(`source ${field}`, (snapshot) => ({
        ...snapshot,
        sources: {
          ...snapshot.sources,
          teams: {
            ...snapshot.sources.teams,
            [field]: field === "checksum" ? "a".repeat(64) : field.endsWith("Date") ? "2026-06-28" : "changed",
          },
        },
      }));
    }
  });

  it("validates declared state before checksum calculation and hashes derived state only", () => {
    expect(() =>
      checksum({ ...completeSnapshot(), state: "group_stage_in_progress" }),
    ).toThrow(/does not match derived state/);

    const validated = validateTournamentSnapshot(completeSnapshot());
    expect(validated.metadata.snapshotChecksum).toBeNull();
    expect(serializeNormalizedTournamentSnapshot(normalizeTournamentSnapshot(completeSnapshot()))).toContain(
      '"derivedState":"group_stage_complete"',
    );
  });
});
