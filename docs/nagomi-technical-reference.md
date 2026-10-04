# Nagomi — Engine & Rendering Reference (transferable parts)

Source project: `/workspace/nagomi` (package `procedural-koi-threejs`).
Purpose of this doc: capture the **game engine, tech, rendering approach, and pixel-art look**
that eco-evo should base itself on.

> **Scope:** eco-evo is **not** fish- or water-based. Everything specific to nagomi's koi,
> pond bed, water surface, reflections, refraction, ripples, weather, and aquatic props is
> **out of scope and intentionally omitted here**. What we want from nagomi is the engine
> setup, simulation/rendering architecture, and the pixel-art visual language.

> **License warning:** nagomi is under the **PolyForm Noncommercial License 1.0.0**
> (`/workspace/nagomi/LICENSE`), Required Notice "Copyright 2026 Mayank Kadam". Study the
> architecture, but copying code carries noncommercial obligations.

---

## 1. What we are taking from nagomi

A browser-native, watch-first simulation with:

- A **fixed-timestep** simulation loop decoupled from rendering.
- A **strict separation of simulation and rendering**.
- A **multi-pass WebGL renderer** at a **fixed low logical resolution**, upscaled with
  nearest-neighbor for a crisp pixel-art look.
- **Flat, procedurally generated vector art** (triangles/circles) rather than sprite sheets.
- A **schema-driven settings engine** for tuning.
- **Deterministic** behavior via seeded per-entity RNG.

The simulation content itself (koi behavior, water, weather) is not reused.

---

## 2. Tech stack

| Area          | Choice                                                       | Version            |
| ------------- | ------------------------------------------------------------ | ------------------ |
| Framework     | React + ReactDOM                                             | `^19.3.0`          |
| Language      | TypeScript                                                   | `^7.0.2`           |
| Build         | Vite (`@vitejs/plugin-react`)                                | `^8.2.2`           |
| 3D / GPU      | Three.js (WebGL)                                             | `^0.186.0`         |
| Styling       | Tailwind CSS v4 (CSS-first) + plain CSS                      | `^4.3.3`           |
| UI primitives | shadcn "base-rhea" on Base UI                                | `^1.8.0`           |
| Animation     | `motion`                                                     | `^13.2.0`          |
| Fonts         | `@fontsource-variable/inter`                                 | `^5.3.0`           |
| Testing       | Vitest                                                       | `^5.0.2`           |
| Deploy        | Static SPA (nagomi uses Cloudflare Workers; **not Next.js**) | `wrangler` 4.131.2 |

