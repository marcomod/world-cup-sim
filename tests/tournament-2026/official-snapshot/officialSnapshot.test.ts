import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeTournamentSnapshotChecksum } from "@/src/data/world-cup-2026/snapshots/node";
import { validateTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";
import { compareCodePoints, GROUP_IDS } from "@/src/lib/tournament-2026/constants";
import {
  officialWorldCup2026TeamIdentities,
  resolveOfficialWorldCup2026TeamAlias,
  validateOfficialWorldCup2026TeamIdentities,
} from "@/src/data/world-cup-2026/officialTeamIdentities";
import { buildOfficialSnapshot } from "@/scripts/tournament-2026/buildOfficialSnapshot";
import { verifyOfficialSnapshot } from "@/scripts/tournament-2026/verifyOfficialSnapshot";
import { diffTournamentSnapshots } from "@/scripts/tournament-2026/diffSnapshots";
import {
  OFFICIAL_EXPECTED_TEAMS_FILE,
  RAW_FAIR_PLAY_SOURCE_GAP_FILE,
  OFFICIAL_SNAPSHOT_CHECKSUMS_FILE,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE,
  OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE,
} from "@/scripts/tournament-2026/officialSnapshotPaths";
import { verifyFairPlaySourceGap } from "@/scripts/tournament-2026/verifyFairPlaySourceGap";
import { buildTournamentState } from "@/src/lib/tournament-2026/snapshot/buildTournamentState";
import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";
import { deriveSnapshotState } from "@/src/data/world-cup-2026/snapshots";
import type { TournamentSnapshot } from "@/src/data/world-cup-2026/snapshots";

function readOfficialSnapshot(): TournamentSnapshot {
  return JSON.parse(readFileSync(OFFICIAL_SNAPSHOT_FILE, "utf8")) as TournamentSnapshot;
}

function cloneSnapshot(snapshot: TournamentSnapshot): TournamentSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TournamentSnapshot;
}

