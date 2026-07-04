import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bracket } from "@/src/components/Bracket/Bracket";
import { ChampionPanel } from "@/src/components/Bracket/ChampionPanel";
import { MatchCard } from "@/src/components/Bracket/MatchCard";
import { WorldCupSimulator } from "@/src/components/WorldCupSimulator";
import {
  createChampionViewModel,
  createMatchCardViewModel,
} from "@/src/components/viewModels/bracketViewModels";
import { initialBracket } from "@/src/data/initialBracket";
import { mockTeams } from "@/src/data/mockTeams";
import {
  createOfficialKnockoutStatusMatches,
  officialTournamentUiData,
} from "@/src/data/world-cup-2026/officialArtifacts";
import { teamRatingsV2ByTeamId } from "@/src/data/teamRatingsV2";
import {
  fallbackTeamFlagPath,
  getTeamFlagPath,
  hasTeamFlag,
} from "@/src/data/teamFlags";
import { createSeededRng } from "@/src/lib/simulator/rng";
import { simulateBracket } from "@/src/lib/simulator/simulateBracket";
import type { Match, Team, TeamsById } from "@/src/lib/simulator/types";

function createTeamsById(teams: Team[]): TeamsById {
  return Object.fromEntries(teams.map((team) => [team.id, team]));
}

const teamsById = createTeamsById(mockTeams);

function createBracketMarkup(matches: Match[]): string {
  const matchViewModels = matches.map((match) =>
    createMatchCardViewModel(match, teamRatingsV2ByTeamId, teamsById),
  );
  const finalMatch = matches.find((match) => match.round === "final");
  const champion = createChampionViewModel(finalMatch, teamsById);

  return renderToStaticMarkup(
    createElement(Bracket, {
      matches: matchViewModels,
      champion,
    }),
  );
}

function getRoundColumnMarkup(
  markup: string,
  round: Match["round"],
  side: "left" | "right",
): string {
  const match = markup.match(
    new RegExp(
      `<section[^>]*data-round-column="${round}"[^>]*data-side="${side}"[^>]*>([\\s\\S]*?)</section>`,
    ),
  );

  if (!match) {
    throw new Error(`Missing ${side} ${round} bracket column.`);
  }

  return match[1];
}

function getOfficialMatchRowMarkup(markup: string, matchId: string): string {
  const match = markup.match(
    new RegExp(
      `<tr[^>]*data-official-match-id="${matchId}"[^>]*>([\\s\\S]*?)</tr>`,
    ),
  );

  if (!match) {
    throw new Error(`Missing official Round-of-32 row for ${matchId}.`);
  }

  return match[1];
}

function getOfficialKnockoutStatusRowMarkup(markup: string, matchId: string): string {
  const match = markup.match(
    new RegExp(
      `<tr[^>]*data-official-knockout-match-id="${matchId}"[^>]*>([\\s\\S]*?)</tr>`,
    ),
  );

  if (!match) {
    throw new Error(`Missing official knockout status row for ${matchId}.`);
  }

  return match[1];
}

function createOfficialKnockoutStatusFixtureMarkup(
  matches: typeof officialTournamentUiData.knockoutStatusMatches,
): string {
  return renderToStaticMarkup(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        matches.map((match) =>
          createElement(
            "tr",
            {
              key: match.id,
              "data-official-knockout-match-id": match.id,
              "data-official-knockout-status": match.statusTone,
            },
            createElement("td", null, match.statusLabel),
            createElement("td", null, match.scoreLabel),
            createElement("td", null, match.winnerLabel),
          ),
        ),
      ),
    ),
  );
}

