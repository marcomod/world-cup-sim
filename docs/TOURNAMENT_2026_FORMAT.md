Tournament 2026 Format

Purpose

This document describes the product-side 2026 tournament domain layer. It is
separate from historical calibration and separate from React rendering.

Current Scope

The implementation models:

- 48 tournament teams.
- 12 groups labelled A through L.
- Four teams per group.
- Six fixtures per group and 72 group-stage fixtures total.
- Group standings from completed match results.
- Top-two qualification from each group.
- Ranking of all 12 third-placed teams.
- Selection of the eight best third-placed teams.
- Round-of-32 generation from static slot definitions.
- Adaptation of the generated Round of 32 into the existing knockout simulator
  bracket shape.

It does not fetch live results, simulate group-stage scores, replace the UI
bracket, or change the active rating source.

Group Standings

Completed group matches are scored with:

- Win: 3 points.
- Draw: 1 point.
- Loss: 0 points.

The table tracks played, wins, draws, losses, goals for, goals against, goal
difference, and points. Scheduled matches are ignored for table totals but an
incomplete group stage cannot qualify teams into the knockout bracket.

Tie-Breaking

The implemented ranking pipeline follows article 13 of the FIFA World Cup 26
regulations:

1. Points in all group matches.
2. For teams equal on points, points in matches between the teams concerned.
3. Goal difference in matches between the teams concerned.
4. Goals scored in matches between the teams concerned.
5. If a subset remains tied after one or more teams separate, the
   head-to-head sequence restarts for that remaining subset only.
6. If head-to-head cannot decide the remaining tied teams, overall goal
   difference, overall goals scored, and fair-play conduct score are applied.
7. A deterministic code-point fallback is available only for synthetic
   development fixtures when explicitly requested.

Official mode requires complete fair-play records when fair play is needed.
Missing fair-play data is not treated as zero. Explicit zero deductions are
valid. The development fallback is not an official replacement for FIFA ranking
or other final FIFA decisions.

The current official 2026 source-gap review did not find stable fair-play
deduction totals or disciplinary events for Ecuador and Ghana. Ecuador and Ghana
therefore remain strictly unordered on available official criteria, but both
share third-place rank 3 and both are inside the eight-team qualifying band. The
unresolved strict order does not affect qualification membership, the qualifying
third-place group key `BDEFIJKL`, Annex C assignment, or the official Round of
32. No fair-play totals are fabricated.

Best Third-Placed Teams

The third-place ranking takes exactly the third-placed team from each group and
ranks the 12 candidates by tournament-wide criteria:

1. Points.
2. Goal difference.
3. Goals scored.
4. Fair-play conduct score when needed.
5. Deterministic fallback for synthetic development fixtures only.

Head-to-head criteria are not applied across different groups. Ranks 1 through
8 qualify; ranks 9 through 12 are eliminated.

Round Of 32 Slots

The Round-of-32 slots are encoded as static data in
`src/data/world-cup-2026/roundOf32Slots.ts`. Each slot identifies either a fixed
group winner/runner-up or a third-placed team from an eligible group set.

The fixed Round-of-32 schedule uses FIFA match numbers `m73` through `m88`.
Later simulator matches use FIFA-style progression through the final at `m104`.
The canonical tournament topology also represents the third-place match `m103`.
Semifinal winners from `m101` and `m102` advance to final `m104`; semifinal
losers advance to `m103`. The current simulator adapter remains
champion-path-only and intentionally omits `m103` when converting to the
existing `Match[]` shape.

Third-Place Assignment

The eight qualifying third-place groups must be assigned to the eight
third-place slots using the official combination mapping. The foundation keeps
that mapping versioned in `thirdPlaceAssignmentLookup.ts`.

The current lookup is a static transcription of Annex C in the May 2026 FIFA
regulations and contains all 495 combinations of eight third-placed groups from
A through L. The resolver does not use a greedy or first-valid assignment
fallback; a qualifying combination must be present in the versioned lookup.

Round-of-32 topology is also versioned as canonical static data in
`knockoutTopology.ts`. It stores explicit winner and loser advancement links,
including the semifinal loser links to `m103`. The simulator adapter reads only
winner advancement links from that topology rather than maintaining a separate
champion-path mapping.

