# Historical Elo Reconstruction

## Purpose

The sequential Elo reconstruction creates offline, leakage-free pre-match
ratings and prediction observations from the validated 1930-2022 World Cup
dataset. It is calibration infrastructure only. The app, active World Football
Elo ratings, simulator, Monte Carlo engine, and production divisor are not
connected to these artifacts.

## Baseline Configuration

| Parameter | Value |
| --- | ---: |
| Initial rating | 1500 |
| K-factor | 20 |
| Elo divisor | 400 |
| Home advantage | 0 |
| Goal-difference multiplier | None |
| Match-importance multiplier | None |
| Rating decay | None |
| Regression to mean | None |

All values remain explicit configuration fields so later comparisons can vary
one assumption at a time without changing the production model.

## Reconstruction Order

The engine copies and sorts normalized matches by date and then stable match ID.
Both keys use JavaScript string code-point comparison rather than locale-aware
collation. The engine does not trust caller order. For every match it:

1. Initializes unseen historical identities at 1500.
2. Records both pre-match ratings.
3. calculates the expected home score.
4. Records the prediction observation.
5. Applies both Elo updates simultaneously from the same pre-match ratings.

Complete kickoff times are unavailable. Stable match ID is therefore a
deterministic same-day fallback, not a claim of exact intra-day chronology.
The current 964-match snapshot has no team appearing more than once on the same
date, so one same-day result cannot affect that team's later prediction that
day. Future datasets must revalidate this invariant. Grouped same-day updates or
verified kickoff times remain future sensitivity work.

## Outcome Policy

- A decisive home win contributes `1` and an away win contributes `0`.
- A draw contributes `0.5`.
- A penalty shootout contributes `0.5` to the Elo update, while its actual
  winner and penalty flag remain in the observation.
- A replay-era `non_decisive` tie contributes `0.5`.

Historical identities are never merged or inherited. Germany, West Germany,
Germany DR, Russia, Soviet Union, Yugoslavia, FR Yugoslavia, Serbia and
Montenegro, Serbia, Czechoslovakia, Czech Republic, Dutch East Indies, and
Zaire keep independent rating states.

## Generated Artifacts

Run:

```bash
npm run calibration:reconstruct-elo
```

The command reads the raw source once, validates and parses those same bytes,
then uses the resulting normalized matches for reconstruction. The checksum in
metadata therefore identifies the bytes used to write:

- `data/generated/calibration/historical-elo/observations.json`
- `data/generated/calibration/historical-elo/final-ratings.json`
- `data/generated/calibration/historical-elo/metadata.json`

Calculations retain full floating-point precision. Generated ratings and
probabilities are rounded to six decimal places only during serialization, and
negative zero is written as zero. Object and array ordering is deterministic.
No current-time timestamp or machine-specific path is emitted.

The expected-score calculation uses a branch-stable form of the standard Elo
formula. If an extreme finite rating difference would saturate floating-point
arithmetic to exactly zero or one, the result is bounded only at
`Number.EPSILON` or `1 - Number.EPSILON`; no model-level probability floor is
applied.

## Limitations And Next Step

This is a baseline reconstruction, not a final calibrated production model.
The current 2026 World Football Elo snapshot is never applied retrospectively.
The deterministic Brier score, log-loss, accuracy, and calibration-bucket
evaluation protocol is documented in `docs/HISTORICAL_EVALUATION.md`. Its
reports remain offline baseline analysis; divisor comparison, same-day
sensitivity, production model selection, and market comparison remain separate
future phases.
