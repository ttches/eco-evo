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
| `--prey <n>` / `--hunters <n>` | starting population | `120` / `8` |
| `--sample <s>` | time-series sampling interval | `5` |
| `--stop-on <mode>` | `total` \| `prey` \| `hunter` \| `either` \| `none` | `total` |
| `--check-every <steps>` | extinction check interval | `1` |
| `--jobs <n>` | parallel worker processes | cpus-1 |
| `--out <dir>` | output directory | `runs/<timestamp>` |
| `--label <name>` | label appended to the default output dir | – |
| `--config <file>` | config overlay (repeatable, layered) | game config |
| `--set KEY=VALUE` | config override (repeatable) | – |
| `--baseline <path>` | `summary.json` or its dir to diff against | – |
| `--no-csv` | skip `lineage.csv` / `timeseries.csv` | – |
| `--quiet` | suppress progress and single-run summary | – |

`--stop-on total` (default) ends a run the instant `world.count` hits 0.
`either` ends when **prey or hunters** first reach 0, which is useful for
detecting destabilizing changes; the collapsed side is recorded as `stopReason`.

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

The whole point: hold seeds constant, change one thing, diff.

```bash
# 1. baseline (game config)
npm run test:simulator -- --seeds 1,2,3 --seconds 600 --out runs/before --no-csv

# 2. change the mechanic (edit src/sim/config.ts or use an overlay)
npm run test:simulator -- --seeds 1,2,3 --seconds 600 --out runs/after \
  --config tools/simulator/configs/slow-hunters.ts --no-csv

# 3. diff the same seed against the baseline
npm run test:simulator -- --seed 1 --seconds 600 --baseline runs/before/seed-1/summary.json \
  --config tools/simulator/configs/slow-hunters.ts --out runs/check --no-csv
```

The diff prints per-metric % deltas (population, time-to-death, predation,
lineage, traits). Same seed + same config = byte-identical analysis.

## Metrics

- **Time to dead prey / hunters** — lifespan distribution (mean/median/p10/p90)
  of dead glorps, split by `eaten` vs `starved`. For prey, `eaten` is also
  time-to-kill; the killer id is in `lineage.csv`.
- **Predation** — total kills, hunters-with-kills, kills per hunter,
  time-to-first-kill.
- **Lineage** — max/mean generation, generation time (mean parent age at
  offspring birth), offspring per parent, trait means by generation (evolution
  drift).
- **Population** — born/alive/death-cause counts, plus the sampled time series
  of counts, mean traits, mean generation, and grass level.
- **Age at death** — histogram in `summary.json` (`analysis.ageAtDeath`).

## Artifacts

Under the output directory (git-ignored):

- `summary.json` — run config + full `analysis` (machine-readable).
- `lineage.csv` — one row per glorp ever born: id, type, parents, generation,
  bornAt, diedAt, alive, deathCause, killer, directive, traits.
- `timeseries.csv` — sampled population/trait metrics over sim time.
- `sweep.json` — aggregate key metrics across all seeds in a run.

For multi-seed runs each seed gets `seed-<n>/`; single runs write to the root.

## Tips

- Runs are single-threaded; use `--jobs` for sweeps and `--no-csv` when you only
  need `summary.json`.
- Extinction is absorbing, so `--stop-on` saves the tail of a collapsed run.
- `--check-every` > 1 trades exact extinction timestamps for speed.
- Read `lineage.csv` for anything not summarized (family trees, killer
  networks, per-trait selection).
- Always compare like-for-like: same seeds, same `--seconds`, same population.