No ESLint/Biome/Prettier config; no Tailwind config file (Tailwind v4 uses `@theme` in CSS).
ESM (`"type": "module"`).

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
```

```json
// tsconfig
"target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
"jsx": "react-jsx", "strict": true,
"noUnusedLocals": true, "noUnusedParameters": true,
"paths": { "@/*": ["./src/*"] }
```

```json
"dev": "vite", "build": "tsc && vite build", "preview": "vite preview", "test": "vitest run"
```

---

## 3. Project layout (patterns to mirror)

```
src/
├── main.tsx              React entry
├── app.tsx               Root: rAF loop, input, UI orchestration
├── styles.css            Theme tokens + custom CSS
├── config.ts             Re-exports settings.live slices + engine constants
├── math.ts               Vec2 helpers + XorShift32 PRNG
├── <entity>.ts           Simulation entities/state (pure, no Three.js)
├── <system>.ts           Behavior/steering/systems (pure, no Three.js)
├── <pass>.ts             Renderer passes (own GPU resources)
├── <top-level>-renderer.ts  Scene graph, batches, draw pipeline
├── settings/             definition, schema, store, effects, react, persistence
├── hooks/
├── lib/utils.ts
└── components/           React UI (shadcn primitives)
```

Conventions: **kebab-case filenames**, PascalCase classes/components, camelCase
functions/fields, UPPER_SNAKE constants, **named exports** (no default exports).
Simulation modules are flat in `src/`; React UI in `src/components`; settings in `src/settings`.

---

## 4. Simulation loop (core engine pattern)

Fixed timestep, decoupled from render (`app.tsx`):

```ts
let accumulator = 0
let previousTime = performance.now()
const animate = (now: number): void => {
  accumulator += Math.min((now - previousTime) / 1000, 0.1) // clamp 100ms
  previousTime = now
  while (accumulator >= FIXED_STEP) {
    simulationTime += FIXED_STEP
    simulation.update(FIXED_STEP, simulationTime)
    accumulator -= FIXED_STEP
  }
  renderer.draw(simulation, simulationTime, runtime.showDebug)
  requestAnimationFrame(animate)
}
```

`FIXED_STEP = 1/60`. Simulation is fixed 60 Hz; rendering runs once per display frame. A
`ResizeObserver` rescales entities and render targets while preserving relative positions.

**Why it matters:** behavior is stable and reproducible regardless of display refresh, and
render cost never changes simulation outcomes.

---

## 5. Rendering architecture

### 5.1 Fixed logical resolution -> pixel-art upscale

- The renderer works at a **fixed logical resolution (480×270 in nagomi)** and upscales to the
  display. The canvas is CSS-scaled with:
  ```css
  #canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  ```
  This is the source of the crisp pixel-art look. It is also cheap: fragment cost is constant
  regardless of window size.
- Camera is an **orthographic camera with Y down** so world coordinates match screen
  coordinates:
  ```ts
  new THREE.OrthographicCamera(0, W, 0, H, -10, 10)
  ```

### 5.2 Multi-pass render targets (generic technique)

nagomi composites scenes through intermediate `WebGLRenderTarget`s rather than drawing
straight to the screen. The generalizable pattern:

- Render "world/background layers" into an intermediate target.
- Render an effect layer that **samples and distorts** that target (nagomi uses water for
  this — eco-evo would use whatever full-screen effect it needs, or skip it).
- Composite foreground/UI layers on top into a second target.
- Apply a final full-screen post-process pass to the screen.

```ts
renderer.setRenderTarget(intermediateTarget)
renderer.clear()
renderer.render(backgroundScene, camera)
renderer.render(entityScene, camera)
renderer.setRenderTarget(compositeTarget)
renderer.clear()
renderer.render(effectScene, fullscreenCamera) // samples intermediateTarget
renderer.render(foregroundScene, camera)
renderer.setRenderTarget(null)
renderer.render(postScene, fullscreenCamera)
```

Full-screen passes use an identity `THREE.Camera()` with `PlaneGeometry(2,2)` and a vertex
shader writing clip-space directly (`gl_Position = vec4(position.xy, 0.0, 1.0)`).

**Takeaway for eco-evo:** keep the ability to insert full-screen effect/post passes, but the
specific water/reflection/refraction passes are dropped.

### 5.3 CPU tessellation into preallocated typed arrays

Instead of one mesh per entity, nagomi tessellates primitives on the CPU into preallocated
`Float32Array` buffers with `DynamicDrawUsage`, then commits a draw range:

```ts
class GeometryBatch {
  constructor(geometry, capacity, includeColors) {
    this.values = new Float32Array(capacity)
    this.attribute = new THREE.BufferAttribute(this.values, 3)
    this.attribute.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', this.attribute)
    // optional per-vertex color attribute, same pattern
  }
  point(p, color) {
    /* write x,y,z (+rgb) at cursor, advance */
  }
  triangle(a, b, c, color) {
    this.point(a, color)
    this.point(b, color)
    this.point(c, color)
  }
  circle(center, radius, color, segments) {
    /* fan of triangles */
  }
  commit() {
    geometry.setDrawRange(0, this.cursor / 3)
    this.attribute.addUpdateRange(0, this.cursor)
    this.attribute.needsUpdate = true
  }
}
```

