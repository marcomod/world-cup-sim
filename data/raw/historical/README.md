# Historical World Cup Source Data

This directory is reserved for approved, unmodified third-party historical match
files used by offline calibration tooling. Raw historical files are not runtime
application dependencies.

## Intended Dataset

- Dataset: Football - FIFA World Cup, 1930 - 2026
- Creator: Petro Ivaniuk
- Dataset URL: https://www.kaggle.com/datasets/piterfm/fifa-football-world-cup
- Dataset metadata checked: 2026-06-21
- Licence shown by Kaggle metadata: CC BY-NC-SA 4.0
- Attribution: credit Petro Ivaniuk and link to the Kaggle dataset
- Redistribution status: not approved for this repository until the licence,
  attribution, non-commercial, and share-alike obligations have been reviewed

The raw dataset was not downloaded for this pipeline foundation. The metadata
advertises these files:

- `matches_1930_2022.csv`: required match-level source for this pipeline
- `world_cup.csv`: tournament summary data; not consumed initially
- `fifa_ranking_2022-10-06.csv`: 2022 ranking snapshot; not consumed initially

After approval, place the required match file at:

`data/raw/historical/world-cup/matches_1930_2022.csv`

Files under `data/raw/historical/world-cup/` are excluded from Git. Only the
directory placeholder is committed. The synthetic test fixture is repository
owned and lives separately at
`tests/fixtures/historical/world-cup-matches.synthetic.csv`.

## Source Handling Rules

- Do not invent, repair, reformat, or silently modify raw third-party records.
- Record the actual download/access date and dataset version before use.
- Preserve the original filename and retain a checksum outside generated code.
- Confirm the exact CSV headers and the meaning of match, extra-time, and
  penalty scores before implementing the Kaggle adapter.
- Keep source-specific parsing outside `src/lib/simulator` and runtime UI code.
- Document every field transformation, excluded record, and deliberate alias.

The current `loadHistoricalMatches.ts` parser supports only the documented
synthetic-v1 fixture schema. It must not be used to imply that the Kaggle schema
has been confirmed. `npm run historical:validate` fails until the approved file
and a reviewed Kaggle adapter are available; it never falls back to test data.
