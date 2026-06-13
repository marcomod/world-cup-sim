Contributing

Purpose

This document defines development practices for the World Cup Simulator.

The goal is to maintain a clean, understandable, and extensible codebase.

Code quality and maintainability are more important than adding features quickly.

⸻

General Principles

- Prefer simple solutions.
- Avoid premature abstraction.
- Extend existing code before rewriting it.
- Keep responsibilities separate.
- Do not optimize prematurely.
- Make changes incrementally.
- Preserve readability.

⸻

Architecture Rules

The UI displays the bracket.

The simulator decides the bracket.

Do not place business logic inside React components.

Do not couple simulator code to React.

Keep simulation logic inside:

src/lib/simulator

Keep UI code inside:

src/components
src/app

Keep static data inside:

src/data

⸻

File Size Guidelines

These are guidelines, not hard rules.

Components

Prefer:

- Less than 200 lines

Consider splitting:

- More than 300 lines

⸻

Simulator Files

Prefer:

- Less than 300 lines

Consider splitting:

- More than 500 lines

Avoid creating tiny files unnecessarily.

⸻

TypeScript

Prefer explicit types.

Avoid:

any

whenever practical.

Favor:

interface

and

type

with narrow, descriptive names.

⸻

State Management

For the MVP:

Use React state.

Avoid introducing:

- Redux
- Zustand
- Context-heavy architectures

unless clearly necessary.

Keep canonical state in one place.

Avoid storing derived values.

⸻

Testing Philosophy

Test meaningful logic.

Prioritize:

- Match simulation
- Bracket advancement
- Monte Carlo calculations
- Probability calculations
- Seed reproducibility

Do not spend excessive effort testing simple presentational components.

⸻

Performance

Simulation code should not depend on rendering.

Avoid:

- Deep object cloning
- Unnecessary allocations
- Complex object graphs in hot loops

Favor:

- Arrays
- Simple structures
- Pure functions

10,000 tournament simulations should run comfortably on modern hardware.

⸻

Branching

Prefer small branches.

Examples:

feature/bracket-ui
feature/monte-carlo
feature/team-ratings
feature/methodology-page

Avoid large branches containing unrelated changes.

⸻

Pull Requests

Each pull request should focus on one purpose.

Examples:

Good:

- Add Monte Carlo engine
- Improve bracket styling
- Add team flags

Bad:

- Rewrite simulator and redesign UI simultaneously

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
- Probability models
- Tournament logic

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

- Connecting layers
- Wiring state to UI

Should avoid changing internal implementations.

⸻

Review Agent

Responsible for:

- Bug detection
- Performance review
- Architecture review
- Test coverage

Should not implement features.

⸻

Documentation

Major changes should include explanations.

Keep these documents synchronized:

docs/ARCHITECTURE.md
docs/METHODOLOGY.md
docs/DATA_MODEL.md
docs/ROADMAP.md
docs/CONTRIBUTING.md

Documentation should explain reasoning rather than implementation details.

⸻

Future Flexibility

The architecture should allow future support for:

- Group-stage simulation
- Different probability models
- Player-level ratings
- Injuries
- Host advantage
- Market values
- Historical calibration

Avoid tightly coupling the codebase to any single statistical model.

⸻

Philosophy

Correctness first.

Architecture second.

Performance third.

Features fourth.

A simple and understandable simulator is preferable to a complicated simulator that is difficult to maintain.
