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
They are therefore absent rather than fabricated. If strict ordering would
affect qualification membership in a future snapshot, orchestration must return
an unresolved official tie until a reviewed fair-play source snapshot is added.
For the current snapshot, Ecuador and Ghana are both inside the qualifying band,
so the missing strict order does not affect qualification membership.

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

That source-gap review remains true for strict Ecuador/Ghana ordering only. The
group-stage results snapshot is complete and official qualification is resolved:
Ecuador (`ecu`) and Ghana (`gha`) share third-place rank 3 on available
criteria, both qualify, and the unresolved strict ordering does not affect
qualification membership, Annex C, or the Round of 32. No fair-play totals are
fabricated.

The finalized artifacts for this snapshot are:

- `data/world-cup-2026/snapshots/official-2026-current/qualification.json`
  with checksum
  `2a4d4864b42c0b52bb49e5a872f2d2292d0d23316f62f49b37d883089e753491`.
- `data/world-cup-2026/snapshots/official-2026-current/round-of-32.json`
  with checksum
  `8fa685fb4b11fe1703c2af7b3d89e53353983779baaf0e3766c65691945d97f7`.
- `data/generated/world-cup-2026/official-rating-linkage.json` with stable
  numeric rating checksum
  `f4c718c8cf2c87beb0eade1268268651eca6cb9712a4ef2ffbfddeebb01d94d5`.
- `data/generated/world-cup-2026/official-simulator-input.json` with checksum
  `d3a981a86c13037061994e700301db835ac2a35c5d251a47fb06cbfa4a0bf477`.
- `data/world-cup-2026/snapshots/official-2026-current/knockout-results.json`
  with checksum
  `ea30bbc73ad102f3e0d6617410369356e0f3e861031b0397b590ed7518c1808f`.

## Official Knockout Results

The editable source for real completed knockout results is:

`data/world-cup-2026/sources/official-knockout-results.json`

This is the only file where future official knockout results should be entered
manually. The generated artifact is:

`data/world-cup-2026/snapshots/official-2026-current/knockout-results.json`

The source file records fixed lineage values for the tournament snapshot,
qualification artifact, Round of 32 artifact, and canonical topology. It also
records a fixed `sourceAccessTimestampUtc` (`2026-07-04T00:00:00Z` in the
initial empty source). Builders do not write current-time timestamps into the
artifact. The artifact records `runtimeFetch: false`; no live API or network
call is used.

To add a completed official result, append one entry to `results` in the source
file:

```json
{
  "matchId": "m73",
  "participantAId": "rsa",
  "participantBId": "can",
  "score": {
    "participantAGoals": 1,
    "participantBGoals": 0,
    "decidedBy": "regular_time"
  },
  "winnerId": "rsa",
  "resultStatus": "official_final",
  "resultSource": "manual-official-knockout-results"
}
```

For extra time use `"decidedBy": "extra_time"`. For penalties, keep match
goals tied and include `participantAPenalties` and `participantBPenalties`.
After editing the source file, run:

```bash
npm run tournament2026:build-knockout-results
npm run tournament2026:verify-knockout-results
```

The builder validates every result before writing the artifact. It rejects
unknown match IDs, non-knockout match IDs, duplicate match results, impossible
score shapes, winners outside the participants, score/winner mismatches,
completed matches whose prerequisite participants are unresolved, participant
mismatches against the official bracket, winner routing that does not match the
canonical topology, stale lineage checksums, current-time-generated artifact
timestamp fields, and non-deterministic ordering. With no result entries, the
artifact remains valid and records all 32 topology matches as pending.

Completed matches are official locks. Pending matches are unresolved official
matches. The mixed official/simulated adapter uses completed official winners
to populate future champion-path slots and simulates only unresolved
champion-path matches. It does not change simulator probability math, active
ratings, calibration artifacts, Annex C values, topology, official group-stage
results, rating values, or the production divisor `400`.

## Build And Verify

Artifact ownership:

- `build-official-snapshot` owns the local official snapshot, checksum,
  provenance, source manifest, and snapshot README. It rebuilds snapshot-owned
  files only, then reconstructs `orchestration-status.json` from validated
  artifact files already on disk.