function getModuleSpecifiers(sourceText: string): string[] {
  return [...sourceText.matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
}

describe("knockout bracket UI", () => {
  it("renders all rounds and every one of the 31 matches exactly once", () => {
    const markup = createBracketMarkup(initialBracket);

    expect(markup.match(/data-round-column="round_of_32"/g)).toHaveLength(2);
    expect(markup.match(/data-round-column="round_of_16"/g)).toHaveLength(2);
    expect(markup.match(/data-round-column="quarterfinal"/g)).toHaveLength(2);
    expect(markup.match(/data-round-column="semifinal"/g)).toHaveLength(2);
    expect(markup.match(/data-round-column="final"/g)).toHaveLength(1);
    expect(markup.match(/data-match-id=/g)).toHaveLength(31);

    for (const match of initialBracket) {
      expect(markup.match(new RegExp(`data-match-id="${match.id}"`, "g"))).toHaveLength(
        1,
      );
    }
  });

  it("renders every current demo team name", () => {
    const markup = createBracketMarkup(initialBracket);

    for (const team of mockTeams) {
      expect(markup).toContain(team.name);
    }
  });

  it("keeps each non-final round on the correct bracket side", () => {
    const markup = createBracketMarkup(initialBracket);
    const memberships = [
      { round: "round_of_32" as const, left: [1, 8], right: [9, 16], prefix: "r32" },
      { round: "round_of_16" as const, left: [1, 4], right: [5, 8], prefix: "r16" },
      { round: "quarterfinal" as const, left: [1, 2], right: [3, 4], prefix: "qf" },
      { round: "semifinal" as const, left: [1, 1], right: [2, 2], prefix: "sf" },
    ];

    for (const membership of memberships) {
      const leftMarkup = getRoundColumnMarkup(markup, membership.round, "left");
      const rightMarkup = getRoundColumnMarkup(markup, membership.round, "right");

      for (let index = membership.left[0]; index <= membership.left[1]; index += 1) {
        const matchId = `${membership.prefix}-${index}`;
        expect(leftMarkup).toContain(`data-match-id="${matchId}"`);
        expect(rightMarkup).not.toContain(`data-match-id="${matchId}"`);
      }

      for (let index = membership.right[0]; index <= membership.right[1]; index += 1) {
        const matchId = `${membership.prefix}-${index}`;
        expect(rightMarkup).toContain(`data-match-id="${matchId}"`);
        expect(leftMarkup).not.toContain(`data-match-id="${matchId}"`);
      }
    }
  });

  it("renders the champion placeholder before simulation", () => {
    const markup = createBracketMarkup(initialBracket);

    expect(markup).toContain("Tournament Champion");
    expect(markup).toContain('data-champion-state="placeholder"');
    expect(markup).toContain("Awaiting simulation");
  });

  it("renders the champion and winner states after simulation", () => {
    const result = simulateBracket(
      initialBracket,
      teamRatingsV2ByTeamId,
      createSeededRng(901),
      {
        includeScoreline: true,
        scoreRng: createSeededRng(902),
      },
    );
    const markup = createBracketMarkup(result.matches);
    const championName = teamsById[result.championId]?.name;

    expect(championName).toBeDefined();
    expect(markup).toContain('data-champion-state="complete"');
    expect(markup).toContain(championName);
    expect(markup.match(/data-winner="true"/g)).toHaveLength(31);
    expect(markup).toContain("Winner:");
  });

  it.each([
    {
      decidedBy: "regular_time" as const,
      score: { teamAGoals: 2, teamBGoals: 1 },
      decisionLabel: "FT",
      scorelineLabel: "2-1",
    },
    {
      decidedBy: "extra_time" as const,
      score: { teamAGoals: 2, teamBGoals: 1 },
      decisionLabel: "AET",
      scorelineLabel: "2-1",
    },
    {
      decidedBy: "penalties" as const,
      score: {
        teamAGoals: 1,
        teamBGoals: 1,
        teamAPenalties: 4,
        teamBPenalties: 3,
      },
      decisionLabel: "Pens",
      scorelineLabel: "1-1 (4-3 pens)",
    },
  ])("renders $decisionLabel scoreline and winner labels", ({ decidedBy, score, decisionLabel, scorelineLabel }) => {
    const match: Match = {
      id: `display-${decidedBy}`,
      round: "final",
      teamAId: "arg",
      teamBId: "fra",
      winnerId: "arg",
      score: { ...score, decidedBy },
    };
    const viewModel = createMatchCardViewModel(
      match,
      teamRatingsV2ByTeamId,
      teamsById,
    );
    const markup = renderToStaticMarkup(createElement(MatchCard, { match: viewModel }));

    expect(viewModel.resultDetailLabel).toBe(`Winner: Argentina · ${decisionLabel}`);
    expect(markup).toContain(decisionLabel);
    expect(markup).toContain(scorelineLabel);
    expect(markup).toContain('data-winner="true"');
  });

  it("announces complete match result information exactly once", () => {
    const match: Match = {
      id: "accessible-final",
      round: "final",
      teamAId: "arg",
      teamBId: "fra",
      winnerId: "arg",
      score: {
        teamAGoals: 2,
        teamBGoals: 1,
        decidedBy: "extra_time",
      },
    };
    const viewModel = createMatchCardViewModel(
      match,
      teamRatingsV2ByTeamId,
      teamsById,
    );
    const markup = renderToStaticMarkup(createElement(MatchCard, { match: viewModel }));

    expect(viewModel.accessibleLabel).toContain("Argentina vs France");
    expect(viewModel.accessibleLabel).toContain("Winner: Argentina.");
    expect(viewModel.accessibleLabel).toContain("Score: 2-1.");
    expect(viewModel.accessibleLabel).toContain("AET.");
    expect(markup).toContain(`aria-label="${viewModel.accessibleLabel}"`);
    expect(markup.match(/Winner: Argentina\./g)).toHaveLength(1);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("sr-only");
  });

  it("uses the exact project snapshot-label wording", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    expect(markup).toContain("Snapshot label: 2026-06-18");
    expect(markup).not.toContain("Snapshot: 2026-06-18");
  });
});

