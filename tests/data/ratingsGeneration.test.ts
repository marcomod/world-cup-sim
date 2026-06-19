import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { mockTeams } from "@/src/data/mockTeams";
import { tournamentTeams } from "@/src/data/tournamentTeams";
import { initialBracket } from "@/src/data/initialBracket";
import { teamRatingsV2GeneratedByTeamId } from "@/src/data/generated/teamRatingsV2.generated";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import { createSeededRng } from "@/src/lib/simulator/rng";
import type { RatingsByTeamId, TeamId } from "@/src/lib/simulator/types";
import {
  buildTeamRatingsV2,
  calculateEloDerivedProxy,
} from "@/scripts/ratings-pipeline/buildTeamRatingsV2";
import { createRatingsGenerationResult } from "@/scripts/ratings-pipeline/generateRatings";
import {
  loadSourceRatings,
  parseSourceRatingsCsv,
} from "@/scripts/ratings-pipeline/loadSourceRatings";
import {
  fixtureRatingsSourceConfig,
  getRatingsSourceConfig,
  parseRatingsSourceSelection,
  worldFootballEloDevelopmentSourceConfig,
} from "@/scripts/ratings-pipeline/sourceConfig";
import { tournamentTeamAliasEntries } from "@/scripts/ratings-pipeline/teamAliases";
import { normalizeAndValidateTeamRatings } from "@/scripts/ratings-pipeline/validateTeamRatings";
import {
  createGeneratedRatingsArtifacts,
  createGeneratedRatingsMetadata,
} from "@/scripts/ratings-pipeline/writeGeneratedRatings";
import type { RawTeamRatingRecord } from "@/scripts/ratings-pipeline/schemas";

const FIXTURE_SOURCE_FILE = "data/raw/ratings/team-elo-fixture.csv";
const WORLD_FOOTBALL_ELO_SOURCE_FILE =
  "data/raw/ratings/world-football-elo-development.csv";
const AS_OF_DATE = new Date("2026-06-17T00:00:00.000Z");

async function buildFixtureRatings() {
  const rawRecords = await loadSourceRatings(FIXTURE_SOURCE_FILE);
  const normalized = normalizeAndValidateTeamRatings(rawRecords, {
    asOfDate: AS_OF_DATE,
  });
  const ratingsByTeamId = buildTeamRatingsV2(normalized.records);
  const metadata = createGeneratedRatingsMetadata({
    sourceConfig: fixtureRatingsSourceConfig,
    sourceDates: normalized.records.map((record) => record.sourceDate),
    teamCount: normalized.records.length,
    warnings: normalized.warnings,
  });

  return { rawRecords, normalized, ratingsByTeamId, metadata };
}

async function buildWorldFootballEloDevelopmentRatings() {
  const rawRecords = await loadSourceRatings(WORLD_FOOTBALL_ELO_SOURCE_FILE);
  const normalized = normalizeAndValidateTeamRatings(rawRecords, {
    teams: tournamentTeams,
    aliasEntries: tournamentTeamAliasEntries,
    asOfDate: new Date("2026-06-18T00:00:00.000Z"),
  });
  const ratingsByTeamId = buildTeamRatingsV2(normalized.records, {
    teams: tournamentTeams,
    expectedTeamCount: 48,
  });
  const metadata = createGeneratedRatingsMetadata({
    sourceConfig: worldFootballEloDevelopmentSourceConfig,
    sourceDates: normalized.records.map((record) => record.sourceDate),
    teamCount: normalized.records.length,
    warnings: normalized.warnings,
  });

  return { rawRecords, normalized, ratingsByTeamId, metadata };
}

