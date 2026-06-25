Roadmap

Philosophy

Build the simulator incrementally.

Prioritize correctness and architecture before realism and features.

The MVP should be simple, understandable, and easy to extend.

⸻

Version 1 — MVP

Goal:

Produce a functional post-group-stage knockout simulator.

Features

- Static Round of 32 bracket
- Mock teams
- Mock ratings
- Match win probabilities
- Simulate full bracket
- Champion output
- Reset bracket
- Basic odds table
- Methodology page

Not Included

- Group-stage simulation
- Databases
- Authentication
- Live data
- Team customization

⸻

Version 2 — Monte Carlo Engine And Static Team Strength

Goal:

Generate tournament odds through repeated simulations and replace mock ratings with a static V2 team-strength snapshot.

Features

- Monte Carlo simulations
- Champion probability
- Final probability
- Semifinal probability
- Quarterfinal probability
- Matchup probabilities
- Static V2 team-strength ratings
- Elo-style overall rating used by matchup probabilities
- Normalized attack, defense, recent form, squad strength, and penalty components
- Faster simulation engine

The V2 ratings are a static manual snapshot. They are not live sourced, scraped, or automatically updated.

Target:

10,000 tournament simulations.

⸻

Version 3 — Better Presentation

Goal:

Improve the user experience and add scoreline display for single-bracket simulations.

Features

- Local team flags with fallback handling
- Mirrored knockout bracket moving inward to a central final and champion area
- CSS connector lines between rounds
- Responsive horizontal bracket scrolling on tablet and mobile
- Better odds tables
- Scoreline display
- Extra-time and penalty shootout result labels
- Loading indicators
- Simulation history
- Animated advancement

The current bracket remains a development/demo bracket. Its matchups will be
replaced with the official Round of 32 bracket after the group stage.

⸻

Version 4 — Customization

Goal:

Allow users to explore alternative scenarios.

Features

- Editable team ratings
- Build-your-own bracket
- Custom seeds
- Adjustable number of simulations
- Shareable URLs
- Export bracket images

⸻

Version 5 — Advanced Team Strength Model

Goal:

Replace the static V2 snapshot with more realistic, maintained estimates.

Potential inputs:

- Elo ratings
- FIFA rankings
- Market values
- Historical performance
- Recent form
- Squad strength
- Penalty ability

⸻

Version 6 — Full Tournament

Goal:

Support the entire World Cup.

Features

- Group-stage simulation
- Dynamic Round of 32 generation
- FIFA tiebreakers
- Host advantage
- Qualification scenarios

⸻

Version 7 — Advanced Soccer Model

Goal:

Improve realism.

Potential additions:

- Player-level ratings
- Goalkeeper quality
- Injuries
- Fatigue
- Tactical styles
- Home advantage
- Historical calibration
- Dixon-Coles model
- Correlated scoring
- Fully score-driven matchup probabilities

Historical Calibration Phases

The following work is offline analysis and does not change production
probabilities until a reviewed calibration result is deliberately adopted:

1. Ingest and validate an approved historical World Cup match dataset.
2. Reconstruct deterministic sequential pre-match Elo ratings without
   look-ahead bias.
3. Evaluate baseline probabilities with Brier score and log loss.
4. Compare candidate Elo divisors against a fixed validation set.
5. Analyse regulation, extra-time, and penalty outcomes separately.
6. Optionally compare the validated model with betting-market probabilities.
7. Remove bookmaker margin to produce no-vig market probabilities.
8. Consider model/market blending only after independent out-of-sample
   validation.

Current status:

- The confirmed 44-column Kaggle source is parsed by an isolated offline
  adapter.
- The raw snapshot is checksum-validated against tracked provenance.
- All 964 rows, 12 stage labels, and 86 team names validate deterministically.
- Replay-era non-decisive ties, historical group formats, extra time, and
  shootouts are preserved explicitly.
- A deterministic offline sequential Elo baseline now produces pre-match
  observations for all historical matches using initial rating `1500`, K-factor
  `20`, divisor `400`, and no home advantage or weighting adjustments.
- Penalty shootouts and replay-era non-decisive ties update Elo as draws while
  preserving their original outcome metadata.
- Same-day matches use stable match ID ordering because complete kickoff times
  are unavailable. No team appears twice on one date in the current snapshot;
  future datasets must revalidate this invariant, and grouped same-day
  sensitivity analysis remains future work.
- Deterministic Brier score, log loss, accuracy, and calibration-bucket reports
  are implemented for explicit development, validation, holdout, and full-history
  cohorts. Reports expose explicit selected and binary-scored sample counts;
  descriptive shootout results retain null metrics. These reports do not select
  a production model.
- A deterministic fixed-grid Elo-divisor comparison is implemented using only
  development and validation. Divisor `200` is the provisional protocol choice,
  not a production recommendation; it is the lower grid boundary and validation
  includes only 38 scored knockout matches. The optimum may lie below `200`, but
  expanding the grid after observing results requires a new predefined protocol.
  Uncertainty analysis, K-factor tuning, goal-difference and importance
  weighting, identity continuity, and other model changes remain separate work.
- The 2022 holdout remains sealed. One-time holdout evaluation, production model
  selection, broader parameter tuning, and market comparison remain future work.

The historical dataset and calibration scripts remain outside the runtime app.
The World Football Elo development snapshot remains the active rating source,
and the production Elo divisor remains `400` during this foundation work.

⸻

Version 8 — Community Features

Goal:

Make the simulator interactive.

Features

- Save brackets
- Share brackets
- Public links
- Favorite teams
- Simulation history
- Comparison mode

⸻

Long-Term Vision

Create a World Cup simulator inspired by HockeyStats playoff simulators but adapted specifically for soccer.

The project should prioritize:

1. Correct architecture.
2. Explainable methodology.
3. Realistic probabilities.
4. Fast simulations.
5. Excellent user experience.

Realism should always be added gradually rather than through premature complexity.
