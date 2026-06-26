# Elo Divisor Production Adoption Decision

## Status

Decision: defer production adoption.

Production remains at Elo divisor `400`. Divisor `200` is the leading research
candidate and the frozen historical protocol now supports a formal adoption
review, but this decision record does not authorize a production change.

## Context

The offline historical calibration pipeline compared divisors
`200, 250, 300, 350, 400, 450, 500, 600` using deterministic sequential Elo
reconstruction from the validated 1930-2022 World Cup match dataset. The
production simulator was not changed by that analysis.

The pre-holdout protocol selected divisor `200` from development and validation
only. The 2022 holdout was then opened once under the frozen protocol and
evaluated only against reference divisor `400`.

The final uncertainty layer compares only divisors `200` and `400`:

- Cohort: `knockout_decisive_only`.
- Metrics: Brier score and log loss.
- Delta direction: `200 - 400`.
- Bootstrap: paired match-level percentile bootstrap.
- Replications: `100000`.
- Seed: `2026200400`.
- Splits: development `1930-2006`, validation `2010-2018`, holdout `2022`.

## Evidence Summary

| Split | Scored matches | Brier delta | 95% interval | Log-loss delta | 95% interval |
|---|---:|---:|---:|---:|---:|
| Development | 163 | -0.003277 | -0.008640 to 0.002275 | -0.008064 | -0.020039 to 0.004580 |
| Validation | 38 | -0.019370 | -0.028290 to -0.010311 | -0.044069 | -0.063120 to -0.024670 |
| Holdout | 11 | -0.013225 | -0.027729 to 0.001618 | -0.034032 | -0.067697 to 0.000541 |

Validation favors divisor `200` in all three validation tournaments:

- 2010: Brier delta `-0.012514`.
- 2014: Brier delta `-0.030493`.
- 2018: Brier delta `-0.016248`.

All validation leave-one-tournament-out checks also favor divisor `200`.

The holdout point estimate favors `200`, but the holdout sample is only 11
scored matches and its bootstrap intervals cross zero for both Brier score and
log loss. Development intervals also cross zero. No statistical significance is
claimed.

## Options considered

1. Adopt divisor `200` now.

   Validation and holdout primary Brier results favor `200`, the validation
   uncertainty interval excludes zero, and all three validation tournaments
   favor `200`. Adoption would change all runtime matchup probabilities and
   tournament simulations. The evidence remains limited by sample size, the
   one-tournament holdout, and the fact that `200` was the lower-boundary
   selection.

2. Keep divisor `400` permanently.

   This would preserve current runtime behavior and avoid acting on limited
   evidence. It would also disregard the consistent validation advantage for
   `200`. A permanent rejection of `200` is stronger than the available evidence
   justifies because `200` remains the leading research candidate.

3. Defer production adoption pending stronger evidence.

   This retains production divisor `400`, keeps divisor `200` as the leading
   research candidate, avoids further tuning on the 2022 holdout, and requires
   new evidence or a separately predefined research cycle before adoption. Any
   future production change must be a separate reviewed change.

## Decision

Keep production divisor `400`.

Do not change:

- Runtime simulator behavior.
- Production probability formula.
- Active ratings.
- Bracket data.
- Monte Carlo behavior.
- React UI.

Record divisor `200` as the leading research candidate for a future adoption
review. Any production change requires a separate implementation request and
review that explicitly updates the runtime probability formula and explains user
impact.

## Rationale

- The validation result is directionally strong, including all three validation
  tournaments and leave-one-out checks.
- The holdout point estimate also favors `200`, but the holdout has only 11
  primary scored matches.
- Divisor `200` is the lower boundary of the searched grid, so the apparent
  optimum may be outside the predefined grid.
- The analysis uses a simple baseline sequential Elo reconstruction, not a fully
  calibrated production model with group-stage, market, roster, or injury
  inputs.
- The 2022 holdout has now been opened and must not be reused for additional
  tuning.

## Consequences

- The app remains on divisor `400`.
- Historical calibration artifacts are offline research artifacts only.
- Divisor `200` should be treated as a candidate for human review, not an
  automatic production recommendation.
- Future work may define a new protocol for broader model families, but it must
  not retroactively retune this frozen protocol on the 2022 holdout.

## Artifacts

The decision is supported by deterministic artifacts under:

- `data/generated/calibration/divisor-comparison/`
- `data/generated/calibration/holdout-evaluation/`
- `data/generated/calibration/uncertainty-analysis/`

No artifact uses wall-clock timestamps or machine-specific paths.
