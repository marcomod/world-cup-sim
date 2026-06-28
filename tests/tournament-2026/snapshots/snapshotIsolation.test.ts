import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runtimeRoots = ["app", "src/components", "src/lib/simulator"];

function readRuntimeFiles(): string {
  const files = execFileSync("rg", ["--files", ...runtimeRoots], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  return files.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
}

describe("snapshot runtime isolation", () => {
  it("keeps snapshot loading, calibration, and live fetch out of runtime UI and simulator paths", () => {
    const source = readRuntimeFiles();

    expect(source).not.toMatch(/world-cup-2026\/snapshots/);
    expect(source).not.toMatch(/scripts\/calibration|calibration\//);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
