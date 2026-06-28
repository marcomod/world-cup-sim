# Official 2026 Source Extracts

These files are normalized extracts from one-time inspection of official FIFA
API responses. They are checked in so snapshot construction is deterministic and
does not require runtime or build-time network access.

Files:

- `teams-and-groups.json`
- `group-fixtures.json`
- `fifa-ranking.json`
- `source-manifest.json`

The source manifest records source authority, title, URL, access date,
precise UTC access cutoff, normalization version, local checksums, and
unavailable source notes.

The current access cutoff is `2026-06-28T03:00:00.000Z`. It is distinct from
source publication/update dates and match kickoff times.

Do not replace these files by silently editing generated values. Create a new
snapshot version when official source data or normalization rules change.
