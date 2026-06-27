import {
  compareCodePoints,
  GROUP_COUNT,
  GROUP_IDS,
  GROUP_STAGE_MATCHES_PER_GROUP,
  GROUP_STAGE_MATCHES_PER_TEAM,
  ROUND_OF_32_MATCH_COUNT,
  TEAMS_PER_GROUP,
  TOURNAMENT_2026_TEAM_COUNT,
} from "./constants";
import { knockoutTopology } from "./bracket/knockoutTopology";
import type {
  AdvancementOutcome,
  GroupId,
  GroupStageMatch,
  KnockoutAdvancement,
  KnockoutTopologyMatch,
  RoundOf32ParticipantSource,
  RoundOf32SlotDefinition,
  ThirdPlaceSlotId,
  Tournament2026Data,
} from "./types";

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: "${value}".`);
    }
    seen.add(value);
  }
}

function validateParticipantSource(source: RoundOf32ParticipantSource, slotId: string): void {
  if (source.type === "group_position") {
    if (!GROUP_IDS.includes(source.group)) {
      throw new Error(`Round-of-32 slot "${slotId}" references invalid group "${source.group}".`);
    }

    if (source.position !== 1 && source.position !== 2) {
      throw new Error(`Round-of-32 slot "${slotId}" references invalid group position.`);
    }

    if (source.label !== `${source.position}${source.group}`) {
      throw new Error(`Round-of-32 slot "${slotId}" has mismatched source label "${source.label}".`);
    }
    return;
  }

  if (source.eligibleGroups.length === 0) {
    throw new Error(`Round-of-32 slot "${slotId}" has an empty third-place eligible set.`);
  }

  assertUnique([...source.eligibleGroups], `third-place eligible group in slot ${slotId}`);

  const sortedEligibleGroups = [...source.eligibleGroups].sort(compareCodePoints);
  if (source.eligibleGroups.join("") !== sortedEligibleGroups.join("")) {
    throw new Error(`Round-of-32 slot "${slotId}" third-place eligible groups must be sorted.`);
  }

  if (source.label !== `3${source.eligibleGroups.join("/")}`) {
    throw new Error(`Round-of-32 slot "${slotId}" has mismatched third-place label "${source.label}".`);
  }

  for (const groupId of source.eligibleGroups) {
    if (!GROUP_IDS.includes(groupId)) {
      throw new Error(`Round-of-32 slot "${slotId}" references invalid third-place group "${groupId}".`);
    }
  }
}

const expectedRoundOf32Sources: Readonly<Record<string, readonly string[]>> = {
  m73: ["2A", "2B"],
  m74: ["1E", "3A/B/C/D/F"],
  m75: ["1F", "2C"],
  m76: ["1C", "2F"],
  m77: ["1I", "3C/D/F/G/H"],
  m78: ["2E", "2I"],
  m79: ["1A", "3C/E/F/H/I"],
  m80: ["1L", "3E/H/I/J/K"],
  m81: ["1D", "3B/E/F/I/J"],
  m82: ["1G", "3A/E/H/I/J"],
  m83: ["2K", "2L"],
  m84: ["1H", "2J"],
  m85: ["1B", "3E/F/G/I/J"],
  m86: ["1J", "2H"],
  m87: ["1K", "3D/E/I/J/L"],
  m88: ["2D", "2G"],
};

const thirdPlaceSlotIds = new Set<ThirdPlaceSlotId>([
  "third_vs_1A",
  "third_vs_1B",
  "third_vs_1D",
  "third_vs_1E",
  "third_vs_1G",
  "third_vs_1I",
  "third_vs_1K",
  "third_vs_1L",
]);

function getSourceLabel(source: RoundOf32ParticipantSource): string {
  return source.label;
}

function validateFixedQualificationCoverage(slots: readonly RoundOf32SlotDefinition[]): void {
  const fixedSources = slots.flatMap((slot) =>
    [slot.homeSource, slot.awaySource].flatMap((source) =>
      source.type === "group_position" ? [`${source.position}${source.group}`] : [],
    ),
  );
  const thirdPlaceSources = slots.flatMap((slot) =>
    [slot.homeSource, slot.awaySource].filter((source) => source.type === "third_place"),
  );

  const expectedFixedSources = [
    "2A",
    "2B",
    "1E",
    "1F",
    "2C",
    "1C",
    "2F",
    "1I",
    "2E",
    "2I",
    "1A",
    "1L",
    "1D",
    "1G",
    "2K",
    "2L",
    "1H",
    "2J",
    "1B",
    "1J",
    "2H",
    "1K",
    "2D",
    "2G",
  ].sort(compareCodePoints);

  if (fixedSources.sort(compareCodePoints).join("|") !== expectedFixedSources.join("|")) {
    throw new Error("Round-of-32 fixed qualification sources do not match the official slot coverage.");
  }

  if (thirdPlaceSources.length !== 8) {
    throw new Error("Round-of-32 must reserve exactly eight slots for third-place qualifiers.");
  }
}

export function validateKnockoutTopology(topology: readonly KnockoutTopologyMatch[] = knockoutTopology): void {
  validateOfficialKnockoutTopology(topology);
}

export function validateKnockoutTopologyStructure(topology: readonly KnockoutTopologyMatch[]): void {
  const expectedIds = Array.from({ length: 32 }, (_, index) => `m${index + 73}`);
  const actualIds = topology.map((match) => match.matchId);

  assertUnique(actualIds, "knockout topology match ID");

  const actualIdSet = new Set(actualIds);
  const expectedIdSet = new Set(expectedIds);
  for (const actualId of actualIds) {
    if (!expectedIdSet.has(actualId)) {
      throw new Error(`Knockout topology contains unexpected match "${actualId}".`);
    }
  }

  for (const expectedId of expectedIds) {
    if (!actualIdSet.has(expectedId)) {
      throw new Error(`Knockout topology is missing match "${expectedId}".`);
    }
  }

  if (topology.length !== expectedIds.length) {
    throw new Error(`Knockout topology must contain exactly ${expectedIds.length} matches.`);
  }

  if (actualIds.join("|") !== expectedIds.join("|")) {
    throw new Error("Knockout topology match IDs must be ordered exactly m73 through m104.");
  }

  const byId = new Map(topology.map((match) => [match.matchId, match]));
  const inbound = new Map<string, string[]>();
  const finalMatch = byId.get("m104");
  const thirdPlaceMatch = byId.get("m103");

  if (finalMatch?.round !== "final") {
    throw new Error('Knockout topology match "m104" must be the final.');
  }

  if (thirdPlaceMatch?.round !== "third_place") {
    throw new Error('Knockout topology match "m103" must be the third-place match.');
  }

  if (!finalMatch.championPath) {
    throw new Error("Final match m104 must be marked as champion-path.");
  }

  if (thirdPlaceMatch.championPath) {
    throw new Error("Third-place match m103 must not enter champion progression.");
  }

  for (const match of topology) {
    if ((match.round === "final" || match.round === "third_place") && match.advancements.length > 0) {
      throw new Error(`Terminal knockout match "${match.matchId}" must not include an advancement link.`);
    }

    const outcomes = new Set<AdvancementOutcome>();
    for (const advancement of match.advancements) {
      if (outcomes.has(advancement.outcome)) {
        throw new Error(`Knockout match "${match.matchId}" has duplicate ${advancement.outcome} advancement.`);
      }
      outcomes.add(advancement.outcome);

      if (advancement.toSlot !== "teamAId" && advancement.toSlot !== "teamBId") {
        throw new Error(
          `Knockout match "${match.matchId}" advances to invalid target slot "${advancement.toSlot}".`,
        );
      }

      if (advancement.toMatchId === match.matchId) {
        throw new Error(`Knockout match "${match.matchId}" cannot advance to itself.`);
      }

      const target = byId.get(advancement.toMatchId);
      if (!target) {
        throw new Error(`Knockout match "${match.matchId}" advances to unknown match "${advancement.toMatchId}".`);
      }

      if (advancement.outcome === "loser" && match.round !== "semifinal") {
        throw new Error(`Only semifinal matches may have loser advancement; found "${match.matchId}".`);
      }

      const key = `${advancement.toMatchId}:${advancement.toSlot}`;
      inbound.set(key, [...(inbound.get(key) ?? []), `${match.matchId}:${advancement.outcome}`]);
    }
  }

  for (const semifinalId of ["m101", "m102"]) {
    const semifinal = byId.get(semifinalId);
    const winnerAdvancement = semifinal?.advancements.find((advancement) => advancement.outcome === "winner");
    const loserAdvancement = semifinal?.advancements.find((advancement) => advancement.outcome === "loser");

    if (winnerAdvancement?.toMatchId === "m103") {
      throw new Error(`Semifinal winner from "${semifinalId}" must not advance to third-place match m103.`);
    }

    if (loserAdvancement?.toMatchId === "m104") {
      throw new Error(`Semifinal loser from "${semifinalId}" must not advance to final m104.`);
    }
  }

  for (const match of topology.filter((candidate) => candidate.championPath)) {
    let current = match;
    const seen = new Set<string>();
    let winnerAdvancement = current.advancements.find((advancement) => advancement.outcome === "winner");
    while (winnerAdvancement) {
      if (seen.has(current.matchId)) {
        throw new Error(`Knockout topology contains a cycle starting at "${match.matchId}".`);
      }
      seen.add(current.matchId);
      const next = byId.get(winnerAdvancement.toMatchId);
      if (!next) {
        throw new Error(`Knockout path from "${match.matchId}" reaches an unknown match.`);
      }
      current = next;
      winnerAdvancement = current.advancements.find((advancement) => advancement.outcome === "winner");
    }

    if (current.matchId !== "m104") {
      throw new Error(`Champion path from "${match.matchId}" does not reach the final.`);
    }
  }

  for (const match of topology.filter((candidate) => candidate.round === "third_place")) {
    let current = match;
    const seen = new Set<string>();
    let winnerAdvancement = current.advancements.find((advancement) => advancement.outcome === "winner");
    while (winnerAdvancement) {
      if (seen.has(current.matchId)) {
        throw new Error(`Knockout topology contains a cycle starting at "${match.matchId}".`);
      }
      seen.add(current.matchId);
      const next = byId.get(winnerAdvancement.toMatchId);
      if (!next) {
        throw new Error(`Knockout path from "${match.matchId}" reaches an unknown match.`);
      }
      current = next;
      winnerAdvancement = current.advancements.find((advancement) => advancement.outcome === "winner");
    }

    if (current.matchId === "m104") {
      throw new Error("Third-place match m103 must not enter champion progression.");
    }
  }

  for (const [key, predecessors] of inbound) {
    if (predecessors.length !== 1) {
      throw new Error(`Knockout topology target ${key} receives multiple predecessors.`);
    }
  }

  const championPathMatches = topology.filter((match) => match.championPath);
  if (championPathMatches.length !== 31) {
    throw new Error("Champion-path topology must contain exactly 31 matches.");
  }

  const requiredInbound = [
    ...topology.flatMap((match) =>
      match.round === "round_of_16" ||
      match.round === "quarterfinal" ||
      match.round === "semifinal" ||
      match.round === "third_place" ||
      match.round === "final"
        ? [`${match.matchId}:teamAId`, `${match.matchId}:teamBId`]
        : [],
    ),
  ];
  for (const key of requiredInbound) {
    if (!inbound.has(key)) {
      throw new Error(`Knockout topology target ${key} is missing a predecessor.`);
    }
  }
}

export function validateOfficialKnockoutTopology(
  topology: readonly KnockoutTopologyMatch[] = knockoutTopology,
): void {
  validateKnockoutTopologyStructure(topology);

  const canonicalById = new Map(knockoutTopology.map((match) => [match.matchId, match]));

  const compareAdvancements = (left: KnockoutAdvancement, right: KnockoutAdvancement): number =>
    compareCodePoints(left.outcome, right.outcome) ||
    compareCodePoints(left.toMatchId, right.toMatchId) ||
    compareCodePoints(left.toSlot, right.toSlot);

  const sortedAdvancements = (advancements: readonly KnockoutAdvancement[]) =>
    [...advancements].sort(compareAdvancements);

  for (const match of topology) {
    const canonical = canonicalById.get(match.matchId);
    if (!canonical) {
      throw new Error(`Knockout topology contains unexpected match "${match.matchId}".`);
    }

    if (match.round !== canonical.round) {
      throw new Error(`Knockout match "${match.matchId}" has incorrect round classification.`);
    }

    if (match.championPath !== canonical.championPath) {
      throw new Error(`Knockout match "${match.matchId}" has incorrect champion-path classification.`);
    }

    const actualAdvancements = sortedAdvancements(match.advancements);
    const expectedAdvancements = sortedAdvancements(canonical.advancements);
    if (actualAdvancements.length !== expectedAdvancements.length) {
      throw new Error(
        `Knockout match "${match.matchId}" has ${actualAdvancements.length} advancements; expected ${expectedAdvancements.length}.`,
      );
    }

    for (let index = 0; index < expectedAdvancements.length; index += 1) {
      const actual = actualAdvancements[index];
      const expected = expectedAdvancements[index];

      if (actual.outcome !== expected.outcome) {
        throw new Error(
          `Knockout match "${match.matchId}" advancement ${index} has outcome "${actual.outcome}"; expected "${expected.outcome}".`,
        );
      }

      if (actual.toMatchId !== expected.toMatchId) {
        throw new Error(
          `Knockout match "${match.matchId}" ${actual.outcome} advancement targets "${actual.toMatchId}"; expected "${expected.toMatchId}".`,
        );
      }

      if (actual.toSlot !== expected.toSlot) {
        throw new Error(
          `Knockout match "${match.matchId}" ${actual.outcome} advancement targets slot "${actual.toSlot}"; expected "${expected.toSlot}".`,
        );
      }
    }
  }
}

export function validateGroupStageMatches(
  groupsById: Readonly<Record<GroupId, readonly string[]>>,
  matches: readonly GroupStageMatch[],
): void {
  assertUnique(
    matches.map((match) => match.id),
    "group-stage match ID",
  );

  const fixtureKeys = new Set<string>();
  const teamMatchCounts = new Map<string, number>();
  const groupMatchCounts = new Map<GroupId, number>();

  for (const match of matches) {
    const groupTeams = groupsById[match.group];
    if (!groupTeams) {
      throw new Error(`Group-stage match "${match.id}" references unknown group ${match.group}.`);
    }

    if (match.homeTeamId === match.awayTeamId) {
      throw new Error(`Group-stage match "${match.id}" contains the same team twice.`);
    }

    if (!groupTeams.includes(match.homeTeamId) || !groupTeams.includes(match.awayTeamId)) {
      throw new Error(`Group-stage match "${match.id}" contains a team outside Group ${match.group}.`);
    }

    if (match.status === "scheduled" && match.result) {
      throw new Error(`Scheduled group-stage match "${match.id}" must not include a result.`);
    }

    if (match.status === "completed" && !match.result) {
      throw new Error(`Completed group-stage match "${match.id}" is missing a result.`);
    }

    if (match.result) {
      const goals = [match.result.homeGoals, match.result.awayGoals];
      if (!goals.every((goal) => Number.isInteger(goal) && goal >= 0)) {
        throw new Error(`Group-stage match "${match.id}" has invalid goals.`);
      }
    }

    const sortedTeams = [match.homeTeamId, match.awayTeamId].sort(compareCodePoints);
    const fixtureKey = `${match.group}:${sortedTeams[0]}:${sortedTeams[1]}`;
    if (fixtureKeys.has(fixtureKey)) {
      throw new Error(`Duplicate Group ${match.group} fixture: ${sortedTeams.join(" vs ")}.`);
    }
    fixtureKeys.add(fixtureKey);

    groupMatchCounts.set(match.group, (groupMatchCounts.get(match.group) ?? 0) + 1);
    teamMatchCounts.set(match.homeTeamId, (teamMatchCounts.get(match.homeTeamId) ?? 0) + 1);
    teamMatchCounts.set(match.awayTeamId, (teamMatchCounts.get(match.awayTeamId) ?? 0) + 1);
  }

  for (const groupId of GROUP_IDS) {
    const count = groupMatchCounts.get(groupId) ?? 0;
    if (count !== GROUP_STAGE_MATCHES_PER_GROUP) {
      throw new Error(`Group ${groupId} must contain exactly six fixtures.`);
    }

    for (const teamId of groupsById[groupId]) {
      if ((teamMatchCounts.get(teamId) ?? 0) !== GROUP_STAGE_MATCHES_PER_TEAM) {
        throw new Error(`Team "${teamId}" in Group ${groupId} must have exactly three group matches.`);
      }
    }
  }
}

export function validateTournament2026Data(data: Tournament2026Data): void {
  if (data.groups.length !== GROUP_COUNT) {
    throw new Error(`Tournament data must contain exactly ${GROUP_COUNT} groups.`);
  }

  const groupIds = data.groups.map((group) => group.id);
  if (groupIds.join("") !== GROUP_IDS.join("")) {
    throw new Error("Tournament groups must be ordered exactly A through L.");
  }

  const allTeamIds: string[] = [];
  const groupsById = Object.fromEntries(
    data.groups.map((group) => {
      if (group.teamIds.length !== TEAMS_PER_GROUP) {
        throw new Error(`Group ${group.id} must contain exactly four teams.`);
      }

      assertUnique([...group.teamIds], `team ID in Group ${group.id}`);
      allTeamIds.push(...group.teamIds);

      return [group.id, group.teamIds];
    }),
  ) as Record<GroupId, readonly string[]>;

  if (allTeamIds.length !== TOURNAMENT_2026_TEAM_COUNT) {
    throw new Error(`Tournament data must contain exactly ${TOURNAMENT_2026_TEAM_COUNT} team slots.`);
  }

  assertUnique(allTeamIds, "tournament team ID");
  validateGroupStageMatches(groupsById, data.groupStageMatches);
}

export function validateRoundOf32SlotDefinitions(slots: readonly RoundOf32SlotDefinition[]): void {
  validateKnockoutTopology();

  if (slots.length !== ROUND_OF_32_MATCH_COUNT) {
    throw new Error("Round-of-32 slot data must contain exactly 16 matches.");
  }

  const expectedMatchIds = Array.from({ length: ROUND_OF_32_MATCH_COUNT }, (_, index) => `m${index + 73}`);
  const actualMatchIds = slots.map((slot) => slot.matchId);
  if (actualMatchIds.join("|") !== expectedMatchIds.join("|")) {
    throw new Error("Round-of-32 slots must be ordered exactly m73 through m88.");
  }

  assertUnique(actualMatchIds, "Round-of-32 match ID");

  for (const slot of slots) {
    validateParticipantSource(slot.homeSource, slot.matchId);
    validateParticipantSource(slot.awaySource, slot.matchId);

    const expectedSources = expectedRoundOf32Sources[slot.matchId];
    if (!expectedSources) {
      throw new Error(`Round-of-32 slot "${slot.matchId}" is not an official match ID.`);
    }

    if (
      getSourceLabel(slot.homeSource) !== expectedSources[0] ||
      getSourceLabel(slot.awaySource) !== expectedSources[1]
    ) {
      throw new Error(`Round-of-32 slot "${slot.matchId}" does not match the official participant sources.`);
    }

    const topology = knockoutTopology.find((match) => match.matchId === slot.matchId);
    const winnerAdvancement = topology?.advancements.find((advancement) => advancement.outcome === "winner");
    if (
      !winnerAdvancement ||
      winnerAdvancement.toMatchId !== slot.nextMatchId ||
      winnerAdvancement.toSlot !== slot.nextSlot
    ) {
      throw new Error(`Round-of-32 slot "${slot.matchId}" advancement does not match canonical topology.`);
    }

    for (const source of [slot.homeSource, slot.awaySource]) {
      if (source.type === "third_place" && !thirdPlaceSlotIds.has(source.assignmentKey as ThirdPlaceSlotId)) {
        throw new Error(`Round-of-32 slot "${slot.matchId}" has invalid third-place assignment key.`);
      }
    }
  }

  validateFixedQualificationCoverage(slots);
}
