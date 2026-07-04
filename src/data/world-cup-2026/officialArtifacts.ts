import qualificationArtifactJson from "@/data/world-cup-2026/snapshots/official-2026-current/qualification.json";
import roundOf32ArtifactJson from "@/data/world-cup-2026/snapshots/official-2026-current/round-of-32.json";
import ratingLinkageArtifactJson from "@/data/generated/world-cup-2026/official-rating-linkage.json";
import simulatorInputArtifactJson from "@/data/generated/world-cup-2026/official-simulator-input.json";

interface OfficialParticipant {
  teamId: string;
  displayName: string;
  sourceSlot: string;
}

interface OfficialRoundOf32MatchRecord {
  matchId: string;
  participantADisplayName: string;
  participantBDisplayName: string;
  participantA: OfficialParticipant;
  participantB: OfficialParticipant;
}

interface OfficialRoundOf32Artifact {
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  qualifyingThirdPlaceGroupKey: string;
  matchCount: number;
  matches: OfficialRoundOf32MatchRecord[];
  roundOf32Checksum: string;
}

interface OfficialQualificationArtifact {
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  status: string;
  qualifierCount: number;
  uniqueQualifierCount: number;
  qualifyingThirdPlaceGroupKey: string;
  fairPlay: {
    totalsIncluded: boolean;
    fabricatedTotals: boolean;
    sourceStatus: string;
  };
  tieSemantics: {
    ecuadorGhanaSharedRank: number;
    strictEcuadorGhanaOrderingResolved: boolean;
    affectsQualification: boolean;
  };
  qualificationChecksum: string;
}

interface OfficialRatingRecord {
  teamId: string;
  modelVersion: "v2";
  overall: number;
  attack: number;
  defense: number;
  recentForm: number;
  squadStrength: number;
  penalties: number;
}

interface OfficialRatingLinkageArtifact {
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  ratingSnapshotId: string;
  ratingSnapshotVersion: string;
  ratingSnapshotChecksum: string;
  numericRatingChecksum: string;
  modelVersion: string;
  divisor: number;
  qualifiedRatingRecordCount: number;
  allQualifiersCovered: boolean;
  productionRatingsOverwritten: boolean;
  qualifiedTeamRatings: OfficialRatingRecord[];
  ratingLinkageChecksum: string;
}

interface OfficialSimulatorInputArtifact {
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  ratingSnapshotId: string;
  ratingSnapshotVersion: string;
  ratingSnapshotChecksum: string;
  ratingLinkageChecksum: string;
  modelVersion: string;
  divisor: number;
  openingRoundMatchCount: number;
  championPathMatchCount: number;
  laterRoundsStatus: string;
  matches: Array<{
    id: string;
  }>;
  simulatorInputChecksum: string;
}

export interface OfficialRoundOf32Match {
  id: string;
  teamAName: string;
  teamBName: string;
  teamASlot: string;
  teamBSlot: string;
  teamARatingLabel: string;
  teamBRatingLabel: string;
}

export interface OfficialRatingRow {
  teamId: string;
  teamName: string;
  overallLabel: string;
  attack: number;
  defense: number;
}

export interface OfficialDetailRow {
  label: string;
  value: string;
}

export interface OfficialArtifactTraceabilityRow {
  label: string;
  artifactVersion?: string;
  artifactPath?: string;
  id?: string;
  checksumLabel?: string;
  checksum?: string;
  value?: string;
}

export interface OfficialTournamentUiData {
  roundOf32Matches: OfficialRoundOf32Match[];
  ratingRows: OfficialRatingRow[];
  detailRows: OfficialDetailRow[];
  artifactTraceabilityRows: OfficialArtifactTraceabilityRow[];
  ecuadorGhanaNote: string;
  thirdPlaceGroupKeyLabel: string;
  fairPlayStatusLabel: string;
}

const roundOf32Artifact =
  roundOf32ArtifactJson as OfficialRoundOf32Artifact;
const qualificationArtifact =
  qualificationArtifactJson as OfficialQualificationArtifact;
const ratingLinkageArtifact =
  ratingLinkageArtifactJson as OfficialRatingLinkageArtifact;
const simulatorInputArtifact =
  simulatorInputArtifactJson as OfficialSimulatorInputArtifact;

const teamNameById = new Map<string, string>();

for (const match of roundOf32Artifact.matches) {
  teamNameById.set(match.participantA.teamId, match.participantADisplayName);
  teamNameById.set(match.participantB.teamId, match.participantBDisplayName);
}

const ratingByTeamId = new Map<string, OfficialRatingRecord>(
  ratingLinkageArtifact.qualifiedTeamRatings.map((rating) => [
    rating.teamId,
    rating,
  ]),
);

