Architecture

Purpose

This document describes the overall structure and design principles of the World Cup Simulator.

The simulator is inspired by HockeyStats playoff simulators but is designed specifically for soccer. The architecture prioritizes maintainability, testability, and flexibility over premature complexity.

⸻

Core Principle

The UI displays the bracket.

The simulator decides the bracket.

These responsibilities should remain separate.

React components should never contain tournament logic. Simulator functions should not depend on React.

⸻

High-Level Architecture

User
↓
UI Components
↓
State Layer
↓
Simulator Engine
↓
Probability Models
↓
Random Number Generator
↓
Results

⸻

Layer Responsibilities

UI Layer

Location:

src/components
src/app

Responsible for:

- Rendering brackets
- Rendering odds tables
- Displaying scores and probabilities
- User interactions
- Simulation controls

Not responsible for:

- Probability calculations
- Tournament logic
- Match simulation

⸻

State Layer

Responsible for:

- Maintaining current bracket state
- Tracking user selections
- Triggering simulations
- Resetting simulations

For the MVP, React state is sufficient.

Canonical state should exist in one place.

Derived values should not be stored unless performance requires it.

⸻

Simulator Layer

Location:

src/lib/simulator
src/lib/tournament-2026

Responsible for:

- Match simulation
- Round simulation
- Tournament simulation
- Monte Carlo simulations
- Probability calculations
- 2026 group standings and qualification logic
- Round-of-32 bracket generation

Simulator functions should:

- Be pure whenever possible
- Avoid mutating inputs
- Return explicit outputs
- Remain independent of React

⸻

Data Layer

Location:

src/data

Responsible for:

- Teams
- Ratings
- Initial bracket structure
- Static 2026 tournament groups and bracket slot definitions

Data files should not contain business logic.

The `src/lib/tournament-2026` package converts static tournament data and group
results into a generated knockout bracket. React components should consume
display-ready state from the app layer and should not perform standings,
qualification, or third-place assignment logic.

The local 2026 snapshot ingestion layer lives under
`src/data/world-cup-2026/snapshots` and `src/lib/tournament-2026/snapshot`.
The snapshot package has two entry points: `snapshots/index.ts` is browser-safe
and exports validation/normalization contracts, while `snapshots/node.ts` is
Node-only and exports filesystem loading plus SHA-256 checksum hashing.
Browser-safe tournament code accepts already validated snapshot objects and
remains separate from React, live network access, calibration scripts, and the
runtime simulator engine.

The 2026 tournament package has one canonical knockout topology source. It
models explicit winner and loser advancement, including semifinal loser links
to the third-place match. The Round-of-32 slot definitions and simulator
adapter are validated against that topology so advancement links are not
maintained independently in multiple places. The existing simulator adapter uses
only the champion path until the runtime engine supports third-place output.

⸻

Folder Structure

src/
app/
components/
Bracket/
Odds/
data/
lib/
simulator/
types.ts
rng.ts
simulateMatch.ts
simulateBracket.ts
monteCarlo.ts
tests/

⸻

Design Principles

Separation of Concerns

Keep UI, state, data, and simulation independent.

Avoid mixing responsibilities.

⸻

Pure Functions

Prefer:

simulateMatch(teamA, teamB)

over:

simulateMatch(teamA, teamB, setState)

Simulator code should not know about React.

⸻

Deterministic Simulations

Randomness should be reproducible.

All randomness should come through a seedable RNG.

Identical seeds should produce identical tournament results.

⸻

Simplicity First

Prefer simple solutions.

Avoid introducing abstractions until they are clearly needed.

Large files may be split later, but avoid premature fragmentation.

⸻

Extensibility

The architecture should support future additions:

- Better rating models
- Group-stage simulation
- Player-level adjustments
- Injuries
- Host advantage
- Market value models
- Historical validation

No single statistical model should be tightly coupled to the rest of the system.

⸻

Performance

Simulation code should remain independent from rendering.

Avoid unnecessary object cloning inside Monte Carlo loops.

Avoid React rerenders during simulations.

Favor arrays and simple structures in performance-critical paths.

10,000 tournament simulations should complete comfortably on modern hardware.

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

- Connecting layers together
- Wiring data into components

Should avoid changing internal implementations.

⸻

Review Agent

Responsible for:

- Bugs
- Architecture review
- Performance review
- Test coverage

Should not implement features.

⸻

Official 2026 Snapshot Boundary

The official World Cup 2026 snapshot pipeline is offline and script-driven:

checked-in normalized FIFA extracts -> builder -> validated snapshot artifacts
-> independent verifier -> optional server/test orchestration.

The app and simulator do not fetch FIFA data and do not import the official
snapshot scripts. UI wiring is deferred until the official knockout bracket is
ready to replace the demo bracket. The current official snapshot is a complete
72-match group-stage results record, but official qualification remains blocked
until missing fair-play inputs for Ecuador and Ghana are resolved.

The fair-play source-gap verifier is also offline and script-driven. It checks
the reviewed source-gap artifact, confirms Ecuador/Ghana fair-play totals remain
missing rather than zero, and preserves the unresolved official orchestration
state. The verifier uses a fixed seven-candidate manifest with stable candidate
IDs, structured source outcomes, bounded-conclusion checks, and direct
filesystem checks that official qualification, Round-of-32, simulator-input,
finalized-bracket, and knockout-ready artifacts are absent. It does not
generate those artifacts.
