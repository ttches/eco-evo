---
name: test-simulator
description: Run the eco-evo game headlessly at high speed to study game mechanics, balance, and evolution. Use when asked to simulate the game, run headless experiments, gather lineage/population statistics, measure time-to-death for prey or hunters, compare a mechanics or config change against a baseline, or sweep config values. Triggers on "simulator", "headless", "lineage stats", "time to dead prey/hunters", "balance", "run the sim".
---

# test:simulator

A separate, read-only tool that drives the real simulation (`createWorld` + `step`)
with no renderer, no DOM, and no changes to `src/`. It writes analysis artifacts
and is deterministic per seed, so runs can be compared exactly.

## Run it

```bash
npm run test:simulator -- [options]
```

Single run:

```bash
npm run test:simulator -- --seconds 600 --out runs/baseline
```

Sweep several seeds in parallel:

```bash
npm run test:simulator -- --seeds 1,2,3,4 --seconds 600 --jobs 4 --out runs/sweep
```

## Options

| Flag | Meaning | Default |
|---|---|---|
| `--seed <n>` | single seed | `0x00c0ffee` |
| `--seeds <a,b,c>` | explicit seed list | – |
| `--runs <n>` | n consecutive seeds from `--seed` | – |
| `--seconds <n>` | simulated seconds per run | `600` |
| `--prey <n>` / `--hunters <n>` | starting population | `120` / `10` |
| `--sample <s>` | time-series sampling interval | `2` |
| `--warmup <s>` | start-up period excluded from "settled" population stats (clamped to 25% of the run) | `120` |
| `--epochs <n>` | equal time slices for epoch tables and birth cohorts | `5` |
| `--settle <s>` | ignore births in the last N s for selection stats | `60` |
| `--floor-prey <n>` / `--floor-hunter <n>` | near-crash floor (post-warmup) | 15% / 40% of start |
| `--stop-on <mode>` | `total` \| `prey` \| `hunter` \| `either` \| `none` | `total` |
| `--check-every <steps>` | extinction check interval | `1` |
| `--jobs <n>` | parallel worker processes | cpus-1 |
| `--out <dir>` / `--label <name>` | output directory / suffix for the default one | `runs/<timestamp>` |
| `--config <file>` / `--set KEY=VALUE` | config overlays / overrides (repeatable) | game config |
| `--baseline <path>` | run or sweep directory (or `sweep.json`) to compare against | – |
| `--no-csv` | skip `lineage.csv` / `timeseries.csv` | – |
| `--quiet` | suppress the printed report | – |

Use `--stop-on none` when studying dynamics: the default `total` only stops when
*everything* is dead, so a hunter extinction runs on (which is what you want for
crash analysis). `either` ends a run the instant prey or hunters hit 0.

## Config overlays and `--set`

Nothing in `src/` is modified. `--config` swaps `@/sim/config` for an overlay
module, and `--set` overrides values on top. Overlays are partial and chain:
each does `export * from '@/sim/config.base'` and declares only what changes.
`@/sim/config.base` resolves to the **previous layer** (or the real game config
for the first layer), so `--config a --config b` applies `a` then `b`.

```ts
// tools/simulator/configs/slow-hunters.ts
export * from '@/sim/config.base'
export const HUNTER_SPRINT_MULTIPLIER = 1.0
export const HUNTER_SIGHT = 150
```

```bash
# quick scalar / nested tweak, no file needed
npm run test:simulator -- --set HUNGER=85 --set MOVEMENT.walkFactor=0.6
```

With no `--config`/`--set`, the real game config is used directly.

`--set` keys may be a top-level name or one dotted level (`MOVEMENT.walkFactor`);
deeper keys are rejected rather than silently mangled. Constants defined in terms
of others are propagated automatically (e.g. `MATE_FED_MIN` follows `HUNGER`); if
an override feeds an expression-based constant the loader warns on stderr.

## A/B a mechanics change

Hold seeds constant, change one thing, compare **sweeps** (single seeds are too
noisy: prey/hunter dynamics diverge chaotically, so use 8+ seeds per side).

```bash
npm run test:simulator -- --seeds 1,2,3,4,5,6,7,8 --seconds 600 --stop-on none --out runs/before
# change src/sim/config.ts or pass an overlay / --set
npm run test:simulator -- --seeds 1,2,3,4,5,6,7,8 --seconds 600 --stop-on none --out runs/after \
  --set MOVEMENT.jogFactor=0.45 --baseline runs/before
```

The comparison prints mean-across-seeds per metric and marks **sig ↑/↓** only
where the change exceeds 2x the across-seed standard error. Unmarked = within
seed noise. With ~90 metrics an isolated "sig" is often chance; trust patterns of
related metrics moving together. With one run per side there is no noise
estimate and every delta is descriptive only.

## What the report answers

`report.md` (printed for a single run; per seed on disk) is written for people
and LLMs. Sections, and the design question each answers:

- **Verdict + flags**: `CRASH` (a type went extinct, or a lineage integrity check
  failed) / `NEAR-CRASH` (population fell to the floor after warmup) / `WARN` /
  `OK`. Flag thresholds are the exported `THRESHOLDS` in `analysis/health.ts`.
- **Population**: settled min/p10/median/mean/p90/max, exact extinction time,
  worst peak-to-trough drawdown, cycle count/period/swing and whether cycles widen
  (`growth`), first-vs-second-half trend, time spent at/below the floor, plus a
  sparkline of each population. "Settled" excludes the warmup so the start-up
  boom/bust does not count as a low.
- **Epochs**: population, energy and grass per time slice, and births / starved /
  eaten per slice (what is killing each type, when).
- **Deaths, predation**: lifespans by cause, prey kills vs cannibal kills,
  kills per hunter-minute, how concentrated kills are (top-10% share, gini),
  hunters that never killed, and the top killers with their builds. Hunters eaten
  at birth by a starving parent are counted separately.
- **Selection** (per type): for each trait the drift from founders to the final
  cohort, the share pinned at level 1 / 7, and a budget-aware selection gradient
  (`effect`) against lifespan, offspring and (hunters) kills. Traits share a point
  budget, so naive correlations mislead; `effect` measures moving one point into
  the trait from the average of the others, in outcome-sd per trait-sd. Also an
  outcome-by-level table. Verdicts: strong advantage / advantage / neutral
  ("possibly a dead stat") / disadvantage / trade-off.
- **Performer cohorts**: top-decile by offspring, by lifespan, by kills, and the
  shortest-lived decile, each with trait mean and gap to the population in sd.
  Big gap = that trait separates winners.
- **Builds and variance**: per birth-cohort distinct builds, effective builds,
  mean pairwise build distance (points to move between two random members) and
  per-trait sd; verdict `diverging` / `converging` / `stable` versus the founders;
  most common builds and best builds by offspring.

Caveats built into the numbers: lifespan/offspring of glorps alive at the end are
lower bounds (right-censored); births in the last `--settle` seconds are excluded
from selection; hunter stats in a single run have tiny n (the report says so), so
use a sweep, whose **pooled** section merges every seed's individuals.

## Metrics glossary (headline keys)

Every run exposes a flat `analysis.headline` (e.g. `prey.pop.min`,
`hunter.extinctAt`, `prey.sel.speed.offspring`, `hunter.div.distance`). Sweeps
aggregate these (mean/sd/min/max) in `sweep.json`; the curated display list is
`metrics.ts`. Add a metric in `analyze.ts` `buildHeadline` and (to show it) `metrics.ts`.

## Artifacts

Under the output directory (git-ignored):

- `report.md` / `report.html`: the full report / the same verdict with interactive
  charts (populations with warmup shading and floor line, energy, grass, trait drift).
  A sweep's root `report.md/html` adds per-seed table, flag rollup, across-seed
  metrics, pooled selection/performers/builds and a population overlay of all seeds.
- `summary.json`: run config + full `analysis` (machine-readable).
- `sweep.json`: per-seed headlines and across-seed aggregate (also written for
  single runs, and is what `--baseline` reads).
- `lineage.csv`, `timeseries.csv` (traits split by prey/hunter): raw exports.
- `individuals.json`, `population.json` (multi-seed only): inputs for pooling.

For multi-seed runs each seed gets `seed-<n>/`; single runs write to the root.

## Code layout (`tools/simulator/`)

- `run.ts` CLI orchestration (spawns workers, aggregates) · `worker.ts` one run · `cli/args.ts` flags.
- `analyze.ts` wires a finished world into a `RunAnalysis`; the computation is in `analysis/`:
  `sampling` (time-series rows), `dynamics` + `cycles` (population), `individuals` (per-glorp table),
  `overview`, `selection`, `performers`, `diversity`, `health` (flags + `THRESHOLDS`),
  `integrity`, `lineage-stats`, `headline` (flat metrics), `stats` (math helpers).
- `report/` markdown sections, `charts/` HTML pages (`chart-client.ts` is the in-browser renderer),
  `sweep/` across-seed `aggregate`, `compare` (A/B), `sweep-report`, `metrics` (curated display list).
- Analyses over the individual table take a table, not a world, which is why the same code
  serves one run and a pooled sweep. Add a new analysis there, then surface it in `report/`.

## Trust

The simulator checks itself: every run asserts lineage invariants (trait budget,
parent/child ordering, every eaten glorp has a hunter killer, alive counts match
the world) and a failure is reported as a `CRASH` flag. Runs are deterministic
per seed; `--no-csv` does not change results.

## Tips

- Runs are single-threaded (~4s per 600 simulated seconds); use `--jobs` for sweeps.
- A flag that fires in most seeds is a property of the design; in one seed it may be luck.
- Read `lineage.csv` for anything not summarized (family trees, killer networks).
- Always compare like-for-like: same seeds, same `--seconds`, same population.
