# World Cup 2026 Official Local Snapshot

The official local snapshot lives at:

`data/world-cup-2026/snapshots/official-2026-current/snapshot.json`

It is generated from checked-in normalized FIFA source extracts under:

`data/world-cup-2026/raw/official-2026-current/`

The production app does not fetch these sources at runtime and does not yet
consume this official snapshot.

## Current Snapshot State

The inspected FIFA match-calendar source contains all 72 first-stage fixtures
with official scores. The declared and derived state is:

`group_stage_complete`

The snapshot version is:

`official-2026-2026-06-28-r1`

The access date is a fixed local repository date, `2026-06-28`; it is not a
runtime timestamp. The precise source access cutoff is
`2026-06-28T03:00:00.000Z`, after the latest encoded group fixture kickoff.
This cutoff is distinct from source publication/update dates and match kickoff
times.

The current semantic checksum is:

`1e7d0c321be1905f652d3103baf88b911d327ff4ea02c6ea11fe7f6002a0d8f7`

## Sources

Primary source hierarchy for this snapshot:

1. FIFA match calendar API for first-stage teams, groups, fixtures, and results.
2. FIFA approved men’s ranking API for the ranking tie-break input.
3. FIFA ranking schedule API to identify the approved ranking release.

No Wikipedia, score aggregator, betting, or unofficial API data is used as a
primary source.

Fair-play totals were not available in a stable per-team FIFA source extract.
They are therefore absent rather than fabricated. If qualification reaches a
tie that requires fair play, orchestration must return an unresolved official
tie until a reviewed fair-play source snapshot is added.

A later fixed source-gap review is recorded in
`data/world-cup-2026/raw/official-2026-current/fair-play-source-gap.json` with
access timestamp `2026-06-28T17:05:00.000Z`. The artifact records exactly
seven reviewed FIFA candidates using stable candidate IDs and structured
outcomes for access, fair-play evidence, and source-specific insufficiency. The
reviewed FIFA match-calendar, ranking, ranking-schedule, match-detail,
event-feed, and standings endpoint candidates did not provide stable official
disciplinary events, per-team fair-play deduction totals, or a third-place
ranking table with fair-play tie-break details. The full FIFA match-calendar
endpoint contained populated Round-of-32 participants, but that listing is only
a cross-check while the fair-play values remain unavailable. The conclusion is
bounded to those reviewed sources and cutoff and is not a claim that official
fair-play evidence cannot exist elsewhere or later.

That is the current official orchestration state. The group-stage results
snapshot is complete, but official qualification is unresolved because the
eighth/ninth third-place cutoff requires fair-play data for Ecuador (`ecu`) and
Ghana (`gha`). No official Round of 32 artifact is generated from this snapshot.

## Build And Verify

Build the artifact:

```bash
npm run tournament2026:build-official-snapshot
```

Verify independently:

```bash
npm run tournament2026:verify-official-snapshot
```

The verifier checks team count, official FIFA names, group count, fixture count,
match numbers, independent expected fixture rows, source-manifest checksums,
result consistency, precise access cutoff, derived state, semantic checksum,
current unresolved fair-play readiness, and absence of synthetic source markers.

Verify the documented fair-play source gap:

```bash
npm run tournament2026:verify-fair-play-source-gap
```

This verifier confirms the source review remains unresolved, Ecuador and Ghana
fair-play totals remain missing rather than zero, qualification artifacts are
not generated, and the production divisor remains `400`. It validates exact
candidate identity, structured insufficiency outcomes, bounded conclusion
wording, absence of machine-local paths, and direct absence of official
qualification, Round-of-32, simulator-input, finalized-bracket, and
knockout-ready artifacts. The all-48-team knockout rating report remains
allowed because it is not a qualification artifact.

Source-gap artifacts must not contain machine-local absolute paths. Official
HTTP(S) URLs are allowed, but `file://` URLs, Unix absolute paths, Windows drive
paths, and UNC paths are rejected recursively in source records, metadata, and
conclusion text.

## Versioning

A new snapshot version is required when any of these change:

- fixture result,
- match status,
- fair-play data,
- FIFA-ranking input,
- source correction,
- identity mapping,
- normalization rules.

Released snapshots must not be silently overwritten. The `official-2026-current`
directory is the working pointer for the currently reviewed official snapshot.

## Diffing

Use:

```bash
npm run tournament2026:diff-snapshots -- <left.json> <right.json>
```

The diff reports semantic changes in teams, groups, fixtures, match status,
scores, fair play, ranking, source metadata, normalization version, and checksum.

## Deferred UI Wiring

The official snapshot is not wired into React components or the active demo app.
The demo bracket remains separate. Official bracket UI integration is blocked
until fair-play data or another official source resolves qualification.

Readiness gate for official UI integration:

- verified official snapshot,
- verified fair-play source or another official qualification source with
  sufficient tie-break detail,
- `knockout_ready` official orchestration without development fallback,
- exact official Round of 32 verified,
- rating linkage verified against the finalized snapshot checksum,
- deterministic simulator-input artifact generated.
