Raw Rating Sources

This directory is reserved for manually obtained, offline rating source snapshots.

`team-elo-fixture.csv` is synthetic fixture data used only to test the rating
pipeline. It is not real Elo data and must not be described as a real source.

Rules:

- Do not add live-fetching scripts here.
- Do not add scraping output without reviewing licensing and attribution.
- Do not assume Kaggle notebook schemas are available locally.
- Commit only source data that is allowed to be stored in this repository.
- Record required provenance before third-party data is committed.

Required provenance:

- source name
- source URL
- retrieval or access date
- snapshot or data date
- license or terms
- required attribution
- redistribution permission or status
- notes about transformations applied before or during ingestion

The first supported raw shape is a team-level Elo-style snapshot with:

- `sourceName`
- `sourceElo`
- `sourceDate`
- optional `sourceNote`

Local `TeamId` values are intentionally not required in raw source records. They are assigned by the pipeline through explicit aliases.

To replace the fixture later, add an approved real snapshot with the same raw
shape, complete the provenance review above, update source notes, and add an
explicit source configuration or CLI argument for the real snapshot. Do not
switch to real data by silently renaming or replacing the fixture file. Fixture
metadata must remain `fixture: true`; approved real data must produce
`fixture: false` metadata after review. Generated files must not be edited
manually.

Supported CSV subset:

- comma-separated fields
- quoted fields
- escaped quotes represented as doubled quotes
- multiline quoted fields are not supported

Blank rows, duplicate headers, malformed quote placement, missing required
values, and out-of-range Elo values are rejected.
