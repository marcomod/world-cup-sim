import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { mockTeams } from "@/src/data/mockTeams";
import { initialBracket } from "@/src/data/initialBracket";
import { teamRatingsV2GeneratedByTeamId } from "@/src/data/generated/teamRatingsV2.generated";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import { createSeededRng } from "@/src/lib/simulator/rng";
import type { RatingsByTeamId, TeamId } from "@/src/lib/simulator/types";
import {
  buildTeamRatingsV2,
  calculateEloDerivedProxy,
} from "@/scripts/ratings-pipeline/buildTeamRatingsV2";
import {
  loadSourceRatings,
  parseSourceRatingsCsv,
} from "@/scripts/ratings-pipeline/loadSourceRatings";
import { normalizeAndValidateTeamRatings } from "@/scripts/ratings-pipeline/validateTeamRatings";
import {
  createGeneratedRatingsArtifacts,
  createGeneratedRatingsMetadata,
} from "@/scripts/ratings-pipeline/writeGeneratedRatings";
import type { RawTeamRatingRecord } from "@/scripts/ratings-pipeline/schemas";

const FIXTURE_SOURCE_FILE = "data/raw/ratings/team-elo-fixture.csv";
const AS_OF_DATE = new Date("2026-06-17T00:00:00.000Z");

async function buildFixtureRatings() {
  const rawRecords = await loadSourceRatings(FIXTURE_SOURCE_FILE);
  const normalized = normalizeAndValidateTeamRatings(rawRecords, {
    asOfDate: AS_OF_DATE,
  });
  const ratingsByTeamId = buildTeamRatingsV2(normalized.records);
  const metadata = createGeneratedRatingsMetadata({
    sourceFile: FIXTURE_SOURCE_FILE,
    sourceDates: normalized.records.map((record) => record.sourceDate),
    teamCount: normalized.records.length,
    warnings: normalized.warnings,
  });

  return { rawRecords, normalized, ratingsByTeamId, metadata };
}

describe("source rating CSV loading", () => {
  it("parses valid CSV records", () => {
    const records = parseSourceRatingsCsv(
      [
        "sourceName,sourceElo,sourceDate,sourceNote",
        "Argentina,1992,2026-06-01,SYNTHETIC FIXTURE DATA - not real Elo",
        "\"United States\",1812,2026-06-01,\"synthetic, quoted note\"",
      ].join("\n"),
    );

    expect(records).toEqual([
      {
        sourceName: "Argentina",
        sourceElo: 1992,
        sourceDate: "2026-06-01",
        sourceNote: "SYNTHETIC FIXTURE DATA - not real Elo",
      },
      {
        sourceName: "United States",
        sourceElo: 1812,
        sourceDate: "2026-06-01",
        sourceNote: "synthetic, quoted note",
      },
    ]);
  });

  it("rejects missing headers", () => {
    expect(() =>
      parseSourceRatingsCsv("sourceName,sourceDate,sourceNote\nArgentina,2026-06-01,note"),
    ).toThrow(/missing required header "sourceElo"/);
  });

  it("rejects malformed rows", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\nArgentina,1992,2026-06-01,note,extra",
      ),
    ).toThrow(/Malformed CSV row 2/);
  });

  it("rejects blank rows", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\n\nArgentina,1992,2026-06-01,note",
      ),
    ).toThrow(/blank rows are not allowed/);
  });

  it("rejects quotes inside unquoted fields", () => {
    expect(() =>
      parseSourceRatingsCsv(
        'sourceName,sourceElo,sourceDate,sourceNote\nArg"entina,1992,2026-06-01,note',
      ),
    ).toThrow(/quote inside unquoted field/);
  });

  it("rejects unexpected characters after closing quotes", () => {
    expect(() =>
      parseSourceRatingsCsv(
        'sourceName,sourceElo,sourceDate,sourceNote\n"Argentina"x,1992,2026-06-01,note',
      ),
    ).toThrow(/unexpected character after closing quote/);
  });

  it("rejects unterminated quoted fields", () => {
    expect(() =>
      parseSourceRatingsCsv(
        'sourceName,sourceElo,sourceDate,sourceNote\n"Argentina,1992,2026-06-01,note',
      ),
    ).toThrow(/unterminated quoted field/);
  });

  it("rejects duplicate headers", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote,sourceElo\nArgentina,1992,2026-06-01,note,1992",
      ),
    ).toThrow(/duplicate header "sourceElo"/);
  });

  it("rejects missing values", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\nArgentina,,2026-06-01,note",
      ),
    ).toThrow(/Missing value for "sourceElo"/);
  });

  it("rejects invalid numeric Elo values", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\nArgentina,not-a-number,2026-06-01,note",
      ),
    ).toThrow(/Invalid numeric sourceElo/);
  });

  it("rejects source Elo values below 1200", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\nArgentina,1199,2026-06-01,note",
      ),
    ).toThrow(/expected 1200..2200/);
  });

  it("rejects source Elo values above 2200", () => {
    expect(() =>
      parseSourceRatingsCsv(
        "sourceName,sourceElo,sourceDate,sourceNote\nArgentina,2201,2026-06-01,note",
      ),
    ).toThrow(/expected 1200..2200/);
  });
});

