import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES,
  verifyFairPlaySourceGapArtifact,
} from "@/scripts/tournament-2026/verifyFairPlaySourceGap";
import {
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
  OFFICIAL_SNAPSHOT_FILE,
  RAW_FAIR_PLAY_SOURCE_GAP_FILE,
} from "@/scripts/tournament-2026/officialSnapshotPaths";
import { buildTournamentState } from "@/src/lib/tournament-2026/snapshot/buildTournamentState";
import { worldFootballEloDevelopmentByTeamId } from "@/src/data/generated/worldFootballEloDevelopment.generated";
import { loadTournamentSnapshot } from "@/src/data/world-cup-2026/snapshots/node";

type JsonObject = Record<string, unknown>;

const validContext = {
  artifactExists: {
    qualification: false,
    roundOf32: false,
    simulatorInput: false,
    finalizedBracket: false,
    knockoutReady: false,
  },
};

function readArtifact(): JsonObject {
  return JSON.parse(readFileSync(RAW_FAIR_PLAY_SOURCE_GAP_FILE, "utf8")) as JsonObject;
}

function cloneArtifact(): JsonObject {
  return JSON.parse(JSON.stringify(readArtifact())) as JsonObject;
}

function sources(artifact: JsonObject): JsonObject[] {
  return artifact.sourcesSearched as JsonObject[];
}

function affectedTie(artifact: JsonObject): JsonObject {
  return artifact.affectedTie as JsonObject;
}

function conclusion(artifact: JsonObject): JsonObject {
  return artifact.conclusion as JsonObject;
}

function expectInvalid(artifact: JsonObject, message: RegExp): void {
  expect(() => verifyFairPlaySourceGapArtifact(artifact, validContext)).toThrow(message);
}

