Methodology

Purpose

This document describes the statistical approach used by the World Cup Simulator.

The model is inspired by HockeyStats-style playoff simulators but is adapted for soccer. It is intended to estimate probabilities, not predict exact outcomes.

The simulator begins after the group stage.

⸻

Simulation Pipeline

Team Ratings
↓
Rating-Based Win Probability
↓
Seeded Winner Sampling
↓
Optional Scoreline Simulation
↓
Winner Advances
↓
Monte Carlo Repetition
↓
Tournament Odds

⸻

Current Implementation

The current simulator samples match winners directly from rating-based win probabilities.

For each playable match:

1. The simulator reads each team's overall rating.
2. It converts the rating difference into a win probability.
3. It uses the seedable random number generator to choose a winner.
4. If scorelines are enabled, it generates a plausible scoreline conditioned on the already-sampled winner.
5. The winner advances through the fixed bracket.

Scorelines do not replace winner probabilities yet. They are explanatory simulation output for single-bracket runs.

The current bracket is still a development/demo bracket. Its 32 demo teams are
drawn from the actual 2026 tournament field, but the matchups are not the
official Round of 32 bracket. The bracket should be replaced after the group
stage once the official knockout qualifiers and matchups are known.

⸻

Team Strength

Each team has ratings that describe its quality.

Possible rating components include:

- Overall strength
- Attack
- Defense
- Recent form
- Squad strength
- Penalty ability

The app currently uses a World Football Elo Ratings development snapshot through
the stable `teamRatingsV2ByTeamId` export. The overall rating is the value used
by the current probability model. Attack, defense, recent form, squad strength,
and penalties are Elo-derived compatibility proxies normalized to 0-100 for
documentation and future model extensions.

The active V2 snapshot is not live fetched, scraped at runtime, or automatically
updated. It was captured during the 2026 World Cup group stage and must be
refreshed after the group stage before final knockout use. The official Round of
32 bracket is not loaded yet.

Future versions may incorporate:

- Elo ratings
- Market values
- FIFA rankings
- Historical performance
- Player-level adjustments

⸻

Match Probabilities

Current matchup probabilities are based on rating differences.

Example:

ratingDiff = teamA.overall - teamB.overall;
teamAProbability =
1 / (1 + Math.pow(10, -ratingDiff / 400));
teamBProbability =
1 - teamAProbability;

The divisor is currently `400`, matching the baseline Elo-style logistic curve
used by the simulator.

These are baseline probabilities. They have not yet been historically calibrated
against World Cup knockout results, betting markets, or out-of-sample match
data. Probability sanity tests verify that the current formula behaves
monotonically and produces plausible broad bands for representative matchups,
but they do not prove the model is calibrated.

Future calibration may adjust the divisor or replace this direct rating-gap
mapping with a better validated probability model.

Future versions may derive probabilities directly from repeated simulations.

Historical Calibration

Historical World Cup data is reserved for offline model evaluation. It is not
imported by the app, React components, or runtime simulator, and adding the
historical pipeline does not change the active World Football Elo ratings or the
current divisor of `400`.

The confirmed Kaggle World Cup source adapter validates the unmodified
`matches_1930_2022.csv` snapshot before normalization. All 44 source columns are
preserved for diagnostics even though only match identity, teams, stages,
scores, extra-time notes, and shootout totals feed the normalized record.

Normalized historical outcomes are explicit:

- `decisive` for regulation, extra-time, and penalty-shootout winners.
- `draw` for valid group-format draws.
- `non_decisive` for four tied 1934/1938 knockout records from replay-era
  formats where the source row itself does not identify a winner.

No replay links, neutral-venue values, or 90-minute scores are inferred when the
source does not provide them. Historical predecessor teams retain separate
identities rather than being collapsed into modern successor states.

The first evaluation target is the binary knockout winner probability produced
by the current Elo-difference formula. Group-stage draws are retained in the
normalized historical dataset for data integrity and later analysis, but they
cannot become binary `PredictionObservation` values without a separate draw
model. Initial probability calibration should therefore use decisive knockout
outcomes.

The implemented offline evaluation reports include:

- Brier score for mean squared probability error.
- Log loss for confidence-sensitive probability error.
- Sample size reported with every metric result.
- Explicit cohort and development, validation, holdout, and full-history split
  results.

These deterministic reports are calculated after ingestion and sequential Elo
reconstruction. They remain offline and do not change the production model.

Historical match results alone are not sufficient to calculate these metrics.
Each observation also needs a contemporaneous pre-match rating difference. The
implemented sequential Elo baseline now generates leakage-free pre-match
ratings and observations offline, and Brier score and log-loss evaluation is
implemented for those baseline observations. A fixed-grid divisor comparison is
also implemented using development and validation only. Broader parameter
tuning, model selection, and deliberate production adoption remain future work.
The 2022 holdout has not been used for tuning, and the current 2026 development
snapshot is not applied retrospectively.

