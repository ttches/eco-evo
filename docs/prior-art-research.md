# Prior Art — Evolution & Ecosystem Simulations

Research into existing open-source simulations/games relevant to eco-evo: watch-only,
glorps with Mendelian genetics (speed, stamina, strength, metabolism), trophic roles
(predator/herbivore/omnivore), energy-based death, reproduction with "similar-enough"
individuals, and hundreds-to-thousands of agents in a zoomable world.

---

## 1. Closest matches (read these first)

### The Bibites — Léo Caussan
- https://www.thebibites.com/ · https://thebibites.itch.io/the-bibites · genes: https://thebibites.fandom.com/wiki/Genes
- Unity/C#, 2D, hundreds-to-low-thousands of agents.
- **Closest genetics match.** Genes include Diet, Size Ratio, Metabolism Speed, View
  Radius/Angle, color, organ sizes, plus *heritable* mutation genes. Mutation = Poisson count
  of events, each applying a log-normal relative change `new = old * (1+var)^N(0,1)` plus a
  small absolute Gaussian term. Neural-net brains, energy-conserving metabolism, eggs from
  "similar-enough" parents, color derived from genes.

### Biosim4 — David Randall Miller
- https://github.com/davidrmiller/biosim4 (3.4k★) · talk: https://www.youtube.com/watch?v=N3tRFayqVtk
- C++/OpenCV + OpenMP, ~thousands of agents on a dense 2D grid.
- **Closest engineering match.** Haploid genome compiles to a neural-net "brain" at birth.
  Perf: dense `Grid` of 16-bit indices (O(1) neighbor/occupancy), OpenMP-parallel per-agent
  loop, separate read-only sensor pass then action pass, pheromone signal layer.
- Nice-UI fork: https://github.com/ilyabrilev/biosim4

### Species: ALRE
- https://store.steampowered.com/app/774541/
- Unity/C#, desktop, hundreds. **Speciation reference** — emergent natural selection and
  real-time splitting into species via reproductive isolation. Maps to "similar-enough"
  reproduction and clade coloring.

---

## 2. Artificial life / evolution simulators

| Project | URL | Stack | Scale | Notes |
|---|---|---|---|---|
| ALIEN | https://github.com/chrxh/alien | C++/CUDA | 10⁵–10⁶ | GPU physics, open-ended evolution |
| Lenia | https://github.com/Chakazul/Lenia | Python/JS | millions of cells | continuous CA; JAX accel: https://github.com/maxencefaldor/cax |
| Particle Life | https://github.com/tom-mohr/particle-life-app | Java | 10³–10⁴ | N×N attraction matrix, uniform spatial grid |
| Polyworld | https://github.com/polyworld/polyworld | C++/Qt/OpenGL | hundreds | genome→body+brain+mutation rate, Hebbian learning |
| Karl Sims | https://www.karlsims.com/evolved-virtual-creatures.html | CM-5 | hundreds | graph genotype→morphology+control |
| Tierra | http://tomray.me/tierra/ | C VM | thousands | self-replicating code, host–parasite co-evolution |
| Avida | https://github.com/devosoft/avida | C++ | thousands | instruction genomes, research platform |
| rust_scriptbots | https://github.com/Dicklesworthstone/rust_scriptbots | Rust | many | deterministic ALife, GPU UI, DuckDB analytics |
| Anima-Engine | https://github.com/DuongNAD/Anima-Engine | Rust/Tauri | GPU | real-time GPU-accelerated evolution |
| formicarium | https://github.com/gliderkite/formicarium | Rust | many | ant-colony zero-player sim |
| carykh JES | https://github.com/carykh/jes | Java/JS/Python | 10²–10³ | soft-body evolution sandbox |

## 3. Biology / ecology simulations

- **NetLogo Wolf Sheep Predation** — https://ccl.northwestern.edu/netlogo/models/WolfSheepPredation
  The canonical energy-budget ABM: eating replenishes energy, running out = death,
  reproduction is probabilistic. The grass-regrowth variant is stable (carrying capacity);
  the infinite-grass variant oscillates. Directly mirrors eco-evo's design.
