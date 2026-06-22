import { readdir, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  historicalTeamAliasEntries,
  resolveHistoricalTeamId,
  validateHistoricalTeamAliases,
} from "@/scripts/historical-pipeline/historicalTeamAliases";
import {
  loadHistoricalMatches,
  parseHistoricalMatchesCsv,
} from "@/scripts/historical-pipeline/loadHistoricalMatches";
import { normalizeHistoricalMatches } from "@/scripts/historical-pipeline/normalizeHistoricalMatches";
import type {
  HistoricalTeamAliasEntry,
  NormalizedHistoricalMatch,
  RawHistoricalMatch,
} from "@/scripts/historical-pipeline/schemas";
import { validateHistoricalMatches } from "@/scripts/historical-pipeline/validateHistoricalMatches";
import { assertHistoricalSourceReady } from "@/scripts/historical-pipeline/validateHistoricalDataset";

const FIXTURE_PATH = "tests/fixtures/historical/world-cup-matches.synthetic.csv";
const SYNTHETIC_SOURCE = "synthetic-world-cup-fixture";
const REQUIRED_HEADER =
  "tournamentYear,date,stage,homeTeam,awayTeam,homeGoals,awayGoals,extraTime,penalties";

function csvRow(values: string): string {
  return `${REQUIRED_HEADER}\n${values}`;
}

function createRawMatch(overrides: Partial<RawHistoricalMatch> = {}): RawHistoricalMatch {
  return {
    tournamentYear: 2014,
    date: "2014-06-28",
    stage: "round_of_16",
    homeTeam: "Brazil",
    awayTeam: "Chile",
    homeGoals: 2,
    awayGoals: 1,
    extraTime: false,
    penalties: false,
    sourceMatchId: "base-match",
    ...overrides,
  };
}

async function readFilesUnder(paths: string[]): Promise<{ path: string; contents: string }[]> {
  const results: { path: string; contents: string }[] = [];

  for (const path of paths) {
    const pathStat = await stat(path);

    if (pathStat.isDirectory()) {
      const childNames = await readdir(path);
      results.push(...(await readFilesUnder(childNames.map((name) => `${path}/${name}`))));
      continue;
    }

    results.push({ path, contents: await readFile(path, "utf8") });
  }

  return results;
}

describe("historical synthetic CSV loading", () => {
  it("parses the labelled synthetic fixture", async () => {
    const records = await loadHistoricalMatches(FIXTURE_PATH);

    expect(records).toHaveLength(4);
    expect(records.map((record) => record.sourceMatchId)).toEqual([
      "synthetic-penalties",
      "synthetic-draw",
      "synthetic-regulation",
      "synthetic-extra-time",
    ]);
  });

  it("supports quoted fields and doubled quote escaping", () => {
    const records = parseHistoricalMatchesCsv(
      csvRow('2014,2014-06-28,round_of_16,"Brazil","Côte d""Ivoire",2,1,false,false'),
    );

    expect(records[0].awayTeam).toBe('Côte d"Ivoire');
  });

  it("enforces required headers", () => {
    expect(() =>
      parseHistoricalMatchesCsv(
        "tournamentYear,date,homeTeam,awayTeam,homeGoals,awayGoals,extraTime,penalties\n2014,2014-06-28,Brazil,Chile,2,1,false,false",
      ),
    ).toThrow(/missing required header "stage"/);
  });

  it("rejects duplicate and unsupported headers", () => {
    expect(() =>
      parseHistoricalMatchesCsv(
        `${REQUIRED_HEADER},stage\n2014,2014-06-28,round_of_16,Brazil,Chile,2,1,false,false,round_of_16`,
      ),
    ).toThrow(/duplicate header "stage"/);

    expect(() =>
      parseHistoricalMatchesCsv(
        `${REQUIRED_HEADER},invented\n2014,2014-06-28,round_of_16,Brazil,Chile,2,1,false,false,value`,
      ),
    ).toThrow(/unsupported header "invented"/);
  });

  it("rejects blank and malformed rows", () => {
    expect(() =>
      parseHistoricalMatchesCsv(
        `${REQUIRED_HEADER}\n\n2014,2014-06-28,round_of_16,Brazil,Chile,2,1,false,false`,
      ),
    ).toThrow(/blank rows are not allowed/);

    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow('2014,2014-06-28,round_of_16,"Brazil"x,Chile,2,1,false,false'),
      ),
    ).toThrow(/unexpected character after closing quote/);

    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow('2014,2014-06-28,round_of_16,"Brazil,Chile,2,1,false,false'),
      ),
    ).toThrow(/unterminated quoted field/);
  });

  it("rejects invalid dates and unsupported tournament years", () => {
    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow("2014,2014-02-30,round_of_16,Brazil,Chile,2,1,false,false"),
      ),
    ).toThrow(/Invalid calendar date/);

    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow("1942,1942-06-28,round_of_16,Brazil,Chile,2,1,false,false"),
      ),
    ).toThrow(/Invalid tournamentYear/);
  });

  it("rejects negative goals and identical teams", () => {
    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow("2014,2014-06-28,round_of_16,Brazil,Chile,-1,1,false,false"),
      ),
    ).toThrow(/Invalid homeGoals/);

    expect(() =>
      parseHistoricalMatchesCsv(
        csvRow("2014,2014-06-28,round_of_16,Brazil, brazil ,2,1,false,false"),
      ),
    ).toThrow(/homeTeam and awayTeam are identical/);
  });

  it("rejects invalid penalty combinations", () => {
    const fullHeader = `${REQUIRED_HEADER},homePenaltyGoals,awayPenaltyGoals`;

    expect(() =>
      parseHistoricalMatchesCsv(
        `${fullHeader}\n2014,2014-06-28,round_of_16,Brazil,Chile,1,1,false,false,4,3`,
      ),
    ).toThrow(/shootout scores require penalties=true/);

    expect(() =>
      parseHistoricalMatchesCsv(
        `${fullHeader}\n2014,2014-06-28,round_of_16,Brazil,Chile,1,1,false,true,4,3`,
      ),
    ).toThrow(/penalties require extraTime=true/);

    expect(() =>
      parseHistoricalMatchesCsv(
        `${fullHeader}\n2014,2014-06-28,round_of_16,Brazil,Chile,1,1,true,true,4,4`,
      ),
    ).toThrow(/shootout scores must identify a winner/);
  });
});

