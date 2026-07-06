# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Next.js (App Router) app that simulates the post-group-stage 2026 World Cup knockout bracket. It also tracks the *official* 2026 tournament state (real group results, qualification, Round of 32, and knockout results) via an offline, script-driven data pipeline, and lets users run Monte Carlo simulations against the unresolved portion of the real bracket.

Group-stage simulation is intentionally out of scope — the simulator MVP begins after the group stage. Do not implement group-stage simulation logic unless explicitly requested.

## Commands

```bash
npm run dev                          # start dev server (http://localhost:3000)
npm run build                        # production build
npm run lint                         # eslint
npm test                             # vitest run (all tests, tests/**/*.test.ts)
npm test -- tests/ui/bracketUi.test.ts   # single test file
npm test -- -t "test name"           # filter by test name
```

Before handing off changes, run the full validation set (mirrors README):

```bash
npm test && npm run lint && npm run build && git diff --check && git status --short
```

### 2026 official data pipeline scripts

These are offline, Node-only scripts (run via `--experimental-strip-types`, no build step) that regenerate checked-in artifacts under `data/generated/` and `data/world-cup-2026/snapshots/`. They are not imported by the app or the simulator engine.

```bash
npm run tournament2026:build-official-snapshot
npm run tournament2026:verify-official-snapshot
npm run tournament2026:build-knockout-ratings
npm run tournament2026:build-knockout-results
npm run tournament2026:verify-knockout-results
npm run tournament2026:build-qualification
npm run tournament2026:verify-qualification
npm run tournament2026:build-simulator-input
npm run tournament2026:build-finalized-artifacts   # runs the full build chain above
npm run tournament2026:diff-snapshots
npm run tournament2026:verify-fair-play-source-gap
```

There are equivalent `ratings:generate`, `historical:validate`, and `calibration:*` scripts for the historical Elo calibration pipeline (see `docs/HISTORICAL_ELO_RECONSTRUCTION.md`, `docs/DIVISOR_COMPARISON.md`, `docs/HOLDOUT_EVALUATION.md`). `npm run historical:test` runs just that pipeline's test subset.

## Architecture

**Core principle: the UI displays the bracket; the simulator decides the bracket.** React components must never contain tournament logic, probability math, or match simulation. Simulator/tournament code must never import React and must stay pure (no mutation of inputs, explicit return values).

```
User → UI Components (src/components, app/) → Simulator Engine (src/lib/simulator)
                                              → 2026 Tournament Layer (src/lib/tournament-2026)
                                              → Probability Models / RNG → Results
```

### Layers

- **`src/lib/simulator/`** — the general knockout-bracket engine: `simulateMatch`, `simulateBracket`, `monteCarlo`, `probability`, `scoreline`, a seedable `rng`. Operates on the generic `Match[]` / `Team` / `TeamRating` shapes described in `docs/DATA_MODEL.md`. Randomness always flows through the seedable RNG so identical seeds reproduce identical tournaments.
- **`src/lib/tournament-2026/`** — 2026-specific domain logic layered on top of the simulator: group standings/tie-breakers (`standings/`), qualification and third-place ranking (`qualification/`), Round-of-32 generation and the canonical knockout topology (`bracket/`), rating integration (`ratings/`), and the local snapshot ingestion adapters (`snapshot/`). This package converts static 2026 data + real results into simulator-shaped input; it does not itself touch React.
  - `bracket/knockoutTopology.ts` is the **single canonical source** of knockout advancement (winner and loser links, `m73`→`m104`, semifinal losers feeding the third-place match `m103`). Round-of-32 slots and the simulator adapter are validated against this topology rather than duplicating advancement links.
  - `bracket/adaptOfficialKnockoutResults.ts` merges official (locked) results with simulated results for pending fixtures into one champion-path `Match[]`, without altering probability math or rating values.
  - The current simulator adapter only carries the champion path — third-place output isn't wired into the runtime engine yet.
- **`src/data/`** — static/generated data only, no business logic: teams, ratings (`teamRatingsV2`, generated Elo development data), flags, and the 2026 official data (`world-cup-2026/groups.ts`, `roundOf32Slots.ts`, `officialArtifacts.ts`, `snapshots/`).
  - `src/data/world-cup-2026/snapshots/` has two entry points: `index.ts` is browser-safe (validation/normalization contracts only) and `node.ts` is Node-only (filesystem loading + SHA-256 checksums). Don't import `node.ts` from browser/React code.
