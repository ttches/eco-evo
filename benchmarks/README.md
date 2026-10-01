# Benchmarks

Optional, manually-recorded simulation snapshots for tracking drift between
patches. A benchmark is just a committed `sweep.json` from a standard sweep, so
any later run can be compared against it with the simulator's `--baseline` flag.

Recording one is opt-in: do it when a patch meaningfully changes gameplay and
you want a reference to compare future changes against. Not every version needs
one. When a version has a benchmark, link it from `CHANGELOG.md`.

## Layout

```
benchmarks/
  v0.1.0/
    sweep.json   # trimmed sweep: provenance + aggregate metrics
```

## Record one

Run the standard sweep (deterministic per seed):

```bash
npm run test:simulator -- \
  --seeds 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 \
  --seconds 5400 --warmup 300 --settle 120 --stop-on none --no-csv --quiet \
  --out runs/bench-vX.Y.Z
```

Then save the run's `sweep.json` to `benchmarks/vX.Y.Z/sweep.json`, keeping only
provenance and the `aggregate` block (the per-seed `runs[].dir` paths are
machine-specific). A recorded file looks like:

```json
{
  "version": "0.1.0",
  "gitTag": "v0.1.0",
  "note": "stamina endurance rework",
  "generatedAt": "...",
  "command": "npm run test:simulator -- --seeds ... --seconds 5400 ...",
  "seeds": [1, 2, "...", 20],
  "simSeconds": 5400,
  "configLayers": [],
  "overrides": {},
  "statusCounts": { "WARN": 10, "NEAR-CRASH": 9, "CRASH": 1 },
  "aggregate": { "prey.pop.mean": { "n": 20, "mean": 0, "sd": 0, "min": 0, "max": 0 } }
}
```

## Compare against one

Run a new sweep with `--baseline` pointing at the benchmark directory (or its
`sweep.json`). The comparison is noise-aware: with the same seed set, a change
is only marked significant when it exceeds the across-seed standard error.

```bash
npm run test:simulator -- --seeds 1,2,...,20 --seconds 5400 --stop-on none \
  --baseline benchmarks/v0.1.0 --out runs/bench-check
```

The standard budget (20 seeds x 5400s, `--stop-on none`) takes roughly seven
minutes on a 10-core machine and is the same budget used for gameplay tuning.