describe("historical team aliases", () => {
  it("normalizes explicit aliases while preserving predecessor identities", () => {
    expect(resolveHistoricalTeamId("  korea   republic ")).toBe("kor");
    expect(resolveHistoricalTeamId("USA")).toBe("usa");
    expect(resolveHistoricalTeamId("Ivory Coast")).toBe("civ");
    expect(resolveHistoricalTeamId("West Germany")).toBe("west-germany");
    expect(resolveHistoricalTeamId("Germany")).toBe("ger");
    expect(resolveHistoricalTeamId("Soviet Union")).toBe("soviet-union");
    expect(resolveHistoricalTeamId("Russia")).toBe("rus");
  });

  it("rejects unknown and ambiguous names", () => {
    expect(() => resolveHistoricalTeamId("Atlantis")).toThrow(/Unknown historical team/);
    expect(() => resolveHistoricalTeamId("Korea")).toThrow(/Ambiguous historical team/);
  });

  it("rejects conflicting alias definitions", () => {
    const entries: HistoricalTeamAliasEntry[] = [
      { teamId: "one", aliases: ["Shared Team"] },
      { teamId: "two", aliases: [" shared   team "] },
    ];

    expect(() => validateHistoricalTeamAliases(entries)).toThrow(/Conflicting historical alias/);
  });

  it("keeps the checked-in alias table valid", () => {
    expect(() => validateHistoricalTeamAliases(historicalTeamAliasEntries)).not.toThrow();
  });
});

