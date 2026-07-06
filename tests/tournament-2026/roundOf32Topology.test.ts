import { describe, expect, it } from "vitest";
import { worldCup2026FormatProvenance } from "@/src/data/world-cup-2026/provenance";
import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import {
  compareCodePoints,
  knockoutTopology,
  validateKnockoutTopologyStructure,
  validateKnockoutTopology,
  validateRoundOf32SlotDefinitions,
} from "@/src/lib/tournament-2026";
import type {
  KnockoutAdvancement,
  KnockoutTopologyMatch,
  RoundOf32SlotDefinition,
} from "@/src/lib/tournament-2026";
import { computeKnockoutTopologyChecksum } from "@/scripts/tournament-2026/knockoutTopologyChecksum";

const officialAdvancements: Record<string, readonly string[]> = {
  m73: ["winner:m90:teamAId"],
  m74: ["winner:m89:teamAId"],
  m75: ["winner:m90:teamBId"],
  m76: ["winner:m91:teamAId"],
  m77: ["winner:m89:teamBId"],
  m78: ["winner:m91:teamBId"],
  m79: ["winner:m92:teamAId"],
  m80: ["winner:m92:teamBId"],
  m81: ["winner:m94:teamAId"],
  m82: ["winner:m94:teamBId"],
  m83: ["winner:m93:teamAId"],
  m84: ["winner:m93:teamBId"],
  m85: ["winner:m96:teamAId"],
  m86: ["winner:m95:teamAId"],
  m87: ["winner:m96:teamBId"],
  m88: ["winner:m95:teamBId"],
  m89: ["winner:m97:teamAId"],
  m90: ["winner:m97:teamBId"],
  m91: ["winner:m99:teamAId"],
  m92: ["winner:m99:teamBId"],
  m93: ["winner:m98:teamAId"],
  m94: ["winner:m98:teamBId"],
  m95: ["winner:m100:teamAId"],
  m96: ["winner:m100:teamBId"],
  m97: ["winner:m101:teamAId"],
  m98: ["winner:m101:teamBId"],
  m99: ["winner:m102:teamAId"],
  m100: ["winner:m102:teamBId"],
  m101: ["loser:m103:teamAId", "winner:m104:teamAId"],
  m102: ["loser:m103:teamBId", "winner:m104:teamBId"],
  m103: [],
  m104: [],
};

const serializeAdvancement = (advancement: KnockoutAdvancement): string =>
  `${advancement.outcome}:${advancement.toMatchId}:${advancement.toSlot}`;

const cloneTopology = (): KnockoutTopologyMatch[] =>
  knockoutTopology.map((match) => ({
    ...match,
    advancements: match.advancements.map((advancement) => ({ ...advancement })),
  }));

const replaceMatch = (
  topology: KnockoutTopologyMatch[],
  matchId: string,
  update: (match: KnockoutTopologyMatch) => KnockoutTopologyMatch,
): KnockoutTopologyMatch[] =>
  topology.map((match) => (match.matchId === matchId ? update(match) : match));

const replaceAdvancement = (
  topology: KnockoutTopologyMatch[],
  matchId: string,
  outcome: KnockoutAdvancement["outcome"],
  update: (advancement: KnockoutAdvancement) => KnockoutAdvancement,
): KnockoutTopologyMatch[] =>
  replaceMatch(topology, matchId, (match) => ({
    ...match,
    advancements: match.advancements.map((advancement) =>
      advancement.outcome === outcome ? update(advancement) : advancement,
    ),
  }));

const expectInvalidTopology = (topology: KnockoutTopologyMatch[], expectedMessage: RegExp): void => {
  expect(() => validateKnockoutTopology(topology)).toThrow(expectedMessage);
};

const expectInvalidStructure = (topology: KnockoutTopologyMatch[], expectedMessage: RegExp): void => {
  expect(() => validateKnockoutTopologyStructure(topology)).toThrow(expectedMessage);
};

const topologyChecksum = (): string => computeKnockoutTopologyChecksum(knockoutTopology);

