# Official 2026 Source Extracts

These files are normalized extracts from one-time inspection of official FIFA
API responses. They are checked in so snapshot construction is deterministic and
does not require runtime or build-time network access.

Files:

- `teams-and-groups.json`
- `group-fixtures.json`
- `fifa-ranking.json`
- `fair-play-source-gap.json`
- `source-manifest.json`

The source manifest records source authority, title, URL, access date,
precise UTC access cutoff, normalization version, local checksums, and
unavailable source notes.

The current access cutoff is `2026-06-28T03:00:00.000Z`. It is distinct from
source publication/update dates and match kickoff times.

`fair-play-source-gap.json` records a later fixed fair-play source review at
`2026-06-28T17:05:00.000Z`. It contains exactly seven reviewed FIFA candidates,
each with a stable candidate ID, structured access result, structured
fair-play-evidence result, and source-specific insufficiency reason. The
reviewed official FIFA endpoints did not expose stable disciplinary events,
fair-play deduction totals, or an official third-place ranking with fair-play
tie-break details for Ecuador and Ghana. The full FIFA match-calendar endpoint
does expose populated Round-of-32 participants as a cross-check, but that
listing is not treated as a fair-play source and does not provide the missing
deduction totals. The current qualification decision is still resolved because
Ecuador and Ghana both qualify at shared rank 3; strict ordering is unresolved
but irrelevant to `BDEFIJKL`, Annex C, the Round of 32, and simulator input.
This conclusion is limited to the reviewed candidates and fixed cutoff; future
official evidence can create a new snapshot revision.

Do not replace these files by silently editing generated values. Create a new
snapshot version when official source data or normalization rules change.
