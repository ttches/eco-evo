# Performance — current state

What the engine costs today, what already scales, and where the next limits
are. The original pre-build assessment (can nagomi's tech handle thousands of
glorps?) concluded the blockers were O(n²) neighbor search and per-entity
objects; both are solved, see "Done" below.

## Measured cost

`step()` timings in Node (Vitest) on an Apple-silicon laptop, averaged over 300
steps, first run (not JIT-warmed):

| Scenario | ms / step | Share of a 60 Hz second |
|---|---:|---:|
| ~150 glorps (120 prey / 30 hunters) | 0.075 | ~0.5% |
| ~500 glorps, all hungry (400 / 100) | 0.145 | ~0.9% |

Warmed-up runs are ~40% faster again. Before the spatial grid the same
scenarios cost 0.61 and 1.30 ms. Phone CPUs are roughly 4–5× slower, which still
leaves the simulation under 1 ms per step.

To re-measure, spawn a population with `spawnRandom`, time `step(world, 1/60)`
in a loop, and compare the final population to confirm identical behavior.

## Done

- **Struct-of-arrays storage** (`sim/store.ts`): every per-glorp value is a
  typed-array column; no objects per glorp.
- **Uniform spatial grid** (`sim/spatial.ts`): counting-sort buckets of 64-unit
  cells, rebuilt by each system that queries (steering, predation, mating).
  `nearestOfType` visits only overlapping cells and matches a linear scan
  exactly, ties included.
- **Grass ring search** (`sim/grass.ts`): hungry prey search outward from their
  tile and stop once no farther ring can be closer, instead of scanning all
  ~2,000 tiles.
- **Instanced rendering**: one draw call each for grass tiles and glorps.
- **View culling**: glorps outside the view (plus a margin) are not uploaded.
- **Screen-independent render cost**: the canvas renders at a fixed 270 px on
  its short side (480×270 on 16:9, 270×584 on a portrait phone) and is
  upscaled with nearest-neighbor, so GPU fill cost stays tiny on high-DPI
  phones.
- **Lineage log** (`sim/lineage.ts`): ~50 bytes per glorp ever born in growable
  typed arrays; the default sim grows it by roughly 350 KB per hour.

## Next limits, in likely order

1. **Population cap.** `MAX_GLORPS = 512` sizes every column and the instanced
   mesh. Raising it is a constant change; the grid keeps queries cheap.
2. **Grass layer uploads.** `GrassLayer.update` rewrites every visible tile's
   matrix and color each frame. Tiles never move, so positions could be built
   once and only colors refreshed (or grass moved to a single data texture).
3. **Steering allocations.** Each glorp's drive returns a small `{ x, y, sprint }`
   object every step, which is garbage-collector churn at a few thousand
   glorps. Writing into a reusable scratch object would remove it.
4. **Selection lookup.** `findGlorpById` scans the population each frame while
   something is selected. An id-to-index map maintained on alloc/remove would
   make it O(1) if populations get large.
5. **Battery on mobile.** The loop renders every display frame. A frame-rate
   cap (nagomi has one, `frame-limiter.ts`) would save power on phones; the
   fixed-step simulation already tolerates it.
6. **Very large populations (5k+).** Move the simulation into a Web Worker,
   sharing the typed-array columns with the renderer via `SharedArrayBuffer`.
   The sim already has no DOM or renderer dependencies.
