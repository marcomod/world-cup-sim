# World Cup 2026 Knockout Rating Refresh

This document defines the offline knockout-stage rating refresh policy. It does
not change active production ratings.

## Policy

- Freeze timing: after the official group stage is complete and the local
  official snapshot has been verified.
- Included matches: completed 2026 group-stage fixtures only.
- Excluded matches: scheduled fixtures, knockout matches, friendlies, qualifying
  matches, and any unverified source rows.
- Update order: sequential by FIFA match number.
- Initial ratings: the reviewed World Football Elo development ratings.
- Divisor: `400`.
- K-factor: `20`, matching the existing project sequential-Elo reconstruction
  baseline and selected before any 2026 knockout outcomes as a conservative
  three-match group-stage update.
- Home treatment: neutral-site, no home advantage.
- Regulation/extra-time treatment: group-stage final match score is treated as
  the match outcome. Group-stage extra time is not expected.
- Penalty shootouts: not expected in the group stage; if a future source encodes
  one, the methodology must be reviewed before use.
- Forfeits/abandoned matches: rejected until a source-specific policy is
  documented.
- Missing initial ratings: fail clearly; no fabricated rating is allowed.
- Production divisor: remains `400`. The historical divisor `200` result is not
  adopted by this refresh.

## Artifacts

The report script writes:

- `data/generated/world-cup-2026/knockout-rating-report.json`
- `data/generated/world-cup-2026/knockout-rating-report.md`

These artifacts are generated only from a complete verified official snapshot.
They remain offline and are not imported by the app.

The report covers all 48 teams independently of qualification. Fair-play data is
not needed for this all-team rating update, and the artifact must not be read as
confirmation of the official Round of 32 field.

## Snapshot Format

The versioned rating snapshot format records:

- schema version,
- rating snapshot ID and version,
- linked tournament snapshot ID, version, and checksum,
- model version,
- divisor,
- K-factor,
- one record for each of the 48 teams,
- source references inherited from the tournament snapshot.
- K-factor policy metadata,
- initial-rating source metadata,
- completed match count and fixture range.

Each rating record contains:

- `teamId`,
- `preTournamentRating`,
- `groupStageDelta`,
- `knockoutRating`.

Validation requires exactly 48 unique team IDs, finite ratings, divisor `400`,
K-factor `20`, and arithmetic consistency:

`preTournamentRating + groupStageDelta = knockoutRating`

## Integration Boundary

The server/test-oriented integration point verifies that the rating snapshot
references the exact tournament snapshot checksum. It can then produce the
existing simulator-ready bracket through `buildTournamentState` without changing
simulator logic.

The official snapshot currently returns `official_tie_unresolved`, so official
bracket integration remains blocked. The UI path remains deferred.

The fair-play source-gap review did not produce a new finalized tournament
snapshot. Therefore the existing rating report remains linked to
`official-2026-2026-06-28-r1`, and numeric rating values are unchanged. A new
rating report revision is required only after a verified snapshot revision
changes the tournament snapshot checksum.
