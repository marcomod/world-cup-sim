World Cup Simulator - Codex Instructions

Project Goal

Build a post-group-stage World Cup knockout simulator inspired by HockeyStats-style playoff simulators.

The app should allow users to:

- View the knockout bracket.
- See matchup probabilities.
- Simulate the tournament.
- Watch winners advance through the bracket.
- View tournament odds.
- Explore possible outcomes.

The MVP begins after the group stage.

Do not implement group-stage logic unless explicitly requested.

⸻

Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS

For the MVP:

- No database
- No authentication
- No live data fetching

⸻

Commands

Run when relevant:

npm run dev
npm run lint
npm run build
npm test

If tests are not configured yet, prioritize simulator implementation before adding test infrastructure.

⸻

Core Rules

Do not rewrite unrelated files.

Prefer extending existing code over replacing it.

Do not change public APIs without explaining why.

Keep components small and focused.

Avoid unnecessary abstractions.

Avoid duplicate logic.

Use explicit TypeScript types whenever practical.

⸻

Architecture Principles

The UI displays the bracket.

The simulator decides the bracket.

Do not place simulation logic inside React components.

Do not couple simulator code to React.

Prefer pure functions.

Keep responsibilities separated.

Preserve original input data unless mutation is intentional.

Favor simple solutions over clever solutions.

⸻

Folder Structure

src/
app/
components/
data/
lib/
simulator/
tests/
docs/

UI

src/app
src/components

Data

src/data

Simulation

src/lib/simulator

⸻

Performance Requirements

Simulation code should remain independent from rendering.

Avoid unnecessary allocations inside Monte Carlo loops.

Avoid React rerenders during simulations.

Favor arrays and simple structures in performance-critical code.

Use seedable random number generators whenever randomness is involved.

10,000 tournament simulations should run comfortably on modern hardware.

⸻

Testing Requirements

Prioritize tests for:

- Match simulation
- Bracket advancement
- Monte Carlo calculations
- Probability calculations
- Deterministic behavior using identical seeds

Avoid excessive testing of simple presentational components.

⸻

Agent Responsibilities

Planner Agent

Responsible for:

- Architecture
- Task decomposition
- File organization

Should not edit files.

⸻

Simulator Agent

Responsible for:

- Match simulation
- Tournament logic
- Probability models

Should not modify UI.

⸻

UI Agent

Responsible for:

- Components
- Styling
- Layout

Should not modify simulator logic.

⸻

Integration Agent

Responsible for:

- Wiring layers together
- Page composition

Should avoid changing internal implementations.

⸻

Review Agent

Responsible for:

- Bug detection
- Architecture review
- Performance review
- Test coverage

Should not implement features.

⸻

Documentation

Consult the following documents when relevant:

Architecture

docs/ARCHITECTURE.md

Methodology

docs/METHODOLOGY.md

Data Model

docs/DATA_MODEL.md

Roadmap

docs/ROADMAP.md

Contribution Guidelines

docs/CONTRIBUTING.md

Keep documentation synchronized with implementation.

⸻

Future Flexibility

The architecture should support future additions such as:

- Group-stage simulation
- Different probability models
- Editable ratings
- Player-level models
- Injuries
- Host advantage
- Historical validation

Avoid tightly coupling the codebase to any single statistical model.

⸻

Philosophy

Correctness first.

Architecture second.

Performance third.

Features fourth.

Build incrementally.

Prefer maintainable solutions over complex ones.
