import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adaptKaggleWorldCupMatches,
  normalizeKaggleWorldCupMatches,
} from "@/scripts/historical-pipeline/adaptKaggleWorldCupMatches";
import { resolveHistoricalTeamId } from "@/scripts/historical-pipeline/historicalTeamAliases";
import {
  KAGGLE_WORLD_CUP_HEADERS,
  type KaggleWorldCupSourceRow,
} from "@/scripts/historical-pipeline/kaggleWorldCupSchemas";
import {
  loadKaggleWorldCupMatches,
  parseKaggleWorldCupCsv,
} from "@/scripts/historical-pipeline/loadKaggleWorldCupMatches";
import {
  createKaggleSourceMatchId,
  REPLAY_ERA_NON_DECISIVE_SOURCE_IDS,
} from "@/scripts/historical-pipeline/replayEraNonDecisiveMatches";
import { validateHistoricalMatches } from "@/scripts/historical-pipeline/validateHistoricalMatches";
import {
  EXPECTED_KAGGLE_MATCH_FILE,
  validateHistoricalDataset,
} from "@/scripts/historical-pipeline/validateHistoricalDataset";

const CONFIRMED_SOURCE_TEAM_NAMES = [
  "Algeria", "Angola", "Argentina", "Australia", "Austria", "Belgium", "Bolivia",
  "Bosnia and Herzegovina", "Brazil", "Bulgaria", "Cameroon", "Canada", "Chile",
  "China PR", "Colombia", "Costa Rica", "Croatia", "Cuba", "Czech Republic",
  "Czechoslovakia", "Côte d'Ivoire", "Denmark", "Dutch East Indies", "Ecuador",
  "Egypt", "El Salvador", "England", "FR Yugoslavia", "France", "Germany",
  "Germany DR", "Ghana", "Greece", "Haiti", "Honduras", "Hungary", "IR Iran",
  "Iceland", "Iraq", "Israel", "Italy", "Jamaica", "Japan", "Korea DPR",
  "Korea Republic", "Kuwait", "Mexico", "Morocco", "Netherlands", "New Zealand",
  "Nigeria", "Northern Ireland", "Norway", "Panama", "Paraguay", "Peru", "Poland",
  "Portugal", "Qatar", "Republic of Ireland", "Romania", "Russia", "Saudi Arabia",
  "Scotland", "Senegal", "Serbia", "Serbia and Montenegro", "Slovakia", "Slovenia",
  "South Africa", "Soviet Union", "Spain", "Sweden", "Switzerland", "Togo",
  "Trinidad and Tobago", "Tunisia", "Türkiye", "Ukraine", "United Arab Emirates",
  "United States", "Uruguay", "Wales", "West Germany", "Yugoslavia", "Zaire",
] as const;

function createSourceRow(
  overrides: Partial<KaggleWorldCupSourceRow> = {},
): KaggleWorldCupSourceRow {
  return {
    sourceRowNumber: 2,
    home_team: "Brazil",
    away_team: "Chile",
    home_score: "2",
    home_xg: "",
    home_penalty: "",
    away_score: "1",
    away_xg: "",
    away_penalty: "",
    home_manager: "Synthetic Home Manager",
    home_captain: "",
    away_manager: "Synthetic Away Manager",
    away_captain: "",
    Attendance: "1000",
    Venue: "Synthetic Venue",
    Officials: "",
    Round: "Round of 16",
    Date: "2014-06-28",
    Score: "2–1",
    Referee: "",
    Notes: "",
    Host: "Synthetic Host",
    Year: "2014",
    home_goal: "",
    away_goal: "",
    home_goal_long: "",
    away_goal_long: "",
    home_own_goal: "",
    away_own_goal: "",
    home_penalty_goal: "",
    away_penalty_goal: "",
    home_penalty_miss_long: "",
    away_penalty_miss_long: "",
    home_penalty_shootout_goal_long: "",
    away_penalty_shootout_goal_long: "",
    home_penalty_shootout_miss_long: "",
    away_penalty_shootout_miss_long: "",
    home_red_card: "",
    away_red_card: "",
    home_yellow_red_card: "",
    away_yellow_red_card: "",
    home_yellow_card_long: "",
    away_yellow_card_long: "",
    home_substitute_in_long: "",
    away_substitute_in_long: "",
    ...overrides,
  };
}

