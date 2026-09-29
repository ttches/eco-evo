# Performance Assessment — Can nagomi's tech handle thousands of glorps?

Question: eco-evo targets **hundreds to thousands of glorps** in a **zoomable world**.
Is nagomi's tech performant enough?

**Short answer: yes, comfortably — once the simulation is fixed.** Glorps are **simple ~24px
blobs**, so rendering is nearly free (one instanced quad/circle per glorp, one draw call).
That removes nagomi's biggest rendering limitation. The remaining real blocker is that
nagomi's neighbor search is **O(n²)**, which must become a spatial grid. With that change,
thousands of glorps are very achievable in the browser.

---

## 1. Why the blob art makes this easy

nagomi draws each koi procedurally: a 14-node spine, body quads, fins, nose, tail, pattern
ellipses, and eyes — roughly **80–120 triangles per entity, duplicated into a shadow batch**.
That is why its batch capacity (`TRIANGLE_FLOAT_CAPACITY = 72_000` floats ≈ 8,000 triangles)
tops out around ~80 fish.

A **24px flat blob** is the opposite: 1 quad (2 triangles) or one instanced circle. At that
size:
- **Rendering thousands is trivial.** One `InstancedMesh` = **one draw call** for the entire
  population. Even a CPU-tessellated batch would fit: 5,000 blobs × 2 triangles = 10,000
  triangles, well within a modest typed-array capacity.
- **No LOD complexity.** A blob is already the far-zoom representation; zooming in can add a
  couple of eyes or a color ring, but nothing heavy.
- **Per-glorp per-frame CPU work is O(1):** update one instance transform + one color. No spine
  math, no tessellation.

So the render side of nagomi's stack is **more than enough**. (The multi-pass full-screen
effect pipeline is also available but optional — eco-evo does not need water/reflection
passes.)

---

## 2. What still needs to change

### 2.1 Neighbor search is O(n²) — the one real blocker
nagomi's agent loop checks every other agent for every agent (`school.ts:348`). That is fine
for its cap of 48, but scales badly:

| Population | distance checks / tick | checks / second @60 Hz |
|---:|---:|---:|
| 48 (nagomi) | 2,304 | ~138 K |
| 500 | 250,000 | ~15 M |
| 1,000 | 1,000,000 | ~60 M |
| 5,000 | 25,000,000 | ~1.5 B |

At 5,000 it is impossible at 60 Hz in JS.

**Fix:** a **uniform spatial grid / spatial hash** keyed on position, rebuilt each tick with a
counting sort. Query only the 3×3 cells around an agent. Cost becomes `O(n · k)` where `k` is
the average neighbors in range (typically 5–30). 5,000 agents × ~15 neighbors ≈ 75 K
interactions/tick ≈ 4.5 M/s — easy.

Glorps need neighbor queries for **separation, predation, and finding a similar-enough mate to
duplicate**, so this grid is required anyway.

### 2.2 Per-entity object allocation (GC pressure)
nagomi's `Koi` allocates ~30 `Vec2` objects per entity. At 5,000 that is ~150,000 live objects,
and its render helpers (`add`, `mul`, `normalize`) allocate new objects every frame.

**Fix:** data-oriented **struct-of-arrays** typed arrays (`Float32Array`/`Uint16Array` for x/y,
velocity, energy, age, genome id, diet, …). Iterate by index; pool dead glorps; no objects in
the hot loop.

### 2.3 Population cap and batch constants
`MAX_FISH = 48` and the batch capacities are fixed constants. Replace them with a configurable
population ceiling (e.g. a few thousand) and, for rendering, one instanced mesh sized to that
ceiling.

---

## 3. Zoomable world — nagomi has no camera or culling

nagomi renders a **fixed 480×270 logical world** with a fixed orthographic camera and
`frustumCulled = false` everywhere. There is no pan/zoom and nothing is culled.

For a zoomable world:
1. **Camera view rect** — move the orthographic camera bounds (or add position + zoom) instead
   of mapping 1:1 to the world.
2. **Viewport culling** for rendering (cheap and worthwhile) and optionally simulation.
3. **Chunked simulation** for large worlds — only tick active/visible chunks, or tick distant
   chunks at a coarser cadence.
4. **Resolution choice:** nagomi's fixed 480×270 is cheap but pixelated when zoomed in. Decide
   whether zoom increases the render target resolution or stays pixel-art. At 24px blobs,
   nearest-neighbor zoom-in looks fine; full-screen effect passes cost `pixels × passes`.

Because blobs are so cheap, culling is optional for performance — it is mainly useful once the
population is very large or the world is much bigger than the viewport.

---

## 4. Verdict

| Target | Verdict with nagomi tech |
|---|---|
| ~50 glorps | Trivial |
| ~200 glorps | Trivial |
| ~1,000 glorps | **Comfortable** with spatial grid + SoA (blob rendering is free) |
| ~5,000 glorps | **Feasible** with spatial grid + SoA + instancing; likely needs a Web Worker for headroom |
| ~10,000+ | Possible with Worker/WebGPU sim; rendering still cheap |

The bottleneck is **simulation neighbor queries**, not rendering. nagomi's engine patterns
(fixed timestep, sim/render split, seeded RNG, settings store, pixel-art pipeline) transfer
directly.

---

## 5. Recommended scaling roadmap for eco-evo

1. **Simulation core (the main work).** SoA typed arrays + uniform spatial grid rebuilt per
   tick with counting sort. Double-buffer state (read prev, write next) to avoid update-order
   bias.
2. **Reproduction & genetics.** Cache phenotype at birth. Pack alleles into typed arrays
   (e.g. `Uint16Array`); compute genetic distance cheaply for the "similar enough" rule; only
   mutate on duplication.
3. **Energy / carrying capacity.** Each glorp has an energy reserve; movement and metabolism
   drain it, food replenishes it, zero = death. Model plants as a **regrowing resource grid**
   (a field) rather than thousands of plant entities — cheap and naturally caps population.
4. **Rendering.** One `InstancedMesh` of a blob quad/circle, per-instance transform + color;
   one draw call. Add eyes/rings on zoom-in if desired.
5. **Zoom camera.** Ortho view rect + zoom factor; wire culling (optional) to it.
6. **Optional, later.** Move simulation to a **Web Worker** with `SharedArrayBuffer` for
   headroom; consider WebGPU compute only if pushing past ~10k.
7. **Food-web interactions.** Predation and mate-finding reuse the same spatial grid with a
   larger query radius.

### Rough frame budget (60 Hz => 16.7 ms)
- Sim: aim < 8 ms. Spatial grid makes 5k agents feasible; O(n²) does not.
- Render: one instanced draw for 5k blobs is ~1 ms; CPU cost is O(1) per glorp.
- Full-screen passes: resolution-bound, not agent-bound.

---

## 6. Compatibility of eco-evo's current scaffold

eco-evo is already React 19 + Vite 8 + TypeScript 6 + oxlint — close to nagomi's stack
(React 19 / Vite 8 / TS 7 / no lint config). nagomi additionally uses Three.js and Tailwind v4.
Adopting the nagomi engine adds Three.js (for WebGL) and the settings engine. No blocking
mismatch.

See `docs/prior-art-research.md` for projects that solved the large-population problem
(Biosim4's dense grid, The Bibites' genetics, spatial-hash + instancing benchmarks).
