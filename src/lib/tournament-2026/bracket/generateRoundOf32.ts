import { compareCodePoints } from "../constants";
import { resolveThirdPlaceAssignments } from "../qualification";
import { validateRoundOf32SlotDefinitions } from "../validateTournament";
import type {
  GeneratedRoundOf32Match,
  GroupId,
  QualificationResult,
  RoundOf32ParticipantSource,
  RoundOf32SlotDefinition,
  TeamId,
} from "../types";

function resolveSource(
  source: RoundOf32ParticipantSource,
  qualification: QualificationResult,
  thirdPlaceAssignments: Readonly<Record<string, GroupId>>,
): TeamId {
  if (source.type === "group_position") {
    return source.position === 1
      ? qualification.groupWinners[source.group].teamId
      : qualification.groupRunnersUp[source.group].teamId;
  }

  const group = thirdPlaceAssignments[source.assignmentKey];
  if (!group) {
    throw new Error(`Missing third-place assignment for slot "${source.assignmentKey}".`);
  }

  if (!source.eligibleGroups.includes(group)) {
    throw new Error(`Third-place Group ${group} is not eligible for slot "${source.assignmentKey}".`);
  }

  const team = qualification.qualifiedThirdPlacedTeams.find((candidate) => candidate.group === group);
  if (!team) {
    throw new Error(`Qualified third-place Group ${group} has no team row.`);
  }

  return team.teamId;
}

export function generateRoundOf32(
  qualification: QualificationResult,
  slotDefinitions: readonly RoundOf32SlotDefinition[],
): readonly GeneratedRoundOf32Match[] {
  validateRoundOf32SlotDefinitions(slotDefinitions);

  const qualifiedThirdGroups = qualification.qualifiedThirdPlacedTeams.map((team) => team.group);
  const assignments = resolveThirdPlaceAssignments(qualifiedThirdGroups, slotDefinitions);
  const assignmentsByKey = Object.fromEntries(
    assignments.map((assignment) => [assignment.assignmentKey, assignment.group]),
  ) as Record<string, GroupId>;

  const matches = slotDefinitions.map((slot) => {
    const homeTeamId = resolveSource(slot.homeSource, qualification, assignmentsByKey);
    const awayTeamId = resolveSource(slot.awaySource, qualification, assignmentsByKey);

    if (homeTeamId === awayTeamId) {
      throw new Error(`Generated Round-of-32 match "${slot.matchId}" has the same team twice.`);
    }

    return {
      matchId: slot.matchId,
      homeTeamId,
      awayTeamId,
      sourceMetadata: {
        homeSource: slot.homeSource,
        awaySource: slot.awaySource,
      },
    };
  });

  if (matches.length !== 16) {
    throw new Error("Round-of-32 generation must produce exactly 16 matches.");
  }

  const teamIds = matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
  const expectedTeamIds = [
    ...Object.values(qualification.groupWinners).map((team) => team.teamId),
    ...Object.values(qualification.groupRunnersUp).map((team) => team.teamId),
    ...qualification.qualifiedThirdPlacedTeams.map((team) => team.teamId),
  ].sort(compareCodePoints);
  const actualTeamIds = [...teamIds].sort(compareCodePoints);

  if (new Set(teamIds).size !== 32) {
    const duplicates = teamIds
      .filter((teamId, index) => teamIds.indexOf(teamId) !== index)
      .sort(compareCodePoints);
    throw new Error(`Round-of-32 generation produced duplicate teams: ${duplicates.join(", ")}.`);
  }

  if (actualTeamIds.join("|") !== expectedTeamIds.join("|")) {
    throw new Error("Round-of-32 generation did not consume exactly the qualified teams.");
  }

  return matches;
}