Topology validation has two layers. Structural validation checks graph
invariants such as unique match IDs, valid targets, self-links, cycles,
duplicate or missing inbound slots, terminal-match outgoing links, loser
advancement only from semifinals, champion paths reaching `m104`, and `m103`
remaining outside champion progression. Official validation calls the
structural validator first, then compares supplied data against the exact FIFA
adjacency table. Production bracket generation uses official validation;
structural validation exists to make graph guarantees explicit and
independently testable. Regression tests cover both structural failures and
structurally valid but officially incorrect adjacency.

Simulator Adapter

`adaptRoundOf32ToSimulatorBracket` converts generated Round-of-32 matches into
the existing `Match[]` shape used by `simulateBracket`.

The adapter:

- Preserves stable match IDs.
- Creates unresolved later-round matches.
- Uses winner advancement from the canonical tournament topology.
- Omits `m103` because the existing simulator has no third-place-match output
  path.
- Keeps the existing knockout simulation engine unchanged.
- Fails if any qualified team lacks an active rating.
- Does not import React.
- Does not change the production Elo divisor of `400`.

Local Snapshot Ingestion

The tournament layer can now be supplied by a validated local snapshot. Snapshot
files represent teams, group assignments, fixtures, status/results, fair-play
records, FIFA-ranking records, source provenance, and deterministic metadata.
The snapshot loader is Node-only; browser-safe orchestration accepts validated
snapshot objects.

`buildTournamentState` orchestrates one validated snapshot through existing
domain logic: structure validation, group tables, group ranking, third-place
ranking, qualification, Round-of-32 generation, and simulator bracket
adaptation. Incomplete snapshots return group tables only. Complete snapshots
can produce a knockout-ready result when official tie resolution succeeds.

FIFA-ranking records are used only at the documented final tie-break criterion.
Lower numerical rank is better. Official mode does not silently fall back to
team ID ordering.

Data Provenance

The current group and slot data are static data. They are not live fetched or
updated at runtime.

Official FIFA source:

- Title: Regulations for the FIFA World Cup 26
- URL:
  https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
- Document date: May 2026
- Accessed: 2026-06-25
- Annex C: combinations for eight best third-placed teams

Official schedule source:

- Title: FIFA World Cup 26 - Match Schedule
- URL:
  https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule_English.pdf
- Document date: 4 February 2024
- Accessed: 2026-06-25

Normalized local representation:

- Annex C lookup version:
  `fifa-world-cup-26-regulations-annex-c-may-2026`
- Annex C lookup SHA-256:
  `5ae1bcdf6ab46197b269500f3fa968e056d6c1275254ec62740fb0ce9cebd99c`
- Independently extracted Annex C fixture version:
  `annex-c-expected-v1`
- Independently extracted Annex C fixture rows SHA-256:
  `98d8210db1b57ed9837e183e68fc03dc1f3faf2fcc3198e2ac7d341775651e42`
- Knockout topology version:
  `fifa-world-cup-26-knockout-topology-may-2026-v2`
- Knockout topology SHA-256:
  `2f9b0165b349387b3ff989a782de8328d32334c8b735656638f4a3b6558e23df`

The knockout topology checksum is the SHA-256 of the canonical normalized
topology data, not the TypeScript source file. The normalized data includes
match ID, round, champion-path status, advancement outcome, target match, and
target participant slot. Entries are ordered by match ID using code-point
ordering, and each match's advancements are ordered by outcome, target match,
and target slot before stable JSON serialization and UTF-8 SHA-256 hashing.
The checksum is therefore independent of comments, formatting, import order,
file path, filesystem order, object insertion order, and runtime locale.

Secondary cross-check:

- Wikipedia, 2026 FIFA World Cup knockout stage, accessed 2026-06-25.

Synthetic test fixtures are separate from the official source material.

Remaining Work

Before UI integration with official results:

- Add a versioned source adapter for official group-stage results.
- Refresh the World Football Elo rating snapshot after the group stage.
- Replace the demo bracket only after official Round-of-32 qualifiers and
  matchups are confirmed.
