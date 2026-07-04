import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stableJson } from "./stableJson.ts";

export function writeJsonAtomically(filePath: string, value: unknown): void {
  const directory = dirname(filePath);
  const tempPath = join(
    directory,
    `.${filePath.slice(filePath.lastIndexOf("/") + 1)}.${process.pid}.${Date.now()}.tmp`,
  );
  const serialized = stableJson(value);

  mkdirSync(directory, { recursive: true });
  try {
    writeFileSync(tempPath, serialized, "utf8");
    renameSync(tempPath, filePath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}
