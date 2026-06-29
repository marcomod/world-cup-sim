import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/node.ts";
import { buildTournamentState } from "../../src/lib/tournament-2026/snapshot/buildTournamentState.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import {
  OFFICIAL_FINALIZED_BRACKET_ARTIFACT_FILE,
  OFFICIAL_KNOCKOUT_READY_ARTIFACT_FILE,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
  OFFICIAL_SNAPSHOT_FILE,
  OFFICIAL_SNAPSHOT_VERSION,
  RAW_FAIR_PLAY_SOURCE_GAP_FILE,
} from "./officialSnapshotPaths.ts";

const EXPECTED_SNAPSHOT_CHECKSUM =
  "1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7";
const EXPECTED_ACCESS_TIMESTAMP = "2026-06-28T17:05:00.000Z";

export type FairPlaySourceCandidateId =
  | "fifa-first-stage-calendar"
  | "fifa-full-calendar"
  | "fifa-approved-rankings"
  | "fifa-ranking-schedule"
  | "fifa-match-detail"
  | "fifa-live-events"
  | "fifa-standings";

type SourceAccessResult = "reviewed" | "unsupported_endpoint";
type FairPlayEvidenceResult =
  | "no_disciplinary_events"
  | "round_of_32_cross_check_only"
  | "ranking_only"
  | "unsupported_endpoint";

type CandidateExpectation = {
  id: FairPlaySourceCandidateId;
  authority: "FIFA";
  role: string;
  url: string;
  accessResult: SourceAccessResult;
  fairPlayEvidenceResult: FairPlayEvidenceResult;
};

export const EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES: readonly CandidateExpectation[] = [
  {
    id: "fifa-first-stage-calendar",
    authority: "FIFA",
    role: "teams_groups_fixtures_results",
    url: "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&idStage=289273&language=en&count=200",
    accessResult: "reviewed",
    fairPlayEvidenceResult: "no_disciplinary_events",
  },
  {
    id: "fifa-full-calendar",
    authority: "FIFA",
    role: "official_round_of_32_listing_cross_check",
    url: "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=200",
    accessResult: "reviewed",
    fairPlayEvidenceResult: "round_of_32_cross_check_only",
  },
  {
    id: "fifa-approved-rankings",
    authority: "FIFA",
    role: "fifa_ranking_tie_break_input",
    url: "https://api.fifa.com/api/v3/fifarankings/rankings/approved?gender=1&count=300&language=en&sportType=0",
    accessResult: "reviewed",
    fairPlayEvidenceResult: "ranking_only",
  },
  {
    id: "fifa-ranking-schedule",
    authority: "FIFA",
    role: "ranking_release_metadata",
    url: "https://api.fifa.com/api/v3/fifarankings/rankingschedules/all?gender=1&type=0&count=30",
    accessResult: "reviewed",
    fairPlayEvidenceResult: "ranking_only",
  },
  {
    id: "fifa-match-detail",
    authority: "FIFA",
    role: "candidate_match_report_or_event_feed",
    url: "https://api.fifa.com/api/v3/calendar/matches/400021443?language=en",
    accessResult: "unsupported_endpoint",
    fairPlayEvidenceResult: "unsupported_endpoint",
  },
  {
    id: "fifa-live-events",
    authority: "FIFA",
    role: "candidate_match_event_feed",
    url: "https://api.fifa.com/api/v3/live/football/17/285023/400021443?language=en",
    accessResult: "unsupported_endpoint",
    fairPlayEvidenceResult: "unsupported_endpoint",
  },
  {
    id: "fifa-standings",
    authority: "FIFA",
    role: "candidate_official_standings_or_qualification_publication",
    url: "https://api.fifa.com/api/v3/standings/17/285023/289273?language=en",
    accessResult: "unsupported_endpoint",
    fairPlayEvidenceResult: "unsupported_endpoint",
  },
] as const;