function encodeCsvField(value: string): string {
  if (!/[",\n\r]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function createCsv(
  row: KaggleWorldCupSourceRow = createSourceRow(),
  headers: readonly string[] = KAGGLE_WORLD_CUP_HEADERS,
): string {
  const sourceValues = row as unknown as Record<string, string>;

  return [
    headers.join(","),
    headers.map((header) => encodeCsvField(sourceValues[header] ?? "")).join(","),
  ].join("\n");
}

describe("strict Kaggle World Cup CSV loading", () => {
  it("requires all 44 confirmed headers in exact order", () => {
    expect(parseKaggleWorldCupCsv(createCsv())).toHaveLength(1);

    const reordered = [...KAGGLE_WORLD_CUP_HEADERS];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    expect(() => parseKaggleWorldCupCsv(createCsv(createSourceRow(), reordered))).toThrow(
      /reordered/,
    );

    expect(() =>
      parseKaggleWorldCupCsv(
        createCsv(createSourceRow(), KAGGLE_WORLD_CUP_HEADERS.slice(0, -1)),
      ),
    ).toThrow(/missing required header/);

    const duplicate = [...KAGGLE_WORLD_CUP_HEADERS];
    duplicate[43] = duplicate[0];
    expect(() => parseKaggleWorldCupCsv(createCsv(createSourceRow(), duplicate))).toThrow(
      /duplicate header/,
    );

    const unknown = [...KAGGLE_WORLD_CUP_HEADERS];
    unknown[43] = "unknown_column";
    expect(() => parseKaggleWorldCupCsv(createCsv(createSourceRow(), unknown))).toThrow(
      /unknown or extra header/,
    );

    expect(() =>
      parseKaggleWorldCupCsv(
        createCsv(createSourceRow(), [...KAGGLE_WORLD_CUP_HEADERS, "extra_column"]),
      ),
    ).toThrow(/unknown or extra header/);
  });

  it("rejects BOMs, blank rows, malformed columns, and malformed quotes", () => {
    expect(() => parseKaggleWorldCupCsv(`\uFEFF${createCsv()}`)).toThrow(/without a byte-order mark/);
    expect(() => parseKaggleWorldCupCsv(`${createCsv()}\n\n`)).toThrow(/blank rows/);

    const [header, row] = createCsv().split("\n");
    expect(() =>
      parseKaggleWorldCupCsv(`${header}\n${row.split(",").slice(0, -1).join(",")}`),
    ).toThrow(/expected 44 columns/);
    expect(() => parseKaggleWorldCupCsv(`${header}\n${row},extra`)).toThrow(
      /expected 44 columns but found 45/,
    );
    expect(() => parseKaggleWorldCupCsv(`${header}\n"unterminated`)).toThrow(
      /unterminated quoted field/,
    );
    expect(() => parseKaggleWorldCupCsv(`${header}\n${row.replace("Brazil", 'Bra"zil')}`)).toThrow(
      /quote inside unquoted field/,
    );
    expect(() =>
      parseKaggleWorldCupCsv(`${header}\n${row.replace("Synthetic Venue", '"Synthetic Venue"x')}`),
    ).toThrow(/unexpected character after closing quote/);
  });

  it("preserves quoted values and doubled quotes", () => {
    const source = createSourceRow({
      Venue: 'Synthetic "Arena", City',
      home_goal_long: "opaque source detail",
    });
    const [parsed] = parseKaggleWorldCupCsv(createCsv(source));

    expect(parsed.Venue).toBe('Synthetic "Arena", City');
    expect(parsed.home_goal_long).toBe("opaque source detail");
    expect(adaptKaggleWorldCupMatches([parsed]).records[0].sourceRow).toEqual(parsed);
  });

  it("rejects multiline quoted fields", () => {
    expect(() =>
      parseKaggleWorldCupCsv(createCsv(createSourceRow({ Venue: "Line one\nLine two" }))),
    ).toThrow(/multiline quoted fields are not supported/);
  });

  it("rejects malformed UTF-8 bytes with file context", async () => {
    const directory = await mkdtemp(join(tmpdir(), "world-cup-history-"));
    const filePath = join(directory, "invalid-history.csv");

    try {
      await writeFile(filePath, Buffer.from([0xff, 0xfe, 0xfd]));
      await expect(loadKaggleWorldCupMatches(filePath)).rejects.toThrow(
        /invalid-history\.csv.*UTF-8.*malformed byte sequence/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("Kaggle source adaptation", () => {
  it("rejects missing required values and invalid numeric fields", () => {
    expect(() => adaptKaggleWorldCupMatches([createSourceRow({ home_team: "" })])).toThrow(
      /missing required value "home_team"/,
    );
    expect(() => adaptKaggleWorldCupMatches([createSourceRow({ home_score: "-1" })])).toThrow(
      /non-negative integer/,
    );
    expect(() => adaptKaggleWorldCupMatches([createSourceRow({ home_score: "1.5" })])).toThrow(
      /non-negative integer/,
    );
    expect(() => adaptKaggleWorldCupMatches([createSourceRow({ home_xg: "invalid" })])).toThrow(
      /non-negative finite number/,
    );
  });

  it("maps every confirmed source round", () => {
    const expectedStages = {
      Final: "final",
      "Third-place match": "third_place",
      "Semi-finals": "semifinal",
      "Quarter-finals": "quarterfinal",
      "Round of 16": "round_of_16",
      "Group stage": "group_stage",
      "Second group stage": "second_group_stage",
      "First group stage": "first_group_stage",
      "Second round": "second_group_stage",
      "First round": "first_group_stage",
      "Group stage play-off": "group_stage_playoff",
      "Final stage": "final_group_stage",
    } as const;

    for (const [round, expectedStage] of Object.entries(expectedStages)) {
      const result = normalizeKaggleWorldCupMatches([
        createSourceRow({ Round: round, sourceRowNumber: 2 }),
      ]);
      expect(result.records[0].normalizedMatch.stage).toBe(expectedStage);
    }
  });

  it("tolerates Unicode score whitespace with an explicit diagnostic", () => {
    const result = adaptKaggleWorldCupMatches([
      createSourceRow({ Score: "2–1\u00a0" }),
    ]);

    expect(result.diagnostics).toHaveLength(1);
    expect(result.records[0].sourceRow.Score).toBe("2–1\u00a0");
  });

  it("rejects Score disagreement", () => {
    expect(() => adaptKaggleWorldCupMatches([createSourceRow({ Score: "1–1" })])).toThrow(
      /score columns imply "2–1"/,
    );
  });

  it("resolves regulation and extra-time winners", () => {
    const regulation = normalizeKaggleWorldCupMatches([createSourceRow()]);
    const extraTime = normalizeKaggleWorldCupMatches([
      createSourceRow({ Notes: "Required Extra Time" }),
    ]);

    expect(regulation.records[0].normalizedMatch).toMatchObject({
      outcomeStatus: "decisive",
      winnerTeamId: "bra",
      wentToExtraTime: false,
    });
    expect(extraTime.records[0].normalizedMatch).toMatchObject({
      outcomeStatus: "decisive",
      winnerTeamId: "bra",
      wentToExtraTime: true,
    });
  });

  it("resolves a shootout winner while keeping match goals tied", () => {
    const result = normalizeKaggleWorldCupMatches([
      createSourceRow({
        home_score: "1",
        away_score: "1",
        home_penalty: "4",
        away_penalty: "2",
        Score: "(4) 1–1 (2)",
        Notes: "Brazil won on penalty kicks following extra time",
      }),
    ]);

    expect(result.records[0].normalizedMatch).toMatchObject({
      outcomeStatus: "decisive",
      winnerTeamId: "bra",
      teamAGoals: 1,
      teamBGoals: 1,
      teamAPenaltyGoals: 4,
      teamBPenaltyGoals: 2,
      wentToPenalties: true,
      wentToExtraTime: true,
    });
  });

  it("preserves group draws, including source-recorded extra time", () => {
    const standard = normalizeKaggleWorldCupMatches([
      createSourceRow({ Round: "Group stage", home_score: "1", away_score: "1", Score: "1–1" }),
    ]);
    const extraTime = normalizeKaggleWorldCupMatches([
      createSourceRow({
        Year: "1954",
        Date: "1954-06-17",
        Round: "Group stage",
        home_score: "1",
        away_score: "1",
        Score: "1–1",
        Notes: "Required Extra Time",
      }),
    ]);

    expect(standard.records[0].normalizedMatch.outcomeStatus).toBe("draw");
    expect(extraTime.records[0].normalizedMatch).toMatchObject({
      outcomeStatus: "draw",
      winnerTeamId: null,
      wentToExtraTime: true,
    });
  });

  it("preserves only the four exact replay-era ties as non-decisive", () => {
    const rows = [
      createSourceRow({
        sourceRowNumber: 2,
        Year: "1934", Date: "1934-05-31", Round: "Quarter-finals",
        home_team: "Italy", away_team: "Spain",
        home_score: "1", away_score: "1", Score: "1–1", Notes: "Required Extra Time",
      }),
      createSourceRow({
        sourceRowNumber: 3,
        Year: "1938", Date: "1938-06-04", Round: "Round of 16",
        home_team: "Switzerland", away_team: "Germany",
        home_score: "1", away_score: "1", Score: "1–1", Notes: "Required Extra Time",
      }),
      createSourceRow({
        sourceRowNumber: 4,
        Year: "1938", Date: "1938-06-05", Round: "Round of 16",
        home_team: "Cuba", away_team: "Romania",
        home_score: "3", away_score: "3", Score: "3–3", Notes: "Required Extra Time",
      }),
      createSourceRow({
        sourceRowNumber: 5,
        Year: "1938", Date: "1938-06-12", Round: "Quarter-finals",
        home_team: "Brazil", away_team: "Czechoslovakia",
        home_score: "1", away_score: "1", Score: "1–1", Notes: "Required Extra Time",
      }),
    ];
    const result = normalizeKaggleWorldCupMatches(rows);

    expect(REPLAY_ERA_NON_DECISIVE_SOURCE_IDS.size).toBe(4);
    expect(result.records.map((record) => record.normalizedMatch.outcomeStatus)).toEqual([
      "non_decisive", "non_decisive", "non_decisive", "non_decisive",
    ]);
    expect(
      new Set(result.records.map((record) => record.normalizedMatch.sourceMatchId)),
    ).toEqual(REPLAY_ERA_NON_DECISIVE_SOURCE_IDS);
  });

  it("rejects different tied extra-time knockouts from 1934 and 1938", () => {
    const base = {
      home_score: "1",
      away_score: "1",
      Score: "1–1",
      Notes: "Required Extra Time",
    };

    expect(() =>
      normalizeKaggleWorldCupMatches([
        createSourceRow({
          ...base, Year: "1934", Date: "1934-06-03", Round: "Semi-finals",
          home_team: "Italy", away_team: "Germany",
        }),
      ]),
    ).toThrow(/not one of the four allowlisted/);
    expect(() =>
      normalizeKaggleWorldCupMatches([
        createSourceRow({
          ...base, Year: "1938", Date: "1938-06-13", Round: "Semi-finals",
          home_team: "Italy", away_team: "Brazil",
        }),
      ]),
    ).toThrow(/not one of the four allowlisted/);
  });

  it("rejects one-field mutations of an allowlisted replay tuple", () => {
    const base = createSourceRow({
      Year: "1934", Date: "1934-05-31", Round: "Quarter-finals",
      home_team: "Italy", away_team: "Spain",
      home_score: "1", away_score: "1", Score: "1–1", Notes: "Required Extra Time",
    });

    for (const mutation of [
      { Date: "1934-05-30" },
      { Round: "Semi-finals" },
      { away_team: "France" },
    ]) {
      expect(() =>
        normalizeKaggleWorldCupMatches([createSourceRow({ ...base, ...mutation })]),
      ).toThrow(/not one of the four allowlisted/);
    }
  });

  it("uses the same exact replay rule in adaptation and generic validation", () => {
    const result = normalizeKaggleWorldCupMatches([
      createSourceRow({
        Year: "1934", Date: "1934-05-31", Round: "Quarter-finals",
        home_team: "Italy", away_team: "Spain",
        home_score: "1", away_score: "1", Score: "1–1", Notes: "Required Extra Time",
      }),
    ]);
    const match = result.records[0].normalizedMatch;
    expect(() => validateHistoricalMatches([match])).not.toThrow();
    expect(() =>
      validateHistoricalMatches([
        {
          ...match,
          sourceMatchId: createKaggleSourceMatchId({
            year: "1934", date: "1934-05-30", round: "Quarter-finals",
            homeTeam: "Italy", awayTeam: "Spain",
          }),
        },
      ]),
    ).toThrow(/exact source key.*four allowlisted/);
  });

  it("rejects invalid shootout combinations", () => {
    expect(() =>
      adaptKaggleWorldCupMatches([
        createSourceRow({ home_penalty: "4", Notes: "Brazil won on penalty kicks following extra time" }),
      ]),
    ).toThrow(/both penalty totals or neither/);

    expect(() =>
      adaptKaggleWorldCupMatches([
        createSourceRow({
          home_penalty: "4", away_penalty: "2", Notes: "Brazil won on penalty kicks following extra time",
        }),
      ]),
    ).toThrow(/match score is not tied/);

    expect(() =>
      adaptKaggleWorldCupMatches([
        createSourceRow({
          home_score: "1", away_score: "1", home_penalty: "4", away_penalty: "4",
          Score: "(4) 1–1 (4)", Notes: "Brazil won on penalty kicks following extra time",
        }),
      ]),
    ).toThrow(/equal penalty totals/);

    expect(() =>
      adaptKaggleWorldCupMatches([
        createSourceRow({
          home_score: "1", away_score: "1", home_penalty: "4", away_penalty: "2",
          Score: "(4) 1–1 (2)", Notes: "",
        }),
      ]),
    ).toThrow(/inconsistent penalty totals and Notes/);
  });

  it("creates deterministic source IDs and rejects duplicate source tuples", () => {
    const source = createSourceRow();
    const first = adaptKaggleWorldCupMatches([source]);
    const second = adaptKaggleWorldCupMatches([source]);

    expect(first.records[0].rawMatch.sourceMatchId).toBe(
      second.records[0].rawMatch.sourceMatchId,
    );
    expect(() => adaptKaggleWorldCupMatches([source, source])).toThrow(/duplicates source tuple/);
  });

  it("normalizes chronologically without depending on source order", () => {
    const later = createSourceRow({ sourceRowNumber: 2, Date: "2014-07-01" });
    const earlier = createSourceRow({ sourceRowNumber: 3, Date: "2014-06-28" });
    const forward = normalizeKaggleWorldCupMatches([later, earlier]);
    const reversed = normalizeKaggleWorldCupMatches([earlier, later]);

    expect(forward.records.map((record) => record.normalizedMatch.date)).toEqual([
      "2014-06-28", "2014-07-01",
    ]);
    expect(forward.records.map((record) => record.normalizedMatch)).toEqual(
      reversed.records.map((record) => record.normalizedMatch),
    );
  });
});

describe("historical identity coverage", () => {
  it("resolves all 86 confirmed source team names exactly once", () => {
    const resolved = CONFIRMED_SOURCE_TEAM_NAMES.map((name) =>
      resolveHistoricalTeamId(name),
    );

    expect(CONFIRMED_SOURCE_TEAM_NAMES).toHaveLength(86);
    expect(resolved).toHaveLength(86);
  });

  it("keeps predecessor and successor identities separate", () => {
    expect(
      new Set(
        ["Germany", "West Germany", "Germany DR"].map((name) =>
          resolveHistoricalTeamId(name),
        ),
      ).size,
    ).toBe(3);
    expect(
      new Set(["Russia", "Soviet Union"].map((name) => resolveHistoricalTeamId(name)))
        .size,
    ).toBe(2);
    expect(
      new Set(
        ["Yugoslavia", "FR Yugoslavia", "Serbia and Montenegro", "Serbia"].map(
          (name) => resolveHistoricalTeamId(name),
        ),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        ["Czechoslovakia", "Czech Republic"].map((name) =>
          resolveHistoricalTeamId(name),
        ),
      ).size,
    ).toBe(2);
    expect(() => resolveHistoricalTeamId("Korea")).toThrow(/Ambiguous historical team/);
    expect(() => resolveHistoricalTeamId("Congo")).toThrow(/Ambiguous historical team/);
  });
});

describe("checked-in Kaggle provenance", () => {
  it.skipIf(!existsSync(EXPECTED_KAGGLE_MATCH_FILE))(
    "matches the real raw file and deterministic validation summary",
    async () => {
      const summary = await validateHistoricalDataset();

      expect(summary.rowCount).toBe(964);
      expect(summary.yearRange).toEqual([1930, 2022]);
      expect(summary.shootoutCount).toBe(35);
      expect(summary.extraTimeCount).toBe(73);
      expect(summary.outcomeCounts).toEqual({ decisive: 785, draw: 175, non_decisive: 4 });
      expect(summary.stageCounts).toEqual({
        Final: 21,
        "Third-place match": 20,
        "Semi-finals": 38,
        "Quarter-finals": 70,
        "Round of 16": 97,
        "Group stage": 587,
        "Second group stage": 12,
        "First group stage": 36,
        "Second round": 24,
        "First round": 48,
        "Group stage play-off": 5,
        "Final stage": 6,
      });
      expect(summary.aliasCoverage).toEqual({ resolved: 86, total: 86 });
      expect(summary.diagnostics).toHaveLength(1);
      expect(summary.diagnostics[0]).toContain(
        "WARNING row 653 [unicode_whitespace_normalized]",
      );
      expect(summary.checksum).toBe(
        "60229eccd1652be38de9e8945696393b89cf3e482ded26cce7a20ed0c4f043ab",
      );
    },
  );
});