- `build-qualification` owns finalized qualification and Round-of-32 artifacts.
  It updates those links in `orchestration-status.json` and preserves valid
  rating-linkage and simulator-input links when they already exist.
- `build-simulator-input` owns finalized rating-linkage and simulator-input
  artifacts. It updates those links after validating qualification and
  Round-of-32 linkage.
- `build-knockout-results` owns only the versioned knockout-results artifact.
  It reads the local editable knockout source, Round of 32 artifact, and
  canonical topology. It is intentionally not part of the normal app build or
  finalized-artifacts aggregate command.
- `orchestration-status.json` is a derived index over the current local
  snapshot and any finalized artifacts that exist. Builders may rewrite it, but
  only after validating existing finalized artifact files and reconstructing
  their links. A builder must not downgrade valid links owned by another phase
  to null just because it did not generate those artifacts. If a downstream
  artifact file exists but has stale checksum or broken linkage, the builder
  fails clearly instead of silently erasing the link.

Canonical regeneration:

```bash
npm run tournament2026:build-finalized-artifacts
```

This aggregate command runs snapshot, rating, qualification, and simulator-input
builders in dependency order. The lower-level commands remain useful for focused
work. The builders are order-safe with finalized artifacts already present, so
rerunning `build-official-snapshot` or `build-qualification` after
`build-simulator-input` must preserve the valid rating-linkage and
simulator-input references.

Build only the local official snapshot:

```bash
npm run tournament2026:build-official-snapshot
```

Partial-state behavior is deterministic:

- With no finalized artifacts present, orchestration status records no artifact
  links and `simulatorInputStatus: "not_generated_by_snapshot_builder"`.
- With qualification only, it records the qualification link and marks simulator
  input not generated.
- With qualification and Round of 32, it records both links and marks simulator
  input not generated.
- With qualification, Round of 32, and rating linkage, it records those three
  links and keeps simulator input not generated until the simulator-input file
  exists.
- With all finalized artifacts present, it records qualification, Round of 32,
  rating-linkage, and simulator-input links with their validated checksums.

Absent artifacts are not claimed as generated. Valid generated artifact
references are not erased when present.

Verify independently:

```bash
npm run tournament2026:verify-official-snapshot
```

The verifier checks team count, official FIFA names, group count, fixture count,
match numbers, independent expected fixture rows, source-manifest checksums,
result consistency, precise access cutoff, derived state, semantic checksum,
current qualification readiness, and absence of synthetic source markers.

Verify the documented fair-play source gap:

```bash
npm run tournament2026:verify-fair-play-source-gap
```

This verifier confirms the source review remains unresolved for strict
Ecuador/Ghana ordering, Ecuador and Ghana fair-play totals remain missing rather
than zero, generated artifacts do not fabricate fair-play values, and the
production divisor remains `400`. It validates exact
candidate identity, structured insufficiency outcomes, bounded conclusion
wording, absence of machine-local paths, and direct absence of official
finalized-bracket and knockout-ready legacy artifacts. The all-48-team knockout
rating report remains independent of qualification.

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

## Build Finalized Artifacts

```bash
npm run tournament2026:build-qualification
npm run tournament2026:verify-qualification
npm run tournament2026:build-simulator-input
```

The qualification artifact records 32 unique qualifiers. The qualified
third-placed teams are `cod`, `swe`, `ecu`, `gha`, `bih`, `alg`, `par`, and
`sen`, giving Annex C key `BDEFIJKL`. The eliminated third-placed teams are
`irn`, `kor`, `sco`, and `uru`.

## Deferred UI Wiring

The official snapshot, Round of 32, ratings linkage, simulator input, and
knockout-results status are wired into the official tournament overview. The
overview labels official completed matches, pending official matches, and the
separate simulation sandbox. It never displays fabricated knockout scores.

The demo simulation sandbox remains separate and is labelled as projection
output. Existing sandbox controls continue to use the active production ratings.

Readiness gate for continued official UI integration:

- verified official snapshot,
- `knockout_ready` official orchestration without development fallback,
- exact official Round of 32 verified,
- rating linkage verified against the finalized snapshot checksum,
- deterministic simulator-input artifact generated,
- verified knockout-results artifact with no runtime fetch.