Sequential Historical Elo Baseline

The offline calibration pipeline now reconstructs a leakage-free baseline Elo
series sequentially from the normalized 1930-2022 matches. This reconstruction
is not imported by the app and does not change the production probability
formula or its divisor of `400`.

The baseline configuration is explicit:

- Initial rating: `1500` for every historical identity at first appearance.
- K-factor: `20`.
- Elo divisor: `400`.
- Home advantage: `0`.
- No goal-difference, match-importance, decay, or regression adjustment.
- Regulation and extra-time wins use observed scores of `1` or `0`.
- Ordinary draws use `0.5`.
- Penalty shootouts use `0.5` for the rating update while preserving the
  shootout winner in the observation.
- Replay-era `non_decisive` ties use `0.5`.

For each match, the pipeline records both teams' ratings and the expected home
score before applying either update. Both team updates then use those same
pre-match ratings. Later results therefore cannot affect earlier predictions.
The current 2026 World Football Elo snapshot is not used anywhere in this
reconstruction.

Historical identities remain independent. Ratings are not transferred from
West Germany to Germany, Soviet Union to Russia, Yugoslavia to successor teams,
or Czechoslovakia to the Czech Republic. This avoids undocumented continuity
assumptions, though a reviewed continuity policy could be evaluated later.

The source does not provide kickoff times for every match. Matches on the same
date are therefore ordered by stable match ID as a deterministic fallback. This
ordering uses JavaScript string code-point comparison and does not depend on the
runtime locale. No team appears more than once on a date in the current
964-match snapshot, so one same-day result cannot affect that same team's later
prediction that day. Future datasets must revalidate this invariant. A later
sensitivity analysis may still apply same-day updates as a batch or use verified
kickoff-time data.

Generated calibration JSON keeps full floating-point precision during rating
updates, then rounds ratings and probabilities to six decimal places only at
serialization. No wall-clock timestamp is emitted, so identical validated
input and configuration produce byte-stable output. See
`docs/HISTORICAL_ELO_RECONSTRUCTION.md` for the artifact contract.

The offline expected-score implementation evaluates the same Elo formula with a
branch-stable odds calculation. Extreme finite inputs are bounded only at the
machine-safe open interval from `Number.EPSILON` to `1 - Number.EPSILON`, not at
an application-level probability floor.

Extra-time and penalty outcomes will be analysed separately after the baseline
reconstruction is evaluated. Betting-market probabilities are a later optional
comparison layer. Any market inputs must first be converted to no-vig
probabilities, and model/market blending should be considered only after both
inputs have been validated independently.

Historical Evaluation

The offline evaluation layer now reports deterministic Brier score, log loss,
classification accuracy, mean prediction, observed home-win rate, and ten fixed
calibration buckets. It evaluates explicit `development` (1930-2006),
`validation` (2010-2018), `holdout` (2022), and `full_history` splits. The 2022
holdout is report-only and is not used for tuning.

Binary metrics include only decisive non-shootout outcomes. Ordinary draws,
replay-era `non_decisive` ties, and penalty shootouts are not silently converted
to regulation binary targets. Shootouts remain available through a descriptive
`penalties_only` cohort, while extra-time reports distinguish selected matches
from the decisive non-shootout subset that can be binary-scored.

Every generated result exposes both `selectedSampleSize` and
`scoredSampleSize`; descriptive-only results use an explicit scored count of
zero and null metrics. The five historical `group_stage_playoff` tiebreak or
elimination fixtures are deliberately included in knockout cohorts, while
`final_group_stage` and the other group formats are excluded. Canonical stage,
outcome, year, date, team, winner, target, probability, and decision metadata
are validated before cohort classification.

Brier score is the mean squared probability error. Log loss uses natural
logarithms and clips predictions only to `Number.EPSILON` and
`1 - Number.EPSILON`. Accuracy classifies an exact `0.5` prediction as a home
win. Calibration buckets are `[0.0, 0.1)` through `[0.9, 1.0]`; empty buckets
remain explicit.

The exact-`0.5` accuracy rule arbitrarily favors the home-labelled side. Brier
score and log loss are the primary proper scoring rules; accuracy is a secondary
diagnostic and must not determine model selection by itself.

These reports evaluate the baseline but do not establish that the production
model or divisor should change. Cohort definitions, generated artifacts, and
holdout discipline are detailed in `docs/HISTORICAL_EVALUATION.md`.

Historical Divisor Comparison

The offline comparison reconstructs the historical Elo series independently for
the fixed divisor grid `200, 250, 300, 350, 400, 450, 500, 600`. Initial rating
`1500`, K-factor `20`, home advantage `0`, outcome treatment, ordering, and all
other assumptions remain fixed.

