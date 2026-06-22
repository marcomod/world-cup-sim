import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_KAGGLE_MATCH_FILE =
  "data/raw/historical/world-cup/matches_1930_2022.csv";

export async function assertHistoricalSourceReady(
  filePath: string = EXPECTED_KAGGLE_MATCH_FILE,
): Promise<never> {
  const resolvedPath = resolve(filePath);

  try {
    await access(resolvedPath);
  } catch {
    throw new Error(
      `Historical World Cup source file is missing: ${filePath}. After licence and attribution review, place the unmodified Kaggle matches_1930_2022.csv at that path. Synthetic test fixtures are not accepted by historical:validate.`,
    );
  }

  throw new Error(
    `Historical World Cup source file exists at ${filePath}, but the Kaggle adapter is intentionally not implemented until its exact local headers and score semantics are reviewed. Do not parse it with the synthetic-v1 fixture adapter.`,
  );
}

async function main(): Promise<void> {
  await assertHistoricalSourceReady();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Historical validation unavailable: ${message}`);
    process.exitCode = 1;
  });
}
