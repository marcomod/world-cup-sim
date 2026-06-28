import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTournamentSnapshot } from "../../src/data/world-cup-2026/snapshots/loadSnapshot.ts";
import { validateKnockoutRatingSnapshot } from "../../src/data/world-cup-2026/ratings/validateRatingSnapshot.ts";
import { buildKnockoutRatingSnapshot } from "../../src/lib/tournament-2026/ratings/buildKnockoutRatingSnapshot.ts";
import { computeKnockoutRatingSnapshotChecksum } from "./knockoutRatingChecksum.ts";
import { OFFICIAL_SNAPSHOT_FILE } from "./officialSnapshotPaths.ts";
import { stableJson } from "./stableJson.ts";

const REPORT_JSON = "data/generated/world-cup-2026/knockout-rating-report.json";
const REPORT_MD = "data/generated/world-cup-2026/knockout-rating-report.md";

function writeFile(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

export function buildKnockoutRatingReport(): { recordCount: number; checksum: string } {
  const tournamentSnapshot = loadTournamentSnapshot(OFFICIAL_SNAPSHOT_FILE);
  const ratingSnapshot = buildKnockoutRatingSnapshot({ tournamentSnapshot });
  const normalized = validateKnockoutRatingSnapshot(ratingSnapshot);
  const checksum = computeKnockoutRatingSnapshotChecksum(ratingSnapshot);
  const records = [...normalized.records];
  const preRank = new Map(records.sort((a, b) => b.preTournamentRating - a.preTournamentRating).map((record, index) => [record.teamId, index + 1]));
  const knockoutRank = new Map(records.sort((a, b) => b.knockoutRating - a.knockoutRating).map((record, index) => [record.teamId, index + 1]));
  const reportRows = normalized.records.map((record) => ({
    teamId: record.teamId,
    preTournamentRating: Number(record.preTournamentRating.toFixed(6)),
    groupStageDelta: Number(record.groupStageDelta.toFixed(6)),
    knockoutRating: Number(record.knockoutRating.toFixed(6)),
    preTournamentRank: preRank.get(record.teamId),
    knockoutRank: knockoutRank.get(record.teamId),
  }));

  const report = {
    generatedFileWarning: "Do not edit manually.",
    ratingSnapshotId: ratingSnapshot.snapshotId,
    ratingSnapshotVersion: ratingSnapshot.snapshotVersion,
    modelVersion: ratingSnapshot.modelVersion,
    tournamentSnapshotId: ratingSnapshot.tournamentSnapshotId,
    tournamentSnapshotVersion: ratingSnapshot.tournamentSnapshotVersion,
    tournamentSnapshotChecksum: ratingSnapshot.tournamentSnapshotChecksum,
    divisor: ratingSnapshot.divisor,
    kFactor: ratingSnapshot.kFactor,
    kFactorPolicy: ratingSnapshot.kFactorPolicy,
    initialRatingSource: ratingSnapshot.initialRatingSource,
    completedMatchCount: ratingSnapshot.completedMatchCount,
    fixtureRangeUsed: ratingSnapshot.fixtureRangeUsed,
    ratingChecksum: checksum,
    outputChecksum: checksum,
    qualificationIndependence:
      "This all-48-team rating report processes completed group-stage results and does not require official fair-play qualification resolution.",
    records: reportRows,
    largestIncreases: [...reportRows].sort((a, b) => b.groupStageDelta - a.groupStageDelta).slice(0, 10),
    largestDecreases: [...reportRows].sort((a, b) => a.groupStageDelta - b.groupStageDelta).slice(0, 10),
  };

  writeFile(REPORT_JSON, stableJson(report));
  writeFile(
    REPORT_MD,
    `# World Cup 2026 Group-Stage Updated Rating Report\n\nGenerated from tournament snapshot \`${ratingSnapshot.tournamentSnapshotId}\` / \`${ratingSnapshot.tournamentSnapshotVersion}\`.\n\n- Tournament snapshot checksum: \`${ratingSnapshot.tournamentSnapshotChecksum}\`\n- Rating snapshot: \`${ratingSnapshot.snapshotId}\` / \`${ratingSnapshot.snapshotVersion}\`\n- Initial rating source: ${ratingSnapshot.initialRatingSource.sourceName} (${ratingSnapshot.initialRatingSource.snapshotLabel}, ${ratingSnapshot.initialRatingSource.snapshotDate})\n- Initial rating checksum: \`${ratingSnapshot.initialRatingSource.inputChecksum}\`\n- Model version: \`${ratingSnapshot.modelVersion}\`\n- Divisor: ${ratingSnapshot.divisor}\n- K-factor: ${ratingSnapshot.kFactor}\n- K-factor policy: \`${ratingSnapshot.kFactorPolicy.policyId}\`\n- K-factor rationale: ${ratingSnapshot.kFactorPolicy.rationale}\n- Matches processed: ${ratingSnapshot.completedMatchCount}\n- Fixture range: ${ratingSnapshot.fixtureRangeUsed.firstFifaMatchNumber}-${ratingSnapshot.fixtureRangeUsed.lastFifaMatchNumber}\n- Rating checksum: \`${checksum}\`\n- Records: ${reportRows.length}\n\nThis report covers all 48 teams independently of official qualification. Fair-play totals are not required for all-team rating updates, and no official Round of 32 is generated here.\n\n| Team | Pre Rating | Delta | Updated Rating | Pre Rank | Updated Rank |\n|---|---:|---:|---:|---:|---:|\n${reportRows.map((record) => `| ${record.teamId} | ${record.preTournamentRating.toFixed(6)} | ${record.groupStageDelta.toFixed(6)} | ${record.knockoutRating.toFixed(6)} | ${record.preTournamentRank} | ${record.knockoutRank} |`).join("\n")}\n`,
  );
  readFileSync(REPORT_JSON, "utf8");
  return { recordCount: reportRows.length, checksum };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildKnockoutRatingReport();
  console.log(`Built knockout rating report: ${result.recordCount} records, checksum ${result.checksum}.`);
}