Candidates rank by validation Brier score, validation log loss, development
Brier score, development log loss, distance from `400`, and numeric divisor, in
that order. Ranking uses full precision and does not accept holdout or
full-history metrics. Accuracy is descriptive only.

Divisor `200` is the provisional validation selection, but it is the lower grid
boundary and the validation knockout sample contains only 38 scored matches. The
underlying optimum may lie below `200`, but expanding the grid after observing
validation results would be a new tuning decision requiring a separately
predefined protocol. Uncertainty analysis remains future work. The result is not
claimed to be statistically conclusive, final, or production-ready. The
production divisor remains `400`.

Divisor `400` reproduces baseline cohort membership, sample counts, and
six-decimal Brier-score and log-loss results. Mean prediction and observed rate
also agree at that boundary. Threshold accuracy can differ because comparison
uses full-precision probabilities while standalone baseline evaluation consumes
six-decimal serialized probabilities; accuracy does not drive ranking. K-factor,
goal-difference, match-importance, identity-continuity, and other model changes
require separate protocols. Calibration buckets are omitted from comparison
artifacts only to avoid redundant artifact size.

The comparison artifacts do not compute or serialize 2022 metrics and remain the
pre-holdout `sealed_unopened` record. The one-time holdout evaluation has opened
2022 separately under the frozen protocol: selected divisor `200`, reference
divisor `400`, primary cohort `knockout_decisive_only`, and primary metric Brier
score. The 11-match primary holdout sample favors divisor `200` at reported
precision, with Brier delta `-0.013225` and log-loss delta `-0.034032` computed
as `200 - 400`. This is descriptive only, makes no significance claim, does not
permit further tuning on 2022, and does not change production; the production
divisor remains `400`. See `docs/DIVISOR_COMPARISON.md` and
`docs/HOLDOUT_EVALUATION.md` for the complete protocol and results.

⸻

Scoreline Simulation

V3 scoreline simulation estimates scoring strength for each team, then produces a score that matches the already-sampled winner.

Conceptually:

Attack Strength

- Opponent Defense
- Other Factors
  ↓
  Expected Goals

Example:

teamAXG =
baseGoals × attackFactorA × defenseFactorB
teamBXG =
baseGoals × attackFactorB × defenseFactorA

Guidelines:

- Strong attacks increase xG.
- Strong defenses suppress xG.
- Expected goals should remain realistic.
- Neutral-site matches assume no home advantage.
- Host advantage may be introduced later.

Regular-time goals are sampled with a Poisson distribution.

If regular time produces a winner that matches the already-sampled winner, the match is decided in regular time.

If regular time produces the opposite winner, the score is minimally adjusted so the already-sampled winner wins in regular time.

If regular time is tied, extra time is simulated.

If scores remain level after extra time, penalties determine the winner.

Penalty shootout goals are stored separately from match goals.

Extra Time

Extra time is modeled similarly to regular time but with reduced expected goals.

Guidelines:

- Lower xG than regular time.
- Maintain realism.
- Avoid excessive scoring.

Penalty Shootouts

Penalty shootouts contain substantial randomness.

Guidelines:

- Penalty ability may influence outcomes.
- Strong teams should not have overwhelming penalty advantages.
- Most penalty shootouts should remain close to 50-50.

Fully score-driven matchup probabilities are planned future work.

⸻

Bracket Simulation

A tournament simulation proceeds as follows:

1. Simulate every match.
2. Advance winners.
3. Continue until a champion is produced.

The simulator should preserve input data whenever possible.

Recommended functions:

simulateMatch()
simulateBracket()
runMonteCarlo()
calculateRoundOdds()
calculateMatchupOdds()

⸻

Monte Carlo Simulation

Tournament odds are produced through repeated simulations.

For each simulation:

1. A complete tournament is simulated.
2. Advancement results are recorded.
3. Frequencies are accumulated.

Probabilities are calculated as:

count / numberOfSimulations

Tracked outcomes:

- Champion probability
- Final appearance probability
- Semifinal probability
- Quarterfinal probability
- Round-of-16 probability
- Matchup probabilities

10,000 simulations are sufficient for the MVP.

Future versions may support larger simulation counts.

⸻

Assumptions

The model assumes:

- Independent matches.
- Neutral-site games.
- No injuries.
- No fatigue effects.
- No weather effects.
- No tactical adjustments.

These assumptions may change in future versions.

⸻

Limitations

This model estimates probabilities.

It does not claim certainty.

The simulator should be viewed as a tool for exploring possible tournament outcomes rather than predicting exact results.

The model is inspired by HockeyStats-style simulators but is specifically adapted for soccer and is not intended to replicate their methodology.