- **Mesa** — https://github.com/mesa/mesa (Python ABM framework, WolfSheep example).
- **Lotka–Volterra** — https://en.wikipedia.org/wiki/Lotka%E2%80%93Volterra_equations
  Baseline predator-prey cycles. Key concepts: *paradox of enrichment* (richer environment can
  destabilize) and the *atto-fox problem* (continuous models under-predict extinction in small
  populations — a reason to use discrete agents).
- **Ecopath with Ecosim** — https://ecopath.org/ (trophic mass-balance / food webs).
- **Madingley Model** — https://madingley.github.io/ (general ecosystem model, cohorts).
- **Repast / MASON / GAMA** — academic ABM platforms (Java).

## 4. Simple / fun browser evolution games

- **Thrive** — https://github.com/Revolutionary-Games/Thrive (C#/Godot, 3.7k★) — player-driven
  evolution; good UX/progression reference.
- **carykh Evolution Simulator / Jelly Evolution Simulator** — https://github.com/carykh/jes
  (also https://github.com/carykh/evolutionSteer) — famous browser evolution sandbox.
- **NeuroCivilization** — https://github.com/twiks228/NeuroCivilization (C# zero-player ALife).
- **vehsamrak/genetics** — https://github.com/vehsamrak/genetics (Go bacterium evolution).
- **Cellsim-2** — https://github.com/m1rza-s/Cellsim-2 (Java/JavaFX life cycle sim).
- Classic non-OSS ancestors: **Darwin Pond**, **Gene Pool** by Jeffrey Ventrella
  (https://www.ventrella.com/), **Ecosystem**, **Spore**, **Osmos**, **Cell Lab**.

## 5. Genetics-focused simulations

Mendelian inheritance is under-served by big ALife sims (most use haploid genomes). References:
- **punnett-square** — https://github.com/smmariquit/punnett-square (React + TS + Vite).
- **genetix** — https://github.com/Mohan-I/genetix (TS statistical inheritance).
- **ABO Population Simulation** — https://github.com/bobbyybg/ABO-Population-Simulation
  (Monte Carlo population genetics under Mendelian inheritance).
- **nookie** — https://github.com/eriqande/nookie (C, Mendelian inheritance of markers).
- **PhET Natural Selection** — https://phet.colorado.edu/en/simulations/natural-selection
  (excellent genotype→phenotype UX reference).
- Theory toolkit: Hardy–Weinberg equilibrium, genetic drift, selection coefficients.

**Key implication:** model each quantitative trait (speed/stamina/strength/metabolism) as a
**polygenic set of diploid loci** (multiple loci per trait, additive + dominance effects +
environment/noise). This yields continuous bell-shaped traits with discrete Mendelian
inheritance and occasional dominance surprises.

## 6. Performance techniques for large agent counts

- **Spatial partitioning**
  - Uniform grid / spatial hash: Biosim4 dense `Grid`; Primordial Particle System (1M
    particles) https://github.com/curtis-aln/Primordial-Particle-System; spatial-hash topic
    https://github.com/topics/spatial-hashing.
  - Quadtree for variable density: https://github.com/kieda/Quadtree.
  - Benchmark: https://github.com/jdseo921/frame-budget — 10,000 steering agents at
    **5.95 ms/frame** with GPU instancing + spatial hashing.
- **ECS / data-oriented (SoA typed arrays)**
  - bitECS (TS) https://github.com/NateTheGreatt/bitECS, EnTT https://github.com/skypjack/entt,
    Flecs https://github.com/SanderMertens/flecs, Arch https://github.com/genaray/Arch.
- **GPU / instancing**
  - ALIEN (CUDA), Anima-Engine (GPU), cax (JAX). Browser: WebGPU compute, WebGL2
    `InstancedMesh` (three.js) / PixiJS `ParticleContainer` for tens of thousands in one draw.
- **Parallelism & scheduling**
  - Biosim4 uses OpenMP; web equivalent is Web Workers + SharedArrayBuffer, sim on a separate
    thread. Double-buffer state each tick.
- **Zoom / LOD**
  - LOD by zoom (point/pixel at far zoom, detail at close), viewport culling, chunked
    simulation (Minecraft/Madingley style).
- **Determinism**
  - Seeded per-agent RNG (Bibites, rust_scriptbots) for reproducible, shareable worlds.

## 7. Patterns to borrow for eco-evo

**Agent / energy**
- Every glorp has an **energy reserve**; movement, attacking, reproduction, and idle
  metabolism drain it; eating replenishes; zero = death. This produces carrying capacity
  naturally (NetLogo, Bibites, Species ALRE).
- Tie genes to costs: metabolism→idle drain, speed→movement cost, strength→predation,
  stamina→sustained-movement efficiency. Trade-offs make evolution interesting.
- Model food as a **regrowing resource field** (not per-plant entities) — cheap and acts as the
  carrying-capacity knob.

**Genetics**
- Diploid, multi-locus, polygenic traits; phenotype = Σ allele effects + dominance + noise;
  cache phenotype at birth.
- Make **mutation rate itself heritable** (Bibites): Poisson mutation count + log-normal
  relative change + small absolute term.
- **Genetic-distance threshold** for reproduction → emergent speciation; color-code clades.
  Asexual duplication with mutation is the simple baseline.
- Diet as a **continuous locus** (0 herbivore → 1 predator) rather than three classes, so
  omnivory evolves smoothly.

**Ecology / macro-evolution**
- Track lineage genetic distance → label species, optionally block interbreeding.
- Watch for extinction cascades (predators overshoot prey) and evolutionary stagnation
  (Tierra/Avida plateau). Mitigate with spatial refugia, mutation variance, seasons.

**Performance**
- Dense uniform grid or spatial hash; SoA typed arrays; double-buffered ticks; Web Workers for
  sim; instanced rendering + LOD by zoom; fixed timestep; seeded RNG; object pools for
  births/deaths.

**Presentation (watch-only "content")**
- Population graphs, trait-distribution histograms, clade coloring, and speciation events are
  the things the player watches (PhET / Bibites style).

## 8. Quick-reference table

| Project | URL | Stack | Scale | Genetics/evolution | Perf trick |
|---|---|---|---|---|---|
| Biosim4 | github.com/davidrmiller/biosim4 | C++/OpenMP | ~thousands | haploid genome→NN, generational | dense grid, OpenMP, double-buffer |
| ALIEN | github.com/chrxh/alien | C++/CUDA | 10⁵–10⁶ | agent-based | GPU compute |
| Lenia / cax | github.com/Chakazul/Lenia | Python/JS/JAX | millions | continuous CA | vectorized/GPU |
| Particle Life | github.com/tom-mohr/particle-life-app | Java | 10³–10⁴ | attraction matrix | uniform spatial grid |
| Polyworld | github.com/polyworld/polyworld | C++/OpenGL | hundreds | genome→body+brain | plane+vision |
| Karl Sims | karlsims.com/evolved-virtual-creatures.html | CM-5 | hundreds | graph genotype→morphology | massively parallel HW |
| Tierra | tomray.me/tierra | C VM | thousands | self-replicating code | custom VM |
| Avida | github.com/devosoft/avida | C++ | thousands | instruction genomes | grid, research tooling |
| The Bibites | thebibites.itch.io/the-bibites | Unity/C# | 10²–10³ | Mendelian-ish, Poisson+Gaussian mutation | real-time 2D energy systems |
| Species ALRE | store.steampowered.com/app/774541 | Unity/C# | 10²–10³ | speciation, natural selection | real-time |
| Thrive | github.com/Revolutionary-Games/Thrive | C#/Godot | player | organelle genome | engine |
| carykh JES | github.com/carykh/jes | Java/JS | 10²–10³ | GA + physics bodies | browser |
| NetLogo Wolf-Sheep | ccl.northwestern.edu/netlogo/models/WolfSheepPredation | NetLogo | 10²–10³ | energy budgets, grass regrowth | ABM reference |
| bitECS | github.com/NateTheGreatt/bitECS | TS | — | — | typed arrays, SoA |
| frame-budget | github.com/jdseo921/frame-budget | C#/Unity | 10⁴ | — | spatial hash + GPU instancing, 5.95 ms |
| Primordial Particle System | github.com/curtis-aln/Primordial-Particle-System | C++/SFML | 10⁶ | particle ALife | spatial hash + multithread |

**Bottom line:** The Bibites is the closest gameplay/genetics match; Biosim4 is the closest
engineering match for grid+parallel agents; Species ALRE is the speciation reference; NetLogo
Wolf-Sheep gives the canonical energy/carrying-capacity rules; and spatial-hash + SoA +
instanced rendering is the proven path to thousands of agents at 60 fps in a zoomable world.
