/** Maximum number of glorps the simulation can hold at once. */
export const MAX_GLORPS = 2048;

/** Collision / draw radius of a single glorp, in world units. */
export const GLORP_RADIUS = 12;

export const DEFAULT_SEED = 0x00c0ffee;

/** Population the world starts with. */
export const START_PREY = 120;

export const START_HUNTERS = 8;

/** Initial energy every glorp spawns with, as a percentage of satiation. */
export const FED_START = 50;

/** Energy an offspring starts life with. */
export const OFFSPRING_FED = 50;

export const FED_MAX = 100;

/** Below this fed value a glorp becomes hungry and starts seeking food. */
export const HUNGER = 70;

/**
 * Two hunters within this distance (world units) can pair-reproduce. Four body
 * radii keeps mates visually "touching" without requiring pixel-perfect contact.
 */
export const MATE_RANGE = 48;

/** Minimum fed each parent needs to pair-reproduce. */
export const MATE_FED_MIN = HUNGER;

/**
 * When false, hunters reproduce only by mating and never by asexual
 * duplication. Prey are unaffected.
 */
export const HUNTER_ASEXUAL = true;

/** Energy each parent spends at conception. */
export const MATE_ENERGY_COST = 0;

/**
 * Seconds a pregnant glorp carries its offspring before it is born. At
 * conception nothing is allocated: the child does not exist until this timer
 * expires. Zero means the child is born immediately.
 */
export const GESTATION_SECONDS = 45;

/** Top-speed multiplier applied while pregnant. */
export const PREGNANT_SPEED_FACTOR = 0.7;

/** Whether a pregnant glorp may sprint. */
export const PREGNANT_CAN_SPRINT = true;

/**
 * Seconds a pair must stay within `MATE_RANGE` before conceiving. Zero mates
 * on first contact, as before.
 */
export const MATE_CONTACT_SECONDS = 0;

/** Well-fed, off-cooldown hunters actively steer toward eligible mates. */
export const MATE_SEEKING = false;

/** Chance a pair-reproduced child inherits the more favorable parent's value. */
export const INHERIT_BEST_CHANCE = 0.75;

/** Symmetric relative mutation spread (±) applied per trait to any offspring. */
export const MUTATION_RATE = 0.08;

/** Extra relative drift per trait in the direction the glorp's directive prefers. */
export const MUTATION_BIAS = 0.02;

/** Chance each directive bit flips when passed to an offspring. */
export const DIRECTIVE_FLIP_CHANCE = 0.05;

export const MOVEMENT = {
  /** Fraction of a glorp's top speed used when moving without sprinting. */
  walkFactor: 0.45,
  /**
   * Fraction of top speed used when a pursuing glorp is too exhausted to
   * sprint. Between walking and sprinting, so fatigue still leaves some agency.
   */
  jogFactor: 0.7,
} as const;

/** How quickly velocity is steered toward its target, in 1/s. */
export const STEER_RATE = 8;

/** How quickly wander headings drift, in radians/s. */
export const WANDER_TURN_RATE = 2;

export const STAMINA = {
  drainPerSecond: 1.0,
  recoverPerSecond: 0.6,
  /**
   * A glorp that drains its stamina to empty latches into exhaustion and cannot
   * sprint again until stamina recovers to this fraction of `staminaMax`. This
   * hysteresis is what stops the per-frame sprint/walk flicker that pinned
   * stamina at zero.
   */
  sprintReadyFraction: 0.5,
} as const;

/**
 * Side of a spatial-grid cell, in world units. Near the common query ranges
 * (prey flee, mating) so most lookups only touch a few cells.
 */
export const SPATIAL_CELL = 64;

/** Hunter perception range. */
export const HUNTER_SIGHT = 220;

/** Prey flight range. */
export const PREY_FLEE = 120;

/**
 * How far ahead, in world units, a steering glorp checks the arena bounds when
 * choosing a heading. Wide enough to begin turning before reaching a wall.
 */
export const STEER_LOOKAHEAD = 48;

/**
 * Hunters sprint this much faster than their `speed` trait, so they can close
 * on fleeing prey. Without an edge predators never catch anything and starve.
 */
export const HUNTER_SPRINT_MULTIPLIER = 1.4;

/** Grass is laid out on a grid of this many world units per tile. */
export const GRASS_TILE = 32;

/**
 * Grass regrows at this fraction per second, capped at 1. Total regrowth is
 * `tiles * GRASS_REGROW` (~33 grass/s across the 120x68 grid), which sets the
 * carrying capacity: prey need ~`metabolism / GRASS_ENERGY` grass per second,
 * so this sustains roughly 400 prey before food becomes limiting.
 */
export const GRASS_REGROW = 0.004;

export const GRASS_INITIAL_MIN = 0.15;

export const GRASS_INITIAL_MAX = 0.6;

/** Tiles at or below this value are treated as bare ground. */
export const GRASS_MIN_VALUE = 0.01;

/** Grass a grazing prey consumes per second. */
export const PREY_CONSUME_PER_SECOND = 0.5;

/** Energy a grazing prey gains per second. */
export const PREY_ENERGY_PER_SECOND = 18;

/** Energy gained from a successful hunt. */
export const HUNTER_KILL_FED = 30;

/** Starving hunters may prey on other hunters when this is true. */
export const CANNIBALISM = true;

/** Below this fed a hunter will prey on other hunters. */
export const CANNIBAL_HUNGER = 20;

/** Energy gained from eating another hunter. */
export const CANNIBAL_KILL_FED = 15;

/**
 * When true, predation is gated by strength: a hunter can eat a glorp only if
 * its floored `strength` tier is within `STRENGTH_EDGE` of the target's.
 */
export const STRENGTH_GATES_PREDATION = true;

/**
 * How many strength tiers above its own a hunter can still eat. Zero means it
 * must match or exceed the prey's tier. The default of 4 keeps the gate
 * meaningful without starving low-tier hunters early (see sim sweeps).
 */
export const STRENGTH_EDGE = 4;
