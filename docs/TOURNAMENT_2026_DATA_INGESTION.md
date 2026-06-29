Tournament 2026 Data Ingestion

Purpose

This document describes the local, versioned snapshot format used to feed the
2026 tournament domain. It is an offline/local file boundary, not a live API
integration.

Scope

The snapshot layer can represent:

- 48 tournament teams.
- Group assignments.
- 72 group-stage fixtures.
- Scheduled or completed fixture status.
- Match results.
- Fair-play card records.
- FIFA-ranking records for the final official tie-break criterion.
- Source provenance.
- Snapshot metadata and deterministic semantic checksums.

It does not fetch live data, schedule jobs, modify the React UI, change active
ratings, or change the production Elo divisor of `400`.

Snapshot Schema

The current schema version is `world-cup-2026-snapshot-v1`.

Each snapshot contains:

- `schemaVersion`
- `snapshotId`
- `snapshotVersion`
- `tournament`
- `state`
- `teams`
- `fixtures`
- `fairPlay`
- `fifaRanking`
- `sources`

Unknown top-level fields are rejected so unstable fields such as execution
timestamps cannot enter the semantic checksum accidentally.

Module Boundaries

`src/data/world-cup-2026/snapshots/index.ts` is the browser-safe snapshot
barrel. It exports types, schema constants, validation, and normalization only.
It must not export modules that import `node:fs`, `node:path`, or
`node:crypto`.

`src/data/world-cup-2026/snapshots/node.ts` is the Node-only entry point. It
exports local filesystem loading and SHA-256 checksum computation. It must not
be imported by client components or browser-bound tournament modules.

Supported States

`structure_only`

- Exactly 48 teams and 72 fixtures are present.
- Every fixture is scheduled.
- No results are required.
- Fair-play and FIFA-ranking records may be absent.
- Standings can be calculated as zero-state tables.
- Qualification is blocked.

`group_stage_in_progress`

- Exactly 48 teams and 72 fixtures are present.
- At least one fixture is completed and at least one is scheduled.
- Completed fixtures require results.
- Scheduled fixtures forbid results.
- Qualification is blocked.

`group_stage_complete`

- All 72 fixtures are completed.
- Every fixture has a result.
- Fair-play and FIFA-ranking data are used only if the relevant official
  tie-break criterion is reached.
- Qualification and Round-of-32 generation may proceed.

The declared state is not trusted. Validation derives the state from fixture
statuses and rejects mismatches.

Validation

Validation checks snapshot identity, team coverage, fixture topology, state
semantics, fair-play records, FIFA-ranking records, and source provenance.

Team validation requires exactly 48 unique teams, unique FIFA codes, all 12
groups A through L, and exactly four teams per group.

Fixture validation requires exactly 72 unique fixtures, unique FIFA match
numbers 1 through 72, six fixtures per group, three fixtures per team, no
self-match, no cross-group fixture, no duplicate fixture regardless of
home/away ordering, valid UTC kickoff timestamps, and valid status/result
combinations.

Fair-play validation checks non-negative card counts and verifies deduction
points from the official card-deduction mapping. Explicit zero deductions are
different from missing records.

FIFA-ranking validation requires positive unique ranks, one ranking date, valid
dates, and known team IDs. Lower numerical rank is better.

Normalization And Checksums

The normalizer is pure and does not mutate input snapshots. It orders:

- teams by group and then stable team ID,
- fixtures by FIFA match number and then ID,
- fair-play records by team ID,
- FIFA-ranking records by team ID,
- source references in fixed key order.

The semantic snapshot checksum is a SHA-256 over canonical normalized JSON and
UTF-8 bytes. It includes schema version, snapshot ID, snapshot version,
tournament ID, derived state, normalized teams, fixtures, fair-play records,
FIFA-ranking records, and source metadata. It excludes file paths, wall-clock
timestamps, JSON whitespace, object insertion order, and raw file formatting.
The checksum intentionally uses the derived state rather than hashing the
redundant declared state. A snapshot whose declared state disagrees with its
fixture-derived state is rejected before checksum calculation.

Loader Boundary

`loadTournamentSnapshot(path)` is exported from the Node-only entry point. It reads a local JSON file once,
parses it once, validates it, normalizes it, and returns typed validated data
plus checksum metadata. Browser-safe tournament code accepts an already loaded
snapshot object and does not import Node filesystem APIs.

FIFA-Ranking Tie-Break Policy

The FIFA-ranking input is represented explicitly as snapshot records and
adapted into tournament-domain ranking options.

The ranking criterion is consulted only after football criteria and fair play
do not resolve a tie. Lower numerical FIFA rank is better. Missing ranking data
fails only when that criterion is reached. Earlier resolved tables do not need
unrelated ranking records.

Development fallback remains explicit and non-official. Official mode does not
fall back to team ID ordering.

Orchestration

`buildTournamentState` converts one validated snapshot into:

1. validated tournament structure,
2. group tables,
3. ranked groups,
4. ranked third-placed teams,
5. qualification result,
6. generated Round of 32,
7. simulator-ready champion-path bracket,
8. auditable snapshot metadata.

Incomplete snapshots return `group_stage_incomplete` with group tables and
counts. They exit before qualification, Annex C assignment, Round-of-32
generation, and simulator-bracket adaptation. Completed snapshots return
`knockout_ready` when official tie
resolution succeeds. If official mode reaches a tie that lacks required
fair-play or FIFA-ranking data, the result is `official_tie_unresolved`.

Synthetic Fixtures

The committed fixtures under
`src/data/world-cup-2026/snapshots/fixtures/` are deterministic synthetic
snapshots for validation and orchestration tests. They are not live tournament
data and are not wired into the UI.

Tests cover non-semantic checksum stability, semantic checksum mutations,
state derivation, team and fixture validation, fair-play records, FIFA-ranking
records, incomplete-state orchestration, and the Node/browser module boundary.

Official Snapshot Status

An official local snapshot now exists under
`data/world-cup-2026/snapshots/official-2026-current/`. It is generated from
checked-in normalized FIFA source extracts and verified by a separate script.
Runtime network calls remain out of scope, and the snapshot is not wired into
the UI yet.

The factual group-stage snapshot is complete, but official qualification is not
currently resolved. The official orchestration status is
`official_tie_unresolved` because Ecuador (`ecu`) and Ghana (`gha`) require
fair-play data at the eighth/ninth third-place cutoff. No official Round of 32
artifact is generated yet.

A fixed fair-play source-gap review is tracked at
`data/world-cup-2026/raw/official-2026-current/fair-play-source-gap.json`. It
records exactly seven official FIFA sources and endpoint candidates searched at
`2026-06-28T17:05:00.000Z`. Each candidate has a stable source ID and structured
access/evidence outcomes. The reviewed sources did not provide stable
disciplinary events, fair-play deduction totals, or a third-place ranking table
with fair-play tie-break details for Ecuador and Ghana. A populated FIFA
Round-of-32 calendar listing was available as a cross-check, but it is not a
substitute for reviewed fair-play deductions when the implementation is
specifically ingesting fair-play data. The verifier checks the exact candidate
manifest and directly verifies that official qualification, Round-of-32, and
simulator-input artifacts remain absent while the source gap is unresolved.

Remaining Work

- Add reviewed official fair-play data or another official qualification source.
- Wire the app to consume a reviewed local snapshot only after official qualification resolves.
- Add live ingestion adapters only after the local snapshot contract is proven.
- Review and, if accepted, wire the generated knockout rating snapshot.
- Replace the demo bracket after official knockout qualifiers are confirmed.