function formatRating(value: number | undefined): string {
  return value === undefined ? "Rating unavailable" : Math.round(value).toString();
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function shortChecksum(value: string): string {
  return value.slice(0, 12);
}

export const officialTournamentUiData: OfficialTournamentUiData = {
  roundOf32Matches: roundOf32Artifact.matches.map((match) => {
    const teamARating = ratingByTeamId.get(match.participantA.teamId);
    const teamBRating = ratingByTeamId.get(match.participantB.teamId);

    return {
      id: match.matchId,
      teamAName: match.participantADisplayName,
      teamBName: match.participantBDisplayName,
      teamASlot: match.participantA.sourceSlot,
      teamBSlot: match.participantB.sourceSlot,
      teamARatingLabel: formatRating(teamARating?.overall),
      teamBRatingLabel: formatRating(teamBRating?.overall),
    };
  }),
  ratingRows: [...ratingLinkageArtifact.qualifiedTeamRatings]
    .sort((teamA, teamB) => teamB.overall - teamA.overall)
    .map((rating) => ({
      teamId: rating.teamId,
      teamName: teamNameById.get(rating.teamId) ?? rating.teamId.toUpperCase(),
      overallLabel: formatRating(rating.overall),
      attack: rating.attack,
      defense: rating.defense,
    })),
  detailRows: [
    {
      label: "Qualification",
      value: `${formatStatus(qualificationArtifact.status)}; ${qualificationArtifact.uniqueQualifierCount} unique qualifiers`,
    },
    {
      label: "Round of 32",
      value: `${roundOf32Artifact.matchCount} matches; artifact ${roundOf32Artifact.artifactVersion}`,
    },
    {
      label: "Rating linkage",
      value: `${ratingLinkageArtifact.ratingSnapshotVersion}; divisor ${ratingLinkageArtifact.divisor}; numeric checksum ${shortChecksum(
        ratingLinkageArtifact.numericRatingChecksum,
      )}`,
    },
    {
      label: "Simulator input",
      value: `${simulatorInputArtifact.championPathMatchCount} matches; opening round ${simulatorInputArtifact.openingRoundMatchCount}; ${formatStatus(
        simulatorInputArtifact.laterRoundsStatus,
      )}`,
    },
    {
      label: "Source status",
      value: `fair play ${formatStatus(qualificationArtifact.fairPlay.sourceStatus)}; fabricated values ${qualificationArtifact.fairPlay.fabricatedTotals ? "yes" : "no"}`,
    },
    {
      label: "Coverage",
      value: `${ratingLinkageArtifact.qualifiedRatingRecordCount} qualified ratings; all qualifiers covered ${ratingLinkageArtifact.allQualifiersCovered ? "yes" : "no"}; production ratings overwritten ${ratingLinkageArtifact.productionRatingsOverwritten ? "yes" : "no"}`,
    },
    {
      label: "Snapshot",
      value: `${roundOf32Artifact.tournamentSnapshotVersion}; checksum ${shortChecksum(
        roundOf32Artifact.tournamentSnapshotChecksum,
      )}`,
    },
  ],
  artifactTraceabilityRows: [
    {
      label: "Tournament snapshot",
      id: roundOf32Artifact.tournamentSnapshotId,
      artifactVersion: roundOf32Artifact.tournamentSnapshotVersion,
      artifactPath: "data/world-cup-2026/snapshots/official-2026-current/snapshot.json",
      checksumLabel: "Snapshot checksum",
      checksum: roundOf32Artifact.tournamentSnapshotChecksum,
    },
    {
      label: "Qualification",
      artifactVersion: qualificationArtifact.artifactVersion,
      artifactPath:
        "data/world-cup-2026/snapshots/official-2026-current/qualification.json",
      checksumLabel: "Qualification checksum",
      checksum: qualificationArtifact.qualificationChecksum,
    },
    {
      label: "Round of 32",
      artifactVersion: roundOf32Artifact.artifactVersion,
      artifactPath:
        "data/world-cup-2026/snapshots/official-2026-current/round-of-32.json",
      checksumLabel: "Round-of-32 checksum",
      checksum: roundOf32Artifact.roundOf32Checksum,
    },
    {
      label: "Rating linkage",
      artifactVersion: ratingLinkageArtifact.artifactVersion,
      artifactPath: "data/generated/world-cup-2026/official-rating-linkage.json",
      checksumLabel: "Rating-linkage checksum",
      checksum: ratingLinkageArtifact.ratingLinkageChecksum,
    },
    {
      label: "Simulator input",
      artifactVersion: simulatorInputArtifact.artifactVersion,
      artifactPath: "data/generated/world-cup-2026/official-simulator-input.json",
      checksumLabel: "Simulator-input checksum",
      checksum: simulatorInputArtifact.simulatorInputChecksum,
    },
    {
      label: "Numeric ratings",
      id: ratingLinkageArtifact.ratingSnapshotId,
      artifactVersion: ratingLinkageArtifact.ratingSnapshotVersion,
      artifactPath: "data/generated/world-cup-2026/official-rating-linkage.json",
      checksumLabel: "Numeric rating checksum",
      checksum: ratingLinkageArtifact.numericRatingChecksum,
    },
    {
      label: "Third-place group key",
      value: roundOf32Artifact.qualifyingThirdPlaceGroupKey,
    },
  ],
  ecuadorGhanaNote: `Ecuador and Ghana both qualified at shared third-place rank ${qualificationArtifact.tieSemantics.ecuadorGhanaSharedRank}; strict order is unresolved and does not affect the tournament output.`,
  thirdPlaceGroupKeyLabel: `${roundOf32Artifact.qualifyingThirdPlaceGroupKey} third-place group key`,
  fairPlayStatusLabel:
    "No fair-play values are shown for Ecuador or Ghana because official per-team values were unavailable; none were fabricated.",
};