describe("Round-of-32 topology", () => {
  it("validates the official Round-of-32 slot definitions and knockout topology", () => {
    expect(() => validateKnockoutTopology()).not.toThrow();
    expect(() => validateRoundOf32SlotDefinitions(roundOf32SlotDefinitions)).not.toThrow();
  });

  it("matches the official knockout advancement table exactly", () => {
    expect(knockoutTopology.map((match) => match.matchId)).toEqual(
      Array.from({ length: 32 }, (_, index) => `m${index + 73}`),
    );

    for (const match of knockoutTopology) {
      expect([...match.advancements].map(serializeAdvancement).sort(compareCodePoints)).toEqual(
        [...officialAdvancements[match.matchId]].sort(compareCodePoints),
      );
    }
  });

  it("routes every winner edge to the official parent match (parent = winners of its two children)", () => {
    const officialParentsByChildren: Record<string, readonly [string, string]> = {
      m89: ["m74", "m77"],
      m90: ["m73", "m75"],
      m91: ["m76", "m78"],
      m92: ["m79", "m80"],
      m93: ["m83", "m84"],
      m94: ["m81", "m82"],
      m95: ["m86", "m88"],
      m96: ["m85", "m87"],
      m97: ["m89", "m90"],
      m98: ["m93", "m94"],
      m99: ["m91", "m92"],
      m100: ["m95", "m96"],
      m101: ["m97", "m98"],
      m102: ["m99", "m100"],
      m104: ["m101", "m102"],
    };

    const childrenByParent = new Map<string, { teamAId?: string; teamBId?: string }>();
    for (const match of knockoutTopology) {
      for (const advancement of match.advancements) {
        if (advancement.outcome !== "winner") {
          continue;
        }
        const slots = childrenByParent.get(advancement.toMatchId) ?? {};
        slots[advancement.toSlot] = match.matchId;
        childrenByParent.set(advancement.toMatchId, slots);
      }
    }

    const actualParents = Object.fromEntries(
      [...childrenByParent.entries()].map(([parentId, slots]) => [
        parentId,
        [slots.teamAId, slots.teamBId],
      ]),
    );

    expect(actualParents).toEqual(officialParentsByChildren);
  });

  it("computes the recorded semantic topology checksum", () => {
    expect(topologyChecksum()).toBe(
      worldCup2026FormatProvenance.normalizedLocalRepresentations.knockoutTopologySha256,
    );
  });

  it("keeps topology checksum stable under non-semantic ordering changes", () => {
    const expectedChecksum = topologyChecksum();
    const reversedTopology = cloneTopology().reverse();
    const reversedAdvancements = cloneTopology().map((match) => ({
      ...match,
      advancements: [...match.advancements].reverse(),
    }));
    const reorderedProperties = cloneTopology().map((match) => ({
      championPath: match.championPath,
      advancements: match.advancements.map((advancement) => ({
        toSlot: advancement.toSlot,
        outcome: advancement.outcome,
        toMatchId: advancement.toMatchId,
      })),
      round: match.round,
      matchId: match.matchId,
    })) as KnockoutTopologyMatch[];

    expect(computeKnockoutTopologyChecksum(reversedTopology)).toBe(expectedChecksum);
    expect(computeKnockoutTopologyChecksum(reversedAdvancements)).toBe(expectedChecksum);
    expect(computeKnockoutTopologyChecksum(reorderedProperties)).toBe(expectedChecksum);
  });

  it("changes topology checksum for every semantic field mutation", () => {
    const expectedChecksum = topologyChecksum();
    const mutations: readonly KnockoutTopologyMatch[][] = [
      replaceMatch(cloneTopology(), "m73", (match) => ({ ...match, matchId: "m073" })),
      replaceMatch(cloneTopology(), "m73", (match) => ({ ...match, round: "round_of_16" })),
      replaceMatch(cloneTopology(), "m103", (match) => ({ ...match, championPath: true })),
      replaceAdvancement(cloneTopology(), "m73", "winner", (advancement) => ({
        ...advancement,
        outcome: "loser",
      })),
      replaceAdvancement(cloneTopology(), "m73", "winner", (advancement) => ({
        ...advancement,
        toMatchId: "m89",
      })),
      replaceAdvancement(cloneTopology(), "m73", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      replaceMatch(cloneTopology(), "m73", (match) => ({
        ...match,
        advancements: [...match.advancements, { outcome: "loser", toMatchId: "m103", toSlot: "teamAId" }],
      })),
      replaceMatch(cloneTopology(), "m73", (match) => ({
        ...match,
        advancements: [],
      })),
    ];

    for (const mutatedTopology of mutations) {
      expect(computeKnockoutTopologyChecksum(mutatedTopology)).not.toBe(expectedChecksum);
    }
  });

  it("rejects missing, extra, reordered, and malformed Round-of-32 match IDs", () => {
    expect(() => validateRoundOf32SlotDefinitions(roundOf32SlotDefinitions.slice(1))).toThrow(/16 matches/);

    expect(() =>
      validateRoundOf32SlotDefinitions([
        roundOf32SlotDefinitions[1],
        roundOf32SlotDefinitions[0],
        ...roundOf32SlotDefinitions.slice(2),
      ]),
    ).toThrow(/ordered exactly m73 through m88/);

    expect(() =>
      validateRoundOf32SlotDefinitions([
        { ...roundOf32SlotDefinitions[0], matchId: "m999" },
        ...roundOf32SlotDefinitions.slice(1),
      ]),
    ).toThrow(/ordered exactly/);
  });

  it("rejects mismatched source labels and unsorted third-place eligible groups", () => {
    const badGroupLabel: RoundOf32SlotDefinition[] = [
      {
        ...roundOf32SlotDefinitions[0],
        homeSource: { type: "group_position", group: "A", position: 2, label: "A2" },
      },
      ...roundOf32SlotDefinitions.slice(1),
    ];
    expect(() => validateRoundOf32SlotDefinitions(badGroupLabel)).toThrow(/mismatched source label/);

    const badThirdPlaceLabel: RoundOf32SlotDefinition[] = [
      roundOf32SlotDefinitions[0],
      {
        ...roundOf32SlotDefinitions[1],
        awaySource: {
          type: "third_place",
          assignmentKey: "third_vs_1E",
          label: "3F/D/C/B/A",
          eligibleGroups: ["F", "D", "C", "B", "A"],
        },
      },
      ...roundOf32SlotDefinitions.slice(2),
    ];
    expect(() => validateRoundOf32SlotDefinitions(badThirdPlaceLabel)).toThrow(/must be sorted/);
  });

  it("rejects Round-of-32 links that drift from the canonical source", () => {
    expect(() =>
      validateRoundOf32SlotDefinitions([
        { ...roundOf32SlotDefinitions[0], nextMatchId: "m89" },
        ...roundOf32SlotDefinitions.slice(1),
      ]),
    ).toThrow(/canonical topology/);
  });

  it("rejects missing and extra topology matches", () => {
    expectInvalidTopology(
      cloneTopology().filter((match) => match.matchId !== "m104"),
      /missing match "m104"/,
    );

    expectInvalidTopology(
      [
        ...cloneTopology(),
        { matchId: "m105", round: "final", advancements: [], championPath: false },
      ],
      /unexpected match "m105"/,
    );
  });

  it("rejects wrong round classification", () => {
    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m89", (match) => ({ ...match, round: "round_of_32" })),
      /m89" has incorrect round classification/,
    );
  });

  it("rejects self-links and winner-path cycles", () => {
    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m73", "winner", (advancement) => ({
        ...advancement,
        toMatchId: "m73",
      })),
      /m73" cannot advance to itself/,
    );

    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m90", "winner", (advancement) => ({
        ...advancement,
        toMatchId: "m73",
      })),
      /contains a cycle starting at "m73"/,
    );
  });

  it("structurally rejects champion paths that cannot reach the final", () => {
    const disconnectedPath = replaceMatch(
      cloneTopology(),
      "m101",
      (match) => ({
        ...match,
        advancements: match.advancements.filter((advancement) => advancement.outcome !== "winner"),
      }),
    );

    expectInvalidStructure(disconnectedPath, /Champion path from "m73" does not reach the final/);
  });

  it("structurally rejects the third-place match entering champion progression", () => {
    expectInvalidStructure(
      replaceMatch(cloneTopology(), "m103", (match) => ({ ...match, championPath: true })),
      /Third-place match m103 must not enter champion progression/,
    );
  });

  it("rejects duplicate and missing inbound target slots", () => {
    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m90", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamAId",
      })),
      /target m97:teamAId receives multiple predecessors/,
    );

    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m101", (match) => ({
        ...match,
        advancements: match.advancements.filter((advancement) => advancement.outcome !== "loser"),
      })),
      /target m103:teamAId is missing a predecessor/,
    );
  });

  it("rejects missing semifinal loser advancements", () => {
    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m101", (match) => ({
        ...match,
        advancements: match.advancements.filter((advancement) => advancement.outcome !== "loser"),
      })),
      /target m103:teamAId is missing a predecessor/,
    );

    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m102", (match) => ({
        ...match,
        advancements: match.advancements.filter((advancement) => advancement.outcome !== "loser"),
      })),
      /target m103:teamBId is missing a predecessor/,
    );
  });

  it("rejects both semifinal losers targeting the same m103 slot", () => {
    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m102", "loser", (advancement) => ({
        ...advancement,
        toSlot: "teamAId",
      })),
      /target m103:teamAId receives multiple predecessors/,
    );
  });

  it("rejects swapped m103 and m104 target slots", () => {
    const swappedThirdPlace = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m101", "loser", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m102",
      "loser",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expectInvalidTopology(swappedThirdPlace, /m101" loser advancement targets slot "teamBId"; expected "teamAId"/);

    const swappedFinal = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m101", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m102",
      "winner",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expectInvalidTopology(swappedFinal, /m101" winner advancement targets slot "teamBId"; expected "teamAId"/);
  });

  it("rejects semifinal winner and loser links sent to the wrong terminal match", () => {
    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m101", "winner", (advancement) => ({
        ...advancement,
        toMatchId: "m103",
      })),
      /winner from "m101" must not advance to third-place match m103/,
    );

    expectInvalidTopology(
      replaceAdvancement(cloneTopology(), "m101", "loser", (advancement) => ({
        ...advancement,
        toMatchId: "m104",
      })),
      /loser from "m101" must not advance to final m104/,
    );
  });

  it("rejects officially incorrect Round-of-16, quarterfinal, and semifinal adjacency", () => {
    const swappedRoundOf16 = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m89", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m90",
      "winner",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expectInvalidTopology(swappedRoundOf16, /m89" winner advancement targets slot "teamBId"; expected "teamAId"/);

    const swappedQuarterfinal = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m97", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m98",
      "winner",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expectInvalidTopology(swappedQuarterfinal, /m97" winner advancement targets slot "teamBId"; expected "teamAId"/);

    const swappedSemifinal = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m99", "winner", (advancement) => ({
        ...advancement,
        toMatchId: "m101",
        toSlot: "teamAId",
      })),
      "m97",
      "winner",
      (advancement) => ({ ...advancement, toMatchId: "m102", toSlot: "teamAId" }),
    );

    expectInvalidTopology(swappedSemifinal, /m97" winner advancement targets "m102"; expected "m101"/);
  });

  it("rejects extra loser advancement on a non-semifinal", () => {
    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m97", (match) => ({
        ...match,
        advancements: [...match.advancements, { outcome: "loser", toMatchId: "m103", toSlot: "teamAId" }],
      })),
      /Only semifinal matches may have loser advancement; found "m97"/,
    );
  });

  it("rejects outgoing advancement from terminal matches", () => {
    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m103", (match) => ({
        ...match,
        advancements: [{ outcome: "winner", toMatchId: "m104", toSlot: "teamAId" }],
      })),
      /Terminal knockout match "m103" must not include an advancement link/,
    );

    expectInvalidTopology(
      replaceMatch(cloneTopology(), "m104", (match) => ({
        ...match,
        advancements: [{ outcome: "winner", toMatchId: "m103", toSlot: "teamAId" }],
      })),
      /Terminal knockout match "m104" must not include an advancement link/,
    );
  });

  it("rejects structurally valid but officially incorrect adjacency", () => {
    const structurallyValidDrift = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m93", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m94",
      "winner",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expectInvalidTopology(structurallyValidDrift, /m93" winner advancement targets slot "teamBId"; expected "teamAId"/);
  });

  it("allows structural validation to pass for non-FIFA adjacency that official validation rejects", () => {
    const structurallyValidUnofficial = replaceAdvancement(
      replaceAdvancement(cloneTopology(), "m93", "winner", (advancement) => ({
        ...advancement,
        toSlot: "teamBId",
      })),
      "m94",
      "winner",
      (advancement) => ({ ...advancement, toSlot: "teamAId" }),
    );

    expect(() => validateKnockoutTopologyStructure(structurallyValidUnofficial)).not.toThrow();
    expectInvalidTopology(
      structurallyValidUnofficial,
      /m93" winner advancement targets slot "teamBId"; expected "teamAId"/,
    );
  });

  it("has the expected champion-path topology shape", () => {
    expect(knockoutTopology.filter((match) => match.round === "round_of_32")).toHaveLength(16);
    expect(knockoutTopology.filter((match) => match.round === "round_of_16")).toHaveLength(8);
    expect(knockoutTopology.filter((match) => match.round === "quarterfinal")).toHaveLength(4);
    expect(knockoutTopology.filter((match) => match.round === "semifinal")).toHaveLength(2);
    expect(knockoutTopology.filter((match) => match.round === "third_place")).toHaveLength(1);
    expect(knockoutTopology.filter((match) => match.round === "final")).toHaveLength(1);
    expect(knockoutTopology.filter((match) => match.championPath)).toHaveLength(31);
  });
});
