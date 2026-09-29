# eco-evo — Design Notes

## Concept

A simulation game that users mostly **watch** without interacting with directly.

## Tech & Art Direction

- **Engine setup, tech, and rendering:** based on the sibling project **nagomi** — its
  fixed-timestep loop, simulation/render separation, WebGL renderer, and **pixel-art look**
  (fixed low logical resolution upscaled with nearest-neighbor, flat procedural shapes).
- **Not taken from nagomi:** anything water/fish/pond-specific — water surface, reflections,
  refraction, ripples, weather, koi, and aquatic props. eco-evo is not fish- or water-based.
- **Coding style:** closer to **whendow.ui** — const arrow functions, `type` aliases, and
  common patterns.
- **Styling:** CSS Modules (not styled-components).
- **Deployment:** static SPA hosted on **GitHub Pages or self-hosted** — no Next.js, no
  server runtime. (nagomi is a plain Vite SPA, not Next.js.)
- **Glorp art:** glorps can be **very undetailed — simple ~24px blobs** (flat, unlit,
  pixel-art). No complex procedural bodies needed.
- Reference docs live in `docs/`.

## Gameplay

- Creatures called **glorps**.
- All glorps are identical except for their **genes**.
- Genetics follow **Mendelian inheritance**, with attributes such as:
  - speed
  - stamina
  - strength
  - metabolism
- Diet types:
  - **Predators** — must eat other glorps.
  - **Herbivores** — eat plants that also spawn.
  - **Omnivores** — eat both.
- Glorps die if they cannot find food based on their metabolism.
- **Reproduction is duplication:** if a glorp finds enough food, or finds another
  glorp that is similar enough, it **duplicates** (produces an offspring), passing
  on its attributes. Glorps that are too genetically different cannot duplicate.

## Scale & World

- Target population: **hundreds to thousands** of glorps in a single world.
- The world should be **zoomable** (zoom in/out over a larger continuous space).

## Future

- Introduce **genes** that act as big boosts to attributes but carry downsides
  (e.g. much faster but much less stamina).
- These can be passed around via **Mendelian genetics** with dominant and
  recessive alleles.

## Roadmap / Upcoming

See `docs/` for the reference material these build on:
`nagomi-technical-reference.md`, `whendow-ui-coding-style.md`,
`performance-assessment.md`, `prior-art-research.md`.

### Milestone 3 — Simulation core

- **Energy budget:** metabolism drains energy, food restores it, zero = death.
- **Resource grid:** a coarse, regrowing field of plant food (also the
  carrying-capacity knob).
- **Attributes/stats:** speed, stamina, strength, metabolism (start as plain
  stats; genes come later).
- **Reproduction:** asexual duplication by energy, with mutation.
- **Population dynamics:** births, deaths, carrying capacity.

### Later

- **Mendelian genetics:** diploid alleles, dominant/recessive.
- **"Similar-enough" partner reproduction** → speciation.
- **Spatial grid:** neighbor queries for separation, predation, and
  mate-finding (O(n²) → O(n·k)). Sim-side, added when behavior needs it.
- **Camera:** auto-follow, minimap, zoom presets.
- **Settings engine:** schema-driven store/editor (per nagomi).
- **Deployment:** GitHub Pages or self-hosted static.

### Performance / scale

- Spatial grid, struct-of-arrays (done), GPU instancing (done), LOD by zoom,
  chunked simulation, Web Worker simulation.
