/** Maximum number of glorps the simulation can hold at once. */
export const MAX_GLORPS = 512

/** Collision / draw radius of a single glorp, in world units. */
export const GLORP_RADIUS = 12

export const DEFAULT_SEED = 0x00c0ffee

/** Population the world starts with. */
export const START_PREY = 30

export const START_HUNTERS = 6

/** Initial energy every glorp spawns with, as a percentage of satiation. */
export const FED_START = 50

/** Energy an offspring starts life with. */
export const OFFSPRING_FED = 50

export const FED_MAX = 100

/** Below this fed value a glorp becomes hungry and starts seeking food. */
export const HUNGER = 70

/**
 * Two hunters within this distance (world units) can pair-reproduce. Four body
 * radii keeps mates visually "touching" without requiring pixel-perfect contact.
 */
export const MATE_RANGE = 48

/** Minimum fed each parent needs to pair-reproduce. */
export const MATE_FED_MIN = HUNGER

/** Chance a pair-reproduced child inherits the more favorable parent's value. */
export const INHERIT_BEST_CHANCE = 0.75

/** Symmetric relative mutation spread (±) applied per trait to any offspring. */
export const MUTATION_RATE = 0.08

/** Extra relative drift per trait in the direction the glorp's directive prefers. */
export const MUTATION_BIAS = 0.02

/** Chance each directive bit flips when passed to an offspring. */
export const DIRECTIVE_FLIP_CHANCE = 0.05

export const MOVEMENT = {
  /** Fraction of a glorp's top speed used when moving without sprinting. */
  walkFactor: 0.45,
} as const

/** How quickly velocity is steered toward its target, in 1/s. */
export const STEER_RATE = 8

/** How quickly wander headings drift, in radians/s. */
export const WANDER_TURN_RATE = 2

export const STAMINA = {
  drainPerSecond: 1.0,
  recoverPerSecond: 0.6,
} as const

/**
 * Side of a spatial-grid cell, in world units. Near the common query ranges
 * (prey flee, mating) so most lookups only touch a few cells.
 */
export const SPATIAL_CELL = 64

/** Hunter perception range. */
export const HUNTER_SIGHT = 220

/** Prey flight range. */
export const PREY_FLEE = 120

/**
 * Hunters sprint this much faster than their `speed` trait, so they can close
 * on fleeing prey. Without an edge predators never catch anything and starve.
 */
export const HUNTER_SPRINT_MULTIPLIER = 1.4

/** Grass is laid out on a grid of this many world units per tile. */
export const GRASS_TILE = 32

/**
 * Grass regrows at this fraction per second, capped at 1. Total regrowth is
 * `tiles * GRASS_REGROW` (~8 grass/s across the 60x34 grid), which sets the
 * carrying capacity: prey need ~`metabolism / GRASS_ENERGY` grass per second,
 * so this sustains roughly 100 prey before food becomes limiting.
 */
export const GRASS_REGROW = 0.004

export const GRASS_INITIAL_MIN = 0.15

export const GRASS_INITIAL_MAX = 0.6

/** Tiles at or below this value are treated as bare ground. */
export const GRASS_MIN_VALUE = 0.01

/** Grass a grazing prey consumes per second. */
export const PREY_CONSUME_PER_SECOND = 0.5

/** Energy a grazing prey gains per second. */
export const PREY_ENERGY_PER_SECOND = 18

/** Energy gained from a successful hunt. */
export const HUNTER_KILL_FED = 30
