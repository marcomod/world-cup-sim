# Historical Elo Holdout Evaluation

## Scope

This is the one-time opening of the 2022 holdout for the already fixed
historical Elo divisor-comparison protocol. It is offline calibration analysis
only. It does not change the app, active World Football Elo ratings, simulator,
production probability formula, bracket data, or production divisor of `400`.

The pre-holdout protocol was fixed before this evaluation:

- Selected candidate: divisor `200`.
- Reference candidate: divisor `400`.
- Primary cohort: `knockout_decisive_only`.
- Primary metric: Brier score.
- Secondary metric: log loss.
- Development range: 1930-2006.
- Validation range: 2010-2018.
- Holdout: 2022 only.
- Initial rating: `1500`.
- K-factor: `20`.
- Home advantage: `0`.
- Penalties and replay-era non-decisive ties update as draws.
- No goal-difference multiplier, match-importance multiplier, rating decay,
  regression to the mean, or historical identity continuity.

The divisor grid remains fixed:

```text
200, 250, 300, 350, 400, 450, 500, 600
```

The holdout evaluation does not rerank the grid and does not introduce new
candidate divisors.

## Primary Result

The primary 2022 holdout cohort is `knockout_decisive_only`. It contains 11
selected matches and 11 binary-scored matches.

| Metric | Divisor 200 | Divisor 400 | Delta, 200 - 400 |
|---|---:|---:|---:|
| Brier score | 0.136992 | 0.150217 | -0.013225 |
| Log loss | 0.448079 | 0.482111 | -0.034032 |
| Accuracy | 0.909091 | 0.909091 | 0 |
| Mean predicted probability | 0.627032 | 0.611777 | 0.015255 |
| Observed home-win rate | 0.909091 | 0.909091 | 0 |

Negative Brier and log-loss deltas favor divisor `200`; positive deltas would
favor divisor `400`; zero indicates equality at the reported precision. Under
the frozen primary protocol, this holdout evaluation favors the selected divisor
`200` on Brier score and log loss.

This is one tournament and only 11 primary scored matches. No statistical
significance is claimed. Divisor `200` was also the lower-boundary validation
winner. The follow-up uncertainty analysis is now recorded under
`data/generated/calibration/uncertainty-analysis/` and supports a formal adoption
review, but the production adoption decision still defers any runtime change.
No further tuning may use the 2022 holdout.

## Supporting Diagnostics

Supporting cohorts are descriptive and cannot override the primary result.

| Cohort | Selected | Scored |
|---|---:|---:|
| `all_matches` | 64 | 49 |
| `decisive_only` | 49 | 49 |
| `knockout_only` | 16 | 11 |
| `knockout_decisive_only` | 11 | 11 |

`all_matches` and `decisive_only` slightly favor divisor `400` on Brier score in
this one tournament. The frozen primary cohort still determines the holdout
conclusion; supporting cohorts are not a new selection target. Accuracy remains
secondary throughout.

## Artifacts

Run:

```bash
npm run calibration:evaluate-holdout
```

The command writes deterministic files under
`data/generated/calibration/holdout-evaluation/`:

- `result.json`: frozen protocol, primary comparison, deltas, and descriptive
  conclusion.
- `by-cohort.json`: both candidates and the four holdout cohort diagnostics.
- `metadata.json`: `opened_once_evaluated` status, checksums, fixed parameters,
  model versions, candidate divisors `[200, 400]`, and no-retuning policy.

Artifacts contain no raw source rows, full observation arrays, wall-clock
timestamp, machine-specific path, full-history metrics, or reranking output.

## Production Status

Production remains divisor `400`. Any adoption of divisor `200` would require a
separate explicit production decision. The holdout result must not trigger
automatic production changes, grid expansion, K-factor tuning, home advantage,
weighting, identity continuity, betting-market blending, or further use of 2022
for tuning.

The current production decision is documented in
`docs/decisions/ELO_DIVISOR_PRODUCTION_ADOPTION.md`: keep production divisor
`400`, treat divisor `200` as the leading research candidate, and require a
separate reviewed implementation before any runtime probability change.
