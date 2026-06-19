Real Data Pipeline

Purpose

This document describes the offline pipeline boundary for converting external football data into the existing simulator rating contract.

The simulator must continue to consume `RatingsByTeamId` / `TeamRatingV2` only. It must not know about CSV files, Kaggle notebooks, raw data schemas, or source-specific parsing rules.

---

Pipeline Boundary

The intended flow is:

raw external source
-> alias normalization
-> normalized records
-> generated TeamRatingV2 snapshot
-> simulator

Layer responsibilities:

- Raw external source: manually obtained files stored outside runtime simulator code. These files may have source-specific names, columns, and licensing terms.
- Alias normalization: maps source team names to local `TeamId` values using explicit aliases only.
- Normalized records: source-independent records with local team IDs, source names, Elo-style overall ratings, and source dates.
- Generated TeamRatingV2 snapshot: a deterministic generated artifact that matches the current `RatingsByTeamId` contract.
- Simulator: reads typed ratings only and remains independent from ingestion details.

---

Source Rules

- No live fetching.
- No scraping.
- No runtime Kaggle dependency.
- No dependence on Kaggle notebook column names or file names.
- Kaggle notebooks may inform future methodology, but they are not runtime or schema dependencies.
- Raw source licensing and attribution must be reviewed before committing third-party data.

---

Baseline Rating Approach

The first real-data pipeline should use a frozen team-level Elo-style snapshot.

Raw records contain:

- `sourceName`
- `sourceElo`
- `sourceDate`
- optional `sourceNote`

Local `TeamId` values are produced only through explicit alias resolution.

Future `attack`, `defense`, `recentForm`, and `squadStrength` values may initially be Elo-derived compatibility proxies. Those values should be documented as derived proxies, not independent measurements, until separate data sources are added.

The current repository fixture is synthetic data used to exercise the pipeline.
It is not real Elo data and is not wired into the app.

Generated rating files must not be edited manually. They should be recreated
from the approved source snapshot using `npm run ratings:generate`.

`scripts/ratings-pipeline/generateRatings.ts` now requires an explicit source
selection path, with fixture retained as the documented default for local
regeneration:

- `npm run ratings:generate -- --source fixture`
- `npm run ratings:generate -- --source world-football-elo-development`

Fixture mode intentionally targets `data/raw/ratings/team-elo-fixture.csv`. The
generated metadata for this path must remain `fixture: true`.

Generic `--source real` mode is intentionally unconfigured. It must fail clearly
and must not silently fall back to the fixture or validate against the 32-team
demo bracket. Approved real snapshots must be added under an explicit source ID
and selected with that exact ID. The migration must not be done by renaming or
replacing the fixture file. Real-data metadata must use `fixture: false` after
provenance and licensing review.

`world-football-elo-development` is the current private development source. It
uses a single World Football Elo Ratings snapshot from `https://eloratings.net/`
taken during the ongoing 2026 World Cup group stage. It is not final knockout
data. The source must be refreshed immediately after the group stage before the
final knockout app uses it.

For the current World Football Elo development source, the retrieved TSV did not
provide a distinct source-declared ratings date. The pipeline therefore records
separate provenance fields:

- `accessDate`: the local calendar date when the source was retrieved.
- `httpLastModified`: the exact HTTP timestamp, currently
  `Fri, 19 Jun 2026 00:13:16 GMT`.
- `httpLastModifiedLocal`: the same HTTP timestamp interpreted in
  America/Toronto, currently `2026-06-18T20:13:16-04:00`.
- `sourceDeclaredSnapshotDate`: `null` when the dataset does not declare its own
  ratings date.
- `sourceDateBasis`: an explanation that the project snapshot label is based on
  retrieval and HTTP metadata, not a source-declared ratings date.
- `snapshotDate`: the project's frozen snapshot label. For the development CSV,
  `2026-06-18` is a project label used consistently in `sourceDate`, not a claim
  that World Football Elo officially dated the ratings `2026-06-18`.

Before replacing the fixture with real third-party data, review licensing and
attribution requirements. Record source name, source URL, retrieval/access date,
snapshot/data date, license or terms, required attribution, redistribution
permission/status, and transformation notes.

Source configuration requires these core fields:

- `sourceId`
- `sourceFile`
- `fixture`
- `sourceName`
- `sourceUrl`
- `accessDate`
- `snapshotDate`
- `license`
- `attribution`
- `redistributionStatus`
- `transformationNotes`

When HTTP metadata is used as provenance, the source configuration also records:

- `httpLastModified`
- `httpLastModifiedLocal`
- `sourceDeclaredSnapshotDate`, using `null` when the source did not declare one
- `sourceDateBasis`

The first real snapshot may cover all 48 World Cup tournament participants so
ratings are ready before the official knockout qualifiers are known. The app
remains knockout-only: the bracket consumes only the official 32 qualifiers.
Do not add standings, qualification, best-third-place logic, or group-stage
simulation as part of ratings ingestion.

The tournament-team rating registry is stored separately from the existing
32-team demo bracket registry. Rating coverage for all 48 teams does not imply
group-stage simulation. The official bracket should use only the confirmed 32
qualifiers once the group stage is complete.

Approval process for a real snapshot:

1. Choose a frozen source file with the supported raw shape.
2. Complete provenance and licensing review for the exact source.
3. Add a new explicit real source configuration with `fixture: false`.
4. Store the approved CSV at the configured `sourceFile`.
5. Run `npm run ratings:generate -- --source <explicit-source-id>`.
6. Review generated metadata and artifacts before wiring anything into the app.

Development-source refresh procedure:

1. Wait until all group-stage matches are complete.
2. Retrieve one fresh World Football Elo Ratings snapshot from a single source
   page/file.
3. Confirm all 48 tournament teams have ratings from that same snapshot.
4. Replace `data/raw/ratings/world-football-elo-development.csv` with the new
   values and one consistent `sourceDate`. If the source still does not declare
   a ratings date, keep `sourceDeclaredSnapshotDate: null`, update the HTTP
   metadata fields, and document that `sourceDate` is the project snapshot label.
5. Update `data/raw/ratings/world-football-elo-development.provenance.json` and
   the matching source configuration snapshot/access dates.
6. Run `npm run ratings:generate -- --source world-football-elo-development`.
7. Review generated artifacts, then explicitly decide whether to wire the
   generated export into the app. Do not import the development export
   accidentally.

The fixture CSV loader supports a deliberately small CSV subset:

- comma-separated fields
- quoted fields
- escaped quotes represented as doubled quotes
- no multiline quoted fields

Blank rows, duplicate headers, malformed quote placement, missing required
values, and out-of-range Elo values are rejected.

---

Validation Expectations

The pipeline should reject:

- unknown source team names
- conflicting aliases
- missing current simulator teams
- unknown local team IDs
- duplicate source records
- duplicate normalized team IDs
- non-finite or out-of-range Elo values
- invalid source dates
- future-dated source snapshots

Old snapshots may produce warnings or metadata but should not automatically fail.

Generated output order must be deterministic and source-scope dependent:
fixture output follows `mockTeams` order, while World Football Elo development
output follows `tournamentTeams` order.
