# World Cup Knockout Simulator

A Next.js app for exploring the post-group-stage 2026 World Cup knockout bracket.

The app shows the official Round of 32 field, tracks completed and pending official knockout fixtures, and provides a simulation sandbox for projecting the unresolved bracket.

## Current UI

- Official bracket/data section with the finalized Round of 32.
- Official knockout status table with `Official completed` and `Pending official` states.
- Current official state simulation that locks completed official results and simulates unresolved fixtures.
- Baseline simulation / ignores official results mode for comparison against the original Round of 32 simulator input.
- Bracket cards with scan-friendly status labels, scores, winners, and matchup probabilities.
- Matchup odds for ready fixtures.
- Tournament projection odds after running 10,000 simulations.
- Source summaries, artifact checksums, qualification notes, and rating inputs kept available in disclosure sections.

## Protected Data Boundaries

Presentation changes should not alter simulator semantics or official data artifacts. Avoid modifying:

- simulator math and probability logic
- active ratings and numeric rating values
- calibration artifacts
- Annex C values
- topology values
- historical artifacts
- official results and generated official artifacts
- production divisor `400`

UI code should display imported state and artifacts without changing their meaning.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

Run the full validation set before handing off changes:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

For focused UI work, the main UI regression suite is:

```bash
npm test -- tests/ui/bracketUi.test.ts
```

## Project Structure

- `app/` - Next.js App Router entry points and global styles.
- `src/components/` - UI components for the simulator, bracket, official overview, and odds tables.
- `src/lib/simulator/` - simulator and Monte Carlo logic.
- `src/lib/tournament-2026/` - 2026 tournament adaptation and official-state bracket wiring.
- `src/data/` - source data, generated official artifacts, ratings, teams, and flags.
- `tests/` - simulator, tournament, data, and UI coverage.
- `docs/` - architecture, methodology, data-model, and ingestion documentation.

## Notes

The MVP starts after the group stage. Group-stage simulation is intentionally out of scope unless explicitly requested.