Properties worth keeping:

- **Zero per-frame allocation** of GPU buffers; capacity is a fixed constant.
- Materials are flat `MeshBasicMaterial`/`LineBasicMaterial` with `vertexColors`,
  `depthTest:false`, `depthWrite:false`, `toneMapped:false` — no lighting, no depth sorting.
- `frustumCulled = false` because the batch bounding sphere covers the whole world.

**Caveat (see `docs/performance-assessment.md`):** this CPU-tessellation approach is right for
tens-to-hundreds of entities. For thousands, use **GPU instancing** (`THREE.InstancedMesh`)
instead of growing these batches.

### 5.4 Pass class convention

Every renderer pass has the same shape:

```ts
class SomePass {
  constructor() {
    /* build geometry + materials, expose .mesh/.group */
  }
  update(time: number): void {
    /* regenerate dynamic buffers / uniforms */
  }
  refreshConfig(): void {
    /* re-read settings */
  }
  resize(w, h, oldW, oldH): void {
    /* resize targets */
  }
  dispose(): void {
    /* free GPU resources */
  }
}
```

Top-level renderer owns scenes, the camera, render targets, and the draw pipeline.

---

## 6. Pixel-art visual language (what we actually want)

- **Fixed low logical resolution** upscaled with nearest-neighbor (crisp edges).
- **Flat, unlit shapes** built from triangles and circles — no textures, no lighting model.
- **Glorps are intentionally simple: ~24px flat blobs.** eco-evo does not need nagomi's
  multi-segment bodies — one instanced quad/circle per glorp, with color carrying the state.
  This makes rendering thousands of glorps nearly free (see `docs/performance-assessment.md`).
- **Procedural, deterministic variation** (seeded RNG) so shapes/palettes differ per entity
  without sprite sheets.
- **Small curated palettes** per entity "family" (nagomi defines a handful of palettes and
  picks one per entity). eco-evo would define glorps the same way, driven by genes.
- **Color used as state** — e.g. nagomi darkens/desaturates/tints entities with depth. eco-evo
  can map this to genes (diet, energy, species) instead.
- **Minimal, dark, translucent floating UI chrome** over the canvas (Tailwind/shadcn dark
  theme), so the art stays the focus.
