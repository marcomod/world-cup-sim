import { mockTeams } from "@/src/data/mockTeams";
import type { Team, TeamId } from "@/src/lib/simulator/types";
import { createAliasResolver, normalizeAlias, normalizeRawTeamRatingRecords } from "./normalizeTeams";
import { teamAliasEntries } from "./teamAliases";
import {
  DEFAULT_STALE_AFTER_DAYS,
  MAX_SOURCE_ELO,
  MIN_SOURCE_ELO,
  type NormalizedTeamRatingRecord,
  type NormalizeTeamRatingsOptions,
  type NormalizeTeamRatingsResult,
  type RawTeamRatingRecord,
  type TeamAliasEntry,
  type ValidationWarning,
} from "./schemas";

export function normalizeAndValidateTeamRatings(
  rawRecords: RawTeamRatingRecord[],
  options: NormalizeTeamRatingsOptions = {},
): NormalizeTeamRatingsResult {
  const teams = options.teams ?? mockTeams;
  const aliasEntries = options.aliasEntries ?? teamAliasEntries;
  const asOfDate = options.asOfDate ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;

  validateAliasCoverage(teams, aliasEntries);
  validateRawTeamRatingRecords(rawRecords, asOfDate);
  validateDuplicateSourceNames(rawRecords);

  const normalizedRecords = normalizeRawTeamRatingRecords(rawRecords, aliasEntries);

  return validateNormalizedTeamRatings(normalizedRecords, {
    teams,
    asOfDate,
    staleAfterDays,
  });
}

export function validateRawTeamRatingRecords(
  rawRecords: RawTeamRatingRecord[],
  asOfDate: Date = new Date(),
) {
  for (const record of rawRecords) {
    if (!record.sourceName.trim()) {
      throw new Error("Raw rating record has an empty sourceName.");
    }

    validateSourceElo(record.sourceElo, record.sourceName);
    validateSourceDate(record.sourceDate, asOfDate, record.sourceName);
  }
}

export function validateNormalizedTeamRatings(
  records: NormalizedTeamRatingRecord[],
  options: {
    teams?: Team[];
    asOfDate?: Date;
    staleAfterDays?: number;
  } = {},
): NormalizeTeamRatingsResult {
  const teams = options.teams ?? mockTeams;
  const asOfDate = options.asOfDate ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const teamIds = new Set(teams.map((team) => team.id));
  const seenTeamIds = new Set<TeamId>();
  const recordsByTeamId = new Map<TeamId, NormalizedTeamRatingRecord>();
  const warnings: ValidationWarning[] = [];

  for (const record of records) {
    if (!teamIds.has(record.teamId)) {
      throw new Error(`Normalized rating has unknown teamId "${record.teamId}".`);
    }

    if (seenTeamIds.has(record.teamId)) {
      throw new Error(`Duplicate normalized rating for teamId "${record.teamId}".`);
    }

    validateSourceElo(record.overall, record.sourceName);
    const sourceDate = validateSourceDate(record.sourceDate, asOfDate, record.sourceName);
    const staleWarning = getStaleSnapshotWarning(record, sourceDate, asOfDate, staleAfterDays);

    if (staleWarning) {
      warnings.push(staleWarning);
    }

    seenTeamIds.add(record.teamId);
    recordsByTeamId.set(record.teamId, record);
  }

  for (const team of teams) {
    if (!seenTeamIds.has(team.id)) {
      throw new Error(`Missing normalized rating for teamId "${team.id}" (${team.name}).`);
    }
  }

  return {
    records: teams.map((team) => {
      const record = recordsByTeamId.get(team.id);

      if (!record) {
        throw new Error(`Missing normalized rating for teamId "${team.id}" (${team.name}).`);
      }

      return record;
    }),
    warnings,
  };
}

export function validateAliasCoverage(
  teams: Team[] = mockTeams,
  aliasEntries: TeamAliasEntry[] = teamAliasEntries,
) {
  createAliasResolver(aliasEntries);

  const aliasTeamIds = new Set(aliasEntries.map((entry) => entry.teamId));

  for (const team of teams) {
    if (!aliasTeamIds.has(team.id)) {
      throw new Error(`Missing aliases for teamId "${team.id}" (${team.name}).`);
    }
  }
}

function validateDuplicateSourceNames(rawRecords: RawTeamRatingRecord[]) {
  const seenSourceNames = new Set<string>();

  for (const record of rawRecords) {
    const normalizedSourceName = normalizeAlias(record.sourceName);

    if (seenSourceNames.has(normalizedSourceName)) {
      throw new Error(`Duplicate source rating record for sourceName "${record.sourceName}".`);
    }

    seenSourceNames.add(normalizedSourceName);
  }
}

function validateSourceElo(value: number, sourceName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`sourceElo for "${sourceName}" must be finite.`);
  }

  if (value < MIN_SOURCE_ELO || value > MAX_SOURCE_ELO) {
    throw new Error(
      `sourceElo for "${sourceName}" must be between ${MIN_SOURCE_ELO} and ${MAX_SOURCE_ELO}.`,
    );
  }
}

function validateSourceDate(sourceDate: string, asOfDate: Date, sourceName: string): Date {
  if (!isValidIsoDate(sourceDate)) {
    throw new Error(`sourceDate for "${sourceName}" must be a valid ISO date.`);
  }

  const date = parseIsoDate(sourceDate);
  const asOfDay = parseIsoDate(toIsoDate(asOfDate));

  if (date.getTime() > asOfDay.getTime()) {
    throw new Error(`sourceDate for "${sourceName}" cannot be future-dated.`);
  }

  return date;
}

function getStaleSnapshotWarning(
  record: NormalizedTeamRatingRecord,
  sourceDate: Date,
  asOfDate: Date,
  staleAfterDays: number,
): ValidationWarning | null {
  const asOfDay = parseIsoDate(toIsoDate(asOfDate));
  const ageMs = asOfDay.getTime() - sourceDate.getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);

  if (ageDays <= staleAfterDays) {
    return null;
  }

  return {
    code: "STALE_SOURCE_DATE",
    teamId: record.teamId,
    sourceName: record.sourceName,
    message: `sourceDate for "${record.sourceName}" is ${ageDays} days old.`,
  };
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return toIsoDate(parseIsoDate(value)) === value;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