describe("official tournament UI integration", () => {
  it("renders the finalized official Round of 32 from m73 through m88", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    for (let matchNumber = 73; matchNumber <= 88; matchNumber += 1) {
      expect(
        markup.match(
          new RegExp(`data-official-match-id="m${matchNumber}"`, "g"),
        ),
      ).toHaveLength(1);
    }
  });

  it("renders m79 as Mexico vs Ecuador", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));
    const rowMarkup = getOfficialMatchRowMarkup(markup, "m79");

    expect(rowMarkup).toContain("Mexico");
    expect(rowMarkup).toContain("Ecuador");
    expect(rowMarkup.indexOf("Mexico")).toBeLessThan(rowMarkup.indexOf("Ecuador"));
  });

  it("renders m87 as Colombia vs Ghana", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));
    const rowMarkup = getOfficialMatchRowMarkup(markup, "m87");

    expect(rowMarkup).toContain("Colombia");
    expect(rowMarkup).toContain("Ghana");
    expect(rowMarkup.indexOf("Colombia")).toBeLessThan(rowMarkup.indexOf("Ghana"));
  });

  it("keeps official and simulation labels visible", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    expect(markup).toContain("Official tournament bracket/data");
    expect(markup).toContain("Simulation sandbox");
    expect(markup).toContain("Simulation projections shown here are sandbox outputs");
  });

  it("labels official knockout completed, pending, and sandbox projection states distinctly", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));
    const completedRows = officialTournamentUiData.knockoutStatusMatches.filter(
      (match) => match.statusTone === "completed",
    );
    const pendingRows = officialTournamentUiData.knockoutStatusMatches.filter(
      (match) => match.statusTone === "pending",
    );
    const completedMarkupMatches =
      markup.match(/data-official-knockout-status="completed"/g) ?? [];
    const pendingMarkupMatches =
      markup.match(/data-official-knockout-status="pending"/g) ?? [];

    expect(markup).toContain("Official knockout result status");
    expect(markup).toContain("Simulation projections");
    expect(completedRows).toHaveLength(
      officialTournamentUiData.knockoutStatusSummary.completedCount,
    );
    expect(pendingRows).toHaveLength(
      officialTournamentUiData.knockoutStatusSummary.pendingCount,
    );
    expect(completedMarkupMatches).toHaveLength(
      officialTournamentUiData.knockoutStatusSummary.completedCount,
    );
    expect(pendingMarkupMatches).toHaveLength(
      officialTournamentUiData.knockoutStatusSummary.pendingCount,
    );
    expect(officialTournamentUiData.knockoutStatusMatches).toHaveLength(
      officialTournamentUiData.knockoutStatusSummary.totalCount,
    );
    expect(officialTournamentUiData.knockoutStatusSummary.totalCount).toBe(
      officialTournamentUiData.knockoutStatusSummary.completedCount +
        officialTournamentUiData.knockoutStatusSummary.pendingCount,
    );

    if (officialTournamentUiData.knockoutStatusSummary.pendingCount > 0) {
      expect(markup).toContain("Pending official");
      expect(markup).toContain("No official score");
      expect(markup).toContain('data-official-knockout-status="pending"');
    }

    if (officialTournamentUiData.knockoutStatusSummary.completedCount > 0) {
      expect(markup).toContain("Official completed");
      expect(markup).toContain('data-official-knockout-status="completed"');
    }
  });

  it("records the current official Round-of-32 results and future pending state", () => {
    const completedRows = officialTournamentUiData.knockoutStatusMatches.filter(
      (match) => match.statusTone === "completed",
    );
    const pendingRows = officialTournamentUiData.knockoutStatusMatches.filter(
      (match) => match.statusTone === "pending",
    );

    expect(officialTournamentUiData.knockoutStatusSummary).toEqual({
      completedCount: 16,
      pendingCount: 16,
      totalCount: 32,
    });
    expect(completedRows.map((match) => match.id)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 73}`),
    );
    expect(pendingRows.map((match) => match.id)).toEqual(
      Array.from({ length: 16 }, (_, index) => `m${index + 89}`),
    );
    expect(pendingRows.every((match) => match.scoreLabel === "No official score")).toBe(true);
    expect(pendingRows.every((match) => match.winnerLabel === "Not official")).toBe(true);
  });

  it("renders official completed Round-of-32 scores and winners", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));
    const canadaRow = getOfficialKnockoutStatusRowMarkup(markup, "m73");
    const mexicoRow = getOfficialKnockoutStatusRowMarkup(markup, "m79");
    const colombiaRow = getOfficialKnockoutStatusRowMarkup(markup, "m87");
    const egyptRow = getOfficialKnockoutStatusRowMarkup(markup, "m88");

    expect(canadaRow).toContain("South Africa");
    expect(canadaRow).toContain("Canada");
    expect(canadaRow).toContain("Official completed");
    expect(canadaRow).toContain("0-1");
    expect(canadaRow).toContain("Canada");

    expect(mexicoRow).toContain("Mexico");
    expect(mexicoRow).toContain("Ecuador");
    expect(mexicoRow).toContain("2-0");
    expect(mexicoRow).toContain("Mexico");

    expect(colombiaRow).toContain("Colombia");
    expect(colombiaRow).toContain("Ghana");
    expect(colombiaRow).toContain("1-0");
    expect(colombiaRow).toContain("Colombia");

    expect(egyptRow).toContain("Australia");
    expect(egyptRow).toContain("Egypt");
    expect(egyptRow).toContain("1-1 (2-4 pens)");
    expect(egyptRow).toContain("Egypt");
  });

  it("renders future official knockout matches as pending without fabricated scores", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));
    const roundOf16Rows = officialTournamentUiData.knockoutStatusMatches.filter(
      (match) => match.id >= "m89" && match.id <= "m96",
    );
    const m89Row = getOfficialKnockoutStatusRowMarkup(markup, "m89");
    const m90Row = getOfficialKnockoutStatusRowMarkup(markup, "m90");

    expect(roundOf16Rows).toHaveLength(8);
    expect(roundOf16Rows.every((match) => match.statusTone === "pending")).toBe(true);
    expect(roundOf16Rows.every((match) => match.scoreLabel === "No official score")).toBe(true);
    expect(roundOf16Rows.every((match) => match.winnerLabel === "Not official")).toBe(true);
    expect(m89Row).toContain("Paraguay");
    expect(m89Row).toContain("France");
    expect(m89Row).toContain("Pending official");
    expect(m89Row).toContain("No official score");
    expect(m89Row).toContain("Not official");
    expect(m90Row).toContain("Canada");
    expect(m90Row).toContain("Morocco");
    expect(m90Row).not.toMatch(/\d-\d/);
  });

  it("formats a controlled pending official knockout row", () => {
    const rows = createOfficialKnockoutStatusMatches({
      completedMatches: [],
      pendingMatches: [
        {
          matchId: "m90",
          round: "round_of_16",
          sourceSlots: {
            participantA: "winner of m73",
            participantB: "winner of m75",
          },
          knownParticipants: {
            participantA: {
              teamId: "rsa",
              displayName: "South Africa",
              sourceSlot: "winner of m73",
            },
          },
          unresolvedParticipantSlots: {
            participantB: "winner of m75",
          },
          status: "pending",
        },
      ],
    });
    const markup = createOfficialKnockoutStatusFixtureMarkup(rows);

    expect(rows).toEqual([
      expect.objectContaining({
        id: "m90",
        statusLabel: "Pending official",
        statusTone: "pending",
        scoreLabel: "No official score",
        winnerLabel: "Not official",
      }),
    ]);
    expect(markup).toContain("Pending official");
    expect(markup).toContain("No official score");
    expect(markup).toContain('data-official-knockout-status="pending"');
  });

  it("formats a controlled official completed knockout row", () => {
    const rows = createOfficialKnockoutStatusMatches({
      completedMatches: [
        {
          matchId: "m73",
          round: "round_of_32",
          participantA: {
            teamId: "rsa",
            displayName: "South Africa",
            sourceSlot: "2A",
          },
          participantB: {
            teamId: "can",
            displayName: "Canada",
            sourceSlot: "2B",
          },
          score: {
            participantAGoals: 1,
            participantBGoals: 0,
            decidedBy: "regular_time",
          },
          winnerId: "rsa",
          resultStatus: "official_final",
        },
      ],
      pendingMatches: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: "m73",
        statusLabel: "Official completed",
        statusTone: "completed",
        scoreLabel: "1-0",
        winnerLabel: "South Africa",
      }),
    ]);
    const markup = createOfficialKnockoutStatusFixtureMarkup(rows);

    expect(markup).toContain("Official completed");
    expect(markup).toContain("1-0");
    expect(markup).toContain("South Africa");
    expect(markup).toContain('data-official-knockout-status="completed"');
  });

  it("does not display fabricated fair-play totals for Ecuador or Ghana", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    expect(markup).toContain("Ecuador and Ghana both qualified");
    expect(markup).toContain("No fair-play values are shown for Ecuador or Ghana");
    expect(markup).not.toMatch(/Ecuador[^<]*(fair-play|fair play)[^<]*\d/i);
    expect(markup).not.toMatch(/Ghana[^<]*(fair-play|fair play)[^<]*\d/i);
    expect(markup).not.toContain("Fair-play total");
    expect(markup).not.toContain("fair-play total");
  });

  it("keeps the simulator sandbox controls and demo bracket available", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    expect(markup).toContain("Simulate One Bracket");
    expect(markup).toContain("Run 10,000 Simulations");
    expect(markup).toContain('data-match-id="r32-1"');
    expect(markup).toContain("Demo bracket");
  });

  it("exposes exact official artifact traceability values in adapter data", () => {
    const traceabilityRowsByLabel = new Map(
      officialTournamentUiData.artifactTraceabilityRows.map((row) => [
        row.label,
        row,
      ]),
    );

    expect(traceabilityRowsByLabel.get("Tournament snapshot")).toMatchObject({
      id: "official-2026-2026-06-28-r1",
      artifactVersion: "official-2026-2026-06-28-r1",
      checksum: "1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7",
    });
    expect(traceabilityRowsByLabel.get("Qualification")).toMatchObject({
      artifactVersion: "official-2026-2026-06-28-r1-qualification-r1",
      checksum: "2a4d4864b42c0b52bb49e5a872f2d2292d0d23316f62f49b37d883089e753491",
    });
    expect(traceabilityRowsByLabel.get("Round of 32")).toMatchObject({
      artifactVersion: "official-2026-2026-06-28-r1-round-of-32-r1",
      checksum: "8fa685fb4b11fe1703c2af7b3d89e53353983779baaf0e3766c65691945d97f7",
    });
    expect(traceabilityRowsByLabel.get("Rating linkage")).toMatchObject({
      artifactVersion: "official-2026-2026-06-28-r1-rating-linkage-r1",
      checksum: "3b245dd833f9f73824108793025b336877d9073d994f5cce5f9e73e4e6dd236c",
    });
    expect(traceabilityRowsByLabel.get("Simulator input")).toMatchObject({
      artifactVersion: "official-2026-2026-06-28-r1-simulator-input-r1",
      checksum: "d3a981a86c13037061994e700301db835ac2a35c5d251a47fb06cbfa4a0bf477",
    });
    expect(traceabilityRowsByLabel.get("Knockout results")).toMatchObject({
      artifactVersion: "official-2026-2026-06-28-r1-knockout-results-r1",
      checksum: "179e9f53a4502a987413fba547dbc32a4d85bee42aa1eb56a84781866a5747a1",
    });
    expect(traceabilityRowsByLabel.get("Numeric ratings")).toMatchObject({
      id: "world-cup-2026-knockout-ratings",
      artifactVersion: "official-2026-2026-06-28-r1-ratings-r1",
      checksum: "f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5",
    });
    expect(traceabilityRowsByLabel.get("Third-place group key")).toMatchObject({
      value: "BDEFIJKL",
    });
  });

  it("renders exact official artifact checksums in the status details", () => {
    const markup = renderToStaticMarkup(createElement(WorldCupSimulator));

    expect(markup).toContain("Exact artifact checksums");
    expect(markup).toContain("official-2026-2026-06-28-r1");
    expect(markup).toContain(
      "1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7",
    );
    expect(markup).toContain(
      "2a4d4864b42c0b52bb49e5a872f2d2292d0d23316f62f49b37d883089e753491",
    );
    expect(markup).toContain(
      "8fa685fb4b11fe1703c2af7b3d89e53353983779baaf0e3766c65691945d97f7",
    );
    expect(markup).toContain(
      "3b245dd833f9f73824108793025b336877d9073d994f5cce5f9e73e4e6dd236c",
    );
    expect(markup).toContain(
      "d3a981a86c13037061994e700301db835ac2a35c5d251a47fb06cbfa4a0bf477",
    );
    expect(markup).toContain(
      "f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5",
    );
    expect(markup).toContain(
      "179e9f53a4502a987413fba547dbc32a4d85bee42aa1eb56a84781866a5747a1",
    );
    expect(markup).toContain("BDEFIJKL");
  });

  it("keeps official UI integration imports deterministic and browser safe", async () => {
    const sourceFiles = [
      {
        filePath: "src/data/world-cup-2026/officialArtifacts.ts",
        allowedSpecifiers: new Set([
          "@/data/world-cup-2026/snapshots/official-2026-current/qualification.json",
          "@/data/world-cup-2026/snapshots/official-2026-current/round-of-32.json",
          "@/data/world-cup-2026/snapshots/official-2026-current/knockout-results.json",
          "@/data/generated/world-cup-2026/official-rating-linkage.json",
          "@/data/generated/world-cup-2026/official-simulator-input.json",
        ]),
      },
      {
        filePath: "src/components/OfficialTournamentOverview.tsx",
        allowedSpecifiers: new Set([
          "@/src/data/world-cup-2026/officialArtifacts",
        ]),
      },
      {
        filePath: "src/components/WorldCupSimulator.tsx",
        allowedSpecifiers: new Set([
          "react",
          "@/src/data/initialBracket",
          "@/src/data/mockTeams",
          "@/src/data/teamRatingsV2",
          "@/src/components/Bracket/Bracket",
          "@/src/components/OfficialTournamentOverview",
          "@/src/components/Odds/MatchupOddsTable",
          "@/src/components/Odds/TournamentOddsTable",
          "@/src/components/viewModels/bracketViewModels",
          "@/src/components/viewModels/tournamentOddsViewModels",
          "@/src/lib/simulator/monteCarlo",
          "@/src/lib/simulator/rng",
          "@/src/lib/simulator/simulateBracket",
          "@/src/lib/simulator/types",
        ]),
      },
    ];
    const forbiddenSpecifiers = [
      "node:fs",
      "node:fs/promises",
      "fs",
      "fs/promises",
      "node:path",
      "path",
      "node:crypto",
      "crypto",
    ];
    const forbiddenSpecifierPatterns = [
      /^@\/src\/lib\/simulator\/probability(?:$|\/)/,
      /^@\/src\/data\/generated\/teamRatingsV2\.generated$/,
      /^@\/data\/generated\/team-ratings-v2(?:$|\/)/,
      /^@\/data\/generated\/world-football-elo-development(?:$|\/)/,
      /^@\/data\/generated\/calibration(?:$|\/)/,
      /^@\/data\/raw\/historical(?:$|\/)/,
      /^@\/tests\/fixtures\/world-cup-2026\/annex-c-expected\.json$/,
      /^@\/src\/lib\/tournament-2026\/bracket(?:$|\/)/,
      /^@\/src\/lib\/tournament-2026\/constants$/,
      /^@\/scripts(?:$|\/)/,
    ];

    for (const { filePath, allowedSpecifiers } of sourceFiles) {
      const sourceText = await readFile(filePath, "utf8");
      const specifiers = getModuleSpecifiers(sourceText);

      expect(specifiers, filePath).toEqual([...allowedSpecifiers]);
      expect(
        specifiers.filter((specifier) => forbiddenSpecifiers.includes(specifier)),
        filePath,
      ).toEqual([]);
      expect(
        specifiers.filter((specifier) =>
          forbiddenSpecifierPatterns.some((pattern) => pattern.test(specifier)),
        ),
        filePath,
      ).toEqual([]);
    }
  });
});

describe("local team flags", () => {
  it("resolves a local sprite flag for all 32 demo teams", async () => {
    const sprite = await readFile("public/flags/team-flags.svg", "utf8");

    for (const team of mockTeams) {
      const flagPath = getTeamFlagPath(team.id);

      expect(hasTeamFlag(team.id)).toBe(true);
      expect(flagPath).toBe(`/flags/team-flags.svg#${team.id}`);
      expect(sprite).toContain(`id="${team.id}"`);
    }
  });

  it("uses the local fallback symbol for missing flag mappings", () => {
    expect(getTeamFlagPath("unknown-team")).toBe(fallbackTeamFlagPath);
    expect(hasTeamFlag("unknown-team")).toBe(false);
  });

  it("keeps team flags decorative beside visible team names", () => {
    const match = createMatchCardViewModel(
      initialBracket[0],
      teamRatingsV2ByTeamId,
      teamsById,
    );
    const markup = renderToStaticMarkup(createElement(MatchCard, { match }));

    expect(markup.match(/<svg/g)).toHaveLength(2);
    expect(markup.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2);
    expect(markup).not.toContain("Argentina flag");
    expect(markup).not.toContain('role="img"');
  });

  it("keeps the champion flag decorative beside the champion name", () => {
    const champion = createChampionViewModel(
      {
        id: "final",
        round: "final",
        teamAId: "arg",
        teamBId: "fra",
        winnerId: "arg",
      },
      teamsById,
    );
    const markup = renderToStaticMarkup(createElement(ChampionPanel, { champion }));

    expect(markup).toContain("Argentina");
    expect(markup).toContain('<svg class="');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("Argentina flag");
  });
});

describe("desktop bracket sizing", () => {
  it("keeps the fixed desktop bracket width below 1920 pixels", async () => {
    const css = await readFile("app/globals.css", "utf8");
    const widthMatch = css.match(/--bracket-width:\s*(\d+)px/);

    expect(widthMatch).not.toBeNull();
    expect(Number(widthMatch?.[1])).toBe(1752);
    expect(Number(widthMatch?.[1])).toBeLessThan(1920);
    expect(css).toContain("width: var(--bracket-width)");
    expect(css).toContain("min-width: var(--bracket-width)");
  });
});