describe("historical match normalization and validation", () => {
  it("orders records chronologically and deterministically", () => {
    const records = [
      createRawMatch({ date: "2014-07-01", sourceMatchId: "later" }),
      createRawMatch({ date: "2014-06-28", sourceMatchId: "earlier" }),
    ];
    const forward = normalizeHistoricalMatches(records, { source: SYNTHETIC_SOURCE });
    const reversed = normalizeHistoricalMatches([...records].reverse(), {
      source: SYNTHETIC_SOURCE,
    });

    expect(forward).toEqual(reversed);
    expect(forward.map((match) => match.date)).toEqual(["2014-06-28", "2014-07-01"]);
  });

  it("assigns deterministic match IDs", () => {
    const withoutSourceId = createRawMatch({ sourceMatchId: undefined });
    const first = normalizeHistoricalMatches([withoutSourceId], {
      source: SYNTHETIC_SOURCE,
    });
    const second = normalizeHistoricalMatches([withoutSourceId], {
      source: SYNTHETIC_SOURCE,
    });

    expect(first[0].matchId).toBe(second[0].matchId);
  });

  it("rejects duplicate matches even when source IDs differ", () => {
    const first = createRawMatch({ sourceMatchId: "one" });
    const second = createRawMatch({ sourceMatchId: "two" });

    expect(() =>
      normalizeHistoricalMatches([first, second], { source: SYNTHETIC_SOURCE }),
    ).toThrow(/Duplicate historical match/);
  });

  it("resolves regulation, extra-time, and penalty winners", async () => {
    const records = await loadHistoricalMatches(FIXTURE_PATH);
    const matches = normalizeHistoricalMatches(records, { source: SYNTHETIC_SOURCE });
    const bySourceId = Object.fromEntries(
      matches.map((match) => [match.matchId.split(":").at(-1), match]),
    );

    expect(bySourceId["synthetic-regulation"].winnerTeamId).toBe("bra");
    expect(bySourceId["synthetic-extra-time"].winnerTeamId).toBe("west-germany");
    expect(bySourceId["synthetic-penalties"].winnerTeamId).toBe("ger");
    expect(bySourceId["synthetic-penalties"].teamAGoals).toBe(1);
    expect(bySourceId["synthetic-penalties"].teamAPenaltyGoals).toBe(4);
  });

  it("keeps a group-stage draw valid with a null winner", () => {
    const [match] = normalizeHistoricalMatches(
      [
        createRawMatch({
          stage: "group_stage",
          homeGoals: 1,
          awayGoals: 1,
          sourceMatchId: "group-draw",
        }),
      ],
      { source: SYNTHETIC_SOURCE },
    );

    expect(match.winnerTeamId).toBeNull();
  });

  it("rejects a knockout draw without penalties", () => {
    expect(() =>
      normalizeHistoricalMatches(
        [createRawMatch({ homeGoals: 1, awayGoals: 1, sourceMatchId: "bad-draw" })],
        { source: SYNTHETIC_SOURCE },
      ),
    ).toThrow(/cannot finish drawn without penalties/);
  });

  it("rejects unknown stages and winner inconsistencies", () => {
    expect(() =>
      normalizeHistoricalMatches([createRawMatch({ stage: "mystery round" })], {
        source: SYNTHETIC_SOURCE,
      }),
    ).toThrow(/Unknown historical match stage/);

    const inconsistent: NormalizedHistoricalMatch = {
      matchId: "synthetic:inconsistent",
      tournamentYear: 2014,
      date: "2014-06-28",
      stage: "round_of_16",
      teamAId: "bra",
      teamBId: "chi",
      teamAGoals: 2,
      teamBGoals: 1,
      wentToExtraTime: false,
      wentToPenalties: false,
      winnerTeamId: "chi",
      source: SYNTHETIC_SOURCE,
    };

    expect(() => validateHistoricalMatches([inconsistent])).toThrow(/score implies "bra"/);
  });

  it("filters knockout matches without changing their deterministic order", async () => {
    const records = await loadHistoricalMatches(FIXTURE_PATH);
    const allMatches = normalizeHistoricalMatches(records, { source: SYNTHETIC_SOURCE });
    const knockoutMatches = normalizeHistoricalMatches(records, {
      source: SYNTHETIC_SOURCE,
      scope: "knockout_only",
    });

    expect(knockoutMatches).toEqual(
      allMatches.filter((match) => match.stage !== "group_stage"),
    );
  });
});

describe("historical pipeline isolation", () => {
  it("fails clearly when the approved Kaggle source is missing", async () => {
    await expect(
      assertHistoricalSourceReady("data/raw/historical/world-cup/not-present.csv"),
    ).rejects.toThrow(/Synthetic test fixtures are not accepted/);
  });

  it("is not imported by runtime app, component, or simulator files", async () => {
    const runtimeFiles = await readFilesUnder(["app", "src/components", "src/lib/simulator"]);
    const forbiddenImports = runtimeFiles.filter(
      ({ contents }) =>
        /(?:from\s+|import\s*\()["'][^"']*(?:historical-pipeline|scripts\/calibration)/.test(
          contents,
        ),
    );

    expect(forbiddenImports).toEqual([]);
  });
});
