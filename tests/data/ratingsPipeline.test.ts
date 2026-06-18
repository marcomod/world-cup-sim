import { describe, expect, it } from "vitest";
import { mockTeams } from "@/src/data/mockTeams";
import { normalizeAlias, resolveTeamIdFromSourceName } from "@/scripts/ratings-pipeline/normalizeTeams";
import { teamAliasEntries } from "@/scripts/ratings-pipeline/teamAliases";
import {
  normalizeAndValidateTeamRatings,
  validateAliasCoverage,
  validateNormalizedTeamRatings,
} from "@/scripts/ratings-pipeline/validateTeamRatings";
import type {
  NormalizedTeamRatingRecord,
  RawTeamRatingRecord,
  TeamAliasEntry,
} from "@/scripts/ratings-pipeline/schemas";

const AS_OF_DATE = new Date("2026-06-17T00:00:00.000Z");

function createRawRecords(): RawTeamRatingRecord[] {
  return mockTeams.map((team, index) => ({
    sourceName: team.name,
    sourceElo: 1700 + index,
    sourceDate: "2026-06-01",
    sourceNote: "test fixture",
  }));
}

describe("ratings pipeline team aliases", () => {
  it("resolves explicit source aliases", () => {
    expect(resolveTeamIdFromSourceName("Argentina")).toBe("arg");
    expect(resolveTeamIdFromSourceName("United States of America")).toBe("usa");
    expect(resolveTeamIdFromSourceName("Korea Republic")).toBe("kor");
  });

  it("normalizes harmless whitespace and casing", () => {
    expect(normalizeAlias("  SOUTH   Korea  ")).toBe("south korea");
    expect(resolveTeamIdFromSourceName("  argentina  ")).toBe("arg");
  });

  it("rejects unknown source teams", () => {
    expect(() => resolveTeamIdFromSourceName("Atlantis")).toThrow(
      /Unknown source team name "Atlantis"/,
    );
  });

  it("rejects conflicting aliases", () => {
    const conflictingAliases: TeamAliasEntry[] = [
      { teamId: "arg", aliases: ["Shared Team"] },
      { teamId: "fra", aliases: [" shared team "] },
    ];

    expect(() => validateAliasCoverage(mockTeams, conflictingAliases)).toThrow(
      /Conflicting alias/,
    );
  });

  it("covers all 32 current teams", () => {
    const aliasTeamIds = new Set(teamAliasEntries.map((entry) => entry.teamId));

    expect(aliasTeamIds.size).toBe(mockTeams.length);

    for (const team of mockTeams) {
      expect(aliasTeamIds.has(team.id)).toBe(true);
      expect(resolveTeamIdFromSourceName(team.name)).toBe(team.id);
      expect(resolveTeamIdFromSourceName(team.abbreviation)).toBe(team.id);
    }
  });
});

describe("ratings pipeline validation", () => {
  it("normalizes and validates complete raw records in stable mockTeams order", () => {
    const rawRecords = createRawRecords().reverse();
    const result = normalizeAndValidateTeamRatings(rawRecords, {
      asOfDate: AS_OF_DATE,
    });

    expect(result.records.map((record) => record.teamId)).toEqual(
      mockTeams.map((team) => team.id),
    );
    expect(result.warnings).toEqual([]);
  });

  it("is deterministic for identical input", () => {
    const rawRecords = createRawRecords().reverse();
    const resultA = normalizeAndValidateTeamRatings(rawRecords, {
      asOfDate: AS_OF_DATE,
    });
    const resultB = normalizeAndValidateTeamRatings(rawRecords, {
      asOfDate: AS_OF_DATE,
    });

    expect(resultA).toEqual(resultB);
  });

  it("rejects missing teams", () => {
    const rawRecords = createRawRecords().filter(
      (record) => record.sourceName !== "Argentina",
    );

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/Missing normalized rating for teamId "arg"/);
  });

  it("rejects duplicate source records", () => {
    const rawRecords = [
      ...createRawRecords(),
      {
        sourceName: " argentina ",
        sourceElo: 1800,
        sourceDate: "2026-06-01",
      },
    ];

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/Duplicate source rating record/);
  });

  it("rejects duplicate normalized team IDs", () => {
    const rawRecords = createRawRecords().map((record) =>
      record.sourceName === "France" ? { ...record, sourceName: "ARG" } : record,
    );

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/Duplicate normalized rating for teamId "arg"/);
  });

  it("rejects unknown local team IDs in normalized records", () => {
    const records: NormalizedTeamRatingRecord[] = createRawRecords().map((record) => ({
      teamId: resolveTeamIdFromSourceName(record.sourceName),
      sourceName: record.sourceName,
      overall: record.sourceElo,
      sourceDate: record.sourceDate,
      sourceNote: record.sourceNote,
    }));

    records[0] = { ...records[0], teamId: "unknown-team" };

    expect(() =>
      validateNormalizedTeamRatings(records, { asOfDate: AS_OF_DATE }),
    ).toThrow(/unknown teamId "unknown-team"/);
  });

  it("rejects invalid Elo values", () => {
    const rawRecords = createRawRecords();
    rawRecords[0] = { ...rawRecords[0], sourceElo: 1199 };

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/must be between 1200 and 2200/);

    rawRecords[0] = { ...rawRecords[0], sourceElo: Number.POSITIVE_INFINITY };

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/must be finite/);
  });

  it("rejects invalid dates", () => {
    const rawRecords = createRawRecords();
    rawRecords[0] = { ...rawRecords[0], sourceDate: "2026-02-30" };

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/valid ISO date/);
  });

  it("rejects future-dated snapshots", () => {
    const rawRecords = createRawRecords();
    rawRecords[0] = { ...rawRecords[0], sourceDate: "2026-06-18" };

    expect(() =>
      normalizeAndValidateTeamRatings(rawRecords, { asOfDate: AS_OF_DATE }),
    ).toThrow(/cannot be future-dated/);
  });

  it("warns for old snapshots without failing", () => {
    const rawRecords = createRawRecords().map((record) => ({
      ...record,
      sourceDate: "2024-01-01",
    }));
    const result = normalizeAndValidateTeamRatings(rawRecords, {
      asOfDate: AS_OF_DATE,
      staleAfterDays: 365,
    });

    expect(result.records).toHaveLength(mockTeams.length);
    expect(result.warnings).toHaveLength(mockTeams.length);
    expect(result.warnings[0]?.code).toBe("STALE_SOURCE_DATE");
  });
});