describe("official fair-play source-gap verifier", () => {
  it("accepts the exact seven reviewed FIFA candidates in deterministic order", () => {
    const artifact = readArtifact();

    expect(verifyFairPlaySourceGapArtifact(artifact, validContext)).toEqual({
      sourceCount: 7,
      orchestrationStatus: "knockout_ready",
      affectedTeamIds: ["ecu", "gha"],
    });
    expect(sources(artifact).map((source) => source.id)).toEqual(
      EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES.map((source) => source.id),
    );
  });

  it("rejects missing, duplicate, unexpected, and reordered source candidates", () => {
    const missing = cloneArtifact();
    missing.sourcesSearched = sources(missing).slice(0, -1);
    expectInvalid(missing, /exactly 7 source candidates/);

    const eighthCandidate = cloneArtifact();
    eighthCandidate.sourcesSearched = [
      ...sources(eighthCandidate),
      {
        ...sources(eighthCandidate)[6],
        id: "fifa-extra-candidate",
      },
    ];
    expectInvalid(eighthCandidate, /exactly 7 source candidates/);

    const duplicate = cloneArtifact();
    sources(duplicate)[1].id = "fifa-first-stage-calendar";
    expectInvalid(duplicate, /Duplicate fair-play source candidate ID fifa-first-stage-calendar/);

    const unexpected = cloneArtifact();
    sources(unexpected)[0].id = "fifa-unexpected";
    expectInvalid(unexpected, /unexpected source candidate ID fifa-unexpected/);

    const reordered = cloneArtifact();
    reordered.sourcesSearched = [sources(reordered)[1], sources(reordered)[0], ...sources(reordered).slice(2)];
    expectInvalid(reordered, /candidate 0 must be fifa-first-stage-calendar/);
  });

  it("rejects wrong source identity fields", () => {
    const wrongRole = cloneArtifact();
    sources(wrongRole)[0].role = "wrong_role";
    expectInvalid(wrongRole, /fifa-first-stage-calendar has wrong role/);

    const wrongUrl = cloneArtifact();
    sources(wrongUrl)[0].url = "https://api.fifa.com/wrong";
    expectInvalid(wrongUrl, /fifa-first-stage-calendar has wrong URL/);

    const wrongAuthority = cloneArtifact();
    sources(wrongAuthority)[0].authority = "Unofficial";
    expectInvalid(wrongAuthority, /fifa-first-stage-calendar has wrong authority/);
  });

  it("rejects malformed source outcomes and false evidence claims", () => {
    const emptyReason = cloneArtifact();
    sources(emptyReason)[0].insufficiencyReason = "";
    expectInvalid(emptyReason, /insufficiencyReason must be a non-empty string/);

    const badAccess = cloneArtifact();
    sources(badAccess)[0].accessResult = "unknown";
    expectInvalid(badAccess, /accessResult has unsupported value unknown/);

    const badEvidence = cloneArtifact();
    sources(badEvidence)[0].fairPlayEvidenceResult = "not_useful";
    expectInvalid(badEvidence, /fairPlayEvidenceResult has unsupported value not_useful/);

    const falseTotals = cloneArtifact();
    sources(falseTotals)[0].suppliesOfficialFairPlayTotals = true;
    expectInvalid(falseTotals, /cannot claim official fair-play totals/);

    const falseEvents = cloneArtifact();
    sources(falseEvents)[0].suppliesCompleteDisciplinaryEvents = true;
    expectInvalid(falseEvents, /cannot claim complete disciplinary events/);

    const fullCalendarAsDiscipline = cloneArtifact();
    sources(fullCalendarAsDiscipline)[1].fairPlayEvidenceResult = "no_disciplinary_events";
    expectInvalid(fullCalendarAsDiscipline, /fifa-full-calendar has wrong fairPlayEvidenceResult/);

    const rankingAsFairPlay = cloneArtifact();
    sources(rankingAsFairPlay)[2].fairPlayEvidenceResult = "no_disciplinary_events";
    expectInvalid(rankingAsFairPlay, /fifa-approved-rankings has wrong fairPlayEvidenceResult/);
  });

  it("rejects malformed metadata, machine paths, and universal conclusion wording", () => {
    const badTimestamp = cloneArtifact();
    badTimestamp.accessTimestampUtc = "2026-06-28";
    expectInvalid(badTimestamp, /accessTimestampUtc must be a precise UTC timestamp/);

    const nonUtcTimestamp = cloneArtifact();
    sources(nonUtcTimestamp)[0].accessTimestampUtc = "2026-06-28T17:05:00-04:00";
    expectInvalid(nonUtcTimestamp, /must be a precise UTC timestamp/);

    const wrongSnapshot = cloneArtifact();
    wrongSnapshot.tournamentSnapshotId = "wrong-snapshot";
    expectInvalid(wrongSnapshot, /wrong tournamentSnapshotId/);

    const wrongChecksum = cloneArtifact();
    wrongChecksum.tournamentSnapshotChecksum = "0".repeat(64);
    expectInvalid(wrongChecksum, /current official snapshot checksum/);

    const machinePathUrl = cloneArtifact();
    sources(machinePathUrl)[0].url = "/tmp/fifa-response.json";
    expectInvalid(machinePathUrl, /machine-specific Unix absolute path at \$\.sourcesSearched\[0\]\.url/);

    const fileUrl = cloneArtifact();
    sources(fileUrl)[0].url = "file:///Users/example/fifa.json";
    expectInvalid(fileUrl, /machine-specific file URL at \$\.sourcesSearched\[0\]\.url/);

    const machinePath = cloneArtifact();
    sources(machinePath)[0].insufficiencyReason = "reviewed at /Users/example/source.json";
    expectInvalid(machinePath, /machine-specific Unix absolute path at \$\.sourcesSearched\[0\]\.insufficiencyReason/);

    const nonListedAbsolutePath = cloneArtifact();
    nonListedAbsolutePath.reviewMetadata = { localPath: "/opt/data/fifa.json" };
    expectInvalid(nonListedAbsolutePath, /machine-specific Unix absolute path at \$\.reviewMetadata\.localPath/);

    const universalClaim = cloneArtifact();
    conclusion(universalClaim).summary = "FIFA has no fair-play data.";
    expectInvalid(universalClaim, /unsupported universal claim/);
  });

  it("rejects fabricated totals and false readiness states", () => {
    const ecuadorTotal = cloneArtifact();
    affectedTie(ecuadorTotal).ecuFairPlayTotal = -1;
    expectInvalid(ecuadorTotal, /must not fabricate an Ecuador fair-play total/);

    const ecuadorZero = cloneArtifact();
    affectedTie(ecuadorZero).ecuFairPlayTotal = 0;
    expectInvalid(ecuadorZero, /must not fabricate an Ecuador fair-play total/);

    const ghanaTotal = cloneArtifact();
    affectedTie(ghanaTotal).ghaFairPlayTotal = -2;
    expectInvalid(ghanaTotal, /must not fabricate a Ghana fair-play total/);

    const ghanaZero = cloneArtifact();
    affectedTie(ghanaZero).ghaFairPlayTotal = 0;
    expectInvalid(ghanaZero, /must not fabricate a Ghana fair-play total/);

    const unresolved = cloneArtifact();
    conclusion(unresolved).retainOrchestrationStatus = "official_tie_unresolved";
    expectInvalid(unresolved, /resolved domain decisions from generated artifacts/);

    const wrongCriterion = cloneArtifact();
    affectedTie(wrongCriterion).criterionReached = "fifa_ranking";
    expectInvalid(wrongCriterion, /exactly the Ecuador\/Ghana fair-play tie/);

    const missingEcuador = cloneArtifact();
    affectedTie(missingEcuador).teamIds = ["gha"];
    expectInvalid(missingEcuador, /exactly the Ecuador\/Ghana fair-play tie/);

    const missingGhana = cloneArtifact();
    affectedTie(missingGhana).teamIds = ["ecu"];
    expectInvalid(missingGhana, /exactly the Ecuador\/Ghana fair-play tie/);

    const extraTeam = cloneArtifact();
    affectedTie(extraTeam).teamIds = ["ecu", "gha", "usa"];
    expectInvalid(extraTeam, /exactly the Ecuador\/Ghana fair-play tie/);

    const fallbackEnabled = cloneArtifact();
    conclusion(fallbackEnabled).developmentFallbackProhibited = false;
    expectInvalid(fallbackEnabled, /resolved domain decisions from generated artifacts/);

    const fabricationAllowed = cloneArtifact();
    conclusion(fabricationAllowed).fabricationProhibited = false;
    expectInvalid(fabricationAllowed, /resolved domain decisions from generated artifacts/);
  });

  it("rejects stale artifact availability fields and mismatched filesystem artifact state", () => {
    const staleField = cloneArtifact();
    conclusion(staleField).qualificationGenerated = true;
    expectInvalid(staleField, /stale artifact field "qualificationGenerated"/);

    const qualificationGenerated = cloneArtifact();
    conclusion(qualificationGenerated).qualificationArtifactGenerated = true;
    expectInvalid(qualificationGenerated, /resolved domain decisions from generated artifacts/);

    expect(() =>
      verifyFairPlaySourceGapArtifact(readArtifact(), {
        artifactExists: {
          qualification: true,
          roundOf32: false,
          simulatorInput: false,
          finalizedBracket: false,
          knockoutReady: false,
        },
      }),
    ).toThrow(/resolved domain decisions from generated artifacts/);
  });

  it("allows the all-48-team rating report while finalized downstream artifacts remain absent", () => {
    expect(
      verifyFairPlaySourceGapArtifact(readArtifact(), {
        artifactExists: validContext.artifactExists,
        allowedArtifactExists: { ratingReport: true },
      }),
    ).toEqual({
      sourceCount: 7,
      orchestrationStatus: "knockout_ready",
      affectedTeamIds: ["ecu", "gha"],
    });
  });

  it("preserves knockout-ready official snapshot and rating readiness boundaries", () => {
    const loaded = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
    const state = buildTournamentState(loaded, {
      ratingsByTeamId: worldFootballEloDevelopmentByTeamId,
      rankingMode: "official",
    });
    const ratingReport = JSON.parse(readFileSync("data/generated/world-cup-2026/knockout-rating-report.json", "utf8")) as {
      ratingChecksum: string;
      divisor: number;
    };

    expect(loaded.snapshot.snapshotVersion).toBe("official-2026-2026-06-28-r1");
    expect(loaded.metadata.snapshotChecksum).toBe("1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7");
    expect(state.status).toBe("knockout_ready");
    expect("qualification" in state).toBe(true);
    expect("roundOf32" in state).toBe(true);
    expect("simulatorBracket" in state).toBe(true);
    expect(ratingReport.ratingChecksum).toBe("f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5");
    expect(ratingReport.divisor).toBe(400);
    expect(OFFICIAL_QUALIFICATION_ARTIFACT_FILE).toBe("data/generated/world-cup-2026/official-qualification.json");
    expect(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE).toBe("data/generated/world-cup-2026/official-round-of-32.json");
    expect(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE).toBe("data/generated/world-cup-2026/official-simulator-input.json");
  });
});
