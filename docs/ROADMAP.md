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

- Team flags
- Improved bracket styling
- Responsive layout
- Better odds tables
- Scoreline display
- Extra-time and penalty shootout result labels
- Loading indicators
- Simulation history
- Animated advancement

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
