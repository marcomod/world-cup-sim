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

- Official 2026 group representation
- Group standings
- Best-third-place qualification
- Dynamic Round of 32 generation
- FIFA tiebreakers
- Versioned official tournament data ingestion
- Host advantage
- Qualification scenarios

Current product phase:

- Static 2026 group and Round-of-32 slot data are represented outside React.
- Group standings, third-place ranking, qualification, and generated knockout
  bracket adaptation are implemented as deterministic domain logic.
- The complete 495-combination Annex C third-place assignment lookup is encoded
  from the official May 2026 FIFA regulations and checked against an independent
  source-derived fixture.
- The Round-of-32 and later knockout topology is represented as a canonical
  static source with explicit winner and loser advancement. Semifinal winners
  feed `m104`; semifinal losers feed third-place match `m103`.
- The existing simulator adapter remains champion-path-only and intentionally
  omits `m103` until runtime third-place-match output is added.
- The existing UI still uses the demo bracket until official group results and
  the generated official bracket are reviewed and wired.

Future product work:

- Add versioned official result ingestion.
- Refresh the 2026 rating snapshot after the group stage.
- Wire generated official Round-of-32 brackets into the UI.
- Add runtime third-place-match output if the product needs to display `m103`.
- Add group-stage scenario tools or simulation only after the deterministic
  result-ingestion path is proven.

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
5. Add paired uncertainty and tournament-sensitivity analysis for frozen
   candidate comparisons.
6. Analyse regulation, extra-time, and penalty outcomes separately.
7. Optionally compare the validated model with betting-market probabilities.
8. Remove bookmaker margin to produce no-vig market probabilities.
9. Consider model/market blending only after independent out-of-sample
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
- The 2022 holdout has been opened once under the frozen protocol. Divisor `200`
  beat reference divisor `400` on the 11-match primary holdout sample at reported
  precision, but no significance is claimed, no further tuning may use 2022, and
  production remains at divisor `400`.
- Post-holdout uncertainty analysis now compares only divisors `200` and `400`
  using paired match-level bootstrap intervals and validation
  leave-one-tournament-out checks. The evidence classification supports a formal
  adoption review, but the decision record defers production adoption and keeps
  the runtime divisor at `400`.
- Production model adoption, broader parameter tuning, extra-time and penalty
  analysis, and market comparison remain future work.

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
