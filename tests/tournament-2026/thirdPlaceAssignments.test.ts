import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { worldCup2026FormatProvenance } from "@/src/data/world-cup-2026/provenance";
import { roundOf32SlotDefinitions } from "@/src/data/world-cup-2026/roundOf32Slots";
import {
  compareCodePoints,
  GROUP_IDS,
  resolveThirdPlaceAssignments,
  THIRD_PLACE_ASSIGNMENT_LOOKUP,
  THIRD_PLACE_ASSIGNMENT_METADATA,
} from "@/src/lib/tournament-2026";
import type { GroupId, ThirdPlaceAssignment, ThirdPlaceSlotId } from "@/src/lib/tournament-2026";
import { canonicalGroups, combinations } from "./helpers";

interface AnnexCExpectedRow {
  option: number;
  key: string;
  assignments: ThirdPlaceAssignment;
}

interface AnnexCExpectedFixture {
  metadata: {
    rowCount: number;
    fixtureChecksumSha256: string;
  };
  rows: AnnexCExpectedRow[];
}

const thirdPlaceSlots = roundOf32SlotDefinitions.flatMap((slot) =>
  [slot.homeSource, slot.awaySource].flatMap((source) =>
    source.type === "third_place"
      ? [{ assignmentKey: source.assignmentKey as ThirdPlaceSlotId, eligibleGroups: source.eligibleGroups }]
      : [],
  ),
);

const thirdPlaceSlotIds = thirdPlaceSlots.map((slot) => slot.assignmentKey).sort(compareCodePoints);

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort(compareCodePoints)
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const loadExpectedFixture = (): AnnexCExpectedFixture =>
  JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/world-cup-2026/annex-c-expected.json"), "utf8"),
  ) as AnnexCExpectedFixture;

describe("Annex C third-place assignments", () => {
  it("contains exactly 495 official assignment combinations", () => {
    expect(Object.keys(THIRD_PLACE_ASSIGNMENT_LOOKUP)).toHaveLength(495);
    expect(THIRD_PLACE_ASSIGNMENT_METADATA.combinationCount).toBe(495);
  });

  it("matches the independently extracted Annex C fixture row by row", () => {
    const fixture = loadExpectedFixture();
    const fixtureRowsChecksum = sha256(stableStringify(fixture.rows));
    const lookupFileChecksum = sha256(
      readFileSync(join(process.cwd(), "src/lib/tournament-2026/bracket/thirdPlaceAssignmentLookup.ts"), "utf8"),
    );

    expect(fixture.metadata.rowCount).toBe(495);
    expect(fixture.rows).toHaveLength(495);
    expect(fixtureRowsChecksum).toBe(fixture.metadata.fixtureChecksumSha256);
    expect(lookupFileChecksum).toBe(
      worldCup2026FormatProvenance.normalizedLocalRepresentations.annexCLookupSha256,
    );

    for (const row of fixture.rows) {
      expect(row.key).toBe(canonicalGroups(row.key.split("") as GroupId[]));
      expect(THIRD_PLACE_ASSIGNMENT_LOOKUP[row.key]).toEqual(row.assignments);
    }

    expect(Object.keys(THIRD_PLACE_ASSIGNMENT_LOOKUP).sort(compareCodePoints)).toEqual(
      fixture.rows.map((row) => row.key).sort(compareCodePoints),
    );
  });

  it("resolves every eight-group combination and preserves assignment invariants", () => {
    const allCombinations = combinations(GROUP_IDS, 8) as GroupId[][];
    const seenKeys = new Set<string>();

    for (const combo of allCombinations) {
      const key = canonicalGroups(combo);
      seenKeys.add(key);

      const assignments = resolveThirdPlaceAssignments(combo, roundOf32SlotDefinitions);
      const reversed = resolveThirdPlaceAssignments([...combo].reverse(), roundOf32SlotDefinitions);
      const assignedGroups = assignments.map((assignment) => assignment.group).sort(compareCodePoints);
      const assignedSlots = assignments.map((assignment) => assignment.assignmentKey).sort(compareCodePoints);

      expect(reversed).toEqual(assignments);
      expect(assignments).toHaveLength(8);
      expect(assignedGroups).toEqual([...combo].sort(compareCodePoints));
      expect(new Set(assignedGroups).size).toBe(8);
      expect(assignedSlots).toEqual(thirdPlaceSlotIds);
      expect(new Set(assignedSlots).size).toBe(8);

      for (const assignment of assignments) {
        const slot = thirdPlaceSlots.find((candidate) => candidate.assignmentKey === assignment.assignmentKey);
        expect(slot?.eligibleGroups).toContain(assignment.group);
      }
    }

    expect(seenKeys.size).toBe(495);
    expect(new Set(Object.keys(THIRD_PLACE_ASSIGNMENT_LOOKUP)).size).toBe(495);
    expect(Object.keys(THIRD_PLACE_ASSIGNMENT_LOOKUP).sort(compareCodePoints)).toEqual(
      [...seenKeys].sort(compareCodePoints),
    );
  });

  it("rejects malformed qualified third-place group sets", () => {
    expect(() =>
      resolveThirdPlaceAssignments(["A", "B", "C", "D", "E", "F", "G"], roundOf32SlotDefinitions),
    ).toThrow(/exactly eight/);

    expect(() =>
      resolveThirdPlaceAssignments(["A", "B", "C", "D", "E", "F", "G", "H", "I"], roundOf32SlotDefinitions),
    ).toThrow(/exactly eight/);

    expect(() =>
      resolveThirdPlaceAssignments(["A", "A", "C", "D", "E", "F", "G", "H"], roundOf32SlotDefinitions),
    ).toThrow(/duplicate/);

    expect(() =>
      resolveThirdPlaceAssignments(
        ["A", "B", "C", "D", "E", "F", "G", "Z" as GroupId],
        roundOf32SlotDefinitions,
      ),
    ).toThrow(/invalid group/);
  });

  it("does not allow an unqualified group to be substituted into a slot", () => {
    const assignment = resolveThirdPlaceAssignments(
      ["A", "B", "C", "D", "E", "F", "G", "H"],
      roundOf32SlotDefinitions,
    );

    expect(assignment.some((item) => item.group === "I")).toBe(false);
  });

  it("uses code-point canonical ordering for lookup keys", () => {
    expect(canonicalGroups(["L", "A", "C", "B", "K", "J", "I", "H"])).toBe("ABCHIJKL");
  });
});
