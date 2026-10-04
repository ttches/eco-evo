# Performance — current state

What the engine costs today, what already scales, and where the next limits
are. The original pre-build assessment (can nagomi's tech handle thousands of
glorps?) concluded the blockers were O(n²) neighbor search and per-entity
objects; both are solved, see "Done" below.

## Measured cost

`step()` timings in Node (Vitest) on an Apple-silicon laptop, averaged over 300
steps, first run (not JIT-warmed):

| Scenario                                                           | ms / step | Share of a 60 Hz second |
| ------------------------------------------------------------------ | --------: | ----------------------: |
| ~150 glorps (120 prey / 30 hunters)                                |     0.075 |                   ~0.5% |
| ~500 glorps, all hungry (400 / 100)                                |     0.145 |                   ~0.9% |
| 3840×2160 world, default start, 10 sim-minutes (peaks ~830 glorps) | 0.13–0.22 |                     ~1% |

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
  ~8,000 tiles.
- **Grass as a data texture** (`render/grass-layer.ts`): one world-sized quad
  samples the simulation's density array directly as a nearest-filtered float
  texture. Each frame uploads one float per tile (~32 KB for the 120×68 grid)
  instead of a matrix and color per tile.
- **Instanced rendering**: one draw call for all glorps.
- **View culling**: glorps outside the view (plus a margin) are not uploaded.
- **Screen-independent render cost**: the canvas renders at a fixed 270 px on
  its short side (480×270 on 16:9, 270×584 on a portrait phone) and is
  upscaled with nearest-neighbor, so GPU fill cost stays tiny on high-DPI
  phones.
- **Draw only when something changed** (`App.tsx` frame callback): a display
  frame with no simulation step and no camera or selection change is skipped.
  The simulation steps at 60 Hz, so 120/144/240 Hz screens no longer redraw
  duplicate frames, while panning and zooming still draw at the full refresh
  rate.
- **Lineage log** (`sim/lineage.ts`): ~50 bytes per glorp ever born in growable
  typed arrays; the default sim grows it by roughly 350 KB per hour.

## Next limits, in likely order

1. **Population cap.** `MAX_GLORPS = 2048` sizes every column and the instanced
   mesh. Raising it is a constant change; the grid keeps queries cheap.
2. **Grass upload rate.** The density texture is re-uploaded every rendered
   frame even though grass changes slowly. Uploading only on frames after a
   simulation step (or every few steps) would cut it further; at 32 KB it is
   not worth the extra state yet.
3. **Grass search when food is scarce.** `nearestGrassTile` stops at the first
   ring that can't beat its best hit, but with almost no grass left each hungry
   prey scans up to all ~8,000 tiles per step. A coarse "any grass in this
   8×8 block" summary grid would let it skip empty regions.
4. **Steering allocations.** Each glorp's drive returns a small `{ x, y, sprint }`
   object every step, which is garbage-collector churn at a few thousand
   glorps. Writing into a reusable scratch object would remove it.
5. **Selection lookup.** `findGlorpById` scans the population each frame while
   something is selected. An id-to-index map maintained on alloc/remove would
   make it O(1) if populations get large.
6. **Smooth motion on high-refresh screens.** Positions only change on the
   60 Hz step, so a 120 Hz display still shows 60 distinct frames. Drawing
   glorps interpolated between the last two steps would use the extra frames,
   at the cost of keeping previous positions and reintroducing a draw per
   display frame.
7. **Very large populations (5k+).** Move the simulation into a Web Worker,
   sharing the typed-array columns with the renderer via `SharedArrayBuffer`.
   The sim already has no DOM or renderer dependencies.