describe("TeamRatingV2 generation", () => {
  it("generates all 32 teams in mockTeams order", async () => {
    const { ratingsByTeamId } = await buildFixtureRatings();

    expect(Object.keys(ratingsByTeamId)).toEqual(mockTeams.map((team) => team.id));
    expect(Object.keys(ratingsByTeamId)).toHaveLength(32);
  });

  it("is deterministic for identical input", async () => {
    const resultA = await buildFixtureRatings();
    const resultB = await buildFixtureRatings();

    expect(resultA.ratingsByTeamId).toEqual(resultB.ratingsByTeamId);
    expect(resultA.metadata).toEqual(resultB.metadata);
  });

  it("creates byte-stable generated artifacts for identical input", async () => {
    const result = await buildFixtureRatings();
    const artifactsA = createGeneratedRatingsArtifacts(
      result.ratingsByTeamId,
      result.metadata,
    );
    const artifactsB = createGeneratedRatingsArtifacts(
      result.ratingsByTeamId,
      result.metadata,
    );

    expect(artifactsA.ratingsJson).toBe(artifactsB.ratingsJson);
    expect(artifactsA.metadataJson).toBe(artifactsB.metadataJson);
    expect(artifactsA.typescript).toBe(artifactsB.typescript);
  });

  it("marks generated JSON artifacts as generated files", async () => {
    const result = await buildFixtureRatings();
    const artifacts = createGeneratedRatingsArtifacts(
      result.ratingsByTeamId,
      result.metadata,
    );
    const ratingsJson = JSON.parse(artifacts.ratingsJson) as {
      generatedFileWarning?: string;
    };
    const metadataJson = JSON.parse(artifacts.metadataJson) as {
      generatedFileWarning?: string;
    };

    expect(ratingsJson.generatedFileWarning).toBe("Do not edit manually.");
    expect(metadataJson.generatedFileWarning).toBe("Do not edit manually.");
    expect(artifacts.typescript).toContain("Do not edit manually.");
  });

  it("preserves source Elo as overall", async () => {
    const { rawRecords, normalized, ratingsByTeamId } = await buildFixtureRatings();
    const rawEloByTeamId = new Map<TeamId, number>(
      normalized.records.map((record) => {
        const rawRecord = rawRecords.find(
          (candidate) => candidate.sourceName === record.sourceName,
        );

        if (!rawRecord) {
          throw new Error(`Missing raw record for ${record.sourceName}`);
        }

        return [record.teamId, rawRecord.sourceElo];
      }),
    );

    for (const team of mockTeams) {
      expect(ratingsByTeamId[team.id].overall).toBe(rawEloByTeamId.get(team.id));
    }
  });

  it("uses bounded Elo-derived proxy fields, neutral penalties, and v2 modelVersion", async () => {
    const { ratingsByTeamId } = await buildFixtureRatings();

    for (const rating of Object.values(ratingsByTeamId)) {
      expect(rating.modelVersion).toBe("v2");
      expect(rating.penalties).toBe(80);

      for (const field of ["attack", "defense", "recentForm", "squadStrength"] as const) {
        expect(rating[field]).toBeGreaterThanOrEqual(0);
        expect(rating[field]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("handles minOverall === maxOverall safely", () => {
    expect(calculateEloDerivedProxy(1800, 1800, 1800)).toBe(84);
  });

  it("rejects duplicate mock team IDs before building ratings", async () => {
    const { normalized } = await buildFixtureRatings();
    const teamsWithDuplicateId = mockTeams.map((team, index) =>
      index === 1 ? { ...team, id: mockTeams[0].id } : team,
    );

    expect(() =>
      buildTeamRatingsV2(normalized.records, { teams: teamsWithDuplicateId }),
    ).toThrow(/duplicate mock team ID "arg"/);
  });

  it("rejects an unexpected mock team count before building ratings", async () => {
    const { normalized } = await buildFixtureRatings();

    expect(() =>
      buildTeamRatingsV2(normalized.records, { teams: mockTeams.slice(0, 31) }),
    ).toThrow(/expected 32 mock teams but found 31/);
  });

  it("generates output compatible with RatingsByTeamId", () => {
    const ratingsByTeamId: RatingsByTeamId = teamRatingsV2GeneratedByTeamId;
    const result = simulateBracket(
      initialBracket,
      ratingsByTeamId,
      createSeededRng(42),
    );

    expect(result.championId).toBeTruthy();
  });

  it("metadata clearly marks fixture data", async () => {
    const { metadata } = await buildFixtureRatings();

    expect(metadata.fixture).toBe(true);
    expect(metadata.generatedFileWarning).toBe("Do not edit manually.");
    expect(metadata.modelVersion).toBe("v2");
    expect(metadata.sourceFile).toBe(FIXTURE_SOURCE_FILE);
    expect(metadata.teamCount).toBe(32);
    expect(metadata.sourceDateRange).toEqual({
      from: "2026-06-01",
      to: "2026-06-01",
    });
    expect(metadata.generationTimestampPolicy).toContain("No wall-clock timestamp");
  });

  it("checked-in generated artifacts match deterministic rendering", async () => {
    const { ratingsByTeamId, metadata } = await buildFixtureRatings();
    const artifacts = createGeneratedRatingsArtifacts(ratingsByTeamId, metadata);
    const [ratingsJson, metadataJson, typescript] = await Promise.all([
      readFile("data/generated/team-ratings-v2.json", "utf8"),
      readFile("data/generated/team-ratings-v2.metadata.json", "utf8"),
      readFile("src/data/generated/teamRatingsV2.generated.ts", "utf8"),
    ]);

    expect(ratingsJson).toBe(artifacts.ratingsJson);
    expect(metadataJson).toBe(artifacts.metadataJson);
    expect(typescript).toBe(artifacts.typescript);
  });

  it("normalizes identical Elo input without invalid proxy values", () => {
    const records = mockTeams.map<RawTeamRatingRecord>((team) => ({
      sourceName: team.name,
      sourceElo: 1800,
      sourceDate: "2026-06-01",
      sourceNote: "synthetic equal Elo fixture",
    }));
    const normalized = normalizeAndValidateTeamRatings(records, {
      asOfDate: AS_OF_DATE,
    });
    const ratingsByTeamId = buildTeamRatingsV2(normalized.records);

    expect(Object.values(ratingsByTeamId).every((rating) => rating.attack === 84)).toBe(
      true,
    );
  });
});