async function readFilesUnder(paths: string[]): Promise<{ path: string; contents: string }[]> {
  const results: { path: string; contents: string }[] = [];

  for (const path of paths) {
    const pathStat = await stat(path);

    if (pathStat.isDirectory()) {
      const childNames = await readdir(path);
      const childPaths = childNames.map((childName) => `${path}/${childName}`);
      results.push(...(await readFilesUnder(childPaths)));
      continue;
    }

    results.push({
      path,
      contents: await readFile(path, "utf8"),
    });
  }

  return results;
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

describe("ratings source selection", () => {
  it("selects fixture source mode explicitly", () => {
    const sourceId = parseRatingsSourceSelection(["--source", "fixture"]);
    const sourceConfig = getRatingsSourceConfig(sourceId);

    expect(sourceId).toBe("fixture");
    expect(sourceConfig.sourceFile).toBe(FIXTURE_SOURCE_FILE);
    expect(sourceConfig.fixture).toBe(true);
  });

  it("keeps fixture as the documented default source mode", () => {
    expect(parseRatingsSourceSelection([])).toBe("fixture");
  });

  it("rejects unknown source selections without falling back to fixture", () => {
    expect(() => parseRatingsSourceSelection(["--source", "unknown"])).toThrow(
      /Unknown ratings source "unknown"/,
    );
  });

  it("selects the World Football Elo development source explicitly", () => {
    const sourceId = parseRatingsSourceSelection([
      "--source",
      "world-football-elo-development",
    ]);
    const sourceConfig = getRatingsSourceConfig(sourceId);

    expect(sourceConfig.sourceId).toBe("world-football-elo-development");
    expect(sourceConfig.sourceFile).toBe(WORLD_FOOTBALL_ELO_SOURCE_FILE);
    expect(sourceConfig.fixture).toBe(false);
  });

  it("requires fixture true for fixture mode", () => {
    expect(fixtureRatingsSourceConfig.fixture).toBe(true);
  });

  it("rejects generic real source mode as an unconfigured placeholder", () => {
    expect(() => parseRatingsSourceSelection(["--source", "real"])).toThrow(
      /Generic ratings source "real" is not configured/,
    );
    expect(() => parseRatingsSourceSelection(["--source=real"])).toThrow(
      /Use --source world-football-elo-development/,
    );
  });
});

describe("World Football Elo development source", () => {
  it("defines exactly 48 tournament teams with unique IDs", () => {
    const teamIds = tournamentTeams.map((team) => team.id);

    expect(tournamentTeams).toHaveLength(48);
    expect(new Set(teamIds).size).toBe(48);
  });

  it("has complete aliases for tournament teams", () => {
    expect(() =>
      normalizeAndValidateTeamRatings(
        tournamentTeams.map((team) => ({
          sourceName: team.name,
          sourceElo: 1800,
          sourceDate: "2026-06-18",
        })),
        {
          teams: tournamentTeams,
          aliasEntries: tournamentTeamAliasEntries,
          asOfDate: new Date("2026-06-18T00:00:00.000Z"),
        },
      ),
    ).not.toThrow();
  });

  it("requires 48 source records", async () => {
    const records = await loadSourceRatings(WORLD_FOOTBALL_ELO_SOURCE_FILE);

    expect(records).toHaveLength(48);
  });

  it("fails when a tournament team is missing", async () => {
    const records = await loadSourceRatings(WORLD_FOOTBALL_ELO_SOURCE_FILE);

    expect(() =>
      normalizeAndValidateTeamRatings(records.slice(1), {
        teams: tournamentTeams,
        aliasEntries: tournamentTeamAliasEntries,
        asOfDate: new Date("2026-06-18T00:00:00.000Z"),
      }),
    ).toThrow(/Missing normalized rating/);
  });

  it("fails when an extra source team is present", async () => {
    const records = await loadSourceRatings(WORLD_FOOTBALL_ELO_SOURCE_FILE);

    expect(() =>
      normalizeAndValidateTeamRatings(
        [
          ...records,
          {
            sourceName: "Denmark",
            sourceElo: 1869,
            sourceDate: "2026-06-18",
          },
        ],
        {
          teams: tournamentTeams,
          aliasEntries: tournamentTeamAliasEntries,
          asOfDate: new Date("2026-06-18T00:00:00.000Z"),
        },
      ),
    ).toThrow(/Unknown source team name "Denmark"/);
  });

  it("fails when a tournament team is duplicated", async () => {
    const records = await loadSourceRatings(WORLD_FOOTBALL_ELO_SOURCE_FILE);

    expect(() =>
      normalizeAndValidateTeamRatings(
        [
          ...records,
          {
            sourceName: "Korea Republic",
            sourceElo: 1786,
            sourceDate: "2026-06-18",
          },
        ],
        {
          teams: tournamentTeams,
          aliasEntries: tournamentTeamAliasEntries,
          asOfDate: new Date("2026-06-18T00:00:00.000Z"),
        },
      ),
    ).toThrow(/Duplicate normalized rating for teamId "kor"/);
  });

  it("orders generated output by tournamentTeams", async () => {
    const { ratingsByTeamId } = await buildWorldFootballEloDevelopmentRatings();

    expect(Object.keys(ratingsByTeamId)).toEqual(tournamentTeams.map((team) => team.id));
  });

  it("generates 48 unique ratings and preserves source Elo as overall", async () => {
    const { rawRecords, normalized, ratingsByTeamId } =
      await buildWorldFootballEloDevelopmentRatings();
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

    expect(Object.keys(ratingsByTeamId)).toHaveLength(48);
    expect(new Set(Object.keys(ratingsByTeamId)).size).toBe(48);

    for (const team of tournamentTeams) {
      expect(ratingsByTeamId[team.id].overall).toBe(rawEloByTeamId.get(team.id));
    }
  });

  it("marks development metadata correctly", async () => {
    const { metadata } = await buildWorldFootballEloDevelopmentRatings();

    expect(metadata.fixture).toBe(false);
    expect(metadata.developmentSnapshot).toBe(true);
    expect(metadata.refreshRequiredAfterGroupStage).toBe(true);
    expect(metadata.sourceUrl).toBe("https://eloratings.net/");
    expect(metadata.accessDate).toBe("2026-06-18");
    expect(metadata.httpLastModified).toBe("Fri, 19 Jun 2026 00:13:16 GMT");
    expect(metadata.httpLastModifiedLocal).toBe("2026-06-18T20:13:16-04:00");
    expect(metadata.snapshotDate).toBe("2026-06-18");
    expect(metadata.sourceDeclaredSnapshotDate).toBeNull();
    expect(metadata.sourceDateBasis).toContain(
      "did not declare a distinct ratings date",
    );
    expect(metadata.sourceDateBasis).toContain("project frozen snapshot label");
    expect(metadata.sourceDateRange).toEqual({
      from: "2026-06-18",
      to: "2026-06-18",
    });
  });

  it("documents raw source-date provenance without implying a source-declared date", async () => {
    const provenance = JSON.parse(
      await readFile(
        "data/raw/ratings/world-football-elo-development.provenance.json",
        "utf8",
      ),
    ) as {
      accessDate?: string;
      httpLastModified?: string;
      httpLastModifiedLocal?: string;
      snapshotDate?: string;
      sourceDeclaredSnapshotDate?: string | null;
      sourceDateBasis?: string;
    };

    expect(provenance.accessDate).toBe("2026-06-18");
    expect(provenance.httpLastModified).toBe("Fri, 19 Jun 2026 00:13:16 GMT");
    expect(provenance.httpLastModifiedLocal).toBe("2026-06-18T20:13:16-04:00");
    expect(provenance.snapshotDate).toBe("2026-06-18");
    expect(provenance.sourceDeclaredSnapshotDate).toBeNull();
    expect(provenance.sourceDateBasis).toContain(
      "not an official source-declared ratings date",
    );
  });

  it("keeps World Football Elo development output deterministic", async () => {
    const resultA = await createRatingsGenerationResult(
      worldFootballEloDevelopmentSourceConfig,
    );
    const resultB = await createRatingsGenerationResult(
      worldFootballEloDevelopmentSourceConfig,
    );

    expect(resultA.artifacts.ratingsJson).toBe(resultB.artifacts.ratingsJson);
    expect(resultA.artifacts.metadataJson).toBe(resultB.artifacts.metadataJson);
    expect(resultA.artifacts.typescript).toBe(resultB.artifacts.typescript);
  });

  it("checked-in World Football Elo development artifacts match deterministic rendering", async () => {
    const result = await createRatingsGenerationResult(
      worldFootballEloDevelopmentSourceConfig,
    );
    const [ratingsJson, metadataJson, typescript] = await Promise.all([
      readFile(
        "data/generated/world-football-elo-development/team-ratings-v2.json",
        "utf8",
      ),
      readFile(
        "data/generated/world-football-elo-development/team-ratings-v2.metadata.json",
        "utf8",
      ),
      readFile(
        "src/data/generated/worldFootballEloDevelopment.generated.ts",
        "utf8",
      ),
    ]);

    expect(ratingsJson).toBe(result.artifacts.ratingsJson);
    expect(metadataJson).toBe(result.artifacts.metadataJson);
    expect(typescript).toBe(result.artifacts.typescript);
  });

  it("does not import the development export from app or simulator files", async () => {
    const files = await readFilesUnder([
      "app",
      "src/components",
      "src/lib/simulator",
      "src/data/teamRatingsV2.ts",
    ]);

    expect(
      files.filter(({ contents }) =>
        contents.includes("worldFootballEloDevelopmentByTeamId"),
      ),
    ).toEqual([]);
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
    ).toThrow(/expected 32 teams but found 31/);
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
    expect(metadata.sourceId).toBe("fixture");
    expect(metadata.sourceFile).toBe(FIXTURE_SOURCE_FILE);
    expect(metadata.sourceName).toBe("Synthetic ratings pipeline fixture");
    expect(metadata.sourceUrl).toBe("local synthetic fixture");
    expect(metadata.accessDate).toBe("2026-06-17");
    expect(metadata.snapshotDate).toBe("2026-06-01");
    expect(metadata.license).toBe("Repository-owned synthetic fixture data");
    expect(metadata.attribution).toBe("World Cup Simulator synthetic fixture");
    expect(metadata.redistributionStatus).toBe("Allowed; synthetic fixture data only");
    expect(metadata.transformationNotes).toContain("Synthetic source Elo values");
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

  it("keeps deterministic fixture output stable through explicit fixture mode", async () => {
    const resultA = await createRatingsGenerationResult(fixtureRatingsSourceConfig);
    const resultB = await createRatingsGenerationResult(fixtureRatingsSourceConfig);

    expect(resultA.artifacts.ratingsJson).toBe(resultB.artifacts.ratingsJson);
    expect(resultA.artifacts.metadataJson).toBe(resultB.artifacts.metadataJson);
    expect(resultA.artifacts.typescript).toBe(resultB.artifacts.typescript);
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
