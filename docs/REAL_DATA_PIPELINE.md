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

`scripts/ratings-pipeline/generateRatings.ts` intentionally targets
`data/raw/ratings/team-elo-fixture.csv` today. The generated metadata for this
path must remain `fixture: true`. A future approved real-data source should be
selected through an explicit source configuration or CLI argument, not by
silently renaming or replacing the fixture file. Real-data metadata must use
`fixture: false` after provenance and licensing review.

Before replacing the fixture with real third-party data, review licensing and
attribution requirements. Record source name, source URL, retrieval/access date,
snapshot/data date, license or terms, required attribution, redistribution
permission/status, and transformation notes.

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

Generated output order must be deterministic and follow `mockTeams` order.