- **`shape-rendering="crispEdges"`** for SVG icons (nagomi's favicon is a pixel-art icon) to
  keep the aesthetic consistent.
- Inline GLSL as tagged template literals (`/* glsl */`) with `precision highp float` and small
  hash/noise helpers for any procedural effect.

**Explicitly not carried over:** water surface, reflections/refraction, pond bed, ripples,
weather/rain, lotus/duckweed/butterflies, koi palettes/patterns.

---

## 7. Settings engine (transferable, high value)

nagomi's most reusable subsystem. It makes tuning a simulation manageable without hand-writing
UI.

- `settings/definition.ts` declares the whole settings tree **once**: default, min/max/step,
  control kind (`num`, `range`, `color`, `rgb`, `vec2`, `bool`, `choice`, `index`, `text`,
  `group`, `list`, `collection`), optional `effect` tag.
- `settings/schema.ts` — typed builders + `ValueOf` inference + pure helpers
  (`nodeAt`, `defaults`, `walk`, `validate`); metadata inherits from the nearest ancestor.
- `settings/store.ts` — `SettingsStore` owns:
  - `live`: single mutable tree all consumers read every frame.
  - `overrides`: sparse `Map<"a.b.c", value>` of user edits.
  - Effective value = `defaults ⊕ overrides` (nagomi also layers weather), recomputed **in
    place** preserving object/array identity.
  - Batched notifications, `subscribe`/`subscribePath`, undo/redo (limit 50, grouped within
    550 ms so a slider drag is one entry).
- `settings/effects.ts` maps effect tags to subsystem refreshes (light = next rAF, heavy =
  trailing 100 ms throttle).
- `settings/react.ts` binds React with `useSyncExternalStore` (`useSetting(path)`, …).
- `settings/persistence.ts` stores sparse overrides in localStorage, debounced 600 ms +
  `pagehide` flush, with versioned migration.
- `config.ts` re-exports `settings.live` slices under stable names so sim/render code reads
  plain objects and never knows the settings UI exists.

**To add a setting:** add one node in `definition.ts` with bounds and (optionally) an `effect`
tag; add an `effects.ts` handler only if the tag is new. The UI is generated from the schema.

---

## 8. Determinism & math helpers

- `XorShift32` PRNG with per-entity streams so individuals don't synchronize; default seed
  `0x00c0ffee`. Variation is repeatable and never teleports entities.
- Vec2 helpers (`add`, `sub`, `mul`, `normalize`, `length`, `lerp`, `clamp`, `fromAngle`,
  `wrapAngle`, `perpendicular`) plus `TAU`.
- Pools for transient effects (nagomi pools ripples) and preallocated entity arrays — no
  runtime spawning/allocation in the hot loop.

---

## 9. Patterns worth adopting for eco-evo

1. **Fixed-timestep simulation**, render decoupled at display rate.
2. **Simulation never imports Three.js**; renderer reads entity state and builds geometry.
3. **Fixed low logical resolution + nearest-neighbor upscale** for the pixel-art look.
4. **Flat unlit procedural shapes** with small curated palettes and seeded variation.
5. **Pass classes** with a uniform `update`/`refreshConfig`/`resize`/`dispose` shape.
6. **Schema-first settings** — one definition drives UI, defaults, validation, persistence,
   and effect dispatch.
7. **Layered effective config** materialized into one mutable `live` tree with preserved
   identity.
8. **Preallocated typed arrays / pools** — no per-frame allocation in the hot loop.
9. **Deterministic seeded RNG** for reproducible worlds.
10. **Named exports, kebab-case files, flat sim modules**; React UI separate.

## 10. Engine constants (nagomi reference)

```ts
CANVAS = { width: 480, height: 270 } // logical resolution
SIMULATION = { updatesPerSecond: 60 }
FIXED_STEP = 1 / 60
```

---

## 11. Deployment

**nagomi is not a Next.js app.** It is a **client-only Vite + React SPA**: `vite build`
emits a static `dist/` of HTML/CSS/JS that can be served from any static host. nagomi happens
to deploy to **Cloudflare Workers static assets** (`wrangler.jsonc`, with SPA fallback), and
its only Vercel tie is the optional `@vercel/analytics` snippet injected when a Vercel env is
detected (`main.tsx`). There is no server runtime or SSR requirement.

### eco-evo target: GitHub Pages or self-hosted

Both work with the same static `dist/`.

**GitHub Pages (project site):**

- Set `base` in `vite.config.ts` to the repo subpath, e.g. `base: "/eco-evo/"`, so asset URLs
  resolve correctly. (User/org sites at the root use `base: "/"`.)
- SPA deep links need a fallback: copy `index.html` to `404.html` on deploy, or use a hash
  router. eco-evo is a watch-only canvas app, so a single route is usually enough.
- Deploy via GitHub Actions (`actions/upload-pages-artifact` + `actions/deploy-pages`).

**Self-hosted (static):**

- Serve `dist/` with nginx/Caddy. Add an SPA fallback (`try_files $uri /index.html;` in nginx,
  or `try_files {path} /index.html` in Caddy).
- Set `base: "/"` (or a subpath if serving under one).
- The app is fully client-side; no backend is required unless you add one for saved worlds.

**Practical notes:**

- Everything nagomi does runs in the browser (WebGL); no server needed.
- Avoid `@vercel/analytics` and `wrangler`; use GitHub Pages' built-in analytics or a
  self-hosted option (e.g. Plausible/Umami) if desired.
- Pin assets with content hashes (Vite does this by default) so long-cache headers are safe.
