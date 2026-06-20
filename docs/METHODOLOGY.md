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
