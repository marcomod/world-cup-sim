import qualificationArtifactJson from "@/data/world-cup-2026/snapshots/official-2026-current/qualification.json";
import roundOf32ArtifactJson from "@/data/world-cup-2026/snapshots/official-2026-current/round-of-32.json";
import knockoutResultsArtifactJson from "@/data/world-cup-2026/snapshots/official-2026-current/knockout-results.json";
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

export interface OfficialKnockoutResultScore {
  participantAGoals: number;
  participantBGoals: number;
  decidedBy: "regular_time" | "extra_time" | "penalties";
  participantAPenalties?: number;
  participantBPenalties?: number;
}

export interface OfficialKnockoutParticipant {
  teamId: string;
  displayName: string;
  sourceSlot: string;
}

export interface OfficialCompletedKnockoutMatchRecord {
  matchId: string;
  round: string;
  participantA: OfficialKnockoutParticipant;
  participantB: OfficialKnockoutParticipant;
  score: OfficialKnockoutResultScore;
  winnerId: string;
  resultStatus: "official_final";
}

export interface OfficialPendingKnockoutMatchRecord {
  matchId: string;
  round: string;
  sourceSlots: {
    participantA: string;
    participantB: string;
  };
  knownParticipants: {
    participantA?: OfficialKnockoutParticipant;
    participantB?: OfficialKnockoutParticipant;
  };
  unresolvedParticipantSlots: {
    participantA?: string;
    participantB?: string;
  };
  status: "pending";
}

interface OfficialKnockoutResultsArtifact {
  artifactVersion: string;
  tournamentSnapshotId: string;
  tournamentSnapshotVersion: string;
  tournamentSnapshotChecksum: string;
  qualificationChecksum: string;
  roundOf32Checksum: string;
  topologyChecksum: string;
  source: {
    sourcePath: string;
    sourceFileVersion: string;
    sourceAccessTimestampUtc: string;
    runtimeFetch: false;
  };
  completedMatchCount: number;
  pendingMatchCount: number;
  completedMatches: OfficialCompletedKnockoutMatchRecord[];
  pendingMatches: OfficialPendingKnockoutMatchRecord[];
  resultChecksum: string;
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

export interface OfficialKnockoutStatusMatch {
  id: string;
  roundLabel: string;
  participantALabel: string;
  participantBLabel: string;
  statusLabel: "Official completed" | "Pending official";
  statusTone: "completed" | "pending";
  scoreLabel: string;
  winnerLabel: string;
}

export interface OfficialKnockoutStatusSummary {
  completedCount: number;
  pendingCount: number;
  totalCount: number;
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
  knockoutStatusSummary: OfficialKnockoutStatusSummary;
  knockoutStatusMatches: OfficialKnockoutStatusMatch[];
  ratingRows: OfficialRatingRow[];
  detailRows: OfficialDetailRow[];
  artifactTraceabilityRows: OfficialArtifactTraceabilityRow[];
  ecuadorGhanaNote: string;
  thirdPlaceGroupKeyLabel: string;
  fairPlayStatusLabel: string;
}

const roundOf32Artifact =
  roundOf32ArtifactJson as OfficialRoundOf32Artifact;
const knockoutResultsArtifact =
  knockoutResultsArtifactJson as OfficialKnockoutResultsArtifact;
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

function formatRound(value: string): string {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatScore(score: OfficialKnockoutResultScore): string {
  const base = `${score.participantAGoals}-${score.participantBGoals}`;
  if (score.decidedBy === "extra_time") {
    return `${base} AET`;
  }
  if (score.decidedBy === "penalties") {
    return `${base} (${score.participantAPenalties}-${score.participantBPenalties} pens)`;
  }
  return base;
}

function pendingParticipantLabel(
  participant: OfficialKnockoutParticipant | undefined,
  unresolvedSlot: string | undefined,
): string {
  return participant?.displayName ?? unresolvedSlot ?? "Unresolved";
}

export function createOfficialKnockoutStatusMatches(input: {
  completedMatches: OfficialCompletedKnockoutMatchRecord[];
  pendingMatches: OfficialPendingKnockoutMatchRecord[];
}): OfficialKnockoutStatusMatch[] {
  const completedRows = input.completedMatches.map((match) => ({
    id: match.matchId,
    roundLabel: formatRound(match.round),
    participantALabel: match.participantA.displayName,
    participantBLabel: match.participantB.displayName,
    statusLabel: "Official completed" as const,
    statusTone: "completed" as const,
    scoreLabel: formatScore(match.score),
    winnerLabel:
      match.winnerId === match.participantA.teamId
        ? match.participantA.displayName
        : match.participantB.displayName,
  }));

  const pendingRows = input.pendingMatches.map((match) => ({
    id: match.matchId,
    roundLabel: formatRound(match.round),
    participantALabel: pendingParticipantLabel(
      match.knownParticipants.participantA,
      match.unresolvedParticipantSlots.participantA,
    ),
    participantBLabel: pendingParticipantLabel(
      match.knownParticipants.participantB,
      match.unresolvedParticipantSlots.participantB,
    ),
    statusLabel: "Pending official" as const,
    statusTone: "pending" as const,
    scoreLabel: "No official score",
    winnerLabel: "Not official",
  }));

  return [...completedRows, ...pendingRows].sort(
    (left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)),
  );
}

const knockoutStatusMatches = createOfficialKnockoutStatusMatches({
  completedMatches: knockoutResultsArtifact.completedMatches,
  pendingMatches: knockoutResultsArtifact.pendingMatches,
});

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
  knockoutStatusSummary: {
    completedCount: knockoutResultsArtifact.completedMatchCount,
    pendingCount: knockoutResultsArtifact.pendingMatchCount,
    totalCount:
      knockoutResultsArtifact.completedMatchCount +
      knockoutResultsArtifact.pendingMatchCount,
  },
  knockoutStatusMatches,
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
      label: "Knockout results",
      value: `${knockoutResultsArtifact.completedMatchCount} official completed; ${knockoutResultsArtifact.pendingMatchCount} pending; checksum ${shortChecksum(
        knockoutResultsArtifact.resultChecksum,
      )}`,
    },
    {
      label: "Knockout source",
      value: `${knockoutResultsArtifact.source.sourcePath}; accessed ${knockoutResultsArtifact.source.sourceAccessTimestampUtc}; runtime fetch ${knockoutResultsArtifact.source.runtimeFetch ? "yes" : "no"}`,
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
      label: "Knockout results",
      artifactVersion: knockoutResultsArtifact.artifactVersion,
      artifactPath:
        "data/world-cup-2026/snapshots/official-2026-current/knockout-results.json",
      checksumLabel: "Knockout-results checksum",
      checksum: knockoutResultsArtifact.resultChecksum,
    },
    {
      label: "Knockout source",
      artifactVersion: knockoutResultsArtifact.source.sourceFileVersion,
      artifactPath: knockoutResultsArtifact.source.sourcePath,
      value: `${knockoutResultsArtifact.source.sourceAccessTimestampUtc}; no runtime fetch`,
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
