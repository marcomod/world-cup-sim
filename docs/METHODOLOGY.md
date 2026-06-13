Methodology

Purpose

This document describes the statistical approach used by the World Cup Simulator.

The model is inspired by HockeyStats-style playoff simulators but is adapted for soccer. It is intended to estimate probabilities, not predict exact outcomes.

The simulator begins after the group stage.

⸻

Simulation Pipeline

Team Ratings
↓
Expected Goals
↓
Goal Simulation
↓
Extra Time
↓
Penalty Shootout
↓
Winner Advances
↓
Monte Carlo Repetition
↓
Tournament Odds

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

Not all components are required in the MVP.

Initially, ratings may be manually assigned.

Future versions may incorporate:

- Elo ratings
- Market values
- FIFA rankings
- Historical performance
- Player-level adjustments

⸻

Match Probabilities

For the MVP, matchup probabilities are based on rating differences.

Example:

ratingDiff = teamA.overall - teamB.overall;
teamAProbability =
1 / (1 + Math.pow(10, -ratingDiff / 400));
teamBProbability =
1 - teamAProbability;

This is only an initial approximation.

Future versions may derive probabilities directly from repeated simulations.

⸻

Expected Goals

The model estimates expected goals for each team.

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

⸻

Goal Simulation

Goals are simulated using a Poisson distribution.

Regular time is simulated first.

If one team scores more goals, that team advances.

If scores are level, extra time is played.

If scores remain level after extra time, penalties determine the winner.

⸻

Extra Time

Extra time is modeled similarly to regular time but with reduced expected goals.

Guidelines:

- Lower xG than regular time.
- Maintain realism.
- Avoid excessive scoring.

⸻

Penalty Shootouts

Penalty shootouts contain substantial randomness.

Guidelines:

- Penalty ability may influence outcomes.
- Strong teams should not have overwhelming penalty advantages.
- Most penalty shootouts should remain close to 50-50.

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
