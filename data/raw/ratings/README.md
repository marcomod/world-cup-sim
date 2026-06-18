Raw Rating Sources

This directory is reserved for manually obtained, offline rating source snapshots.

Rules:

- Do not add live-fetching scripts here.
- Do not add scraping output without reviewing licensing and attribution.
- Do not assume Kaggle notebook schemas are available locally.
- Commit only source data that is allowed to be stored in this repository.
- Record source date, source name, and attribution notes with every dataset.

The first supported raw shape is a team-level Elo-style snapshot with:

- `sourceName`
- `sourceElo`
- `sourceDate`
- optional `sourceNote`

Local `TeamId` values are intentionally not required in raw source records. They are assigned by the pipeline through explicit aliases.

