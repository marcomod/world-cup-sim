import { existsSync, readFileSync } from "node:fs";
import { validateTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/validateSnapshot.ts";
import type {
  NormalizedTournamentSnapshot,
  TournamentSnapshot,
} from "../../src/data/world-cup-2026/snapshots/types.ts";
import { worldFootballEloDevelopmentByTeamId } from "../../src/data/generated/worldFootballEloDevelopment.generated.ts";
import { compareCodePoints } from "../../src/lib/tournament-2026/constants.ts";
import { buildTournamentState } from "../../src/lib/tournament-2026/snapshot/buildTournamentState.ts";
import {
  OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
  OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
  OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
} from "./officialSnapshotPaths.ts";
import {
  computeQualificationChecksum,
  computeRatingLinkageChecksum,
  computeRoundOf32Checksum,
  computeSimulatorInputChecksum,
} from "./officialArtifactChecksums.ts";

export interface OfficialArtifactPaths {
  qualification: string;
  roundOf32: string;
  ratingLinkage: string;
  simulatorInput: string;
}

export interface OfficialOrchestrationStatus {
  generatedFileWarning: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  status: string;
  qualificationDecisionResolved?: boolean;
  strictEcuadorGhanaOrderingResolved?: boolean;
  unresolvedOrderingAffectsTournamentOutput?: boolean;
  qualifyingThirdPlaceGroupKey?: string | null;
  qualificationArtifact?: { path: string; checksum: string } | null;
  roundOf32Artifact?: { path: string; checksum: string } | null;
  ratingLinkageArtifact?: { path: string; checksum: string; numericRatingChecksum: string } | null;
  simulatorInputStatus?: "not_generated_by_snapshot_builder" | "not_generated" | "generated";
  simulatorInputArtifact?: { path: string; checksum: string } | null;
  noFabricatedFairPlayValues?: boolean;
  officialRoundOf32Generated?: boolean;
  criterion?: string;
  teamIds?: string[];
  missingDataset?: string;
  reason?: string;
  generatedAtPolicy: string;
}

export const DEFAULT_OFFICIAL_ARTIFACT_PATHS: OfficialArtifactPaths = {
  qualification: OFFICIAL_QUALIFICATION_ARTIFACT_FILE,
  roundOf32: OFFICIAL_ROUND_OF_32_ARTIFACT_FILE,
  ratingLinkage: OFFICIAL_RATING_LINKAGE_ARTIFACT_FILE,
  simulatorInput: OFFICIAL_SIMULATOR_INPUT_ARTIFACT_FILE,
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function assertFinalizedSnapshotLink(
  artifact: Record<string, unknown>,
  context: string,
  snapshot: TournamentSnapshot,
  snapshotChecksum: string,
): void {
  if (artifact.tournamentSnapshotId !== OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID) {
    throw new Error(`${context} has wrong tournamentSnapshotId.`);
  }
  if (artifact.tournamentSnapshotVersion !== snapshot.snapshotVersion) {
    throw new Error(`${context} has wrong tournamentSnapshotVersion.`);
  }
  if (artifact.tournamentSnapshotChecksum !== snapshotChecksum) {
    throw new Error(`${context} has wrong tournamentSnapshotChecksum.`);
  }
}

function readExistingArtifact(filePath: string): Record<string, unknown> | null {
  return existsSync(filePath) ? readJson<Record<string, unknown>>(filePath) : null;
}

function denormalizedSnapshot(snapshot: TournamentSnapshot | NormalizedTournamentSnapshot): TournamentSnapshot {
  if (!("derivedState" in snapshot)) {
    return snapshot;
  }
  const copy = { ...snapshot } as Record<string, unknown>;
  delete copy.derivedState;
  return copy as unknown as TournamentSnapshot;
}

function validatedQualificationLink(
  snapshot: TournamentSnapshot,
  snapshotChecksum: string,
  filePath: string,
): { artifact: Record<string, unknown>; link: { path: string; checksum: string } } | null {
  const artifact = readExistingArtifact(filePath);
  if (!artifact) {
    return null;
  }
  assertFinalizedSnapshotLink(artifact, "Qualification artifact", snapshot, snapshotChecksum);
  const checksum = computeQualificationChecksum(artifact);
  if (artifact.qualificationChecksum !== checksum) {
    throw new Error("Qualification artifact checksum mismatch while building orchestration status.");
  }
  return { artifact, link: { path: filePath, checksum } };
}

function validatedRoundOf32Link(
  snapshot: TournamentSnapshot,
  snapshotChecksum: string,
  filePath: string,
  qualificationChecksum: string | null,
): { artifact: Record<string, unknown>; link: { path: string; checksum: string } } | null {
  const artifact = readExistingArtifact(filePath);
  if (!artifact) {
    return null;
  }
  if (!qualificationChecksum) {
    throw new Error("Round-of-32 artifact exists without a valid qualification artifact.");
  }
  assertFinalizedSnapshotLink(artifact, "Round-of-32 artifact", snapshot, snapshotChecksum);
  if (artifact.qualificationChecksum !== qualificationChecksum) {
    throw new Error("Round-of-32 artifact qualification linkage mismatch while building orchestration status.");
  }
  const checksum = computeRoundOf32Checksum(artifact);
  if (artifact.roundOf32Checksum !== checksum) {
    throw new Error("Round-of-32 artifact checksum mismatch while building orchestration status.");
  }
  return { artifact, link: { path: filePath, checksum } };
}

function validatedRatingLinkageLink(
  snapshot: TournamentSnapshot,
  snapshotChecksum: string,
  filePath: string,
  qualificationChecksum: string | null,
  roundOf32Checksum: string | null,
): { artifact: Record<string, unknown>; link: { path: string; checksum: string; numericRatingChecksum: string } } | null {
  const artifact = readExistingArtifact(filePath);
  if (!artifact) {
    return null;
  }
  if (!qualificationChecksum || !roundOf32Checksum) {
    throw new Error("Rating-linkage artifact exists without valid qualification and Round-of-32 artifacts.");
  }
  assertFinalizedSnapshotLink(artifact, "Rating-linkage artifact", snapshot, snapshotChecksum);
  if (artifact.qualificationChecksum !== qualificationChecksum || artifact.roundOf32Checksum !== roundOf32Checksum) {
    throw new Error("Rating-linkage artifact tournament linkage mismatch while building orchestration status.");
  }
  const checksum = computeRatingLinkageChecksum(artifact);
  if (artifact.ratingLinkageChecksum !== checksum) {
    throw new Error("Rating-linkage artifact checksum mismatch while building orchestration status.");
  }
  return {
    artifact,
    link: {
      path: filePath,
      checksum,
      numericRatingChecksum: String(artifact.numericRatingChecksum),
    },
  };
}

function validatedSimulatorInputLink(
  snapshot: TournamentSnapshot,
  snapshotChecksum: string,
  filePath: string,
  qualificationChecksum: string | null,
  roundOf32Checksum: string | null,
  ratingLinkageChecksum: string | null,
): { artifact: Record<string, unknown>; link: { path: string; checksum: string } } | null {
  const artifact = readExistingArtifact(filePath);
  if (!artifact) {
    return null;
  }
  if (!qualificationChecksum || !roundOf32Checksum || !ratingLinkageChecksum) {
    throw new Error("Simulator-input artifact exists without valid qualification, Round-of-32, and rating-linkage artifacts.");
  }
  assertFinalizedSnapshotLink(artifact, "Simulator-input artifact", snapshot, snapshotChecksum);
  if (
    artifact.qualificationChecksum !== qualificationChecksum ||
    artifact.roundOf32Checksum !== roundOf32Checksum ||
    artifact.ratingLinkageChecksum !== ratingLinkageChecksum
  ) {
    throw new Error("Simulator-input artifact linkage mismatch while building orchestration status.");
  }
  const checksum = computeSimulatorInputChecksum(artifact);
  if (artifact.simulatorInputChecksum !== checksum) {
    throw new Error("Simulator-input artifact checksum mismatch while building orchestration status.");
  }
  return { artifact, link: { path: filePath, checksum } };
}

export function buildOfficialSnapshotOrchestrationStatus(input: {
  snapshot: TournamentSnapshot | NormalizedTournamentSnapshot;
  snapshotChecksum: string;
  artifactPaths?: OfficialArtifactPaths;
}): OfficialOrchestrationStatus {
  const artifactPaths = input.artifactPaths ?? DEFAULT_OFFICIAL_ARTIFACT_PATHS;
  const validated = validateTournamentSnapshot(denormalizedSnapshot(input.snapshot));
  const tournamentState = buildTournamentState(
    {
      snapshot: validated.snapshot,
      metadata: {
        ...validated.metadata,
        snapshotChecksum: input.snapshotChecksum,
      },
    },
    { ratingsByTeamId: worldFootballEloDevelopmentByTeamId, rankingMode: "official" },
  );

  if (tournamentState.status === "official_tie_unresolved") {
    return {
      generatedFileWarning: "Do not edit manually.",
      tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
      tournamentSnapshotVersion: input.snapshot.snapshotVersion,
      tournamentSnapshotChecksum: input.snapshotChecksum,
      status: "official_tie_unresolved",
      criterion: "fair_play",
      teamIds: ["ecu", "gha"],
      missingDataset: "official_fair_play_records",
      reason: tournamentState.reason,
      generatedAtPolicy: "Deterministic artifact derived from the versioned official snapshot; no wall-clock timestamp is used.",
      officialRoundOf32Generated: false,
    };
  }

  const qualification = validatedQualificationLink(input.snapshot, input.snapshotChecksum, artifactPaths.qualification);
  const roundOf32 = validatedRoundOf32Link(
    input.snapshot,
    input.snapshotChecksum,
    artifactPaths.roundOf32,
    qualification?.link.checksum ?? null,
  );
  const ratingLinkage = validatedRatingLinkageLink(
    input.snapshot,
    input.snapshotChecksum,
    artifactPaths.ratingLinkage,
    qualification?.link.checksum ?? null,
    roundOf32?.link.checksum ?? null,
  );
  const simulatorInput = validatedSimulatorInputLink(
    input.snapshot,
    input.snapshotChecksum,
    artifactPaths.simulatorInput,
    qualification?.link.checksum ?? null,
    roundOf32?.link.checksum ?? null,
    ratingLinkage?.link.checksum ?? null,
  );

  return {
    generatedFileWarning: "Do not edit manually.",
    tournamentSnapshotId: OFFICIAL_FINALIZED_TOURNAMENT_SNAPSHOT_ID,
    tournamentSnapshotVersion: input.snapshot.snapshotVersion,
    tournamentSnapshotChecksum: input.snapshotChecksum,
    status: tournamentState.status,
    qualificationDecisionResolved: tournamentState.status === "knockout_ready",
    strictEcuadorGhanaOrderingResolved: false,
    unresolvedOrderingAffectsTournamentOutput: false,
    qualifyingThirdPlaceGroupKey: tournamentState.status === "knockout_ready"
      ? tournamentState.qualification.qualifiedThirdPlacedTeams.map((team) => team.group).sort(compareCodePoints).join("")
      : null,
    qualificationArtifact: qualification?.link ?? null,
    roundOf32Artifact: roundOf32?.link ?? null,
    ratingLinkageArtifact: ratingLinkage?.link ?? null,
    simulatorInputStatus: simulatorInput ? "generated" : qualification || roundOf32 || ratingLinkage ? "not_generated" : "not_generated_by_snapshot_builder",
    simulatorInputArtifact: simulatorInput?.link ?? null,
    noFabricatedFairPlayValues: true,
    officialRoundOf32Generated: tournamentState.status === "knockout_ready",
    generatedAtPolicy: simulatorInput
      ? "Deterministic artifact derived from checked-in local files; no wall-clock timestamp is used."
      : "Deterministic artifact derived from the versioned official snapshot; no wall-clock timestamp is used.",
  };
}
