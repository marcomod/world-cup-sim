# World Cup Sim — 2026 Knockout Bracket Simulator

An **offline, deterministic** Next.js app that tracks the *official* 2026 World Cup knockout bracket and
runs **Monte Carlo simulations** against the portion of the tournament that hasn't been played yet.

It does two things at once: it renders the real post-group-stage bracket from checked-in official
results, and it lets you simulate the unresolved fixtures — either forward from the *current official
state* or from a *baseline* that ignores official knockout results entirely. Randomness flows through a
seedable RNG, so the same seed reproduces the same tournament, match for match.

<!-- screenshot: drop the rendered bracket image at docs/images/bracket.png -->
![Rendered 2026 knockout bracket](docs/images/bracket.png)

- **Official bracket, from data.** The post-group-stage bracket is built from checked-in official
  results and a canonical FIFA-derived topology — not hand-placed in the UI.
- **Two simulation modes.** *Current official state* carries locked results forward and simulates only
  what's left; *Baseline* re-runs from the original Round of 32 as if no knockout result had been played.
- **Deterministic.** All randomness routes through a seedable RNG; identical seeds reproduce identical
  brackets and identical Monte Carlo odds.
- **Scoped on purpose.** Group-stage simulation is intentionally out of scope — the simulator begins
  after the group stage.

What makes it worth reading as code is the boundary discipline: the UI only ever *displays* state, the
engine *decides* it, the knockout topology is a single source of truth, and every piece of official data
comes through an offline, checksummed build→verify pipeline with zero runtime network calls.

---

## Architecture & engineering highlights

The core principle is a hard separation: **the UI displays the bracket; the simulator decides it.** React
components never contain tournament logic or probability math, and the simulator/tournament code never
imports React. Three decisions are worth calling out.

### Topology as a single source of truth

Knockout advancement lives in one canonical array,
[`src/lib/tournament-2026/bracket/knockoutTopology.ts`](src/lib/tournament-2026/bracket/knockoutTopology.ts).
It encodes every link in the bracket — winner links *and* loser links (`m73`→`m104`, semifinal losers
feeding the third-place match `m103`) — plus a `championPath` flag per match. Round-of-32 slot
generation, the simulator adapter, and the bracket layout are all **validated against or derived from**
this array rather than duplicating advancement links. The table is versioned to the source document it
came from (`Regulations for the FIFA World Cup 26`, May 2026), so a routing change is a single, auditable
edit — and topology corrections, not UI patches, are how bracket-path bugs get fixed.

### Bracket layout derived by a champion-path tree walk

The bracket's column layout isn't a set of hardcoded coordinates or a captured snapshot — it's *derived*.
A structural invariant test
([`tests/ui/bracketUi.test.ts`](tests/ui/bracketUi.test.ts)) rebuilds the champion-path tree straight from
the topology's winner links, does an in-order traversal (`teamA` subtree → node → `teamB` subtree) to get
the crossing-free vertical order each round must render, then renders the real component via
`renderToStaticMarkup` and reads the match IDs back out of the DOM. It asserts two things:

1. each rendered column equals the tree traversal (membership, side, and each parent centered over its
   two children), and
2. a **no-crossing invariant** read independently from the rendered output — every card's winner-link
   parent sits on the same bracket side.

Because the expectation is regenerated from the topology rather than copied from render output, a topology
drift can't silently redefine what "correct" layout means.

### Offline, versioned, checksummed source→build→verify pipeline

Official 2026 data never touches the network at runtime. It flows through an offline pipeline:

```
checked-in FIFA extracts → build* scripts → checksummed JSON artifacts → independent verify* scripts → app
```

Build scripts regenerate artifacts under `data/world-cup-2026/snapshots/` and `data/generated/`; separate
verifier scripts re-check them **byte-identically** and recompute SHA-256 checksums. The app and simulator
import *only* the generated artifacts — never FIFA data directly, never the build/verify scripts. The
snapshot loader is split so browser code can't reach the filesystem: `index.ts` is browser-safe
(validation/normalization only) and `node.ts` is Node-only (fs + checksums). This is enforced by tests: an
import-allowlist test in `bracketUi.test.ts` fails if any UI file imports `node:fs`, `node:crypto`, or the
calibration/historical research artifacts, and the artifact checksums are asserted exactly against what
the UI renders.

---

## Model & evaluation

The probability model is a sequential **Elo reconstruction** over historical World Cup matches
(1930–2022). Evaluation is deliberately **leakage-free**: the data is split into development
(`1930–2006`), validation (`2010–2018`), and a **2022 holdout that is fully held out** and opened only
once, under a frozen protocol. All figures below come from checked-in artifacts under
[`data/generated/calibration/`](data/generated/calibration/).

**Long-run performance (full history, all matches):**

