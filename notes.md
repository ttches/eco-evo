# eco-evo — Design Notes

## Concept

A simulation game that users mostly **watch** without interacting with directly.

## Tech & Art Direction

- **Engine setup, tech, and art direction:** based on the sibling project **nagomi**.
- **Coding style:** closer to **whendow.ui** — const functions, types, and common patterns.
- **Styling:** CSS Modules preferred, unless not recommended.

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