- **`src/components/`** and **`app/`** — rendering only: `Bracket/` (bracket cards, connectors, champion panel), `Odds/` (matchup + tournament odds tables), `OfficialTournamentOverview.tsx`, and `viewModels/` (pure display-state transforms consumed by components). Components consume already-computed state; they don't run standings/qualification/simulation logic themselves.

### Official 2026 snapshot pipeline (offline, script-driven)

```
checked-in normalized FIFA extracts → builder script → validated snapshot artifacts → independent verifier script → optional app wiring
```

- Source extracts: `data/world-cup-2026/raw/official-2026-current/`. Manually-edited real knockout results source: `data/world-cup-2026/sources/official-knockout-results.json`.
- Generated artifacts consumed at runtime: `data/world-cup-2026/snapshots/official-2026-current/{qualification,round-of-32,knockout-results}.json`, `data/generated/world-cup-2026/{official-rating-linkage,official-simulator-input}.json`.
- The app and simulator never fetch FIFA data directly and never import the build/verify scripts — only the generated artifacts.
- Ecuador/Ghana share third-place rank 3 with an intentionally unresolved strict ordering (missing fair-play data, not zero). Do not "fix" this by fabricating fair-play totals — see `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` for why this is correct as-is.

### Protected boundaries

Per the README, presentation/UI changes should not alter simulator semantics or official data. Be careful modifying:

- simulator math / probability logic (`src/lib/simulator/probability.ts`, `simulateMatch.ts`, `monteCarlo.ts`)
- active ratings and numeric rating values (`src/data/teamRatingsV2.ts`, `src/data/generated/*`)
- calibration artifacts and the production Elo divisor (`400`)
- Annex C third-place assignment values, knockout topology values
- historical artifacts and official results / generated official artifacts

UI code should display imported state and artifacts without changing their meaning.

## Conventions

- Explicit TypeScript types; avoid `any`.
- Path alias `@/*` maps to repo root (configured in both `tsconfig.json` and `vitest.config.ts`).
- Node-only pipeline scripts under `scripts/` run directly via `node --experimental-strip-types` (no separate build step); several use a custom loader (`scripts/tournament-2026/tsPathAliasLoader.mjs`) to resolve the `@/*` alias outside of Next/Vitest.
- File size is a guideline, not a hard rule: prefer components < ~200 lines (split above ~300), simulator files < ~300 lines (split above ~500).
- Tests live under `tests/`, mirroring the `src/`/`scripts/` structure (`tests/simulator`, `tests/tournament-2026`, `tests/tournament-2026/official-snapshot`, `tests/tournament-2026/snapshots`, `tests/calibration`, `tests/data`, `tests/ui`). Prioritize testing match simulation, bracket advancement, Monte Carlo/probability calculations, seed reproducibility, and tournament/qualification logic over presentational components.

## Hard Invariants — do not violate

These rules apply to every task in this repo unless the user explicitly says otherwise in a message:

- Do NOT change simulator probability math, active ratings, calibration artifacts, Annex C values, historical artifacts, official group-stage source data, or numeric rating values.
- The production probability divisor is 400 and must not change.
- Do NOT edit result VALUES in `data/world-cup-2026/sources/official-knockout-results.json`. Metadata shape may change only if strictly required; result values never change.
- Protected files, edit only if explicitly required: `src/lib/simulator/probability.ts`, `src/data/teamRatingsV2.ts`, calibration scripts/tests/artifacts.
- Topology/routing corrections ARE allowed when they fix the official bracket path.
- Topology is the source of truth. Never patch only the React UI to mask a topology bug.
- After any topology change, regenerate all downstream artifacts and re-run their verifiers; checksums are expected to change and the checked-in artifacts are trusted after build/verify.
- Verifiers must pass byte-identical; do not reformat generated JSON or change key order by hand.

## Docs

`docs/` has detailed design docs worth reading before nontrivial changes: `ARCHITECTURE.md`, `DATA_MODEL.md`, `METHODOLOGY.md`, `TOURNAMENT_2026_FORMAT.md`, `TOURNAMENT_2026_DATA_INGESTION.md`, `TOURNAMENT_2026_OFFICIAL_SNAPSHOT.md`, `TOURNAMENT_2026_RATING_REFRESH.md`, `HISTORICAL_ELO_RECONSTRUCTION.md`, `DIVISOR_COMPARISON.md`, `HOLDOUT_EVALUATION.md`, `HISTORICAL_EVALUATION.md`, `ROADMAP.md`, `CONTRIBUTING.md`. Keep these in sync with major implementation changes; they explain reasoning rather than restate implementation details.