| Metric | Model | Coin-flip baseline |
|---|---:|---:|
| Accuracy | **~65%** | 50% |
| Brier score | **0.223** | 0.25 |
| Log loss | 0.638 | — |

The headline is **~65% accuracy over the long run**, with a Brier score of **0.223 against a 0.25
coin-flip baseline**. Soccer is variance-dominated, so that margin over a coin flip is modest by design,
not a bug — see limitations below. (The 2022 holdout year alone scored higher, ~73%, but that is a single
favorable tournament above the long-run norm, not the model's typical performance; the ~65% figure is the
number to trust.)

### Calibration

<!-- reliability curve: generate the chart and save it at docs/images/reliability-curve.png -->
![Reliability curve — predicted vs observed win rate](docs/images/reliability-curve.png)

Per-bucket calibration is tracked in the evaluation artifacts (`calibrationBuckets` with an
`absoluteCalibrationError` per bin). The reliability curve shows **mid-range underconfidence**: in the
0.3–0.5 predicted-probability band the observed win rate runs meaningfully higher than predicted (e.g. the
0.4–0.5 bucket predicts ~0.46 but observes ~0.72). The model is closer to calibrated at the extremes than
in the middle.

### The divisor decision (honest version)

The Elo probability divisor controls how sharply rating gaps map to win probabilities. An offline study
compared divisors across a grid; `200` came out ahead of the production `400` on **validation** — it won
all three validation tournaments and every leave-one-out check. But when the 2022 holdout was opened, the
advantage for `200` rested on only **11 scored knockout matches**, and the bootstrap confidence intervals
**cross zero** for both Brier score and log loss. **No statistical significance is claimed.**

So production **stays on divisor 400**, and `200` is recorded as the leading research candidate for a
future, separately reviewed adoption decision — not an automatic change. The full reasoning is in
[`docs/decisions/ELO_DIVISOR_PRODUCTION_ADOPTION.md`](docs/decisions/ELO_DIVISOR_PRODUCTION_ADOPTION.md).

### Limitations

This is deliberately honest about what it is. Single-match soccer is **variance-dominated** — even a
well-calibrated model will look barely better than a coin flip on any one match. The model is a
**baseline Elo reconstruction**: it has no group-stage form, no market odds, no roster or injury inputs.
Knockout samples are small (the 2022 holdout is 11 scored matches), so year-to-year swings are large. The
point of the evaluation isn't to claim an edge — it's to state, with leakage-free numbers and explicit
uncertainty, exactly how much (and how little) the model knows.

---

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Vitest 4** for tests
- Offline pipeline scripts run directly on Node via `--experimental-strip-types` (no separate build
  step); several use a custom loader to resolve the `@/*` path alias outside Next/Vitest
- Runtime dependencies are only `next`, `react`, and `react-dom` — no charting or stats libraries

## Running it

```bash
npm run dev      # start the dev server at http://localhost:3000
npm run build    # production build
npm test         # run the full Vitest suite
npm run lint     # eslint
```

Full validation set (mirrors CI expectations):

```bash
npm test && npm run lint && npm run build && git diff --check && git status --short
```

The offline data pipeline is driven by dedicated scripts — `npm run
tournament2026:build-finalized-artifacts` runs the full official-data build chain, each `*:verify-*`
script independently re-checks a generated artifact, and the `calibration:*` scripts regenerate the
historical Elo evaluation. See [`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/) for the complete list.

## Testing & verification

Tests live under [`tests/`](tests/), mirroring the `src/`/`scripts/` structure. The suite prioritizes the
things that are easy to get subtly wrong: match simulation, bracket advancement, Monte Carlo and
probability calculations, **seed reproducibility**, and qualification/tie-breaker logic.

Beyond unit coverage, several tests exist to lock in **structural invariants**:

- **Bracket completeness & sides** — all 31 matches render exactly once, each round on its correct side.
- **No-crossing layout** — the champion-path traversal invariant described above, read from the rendered
  DOM rather than a snapshot.
- **Runtime isolation** — UI files cannot import `node:fs`/`node:crypto` or the calibration/historical
  research artifacts, keeping the browser bundle free of filesystem/network access.
- **Artifact traceability** — exact SHA-256 checksums of the generated artifacts are asserted against
  what the UI displays.

The `verify-*` scripts complement the tests by re-validating generated artifacts **byte-identically** —
checksums are expected to change only when an artifact is intentionally rebuilt.

## Project layout

```
src/lib/simulator/          # generic knockout engine: simulateMatch, monteCarlo, probability, seedable rng
src/lib/tournament-2026/    # 2026 domain layer: standings, qualification, bracket topology, snapshot adapters
src/data/                   # static + generated data only (teams, ratings, official 2026 artifacts)
src/components/, app/        # rendering only — consume already-computed state
scripts/                    # offline build/verify pipeline (Node, no build step)
docs/                        # design docs and decision records
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), and
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for the reasoning behind these boundaries.
