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

Regenerate the current fixture with:

```bash
npm run ratings:generate -- --source fixture
```

To replace the fixture later, add an approved real snapshot with the same raw
shape, complete the provenance review above, update source notes, and add an
explicit source configuration or CLI argument for the real snapshot. Do not
switch to real data by silently renaming or replacing the fixture file. Fixture
metadata must remain `fixture: true`; approved real data must produce
`fixture: false` metadata after review. Generated files must not be edited
manually.

Generic `--source real` mode is intentionally not configured. Approved real
snapshots must use an explicit source ID. Do not use fixture renaming as the
migration path.

The private World Football Elo development snapshot uses:

```bash
npm run ratings:generate -- --source world-football-elo-development
```

That source is a development snapshot from `https://eloratings.net/`, taken
during the ongoing 2026 World Cup group stage. It must be refreshed immediately
after the group stage before final knockout use. Use one project snapshot label
across all rows and do not mix ratings from differently dated pages/files.

For the current World Football Elo development CSV:

- `accessDate` is the local calendar date when the source was retrieved.
- `httpLastModified` preserves the exact HTTP timestamp:
  `Fri, 19 Jun 2026 00:13:16 GMT`.
- `httpLastModifiedLocal` records that timestamp in America/Toronto:
  `2026-06-18T20:13:16-04:00`.
- `sourceDeclaredSnapshotDate` is `null` because the retrieved TSV did not
  declare a distinct ratings date.
- `snapshotDate` is the project's frozen snapshot label, not a claim that World
  Football Elo officially dated the ratings.
- The `sourceDate` value `2026-06-18` in every CSV row is that project frozen
  snapshot label.

The future real snapshot may include all 48 tournament participants. The app
remains knockout-only and will consume only the official 32 qualifiers in the
bracket; this directory must not add group-stage standings, qualification, or
best-third-place logic.

The development export must not be wired into the final app accidentally. After
the post-group-stage refresh, review generated artifacts and make an explicit
app-wiring decision.

Supported CSV subset:

- comma-separated fields
- quoted fields
- escaped quotes represented as doubled quotes
- multiline quoted fields are not supported

Blank rows, duplicate headers, malformed quote placement, missing required
values, and out-of-range Elo values are rejected.