describe("official World Cup 2026 local snapshot", () => {
  it("contains the official 48-team, 12-group, 72-fixture complete source state", () => {
    const snapshot = readOfficialSnapshot();
    const validated = validateTournamentSnapshot(snapshot);

    expect(validated.snapshot.teams).toHaveLength(48);
    expect(validated.snapshot.fixtures).toHaveLength(72);
    expect(validated.snapshot.fixtures.every((fixture) => fixture.status === "completed")).toBe(true);
    expect(validated.snapshot.state).toBe("group_stage_complete");
    expect(validated.snapshot.derivedState).toBe("group_stage_complete");
    expect(validated.snapshot.fairPlay).toHaveLength(0);
    expect(validated.snapshot.fifaRanking).toHaveLength(48);

    for (const group of GROUP_IDS) {
      expect(validated.snapshot.teams.filter((team) => team.group === group)).toHaveLength(4);
      expect(validated.snapshot.fixtures.filter((fixture) => fixture.group === group)).toHaveLength(6);
    }
  });

  it("uses FIFA official source names in the snapshot team name field", () => {
    const snapshot = readOfficialSnapshot();
    const expectedTeams = JSON.parse(readFileSync(OFFICIAL_EXPECTED_TEAMS_FILE, "utf8")) as {
      teamId: string;
      officialName: string;
    }[];
    const expectedById = new Map(expectedTeams.map((team) => [team.teamId, team.officialName]));

    for (const team of snapshot.teams) {
      expect(team.name).toBe(expectedById.get(team.id));
    }

    expect(snapshot.teams.find((team) => team.id === "cze")?.name).toBe("Czechia");
    expect(snapshot.teams.find((team) => team.id === "kor")?.name).toBe("Korea Republic");
    expect(snapshot.teams.find((team) => team.id === "tur")?.name).toBe("Türkiye");
    expect(snapshot.teams.find((team) => team.id === "usa")?.name).toBe("USA");
    expect(snapshot.teams.find((team) => team.id === "civ")?.name).toBe("Côte d'Ivoire");
    expect(snapshot.teams.find((team) => team.id === "irn")?.name).toBe("IR Iran");
    expect(snapshot.teams.find((team) => team.id === "cpv")?.name).toBe("Cabo Verde");
    expect(snapshot.teams.find((team) => team.id === "cod")?.name).toBe("Congo DR");
  });

  it("keeps exact source pairings, match numbers, UTC kickoff timestamps, and recorded results", () => {
    const snapshot = readOfficialSnapshot();
    const matchNumbers = snapshot.fixtures.map((fixture) => fixture.fifaMatchNumber);
    expect(matchNumbers).toEqual(Array.from({ length: 72 }, (_, index) => index + 1));
    expect(snapshot.fixtures.every((fixture) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(fixture.kickoffUtc))).toBe(true);
    expect(snapshot.fixtures[0]).toMatchObject({
      fifaMatchNumber: 1,
      group: "A",
      homeTeamId: "mex",
      awayTeamId: "rsa",
      result: { homeGoals: 2, awayGoals: 0 },
    });
    expect(snapshot.fixtures[71]).toMatchObject({
      fifaMatchNumber: 72,
      group: "K",
      homeTeamId: "cod",
      awayTeamId: "uzb",
    });
  });

  it("has no synthetic markers or placeholders and matches the recorded semantic checksum", () => {
    const snapshotText = readFileSync(OFFICIAL_SNAPSHOT_FILE, "utf8");
    expect(snapshotText).not.toMatch(/synthetic|placeholder/i);
    const checksums = JSON.parse(readFileSync(OFFICIAL_SNAPSHOT_CHECKSUMS_FILE, "utf8")) as { snapshotChecksum: string };
    expect(computeTournamentSnapshotChecksum(readOfficialSnapshot())).toBe(checksums.snapshotChecksum);
  });

  it("builds deterministically from the checked-in normalized FIFA source extracts", () => {
    const built = buildOfficialSnapshot();
    expect(built.snapshot).toEqual(readOfficialSnapshot());
    expect(built.snapshotChecksum).toBe(computeTournamentSnapshotChecksum(readOfficialSnapshot()));
    expect(built.snapshot.state).toBe(deriveSnapshotState(built.snapshot.fixtures));
  });

  it("verifies independently against raw checksums, expected rows, and current readiness", () => {
    expect(verifyOfficialSnapshot()).toMatchObject({
      teamCount: 48,
      fixtureCount: 72,
      completedFixtureCount: 72,
      state: "group_stage_complete",
      orchestrationStatus: "knockout_ready",
    });
  });

  it("records a precise access cutoff after every completed fixture", () => {
    const manifest = JSON.parse(readFileSync(OFFICIAL_SNAPSHOT_SOURCE_MANIFEST_FILE, "utf8")) as {
      accessCutoffUtc: string;
    };
    expect(manifest.accessCutoffUtc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    const cutoffMs = Date.parse(manifest.accessCutoffUtc);
    for (const fixture of readOfficialSnapshot().fixtures) {
      expect(cutoffMs).toBeGreaterThanOrEqual(Date.parse(fixture.kickoffUtc));
    }
  });

  it("records official qualification as knockout-ready with Ecuador and Ghana both qualified", () => {
    const snapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
    const state = buildTournamentState(snapshot, {
      ratingsByTeamId: worldFootballEloDevelopmentByTeamId,
      rankingMode: "official",
    });
    const status = JSON.parse(readFileSync(OFFICIAL_SNAPSHOT_ORCHESTRATION_STATUS_FILE, "utf8")) as {
      status: string;
      criterion: string;
      teamIds: string[];
      officialRoundOf32Generated: boolean;
    };

    expect(state.status).toBe("knockout_ready");
    if (state.status !== "knockout_ready") {
      throw new Error("Expected official snapshot to be knockout-ready.");
    }
    const qualifiers = [
      ...Object.values(state.qualification.groupWinners).map((team) => team.teamId),
      ...Object.values(state.qualification.groupRunnersUp).map((team) => team.teamId),
      ...state.qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId),
    ];
    const roundOf32Participants = state.roundOf32.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
    const ecuador = state.qualification.qualifiedThirdPlacedTeams.find((team) => team.teamId === "ecu");
    const ghana = state.qualification.qualifiedThirdPlacedTeams.find((team) => team.teamId === "gha");

    expect(state.qualification.qualifiedThirdPlacedTeams.map((team) => team.group).sort(compareCodePoints).join("")).toBe(
      "BDEFIJKL",
    );
    expect(qualifiers).toHaveLength(32);
    expect(new Set(qualifiers).size).toBe(32);
    expect(state.roundOf32).toHaveLength(16);
    expect(roundOf32Participants).toHaveLength(32);
    expect(new Set(roundOf32Participants).size).toBe(32);
    expect(ecuador).toMatchObject({ teamId: "ecu", thirdPlaceRank: 3, qualified: true });
    expect(ghana).toMatchObject({ teamId: "gha", thirdPlaceRank: 3, qualified: true });
    expect(ecuador?.appliedTieBreakers).not.toContain("deterministic_fallback");
    expect(ghana?.appliedTieBreakers).not.toContain("deterministic_fallback");
    expect(state.roundOf32.find((match) => match.matchId === "m79")).toMatchObject({
      homeTeamId: "mex",
      awayTeamId: "ecu",
    });
    expect(state.roundOf32.find((match) => match.matchId === "m87")).toMatchObject({
      homeTeamId: "col",
      awayTeamId: "gha",
    });
    expect(snapshot.snapshot.fairPlay).toHaveLength(0);
    expect(status).toMatchObject({
      status: "knockout_ready",
      officialRoundOf32Generated: true,
    });
  });

  it("documents the official fair-play source gap without claiming generated artifacts exist", () => {
    const gap = JSON.parse(readFileSync(RAW_FAIR_PLAY_SOURCE_GAP_FILE, "utf8")) as {
      reportId: string;
      tournamentSnapshotVersion: string;
      accessTimestampUtc: string;
      sourcesSearched: {
        id: string;
        authority: string;
        role: string;
        responseSha256: string | null;
        usableForFairPlay: boolean;
        usableForQualificationResolution: boolean;
      }[];
      missingFields: string[];
      affectedTie: {
        criterionReached: string;
        teamIds: string[];
        ecuFairPlayTotal: number | null;
        ghaFairPlayTotal: number | null;
        resolution: string;
      };
      conclusion: {
        status: string;
        retainOrchestrationStatus: string;
        qualificationDecisionResolved: boolean;
        roundOf32Resolvable: boolean;
        simulatorInputResolvable: boolean;
        qualificationArtifactGenerated: boolean;
        roundOf32ArtifactGenerated: boolean;
        simulatorInputArtifactGenerated: boolean;
        strictThirdPlaceOrderingResolved: boolean;
        unresolvedOrderingAffectsTournamentDecision: boolean;
        qualifyingThirdPlaceGroupKey: string;
        ratingValuesChanged: boolean;
        productionDivisor: number;
      };
    };

    expect(gap.reportId).toBe("official-2026-fair-play-source-gap");
    expect(gap.tournamentSnapshotVersion).toBe("official-2026-2026-06-28-r1");
    expect(gap.accessTimestampUtc).toBe("2026-06-28T17:05:00.000Z");
    expect(gap.sourcesSearched).toHaveLength(7);
    expect(gap.sourcesSearched.map((source) => source.id)).toEqual([
      "fifa-first-stage-calendar",
      "fifa-full-calendar",
      "fifa-approved-rankings",
      "fifa-ranking-schedule",
      "fifa-match-detail",
      "fifa-live-events",
      "fifa-standings",
    ]);
    expect(gap.sourcesSearched.every((source) => source.authority === "FIFA")).toBe(true);
    expect(gap.sourcesSearched.every((source) => source.usableForFairPlay === false)).toBe(true);
    expect(gap.sourcesSearched.every((source) => source.usableForQualificationResolution === false)).toBe(true);
    expect(gap.sourcesSearched.filter((source) => source.responseSha256 !== null)).toHaveLength(4);
    expect(gap.sourcesSearched.map((source) => source.role)).toEqual(
      expect.arrayContaining([
        "teams_groups_fixtures_results",
        "official_round_of_32_listing_cross_check",
        "fifa_ranking_tie_break_input",
        "ranking_release_metadata",
      ]),
    );
    expect(gap.missingFields).toContain("official fair-play comparison for Ecuador and Ghana");
    expect(gap.affectedTie).toMatchObject({
      criterionReached: "fair_play",
      teamIds: ["ecu", "gha"],
      ecuFairPlayTotal: null,
      ghaFairPlayTotal: null,
      resolution: "unresolved",
    });
    expect(gap.conclusion).toMatchObject({
      status: "official_fair_play_source_unavailable",
      retainOrchestrationStatus: "knockout_ready",
      qualificationDecisionResolved: true,
      roundOf32Resolvable: true,
      simulatorInputResolvable: true,
      qualificationArtifactGenerated: false,
      roundOf32ArtifactGenerated: false,
      simulatorInputArtifactGenerated: false,
      strictThirdPlaceOrderingResolved: false,
      unresolvedOrderingAffectsTournamentDecision: false,
      qualifyingThirdPlaceGroupKey: "BDEFIJKL",
      ratingValuesChanged: false,
      productionDivisor: 400,
    });
    expect(verifyFairPlaySourceGap()).toMatchObject({
      sourceCount: gap.sourcesSearched.length,
      orchestrationStatus: "knockout_ready",
    });
  });

  it("provides exact identity mapping and rejects invalid aliases and duplicate identities", () => {
    expect(officialWorldCup2026TeamIdentities).toHaveLength(48);
    expect(new Set(officialWorldCup2026TeamIdentities.map((team) => team.id)).size).toBe(48);
    expect(new Set(officialWorldCup2026TeamIdentities.map((team) => team.fifaCode)).size).toBe(48);
    expect(resolveOfficialWorldCup2026TeamAlias("  Korea   Republic  ").id).toBe("kor");
    expect(resolveOfficialWorldCup2026TeamAlias("Côte d'Ivoire").id).toBe("civ");
    expect(resolveOfficialWorldCup2026TeamAlias("Ivory Coast").id).toBe("civ");
    expect(resolveOfficialWorldCup2026TeamAlias("Congo DR").id).toBe("cod");
    expect(resolveOfficialWorldCup2026TeamAlias("Türkiye").id).toBe("tur");
    expect(() => resolveOfficialWorldCup2026TeamAlias("Cote d'Ivoire")).toThrow(/Unknown/);
    expect(() => resolveOfficialWorldCup2026TeamAlias("Korea")).toThrow(/Unknown/);
    expect(() => resolveOfficialWorldCup2026TeamAlias("Unknown Team")).toThrow(/Unknown World Cup 2026 source team/);

    expect(() =>
      validateOfficialWorldCup2026TeamIdentities([
        officialWorldCup2026TeamIdentities[0],
        { ...officialWorldCup2026TeamIdentities[1], id: officialWorldCup2026TeamIdentities[0].id },
        ...officialWorldCup2026TeamIdentities.slice(2),
      ]),
    ).toThrow(/Duplicate official team ID/);
    expect(() =>
      validateOfficialWorldCup2026TeamIdentities([
        officialWorldCup2026TeamIdentities[0],
        { ...officialWorldCup2026TeamIdentities[1], fifaCode: officialWorldCup2026TeamIdentities[0].fifaCode },
        ...officialWorldCup2026TeamIdentities.slice(2),
      ]),
    ).toThrow(/Duplicate official FIFA code/);
    expect(() =>
      validateOfficialWorldCup2026TeamIdentities([
        officialWorldCup2026TeamIdentities[0],
        { ...officialWorldCup2026TeamIdentities[1], aliases: [...officialWorldCup2026TeamIdentities[1].aliases, officialWorldCup2026TeamIdentities[0].aliases[0]] },
        ...officialWorldCup2026TeamIdentities.slice(2),
      ]),
    ).toThrow(/Conflicting official team alias/);
  });

  it("classifies snapshot diffs deterministically", () => {
    const base = readOfficialSnapshot();
    expect(diffTournamentSnapshots(base, cloneSnapshot(base)).categories).toEqual([]);
    expect(diffTournamentSnapshots(base, cloneSnapshot(base)).details).toEqual([]);

    const scoreChanged = cloneSnapshot(base);
    scoreChanged.fixtures = scoreChanged.fixtures.map((fixture, index) =>
      index === 0 && fixture.result
        ? { ...fixture, result: { ...fixture.result, homeGoals: fixture.result.homeGoals + 1 } }
        : fixture,
    );
    expect(diffTournamentSnapshots(base, scoreChanged).categories).toContain("scores");
    expect(diffTournamentSnapshots(base, scoreChanged).details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "scores", field: "result", id: "fifa-2026-group-01" }),
      ]),
    );

    const rankingChanged = cloneSnapshot(base);
    rankingChanged.fifaRanking = rankingChanged.fifaRanking.map((record, index) =>
      index === 0 ? { ...record, rank: 999 } : record,
    );
    expect(diffTournamentSnapshots(base, rankingChanged).categories).toContain("ranking");

    const metadataChanged = cloneSnapshot(base);
    metadataChanged.sources = {
      ...metadataChanged.sources,
      fixtures: { ...metadataChanged.sources.fixtures, version: "changed" },
    };
    expect(diffTournamentSnapshots(base, metadataChanged).categories).toContain("source_metadata");
  });
});
