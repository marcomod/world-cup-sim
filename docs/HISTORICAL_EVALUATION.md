# Historical Elo Evaluation

## Scope

This evaluation is deterministic, offline calibration analysis. It does not
change the app, active World Football Elo ratings, production probability
formula, or divisor. Results describe the sequential historical Elo baseline;
they are not a production model-selection decision.

## Cohorts

Every result reports explicit `selectedSampleSize` and `scoredSampleSize`
values. `selectedSampleSize` counts records matching the cohort and split;
`scoredSampleSize` counts the decisive non-shootout records passed to binary
metrics. `excludedFromBinaryScoring` reconciles the difference. A zero-scored
result retains `scoredSampleSize: 0` and `metrics: null`; it never fabricates
zero-valued metrics.

A valid empty selection reports zero for selected, scored, and excluded counts
with `metrics: null`. If a cohort selects records but all of them are excluded
from binary scoring, the selected and excluded counts retain those records while
the scored count remains zero and `metrics` remains null. Invalid cohort names,
split names, and malformed source observations still fail validation.

- `all_matches`: selects every match. Binary metrics score only decisive
  non-shootout outcomes.
- `knockout_only`: selects stages classified as knockout by the historical
  pipeline. Binary metrics score only decisive non-shootout outcomes.
- `decisive_only`: selects decisive non-shootout matches.
- `knockout_decisive_only`: selects decisive non-shootout knockout matches.
- `penalties_only`: selects shootouts for descriptive counts. It has no binary
  regulation-style metrics.
- `extra_time_only`: selects source-recorded extra-time matches. Binary metrics
  include only decisive non-shootout outcomes; shootouts and replay ties remain
  descriptive exclusions.

For this evaluation, `group_stage_playoff` is deliberately classified as
knockout. The five historical records were elimination/tiebreak fixtures rather
than ordinary group-table matches and contribute to the full-history knockout
selected count of 251. `final_group_stage`, `first_group_stage`,
`second_group_stage`, and ordinary `group_stage` records are not knockout.

Ordinary draws and replay-era `non_decisive` ties are not binary outcomes.
Shootout winners are preserved in source observations but are not treated as
regulation or extra-time binary wins.

## Splits

- `development`: tournament years 1930 through 2006.
- `validation`: tournament years 2010 through 2018.
- `holdout`: tournament year 2022 only.
- `full_history`: all available tournament years.

The 2022 holdout may be reported but must not be used for tuning, divisor
selection, or model selection.

## Metrics

For binary outcome `y` and predicted home-win probability `p`:

- Brier score: mean of `(p - y) ** 2`.
- Log loss: mean of `-y * log(p) - (1 - y) * log(1 - p)`.
- Accuracy: predicted home win when `p >= 0.5`; exact `0.5` is classified as a
  home win. This arbitrary deterministic tie policy favors the home-labelled
  side at exactly `0.5`.
- Mean predicted probability and observed home-win rate are also reported.

Log-loss probabilities are clipped only to `Number.EPSILON` and
`1 - Number.EPSILON` to avoid undefined logarithms.

Brier score and log loss are the primary proper scoring rules. Accuracy is a
secondary diagnostic and must not determine model selection by itself.

Calibration uses ten fixed buckets: `[0.0, 0.1)`, `[0.1, 0.2)`, through
`[0.9, 1.0]`. Every bucket reports its sample count, mean prediction, observed
home-win rate, and absolute calibration error. Empty buckets remain present
with null aggregate values.

## Generated Reports

Run:

```bash
npm run calibration:evaluate-elo
```

The command reads and checksums the generated sequential Elo observations and
writes:

- `data/generated/calibration/evaluation/summary.json`
- `data/generated/calibration/evaluation/by-cohort.json`
- `data/generated/calibration/evaluation/metadata.json`

Calculations retain full precision. Generated numbers are rounded to six
decimal places, negative zero is normalized to zero, and no wall-clock
timestamp or machine-specific path is emitted.

The public evaluation boundary validates canonical World Cup years, ISO dates,
canonical stages, outcome statuses, teams, winners, probabilities, observed
scores, and boolean extra-time/shootout metadata before split or cohort
selection. Unknown stages fail closed and cannot default into knockout cohorts.

## Remaining Work

The fixed-grid divisor comparison is implemented using development and
validation only. Its protocol and provisional results are documented in
`docs/DIVISOR_COMPARISON.md`. Divisor `200` ranks first on validation Brier score,
but the validation knockout sample contains only 38 scored matches and `200` is
the lower grid boundary. The underlying optimum may lie below `200`, but the grid
will not be expanded after seeing validation results; that would require a new
predefined tuning protocol. Uncertainty analysis remains future work. This is not
a production recommendation, and the production divisor remains `400`.

The 2022 holdout remains sealed and is not computed by the comparison framework.
The next step is to commit and review the protocol, results, and provisional
selection before one separate holdout evaluation. Extra-time, shootout, and
cohort sensitivity remain future analysis.
