import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(dir: string): string[] {
  const root = join(process.cwd(), dir);
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      return filesUnder(join(dir, entry));
    }
    return path;
  });
}

describe("official snapshot runtime isolation", () => {
  it("does not import official snapshot scripts or generated knockout rating reports from runtime app paths", () => {
    const runtimeFiles = [
      ...filesUnder("app"),
      ...filesUnder("src/components"),
      ...filesUnder("src/lib/simulator"),
      join(process.cwd(), "src/data/teamRatingsV2.ts"),
    ];

    for (const file of runtimeFiles) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/buildOfficialSnapshot|verifyOfficialSnapshot|buildKnockoutRatings|knockout-rating-report/);
    }
  });
});
