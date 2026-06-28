import { describe, expect, it } from "vitest";
import { validateTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { cloneSnapshot, completeSnapshot, readSnapshotFixture } from "./helpers";

describe("tournament snapshot validation", () => {
  it("validates structure-only, in-progress, and complete snapshot fixtures", () => {
    for (const fileName of [
      "synthetic-structure-only.snapshot.json",
      "synthetic-in-progress.snapshot.json",
      "synthetic-complete.snapshot.json",
    ]) {
      expect(() => validateTournamentSnapshot(readSnapshotFixture(fileName))).not.toThrow();
    }
  });

  it("rejects duplicate teams, duplicate FIFA codes, and wrong group sizes", () => {
    const duplicateTeam = completeSnapshot();
    duplicateTeam.teams = [
      { ...duplicateTeam.teams[0] },
      { ...duplicateTeam.teams[0] },
      ...duplicateTeam.teams.slice(2),
    ];
    expect(() => validateTournamentSnapshot(duplicateTeam)).toThrow(/Duplicate snapshot team ID/);

    const duplicateCode = completeSnapshot();
    duplicateCode.teams = duplicateCode.teams.map((team, index) =>
      index === 1 ? { ...team, fifaCode: duplicateCode.teams[0].fifaCode } : team,
    );
    expect(() => validateTournamentSnapshot(duplicateCode)).toThrow(/Duplicate snapshot FIFA code/);

    const wrongGroupSize = completeSnapshot();
    wrongGroupSize.teams = wrongGroupSize.teams.map((team, index) =>
      index === 0 ? { ...team, group: "B" } : team,
    );
    expect(() => validateTournamentSnapshot(wrongGroupSize)).toThrow(/Group A must contain exactly four teams/);
  });

  it("rejects invalid fixture structure and status/result combinations", () => {
    const duplicateFixture = completeSnapshot();
    duplicateFixture.fixtures = [
      { ...duplicateFixture.fixtures[0] },
      { ...duplicateFixture.fixtures[0] },
      ...duplicateFixture.fixtures.slice(2),
    ];
    expect(() => validateTournamentSnapshot(duplicateFixture)).toThrow(/Duplicate fixture ID/);

    const crossGroup = completeSnapshot();
    crossGroup.fixtures = crossGroup.fixtures.map((fixture, index) =>
      index === 0 ? { ...fixture, awayTeamId: "can" } : fixture,
    );
    expect(() => validateTournamentSnapshot(crossGroup)).toThrow(/outside Group A/);

    const scheduledWithResult = readSnapshotFixture("synthetic-structure-only.snapshot.json");
    scheduledWithResult.fixtures = scheduledWithResult.fixtures.map((fixture, index) =>
      index === 0 ? { ...fixture, result: { homeGoals: 1, awayGoals: 0 } } : fixture,
    );
    expect(() => validateTournamentSnapshot(scheduledWithResult)).toThrow(/Scheduled fixture/);

    const invalidGoal = completeSnapshot();
    invalidGoal.fixtures = invalidGoal.fixtures.map((fixture, index) =>
      index === 0 && fixture.result
        ? { ...fixture, result: { ...fixture.result, homeGoals: -1 } }
        : fixture,
    );
    expect(() => validateTournamentSnapshot(invalidGoal)).toThrow(/homeGoals/);
  });

  it("rejects state, ranking, fair-play, source, and top-level schema errors", () => {
    const wrongState = completeSnapshot();
    wrongState.state = "group_stage_in_progress";
    expect(() => validateTournamentSnapshot(wrongState)).toThrow(/does not match derived state/);

    const duplicateRank = completeSnapshot();
    duplicateRank.fifaRanking = duplicateRank.fifaRanking.map((record, index) =>
      index === 1 ? { ...record, rank: duplicateRank.fifaRanking[0].rank } : record,
    );
    expect(() => validateTournamentSnapshot(duplicateRank)).toThrow(/Duplicate FIFA ranking/);

    const inconsistentRankingDate = completeSnapshot();
    inconsistentRankingDate.fifaRanking = inconsistentRankingDate.fifaRanking.map((record, index) =>
      index === 1 ? { ...record, rankingDate: "2026-06-19" } : record,
    );
    expect(() => validateTournamentSnapshot(inconsistentRankingDate)).toThrow(/one ranking date/);

    const badFairPlay = completeSnapshot();
    badFairPlay.fairPlay = badFairPlay.fairPlay.map((record, index) =>
      index === 0 ? { ...record, yellowCards: 1, deductionPoints: 0 } : record,
    );
    expect(() => validateTournamentSnapshot(badFairPlay)).toThrow(/do not match card counts/);

    const badSource = completeSnapshot();
    badSource.sources = {
      ...badSource.sources,
      teams: { ...badSource.sources.teams, url: "file:///Users/example/local.json" },
    };
    expect(() => validateTournamentSnapshot(badSource)).toThrow(/local machine path/);

    const unknownField = cloneSnapshot(completeSnapshot()) as unknown as Record<string, unknown>;
    unknownField.generatedAt = "2026-06-27T00:00:00.000Z";
    expect(() => validateTournamentSnapshot(unknownField)).toThrow(/unknown top-level field/);
  });

  it("rejects every invalid declared-state and status/result combination", () => {
    const structureOnly = readSnapshotFixture("synthetic-structure-only.snapshot.json");
    expect(() =>
      validateTournamentSnapshot({
        ...structureOnly,
        fixtures: structureOnly.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, status: "completed", result: { homeGoals: 1, awayGoals: 0 } } : fixture,
        ),
      }),
    ).toThrow(/does not match derived state "group_stage_in_progress"/);
    expect(() => validateTournamentSnapshot({ ...structureOnly, state: "group_stage_in_progress" })).toThrow(
      /does not match derived state "structure_only"/,
    );
    expect(() => validateTournamentSnapshot({ ...structureOnly, state: "group_stage_complete" })).toThrow(
      /does not match derived state "structure_only"/,
    );

    const complete = completeSnapshot();
    expect(() => validateTournamentSnapshot({ ...complete, state: "structure_only" })).toThrow(
      /does not match derived state "group_stage_complete"/,
    );
    expect(() => validateTournamentSnapshot({ ...complete, state: "group_stage_in_progress" })).toThrow(
      /does not match derived state "group_stage_complete"/,
    );
    expect(() =>
      validateTournamentSnapshot({
        ...complete,
        fixtures: complete.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, result: null } : fixture,
        ),
      }),
    ).toThrow(/Completed fixture "group-a-1" must include a result/);
    expect(() =>
      validateTournamentSnapshot({
        ...complete,
        state: "group_stage_complete",
        fixtures: complete.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, status: "scheduled", result: null } : fixture,
        ),
      }),
    ).toThrow(/does not match derived state "group_stage_in_progress"/);
  });

  it("rejects additional team validation edge cases", () => {
    const snapshot = completeSnapshot();
    expect(() => validateTournamentSnapshot({ ...snapshot, teams: snapshot.teams.slice(1) })).toThrow(
      /exactly 48 teams/,
    );
    expect(() =>
      validateTournamentSnapshot({ ...snapshot, teams: [...snapshot.teams, { ...snapshot.teams[0], id: "extra" }] }),
    ).toThrow(/exactly 48 teams/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        teams: snapshot.teams.map((team, index) => (index === 0 ? { ...team, group: "Z" } : team)),
      }),
    ).toThrow(/must be one of A/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        teams: snapshot.teams.map((team, index) => (index === 0 ? { ...team, name: "" } : team)),
      }),
    ).toThrow(/name must be a non-empty string/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        teams: snapshot.teams.map((team, index) => (index === 0 ? { ...team, shortName: " " } : team)),
      }),
    ).toThrow(/shortName must be a non-empty string/);
  });

  it("rejects additional fixture validation edge cases", () => {
    const snapshot = completeSnapshot();
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, homeTeamId: "unknown" } : fixture,
        ),
      }),
    ).toThrow(/references an unknown team/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, awayTeamId: "unknown" } : fixture,
        ),
      }),
    ).toThrow(/references an unknown team/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, homeTeamId: fixture.awayTeamId } : fixture,
        ),
      }),
    ).toThrow(/same team twice/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, kickoffUtc: "2026-06-10T18:00:00-04:00" } : fixture,
        ),
      }),
    ).toThrow(/valid UTC timestamp/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, kickoffUtc: "not-a-date" } : fixture,
        ),
      }),
    ).toThrow(/valid UTC timestamp/);
    for (const invalidGoal of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        validateTournamentSnapshot({
          ...snapshot,
          fixtures: snapshot.fixtures.map((fixture, index) =>
            index === 0 && fixture.result
              ? { ...fixture, result: { ...fixture.result, homeGoals: invalidGoal } }
              : fixture,
          ),
        }),
      ).toThrow(/homeGoals/);
    }
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, fifaMatchNumber: 0 } : fixture,
        ),
      }),
    ).toThrow(/invalid FIFA match number/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 0 ? { ...fixture, fifaMatchNumber: 73 } : fixture,
        ),
      }),
    ).toThrow(/invalid FIFA match number/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 1 ? { ...fixture, fifaMatchNumber: snapshot.fixtures[0].fifaMatchNumber } : fixture,
        ),
      }),
    ).toThrow(/Duplicate FIFA match number/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fixtures: snapshot.fixtures.map((fixture, index) =>
          index === 1
            ? { ...fixture, homeTeamId: snapshot.fixtures[0].awayTeamId, awayTeamId: snapshot.fixtures[0].homeTeamId }
            : fixture,
        ),
      }),
    ).toThrow(/Duplicate Group A fixture/);
  });

  it("rejects additional fair-play and FIFA-ranking edge cases", () => {
    const snapshot = completeSnapshot();
    for (const invalidValue of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        validateTournamentSnapshot({
          ...snapshot,
          fairPlay: snapshot.fairPlay.map((record, index) =>
            index === 0 ? { ...record, yellowCards: invalidValue } : record,
          ),
        }),
      ).toThrow(/yellowCards/);
    }
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fairPlay: snapshot.fairPlay.map((record, index) =>
          index === 1 ? { ...record, teamId: snapshot.fairPlay[0].teamId } : record,
        ),
      }),
    ).toThrow(/Duplicate fair-play record/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fairPlay: snapshot.fairPlay.map((record, index) =>
          index === 0 ? { ...record, teamId: "unknown" } : record,
        ),
      }),
    ).toThrow(/unknown team/);

    for (const invalidRank of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        validateTournamentSnapshot({
          ...snapshot,
          fifaRanking: snapshot.fifaRanking.map((record, index) =>
            index === 0 ? { ...record, rank: invalidRank } : record,
          ),
        }),
      ).toThrow(/positive integer/);
    }
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fifaRanking: snapshot.fifaRanking.map((record, index) =>
          index === 1 ? { ...record, teamId: snapshot.fifaRanking[0].teamId } : record,
        ),
      }),
    ).toThrow(/Duplicate FIFA ranking record/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fifaRanking: snapshot.fifaRanking.map((record, index) =>
          index === 0 ? { ...record, teamId: "unknown" } : record,
        ),
      }),
    ).toThrow(/unknown team/);
    expect(() =>
      validateTournamentSnapshot({
        ...snapshot,
        fifaRanking: snapshot.fifaRanking.map((record, index) =>
          index === 0 ? { ...record, rankingDate: "not-a-date" } : record,
        ),
      }),
    ).toThrow(/valid ISO date/);
  });

  it("does not mutate input snapshots during validation", () => {
    const snapshot = completeSnapshot();
    const before = JSON.stringify(snapshot);
    validateTournamentSnapshot(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
