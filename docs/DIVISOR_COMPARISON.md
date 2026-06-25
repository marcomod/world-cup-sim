# Historical Elo Divisor Comparison

## Scope

This is deterministic offline calibration analysis. It compares a fixed Elo
divisor grid without changing the app, active World Football Elo ratings,
production probability formula, or production divisor of `400`.

The fixed candidates are:

```text
200, 250, 300, 350, 400, 450, 500, 600
```

Every candidate reconstructs the same 964 historical matches independently with
initial rating `1500`, K-factor `20`, home advantage `0`, no weighting or decay,
and no historical identity continuity. Only the divisor changes.

## Selection Protocol

The protocol was fixed before opening holdout results:

1. Primary cohort: `knockout_decisive_only`.
2. Primary metric: validation Brier score, ascending.
3. Secondary metric: validation log loss, ascending.
4. Development Brier score, ascending.
5. Development log loss, ascending.
6. Absolute distance from divisor `400`, ascending.
7. Numeric divisor, ascending.

Ranking uses full-precision in-memory metrics. Generated JSON rounds to six
decimal places only after ranking. Accuracy is reported but never used for
selection. Holdout and full-history metrics are not accepted by the ranking API.

The primary development sample contains 163 scored matches. The validation
sample contains 38 scored matches. The small validation sample means numerical
differences may not be practically meaningful.

## Provisional Results

| Rank | Divisor | Validation Brier | Validation log loss | Development Brier | Development log loss | Brier delta vs 400 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 200 | 0.184883 | 0.553313 | 0.220800 | 0.631204 | -0.019370 |
| 2 | 250 | 0.190928 | 0.567249 | 0.221300 | 0.632658 | -0.013325 |
| 3 | 300 | 0.196111 | 0.579068 | 0.222132 | 0.634731 | -0.008143 |
| 4 | 350 | 0.200510 | 0.589005 | 0.223089 | 0.636996 | -0.003744 |
| 5 | 400 | 0.204254 | 0.597383 | 0.224077 | 0.639269 | 0 |
| 6 | 450 | 0.207462 | 0.604497 | 0.225050 | 0.641467 | 0.003208 |
| 7 | 500 | 0.210234 | 0.610593 | 0.225988 | 0.643556 | 0.005980 |
| 8 | 600 | 0.214770 | 0.620462 | 0.227726 | 0.647369 | 0.010517 |

Divisor `200` is the provisional protocol selection and the lower boundary of
the fixed grid. The underlying optimum may lie below `200`, but this protocol
will not expand the grid after observing validation results. Adding lower values
would be a new tuning decision and requires a separately predefined protocol.
The 38-match primary validation sample is small, and uncertainty analysis remains
future work. This boundary result is not conclusive, final, or sufficient for
production adoption; the production divisor remains `400`.

The divisor `400` candidate uses full-precision reconstruction. The existing
baseline evaluator reads six-decimal serialized observations. Divisor `400`
matches baseline cohort membership, selected/scored counts, and six-decimal
Brier-score, log-loss, mean-prediction, and observed-rate results. Development
accuracy is intentionally pinned to the following expected values:

| Cohort | Comparison development accuracy | Standalone baseline development accuracy |
|---|---:|---:|
| `all_matches` | 0.647913 | 0.651543 |
| `decisive_only` | 0.647913 | 0.651543 |
| `knockout_only` | 0.601227 | 0.607362 |
| `knockout_decisive_only` | 0.601227 | 0.607362 |

The difference is expected because comparison evaluates full-precision
in-memory probabilities while standalone baseline evaluation consumes
six-decimal serialized probabilities. Accuracy classifies predictions at the
exact `0.5` threshold, so rounding can move near-`0.5` predictions across that
threshold. This is not evidence of different cohort membership or different Elo
reconstruction. Brier score and log loss remain the primary ranking metrics;
accuracy is secondary and does not influence divisor ranking.

K-factor tuning, goal-difference weighting, match-importance weighting, identity
continuity, and other model changes require separate predefined protocols. They
are not part of this comparison. Calibration buckets are intentionally omitted
from comparison artifacts to avoid redundant artifact size; the underlying
cohort evaluation remains complete.

## Sealed Holdout

The comparison does not compute or serialize 2022 candidate metrics. Metadata
marks the holdout `sealed_unopened`. Before opening it, commit and review the
candidate grid, selection protocol, generated artifacts, source checksum, and
provisional selection. The holdout should then be evaluated once in a separate
task without changing the protocol.

## Generated Artifacts

Run:

```bash
npm run calibration:compare-divisors
```

The command writes deterministic files under
`data/generated/calibration/divisor-comparison/`:

- `ranking.json`: ordered ranking, deltas, protocol, and provisional decision.
- `candidates.json`: primary and supporting development/validation metrics.
- `metadata.json`: fixed grid, baseline parameters, model versions, checksums,
  serialization policy, and sealed-holdout status.

No raw source rows, full observation arrays, timestamps, machine paths, or
holdout scores are included.