const EXPECTED_CANDIDATE_IDS = EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES.map((candidate) => candidate.id);

export interface VerifiedFairPlaySourceGap {
  sourceCount: number;
  orchestrationStatus: "knockout_ready";
  affectedTeamIds: readonly ["ecu", "gha"];
}

export interface FairPlaySourceGapVerificationContext {
  artifactExists: {
    qualification: boolean;
    roundOf32: boolean;
    simulatorInput: boolean;
    finalizedBracket?: boolean;
    knockoutReady?: boolean;
  };
  allowedArtifactExists?: {
    ratingReport?: boolean;
  };
}

interface FairPlaySourceRecord {
  id: FairPlaySourceCandidateId;
  authority: string;
  role: string;
  title: string;
  url: string;
  accessTimestampUtc: string;
  accessResult: string;
  fairPlayEvidenceResult: string;
  insufficiencyReason: string;
  publicationOrUpdateTimestamp: string | null;
  extractionMethod: string;
  responseSha256: string | null;
  result: string;
  usableForFairPlay: boolean;
  usableForQualificationResolution: boolean;
  suppliesOfficialFairPlayTotals: boolean;
  suppliesCompleteDisciplinaryEvents: boolean;
}

interface FairPlaySourceGapReport {
  generatedFileWarning: string;
  reportId: string;
  reportVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  accessTimestampUtc: string;
  normalizationVersion: string;
  sourcesSearched: readonly FairPlaySourceRecord[];
  missingFields: readonly string[];
  affectedTie: {
    criterionReached: string;
    teamIds: readonly string[];
    ecuFairPlayTotal?: number | null;
    ghaFairPlayTotal?: number | null;
    resolution: string;
    reason: string;
  };
  conclusion: {
    status: string;
    retainSnapshotVersion: string;
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
    developmentFallbackProhibited: boolean;
    fabricationProhibited: boolean;
    ratingValuesChanged: boolean;
    productionDivisor: number;
    appliesAsOfAccessTimestampUtc: string;
    reviewedSourceCandidateCount: number;
    reviewedSourceCandidateIds: readonly string[];
    limitedToReviewedFifaCandidates: boolean;
    notUniversalNoEvidenceClaim: boolean;
    futureOfficialEvidenceMayResolveOrdering: boolean;
    summary: string;
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assertRecord(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
}

function assertBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be a boolean.`);
  }
  return value;
}

function assertUtcTimestamp(value: unknown, context: string): string {
  const timestamp = assertString(value, context);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${context} must be a precise UTC timestamp.`);
  }
  return timestamp;
}

function assertSourceUtcTimestamp(value: unknown, context: string): string {
  const timestamp = assertString(value, context);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${context} must be a UTC timestamp.`);
  }
  return timestamp;
}

function assertSha256(value: unknown, context: string): string | null {
  if (value !== null && (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error(`${context} must be a SHA-256 hex string or null.`);
  }
  return value;
}

function assertStringArray(value: unknown, context: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context} must be an array of strings.`);
  }
  return value;
}

function assertCandidateId(value: unknown, context: string): FairPlaySourceCandidateId {
  const id = assertString(value, context);
  if (!EXPECTED_CANDIDATE_IDS.includes(id as FairPlaySourceCandidateId)) {
    throw new Error(`${context} has unexpected source candidate ID ${id}.`);
  }
  return id as FairPlaySourceCandidateId;
}

function assertAllowedValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  context: string,
): T {
  const text = assertString(value, context);
  if (!allowed.includes(text as T)) {
    throw new Error(`${context} has unsupported value ${text}.`);
  }
  return text as T;
}

