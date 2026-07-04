import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stableJson } from "./stableJson.ts";
import {
  buildKnockoutResultsArtifact,
  computeKnockoutResultsChecksum,
  type KnockoutResultsArtifact,
  type KnockoutResultsSource,
} from "./buildKnockoutResults.ts";
import {
  OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE,
  OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
} from "./officialSnapshotPaths.ts";
import {
  compareCanonicalMatchIds,
  semanticSha256,
} from "./officialArtifactChecksums.ts";

type JsonObject = Record<string, unknown>;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasForbiddenGeneratedTimestamp(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenGeneratedTimestamp);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as JsonObject).some(([key, nested]) => {
      if (/^(generatedAt|updatedAt|createdAt)$/u.test(key)) {
        return true;
      }
      return hasForbiddenGeneratedTimestamp(nested);
    });
  }
  return false;
}

function assertSortedByMatchId(rows: readonly { matchId: string }[], label: string): void {
  const ids = rows.map((row) => row.matchId);
  const sorted = [...ids].sort(compareCanonicalMatchIds);
  assert(JSON.stringify(ids) === JSON.stringify(sorted), `${label} must use deterministic match ID ordering.`);
}

export function verifyKnockoutResultsArtifacts(input?: {
  qualification?: Record<string, unknown>;
  roundOf32?: Record<string, unknown>;
  source?: KnockoutResultsSource;
  artifact?: KnockoutResultsArtifact;
  artifactText?: string;
}): {
  resultChecksum: string;
  completedMatchCount: number;
  pendingMatchCount: number;
} {
  const qualification = input?.qualification ?? readJson<Record<string, unknown>>(OFFICIAL_QUALIFICATION_ARTIFACT_FILE);
  const roundOf32 = input?.roundOf32 ?? readJson<Record<string, unknown>>(OFFICIAL_ROUND_OF_32_ARTIFACT_FILE);
  const source = input?.source ?? readJson<KnockoutResultsSource>(OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE);
  const artifactText = input?.artifactText ?? (input?.artifact ? null : readFileSync(OFFICIAL_KNOCKOUT_RESULTS_ARTIFACT_FILE, "utf8"));
  const artifact = input?.artifact ?? (JSON.parse(String(artifactText)) as KnockoutResultsArtifact);
  const rebuilt = buildKnockoutResultsArtifact({
    qualification: qualification as unknown as Parameters<typeof buildKnockoutResultsArtifact>[0]["qualification"],
    roundOf32: roundOf32 as unknown as Parameters<typeof buildKnockoutResultsArtifact>[0]["roundOf32"],
    source,
    sourcePath: OFFICIAL_KNOCKOUT_RESULTS_SOURCE_FILE,
  });

  assert(artifact.schemaVersion === rebuilt.schemaVersion, "Knockout results schema version mismatch.");
  assert(artifact.artifactVersion === rebuilt.artifactVersion, "Knockout results artifact version mismatch.");
  assert(artifact.tournamentSnapshotChecksum === rebuilt.tournamentSnapshotChecksum, "Knockout results stale snapshot checksum.");
  assert(artifact.qualificationChecksum === rebuilt.qualificationChecksum, "Knockout results stale qualification checksum.");
  assert(artifact.roundOf32Checksum === rebuilt.roundOf32Checksum, "Knockout results stale Round-of-32 checksum.");
  assert(artifact.topologyChecksum === rebuilt.topologyChecksum, "Knockout results stale topology checksum.");
  assert(artifact.source.sourceAccessTimestampUtc === source.sourceAccessTimestampUtc, "Knockout results source-access timestamp mismatch.");
  assert(artifact.source.runtimeFetch === false, "Knockout results artifact must record no runtime fetch.");
  assert(!hasForbiddenGeneratedTimestamp(artifact), "Knockout results artifact must not contain generated current-time timestamps.");
  assertSortedByMatchId(artifact.completedMatches, "Completed knockout matches");
  assertSortedByMatchId(artifact.pendingMatches, "Pending knockout matches");
  assert(artifact.resultChecksum === computeKnockoutResultsChecksum(artifact), "Knockout results checksum mismatch.");
  assert(semanticSha256(artifact) === semanticSha256(rebuilt), "Knockout results artifact semantics do not match deterministic rebuild.");
  if (artifactText !== null) {
    assert(
      artifactText === stableJson(rebuilt),
      "Knockout results artifact raw bytes differ from canonical deterministic rebuild; regenerate it with npm run tournament2026:build-knockout-results.",
    );
  }

  return {
    resultChecksum: artifact.resultChecksum,
    completedMatchCount: artifact.completedMatchCount,
    pendingMatchCount: artifact.pendingMatchCount,
  };
}

export function verifyKnockoutResults(): ReturnType<typeof verifyKnockoutResultsArtifacts> {
  return verifyKnockoutResultsArtifacts();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = verifyKnockoutResults();
  console.log(
    `Verified official knockout results ${result.resultChecksum} (${result.completedMatchCount} completed, ${result.pendingMatchCount} pending).`,
  );
}
