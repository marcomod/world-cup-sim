import { compareCodePoints, GROUP_IDS } from "../constants";
import type {
  GroupId,
  RoundOf32SlotDefinition,
  ThirdPlaceSlotId,
  ThirdPlaceSlotAssignment,
} from "../types";
import {
  THIRD_PLACE_ASSIGNMENT_LOOKUP,
  THIRD_PLACE_ASSIGNMENT_METADATA,
} from "../bracket/thirdPlaceAssignmentLookup";

function canonicalGroups(groups: readonly GroupId[]): string {
  return [...groups].sort(compareCodePoints).join("");
}

function getThirdPlaceSlots(slots: readonly RoundOf32SlotDefinition[]) {
  return slots.flatMap((slot) =>
    [slot.homeSource, slot.awaySource].flatMap((source) =>
      source.type === "third_place"
        ? [{ matchId: slot.matchId, source }]
        : [],
    ),
  );
}

export function resolveThirdPlaceAssignments(
  qualifiedThirdPlaceGroups: readonly GroupId[],
  slots: readonly RoundOf32SlotDefinition[],
): readonly ThirdPlaceSlotAssignment[] {
  if (qualifiedThirdPlaceGroups.length !== 8) {
    throw new Error("Third-place assignment requires exactly eight qualified groups.");
  }

  const uniqueGroups = new Set(qualifiedThirdPlaceGroups);
  if (uniqueGroups.size !== qualifiedThirdPlaceGroups.length) {
    throw new Error("Third-place assignment contains duplicate groups.");
  }

  for (const groupId of qualifiedThirdPlaceGroups) {
    if (!GROUP_IDS.includes(groupId)) {
      throw new Error(`Third-place assignment contains invalid group "${groupId}".`);
    }
  }

  const thirdPlaceSlots = getThirdPlaceSlots(slots);
  if (thirdPlaceSlots.length !== 8) {
    throw new Error("Round-of-32 slot definitions must contain exactly eight third-place slots.");
  }

  const sortedGroups = [...qualifiedThirdPlaceGroups].sort(compareCodePoints);
  const key = canonicalGroups(sortedGroups);
  const lookup = THIRD_PLACE_ASSIGNMENT_LOOKUP[key];
  if (!lookup) {
    throw new Error(`Official Annex C third-place slot assignment is missing for groups ${key}.`);
  }

  if (Object.keys(THIRD_PLACE_ASSIGNMENT_LOOKUP).length !== THIRD_PLACE_ASSIGNMENT_METADATA.combinationCount) {
    throw new Error("Official Annex C third-place lookup metadata does not match lookup size.");
  }

  const allowedGroups = new Set(sortedGroups);
  const assignedGroups = new Set<GroupId>();
  const assignedSlots = new Set<ThirdPlaceSlotId>();

  const assignments = Object.entries(lookup).map(([assignmentKey, group]) => {
    const typedKey = assignmentKey as ThirdPlaceSlotId;
    if (!allowedGroups.has(group)) {
      throw new Error(`Official third-place assignment ${assignmentKey} uses non-qualified Group ${group}.`);
    }

    if (assignedGroups.has(group)) {
      throw new Error(`Official third-place assignment for ${key} assigns Group ${group} more than once.`);
    }
    assignedGroups.add(group);

    if (assignedSlots.has(typedKey)) {
      throw new Error(`Official third-place assignment for ${key} fills slot "${assignmentKey}" more than once.`);
    }
    assignedSlots.add(typedKey);

    const slot = thirdPlaceSlots.find((candidate) => candidate.source.assignmentKey === assignmentKey);
    if (!slot) {
      throw new Error(`Official third-place assignment references unknown slot "${assignmentKey}".`);
    }

    if (!slot.source.eligibleGroups.includes(group)) {
      throw new Error(`Official third-place assignment ${assignmentKey} cannot use Group ${group}.`);
    }

    return { assignmentKey: typedKey, group };
  });

  if (assignments.length !== 8 || assignedGroups.size !== 8 || assignedSlots.size !== 8) {
    throw new Error(`Official third-place assignment for ${key} is incomplete.`);
  }

  return assignments.sort((left, right) => compareCodePoints(left.assignmentKey, right.assignmentKey));
}
