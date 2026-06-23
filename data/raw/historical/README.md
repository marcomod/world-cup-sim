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

The local development workspace contains the unmodified match file below. It is
ignored by Git and identified by the tracked provenance sidecar.

- `matches_1930_2022.csv`: required match-level source for this pipeline
- `world_cup.csv`: tournament summary data; not consumed initially
- `fifa_ranking_2022-10-06.csv`: 2022 ranking snapshot; not consumed initially

After approval, place the required match file at:

`data/raw/historical/world-cup/matches_1930_2022.csv`

Raw files under `data/raw/historical/world-cup/` are excluded from Git. The
directory placeholder and `matches_1930_2022.provenance.json` are the only
tracked files in that directory. The synthetic test fixture is repository owned and lives separately at
`tests/fixtures/historical/world-cup-matches.synthetic.csv`.

The validated local snapshot contains 964 rows from 1930 through 2022, is
707,938 bytes, and has SHA-256:

`60229eccd1652be38de9e8945696393b89cf3e482ded26cce7a20ed0c4f043ab`

## Source Handling Rules

- Do not invent, repair, reformat, or silently modify raw third-party records.
- Record the actual download/access date and dataset version before use.
- Preserve the original filename and retain a checksum outside generated code.
- Confirm the exact CSV headers and the meaning of match, extra-time, and
  penalty scores before implementing the Kaggle adapter.
- Keep source-specific parsing outside `src/lib/simulator` and runtime UI code.
- Document every field transformation, excluded record, and deliberate alias.

## Confirmed Adapter Boundary

The source-specific loader requires the exact confirmed 44-column header in its
original order. It preserves every source field as a raw string and records the
source row number. Ancillary event fields remain opaque; they are not silently
discarded or interpreted.

The Kaggle adapter then maps source rows into the generic historical pipeline:

1. Parse and preserve the complete Kaggle source row.
2. Validate source scores, dates, rounds, notes, penalties, and aliases.
3. Adapt the source row to `RawHistoricalMatch`.
4. Normalize teams, stages, outcomes, and deterministic match IDs.
5. Retain the source row alongside the normalized match for diagnostics.

The synthetic-v1 parser in `loadHistoricalMatches.ts` remains separate and is
used only by repository-owned tests. `npm run historical:validate` requires the
real file, verifies its checksum against provenance, and never falls back to a
synthetic fixture.

## Historical Semantics

- Group-format draws use `outcomeStatus: "draw"` with no winner.
- Decisive regulation, extra-time, and shootout matches use
  `outcomeStatus: "decisive"`.
- Four tied 1934/1938 knockout rows use `outcomeStatus: "non_decisive"`; no
  replay winner or replay link is invented.
- `First round` and `Second round` in 1974/1978 are mapped to historical group
  phases, not modern knockout rounds.
- The 1950 `Final stage` is represented as a final group stage.
- `Group stage play-off` remains an explicit stage.
- Germany, West Germany, Germany DR, Russia, Soviet Union, Yugoslavia, FR
  Yugoslavia, Serbia and Montenegro, Serbia, Czechoslovakia, Czech Republic,
  and other predecessor/successor identities remain separate.

The source has no reliable neutral-venue flag, source match ID, replay link, or
separate 90-minute score for extra-time matches. The adapter leaves neutral
venue unknown, derives stable IDs from the unique source tuple, and does not
infer the unavailable fields.