function assertNoMachinePathStrings(value: unknown, path = "$"): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/(^|[\s"'(])file:\/\//i.test(value)) {
      throw new Error(`Fair-play source-gap artifact contains a machine-specific file URL at ${path}.`);
    }
    if (/(^|[\s"'(])[A-Za-z]:(?:\\|\/)/.test(value)) {
      throw new Error(`Fair-play source-gap artifact contains a machine-specific Windows absolute path at ${path}.`);
    }
    if (/(^|[\s"'(])(?:\\\\|\/\/)[^/\\\s]+[\/\\][^/\\\s]+/.test(value)) {
      throw new Error(`Fair-play source-gap artifact contains a machine-specific UNC path at ${path}.`);
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return;
    }
    if (/(^|[\s"'(])\/(?!\/)[^\s"'<>]+/.test(value)) {
      throw new Error(`Fair-play source-gap artifact contains a machine-specific Unix absolute path at ${path}.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMachinePathStrings(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertNoMachinePathStrings(nested, `${path}.${key}`);
    }
  }
}

function assertNoUniversalNoEvidenceClaim(report: FairPlaySourceGapReport): void {
  const values: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value !== null && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  collect(report);
  const universalPattern =
    /\b(FIFA has no fair-play data|official fair-play data does not exist|qualification cannot ever be resolved)\b/i;
  const offending = values.find((value) => universalPattern.test(value));
  if (offending !== undefined) {
    throw new Error(`Fair-play source-gap conclusion contains an unsupported universal claim: ${offending}`);
  }
}

function validateSourceCandidateSet(sources: readonly FairPlaySourceRecord[]): void {
  if (sources.length !== EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES.length) {
    throw new Error(`Fair-play source-gap report must contain exactly ${EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES.length} source candidates.`);
  }

  const seen = new Set<string>();
  for (const [index, source] of sources.entries()) {
    if (!source || typeof source !== "object") {
      throw new Error(`Fair-play source candidate ${index} must be an object.`);
    }
    const id = assertCandidateId(source.id, `fair-play source candidate ${index}.id`);
    if (seen.has(id)) {
      throw new Error(`Duplicate fair-play source candidate ID ${id}.`);
    }
    seen.add(id);

    const expected = EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES[index];
    if (id !== expected.id) {
      throw new Error(`Fair-play source candidate ${index} must be ${expected.id}, received ${id}.`);
    }
    assertSourceCandidate(source, expected, index);
  }

  for (const expectedId of EXPECTED_CANDIDATE_IDS) {
    if (!seen.has(expectedId)) {
      throw new Error(`Missing fair-play source candidate ID ${expectedId}.`);
    }
  }
}

function assertSourceCandidate(source: FairPlaySourceRecord, expected: CandidateExpectation, index: number): void {
  if (source.authority !== expected.authority) {
    throw new Error(`Fair-play source ${expected.id} has wrong authority ${source.authority}.`);
  }
  if (source.role !== expected.role) {
    throw new Error(`Fair-play source ${expected.id} has wrong role ${source.role}.`);
  }
  if (source.url !== expected.url) {
    throw new Error(`Fair-play source ${expected.id} has wrong URL or endpoint identifier.`);
  }
  assertString(source.title, `fair-play source ${expected.id}.title`);
  assertUtcTimestamp(source.accessTimestampUtc, `fair-play source ${expected.id}.accessTimestampUtc`);
  assertSha256(source.responseSha256, `fair-play source ${expected.id}.responseSha256`);
  assertString(source.extractionMethod, `fair-play source ${expected.id}.extractionMethod`);
  assertString(source.result, `fair-play source ${expected.id}.result`);
  assertString(source.insufficiencyReason, `fair-play source ${expected.id}.insufficiencyReason`);
  const accessResult = assertAllowedValue(
    source.accessResult,
    ["reviewed", "unsupported_endpoint"] as const,
    `fair-play source ${expected.id}.accessResult`,
  );
  const evidenceResult = assertAllowedValue(
    source.fairPlayEvidenceResult,
    ["no_disciplinary_events", "round_of_32_cross_check_only", "ranking_only", "unsupported_endpoint"] as const,
    `fair-play source ${expected.id}.fairPlayEvidenceResult`,
  );
  if (accessResult !== expected.accessResult) {
    throw new Error(`Fair-play source ${expected.id} has wrong accessResult ${accessResult}.`);
  }
  if (evidenceResult !== expected.fairPlayEvidenceResult) {
    throw new Error(`Fair-play source ${expected.id} has wrong fairPlayEvidenceResult ${evidenceResult}.`);
  }
  if (assertBoolean(source.usableForFairPlay, `fair-play source ${expected.id}.usableForFairPlay`)) {
    throw new Error(`Fair-play source ${expected.id} cannot be marked usable for fair play.`);
  }
  if (assertBoolean(source.usableForQualificationResolution, `fair-play source ${expected.id}.usableForQualificationResolution`)) {
    throw new Error(`Fair-play source ${expected.id} cannot be marked usable for qualification resolution.`);
  }
  if (assertBoolean(source.suppliesOfficialFairPlayTotals, `fair-play source ${expected.id}.suppliesOfficialFairPlayTotals`)) {
    throw new Error(`Fair-play source ${expected.id} cannot claim official fair-play totals.`);
  }
  if (assertBoolean(source.suppliesCompleteDisciplinaryEvents, `fair-play source ${expected.id}.suppliesCompleteDisciplinaryEvents`)) {
    throw new Error(`Fair-play source ${expected.id} cannot claim complete disciplinary events.`);
  }
  if (expected.id === "fifa-full-calendar" && evidenceResult !== "round_of_32_cross_check_only") {
    throw new Error("Full calendar source must be classified only as a Round-of-32 cross-check.");
  }
  if ((expected.id === "fifa-approved-rankings" || expected.id === "fifa-ranking-schedule") && evidenceResult !== "ranking_only") {
    throw new Error(`Ranking source ${expected.id} must be classified as ranking input only.`);
  }
  if (source.publicationOrUpdateTimestamp !== null) {
    assertSourceUtcTimestamp(source.publicationOrUpdateTimestamp, `fair-play source ${index}.publicationOrUpdateTimestamp`);
  }
}

function validateConclusion(
  report: FairPlaySourceGapReport,
  context: FairPlaySourceGapVerificationContext,
): void {
  if (report.tournamentSnapshotId !== "fifa-world-cup-2026") {
    throw new Error("Fair-play source-gap report has the wrong tournamentSnapshotId.");
  }
  if (report.tournamentSnapshotVersion !== OFFICIAL_SNAPSHOT_VERSION) {
    throw new Error("Fair-play source-gap report must retain the current r1 snapshot version.");
  }
  if (report.tournamentSnapshotChecksum !== EXPECTED_SNAPSHOT_CHECKSUM) {
    throw new Error("Fair-play source-gap report must reference the current official snapshot checksum.");
  }
  assertUtcTimestamp(report.accessTimestampUtc, "fair-play source-gap accessTimestampUtc");
  if (report.accessTimestampUtc !== EXPECTED_ACCESS_TIMESTAMP) {
    throw new Error("Fair-play source-gap accessTimestampUtc must match the fixed review cutoff.");
  }
  if (report.normalizationVersion !== "official-fair-play-source-gap-v1") {
    throw new Error("Fair-play source-gap report has an unexpected normalizationVersion.");
  }
  if (!report.missingFields.includes("official fair-play comparison for Ecuador and Ghana")) {
    throw new Error("Fair-play source-gap report must name the missing Ecuador/Ghana fair-play comparison.");
  }

  const affectedTeamIds = [...report.affectedTie.teamIds].sort();
  if (
    report.affectedTie.criterionReached !== "fair_play" ||
    JSON.stringify(affectedTeamIds) !== JSON.stringify(["ecu", "gha"]) ||
    report.affectedTie.resolution !== "unresolved"
  ) {
    throw new Error("Fair-play source-gap report must keep exactly the Ecuador/Ghana fair-play tie unresolved.");
  }
  if (report.affectedTie.ecuFairPlayTotal !== null && report.affectedTie.ecuFairPlayTotal !== undefined) {
    throw new Error("Fair-play source-gap report must not fabricate an Ecuador fair-play total.");
  }
  if (report.affectedTie.ghaFairPlayTotal !== null && report.affectedTie.ghaFairPlayTotal !== undefined) {
    throw new Error("Fair-play source-gap report must not fabricate a Ghana fair-play total.");
  }
  assertString(report.affectedTie.reason, "fair-play source-gap affectedTie.reason");

  const conclusion = report.conclusion;
  const conclusionRecord = conclusion as unknown as Record<string, unknown>;
  for (const staleField of [
    "qualificationGenerated",
    "roundOf32Generated",
    "simulatorInputGenerated",
    "officialQualificationAvailable",
    "officialRoundOf32Available",
    "simulatorInputAvailable",
  ]) {
    if (staleField in conclusionRecord) {
      throw new Error(`Fair-play source-gap conclusion must not use stale artifact field "${staleField}".`);
    }
  }

  if (
    conclusion.status !== "official_fair_play_source_unavailable" ||
    conclusion.retainSnapshotVersion !== OFFICIAL_SNAPSHOT_VERSION ||
    conclusion.retainOrchestrationStatus !== "knockout_ready" ||
    conclusion.qualificationDecisionResolved !== true ||
    conclusion.roundOf32Resolvable !== true ||
    conclusion.simulatorInputResolvable !== true ||
    conclusion.qualificationArtifactGenerated !== context.artifactExists.qualification ||
    conclusion.roundOf32ArtifactGenerated !== context.artifactExists.roundOf32 ||
    conclusion.simulatorInputArtifactGenerated !== context.artifactExists.simulatorInput ||
    conclusion.strictThirdPlaceOrderingResolved !== false ||
    conclusion.unresolvedOrderingAffectsTournamentDecision !== false ||
    conclusion.qualifyingThirdPlaceGroupKey !== "BDEFIJKL" ||
    conclusion.developmentFallbackProhibited !== true ||
    conclusion.fabricationProhibited !== true ||
    conclusion.ratingValuesChanged !== false ||
    conclusion.productionDivisor !== 400 ||
    conclusion.appliesAsOfAccessTimestampUtc !== EXPECTED_ACCESS_TIMESTAMP ||
    conclusion.reviewedSourceCandidateCount !== EXPECTED_FAIR_PLAY_SOURCE_CANDIDATES.length ||
    conclusion.limitedToReviewedFifaCandidates !== true ||
    conclusion.notUniversalNoEvidenceClaim !== true ||
    conclusion.futureOfficialEvidenceMayResolveOrdering !== true
  ) {
    throw new Error("Fair-play source-gap conclusion must distinguish resolved domain decisions from generated artifacts.");
  }
  if (JSON.stringify(conclusion.reviewedSourceCandidateIds) !== JSON.stringify(EXPECTED_CANDIDATE_IDS)) {
    throw new Error("Fair-play source-gap conclusion must list the exact reviewed source candidate IDs.");
  }
  assertNoUniversalNoEvidenceClaim(report);
  if (
    !conclusion.summary.includes("seven reviewed FIFA candidates") ||
    !conclusion.summary.includes(EXPECTED_ACCESS_TIMESTAMP) ||
    !conclusion.summary.includes("does not affect qualification") ||
    !conclusion.summary.includes("BDEFIJKL") ||
    !conclusion.summary.includes("artifacts are not generated")
  ) {
    throw new Error("Fair-play source-gap conclusion summary must be bounded to the reviewed candidates and non-blocking decision.");
  }

}

export function verifyFairPlaySourceGapArtifact(
  artifact: unknown,
  context: FairPlaySourceGapVerificationContext,
): VerifiedFairPlaySourceGap {
  assertRecord(artifact, "fair-play source-gap artifact");
  assertNoMachinePathStrings(artifact);
  const report = artifact as unknown as FairPlaySourceGapReport;

  if (report.generatedFileWarning !== "Do not edit manually.") {
    throw new Error("Fair-play source-gap report must include the generated-file warning.");
  }
  if (report.reportId !== "official-2026-fair-play-source-gap") {
    throw new Error("Fair-play source-gap report has an unexpected reportId.");
  }
  if (report.reportVersion !== "official-2026-2026-06-28-r1-fair-play-gap-r1") {
    throw new Error("Fair-play source-gap report has an unexpected reportVersion.");
  }
  if (!Array.isArray(report.sourcesSearched)) {
    throw new Error("Fair-play source-gap report sourcesSearched must be an array.");
  }
  validateSourceCandidateSet(report.sourcesSearched);
  assertStringArray(report.missingFields, "fair-play source-gap missingFields");
  assertRecord(report.affectedTie, "fair-play source-gap affectedTie");
  assertRecord(report.conclusion, "fair-play source-gap conclusion");
  validateConclusion(report, context);

  return {
    sourceCount: report.sourcesSearched.length,
    orchestrationStatus: "knockout_ready",
    affectedTeamIds: ["ecu", "gha"],
  };
}

function generatedArtifactExists(filePath: string, context: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw new Error(`Unable to inspect generated ${context} artifact path.`);
  }
}

export function readGeneratedArtifactState(): FairPlaySourceGapVerificationContext["artifactExists"] {
  return {
    qualification: generatedArtifactExists(OFFICIAL_QUALIFICATION_ARTIFACT_FILE, "qualification"),
    roundOf32: generatedArtifactExists(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE, "Round-of-32"),
    simulatorInput: generatedArtifactExists(OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE, "simulator-input"),
    finalizedBracket: generatedArtifactExists(OFFICIAL_FINALIZED_BRACKET_ARTIFACT_FILE, "finalized-bracket"),
    knockoutReady: generatedArtifactExists(OFFICIAL_KNOCKOUT_READY_ARTIFACT_FILE, "knockout-ready"),
  };
}

export function verifyFairPlaySourceGap(): {
  sourceCount: number;
  reportChecksum: string;
  orchestrationStatus: string;
} {
  const report = readJson<unknown>(RAW_FAIR_PLAY_SOURCE_GAP_FILE);
  const loaded = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);

  if (loaded.metadata.snapshotChecksum !== EXPECTED_SNAPSHOT_CHECKSUM) {
    throw new Error("Official snapshot checksum changed; fair-play source-gap report must be reviewed.");
  }

  const verified = verifyFairPlaySourceGapArtifact(report, {
    artifactExists: readGeneratedArtifactState(),
  });

  const state = buildTournamentState(loaded, {
    ratingsByTeamId: worldFootballEloDevelopmentByTeamId,
    rankingMode: "official",
  });
  if (state.status !== "knockout_ready") {
    throw new Error("Official snapshot must be knockout-ready when missing fair-play ordering is non-blocking.");
  }
  const qualifiedThirdPlaceGroupKey = state.qualification.qualifiedThirdPlacedTeams
    .map((team) => team.group)
    .sort()
    .join("");
  if (qualifiedThirdPlaceGroupKey !== "BDEFIJKL") {
    throw new Error("Official snapshot qualified third-place group key must remain BDEFIJKL.");
  }

  return {
    sourceCount: verified.sourceCount,
    reportChecksum: createHash("sha256").update(readFileSync(RAW_FAIR_PLAY_SOURCE_GAP_FILE)).digest("hex"),
    orchestrationStatus: state.status,
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = verifyFairPlaySourceGap();
  console.log(
    `Verified fair-play source gap: ${result.sourceCount} sources searched, orchestration ${result.orchestrationStatus}, report checksum ${result.reportChecksum}.`,
  );
}
