import { TRAIT_BASE, TRAIT_KEYS, traitValue } from "@/sim/traits";

/**
 * Total levels every glorp holds across all traits: the all-`TRAIT_BASE` build.
 * Inheritance and mutation only ever move points between traits. Living in the
 * config (rather than `traits`) lets the headless simulator override the total
 * with `--set TRAIT_BUDGET=N` when experimenting with trait budgets.
 */
export const TRAIT_BUDGET = TRAIT_BASE * TRAIT_KEYS.length;

/** Maximum number of glorps the simulation can hold at once. */
export const MAX_GLORPS = 2048;

/** Collision / draw radius of a single glorp, in world units. */
export const GLORP_RADIUS = 12;

export const DEFAULT_SEED = 0x00c0ffee;

/** Population the world starts with. */
export const START_PREY = 120;

export const START_HUNTERS = 10;

/** Initial energy every glorp spawns with, as a percentage of satiation. */
export const FED_START = 50;

/** Energy an offspring starts life with. */
export const OFFSPRING_FED = 50;

export const FED_MAX = 100;

/** Energy every glorp burns per second at level-0 endurance. */
export const METABOLISM = 2.75;

export const ENDURANCE = {
  /**
   * Life-force (hunger) drain multiplier at maximum endurance. `0.7` means a
   * glorp at `TRAIT_MAX` burns hunger 30% slower than at level 0. Interpolated
   * linearly across levels, so each point trims drain a little.
   */
  drainFactorAtMax: 0.9,
} as const;

/** Below this fed value a glorp becomes hungry and starts seeking food. */
export const HUNGER = 70;

/**
 * Two hunters within this distance (world units) can pair-reproduce. Four body
 * radii keeps mates visually "touching" without requiring pixel-perfect contact.
 */
export const MATE_RANGE = 48;

/** Minimum fed each parent needs to pair-reproduce. */
export const MATE_FED_MIN = 50;

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
export const GESTATION_SECONDS = 30;

/** Top-speed multiplier applied while pregnant. */
export const PREGNANT_SPEED_FACTOR = 0.8;

/** Whether a pregnant glorp may sprint. */
export const PREGNANT_CAN_SPRINT = true;

/**
 * Seconds a pair must stay within `MATE_RANGE` before conceiving. Zero mates
 * on first contact, as before.
 */
export const MATE_CONTACT_SECONDS = 0;

/** Well-fed, off-cooldown hunters actively steer toward eligible mates. */
export const MATE_SEEKING = true;

/**
 * Levels a glorp of each type starts from before `SPAWN_SHUFFLES`. The total is
 * rebalanced to `TRAIT_BUDGET`, so it need not sum to it.
 */
export const SPAWN_BASE = {
  prey: { speed: 4, endurance: 4, fertility: 4, agility: 4 },
  hunter: { speed: 4, endurance: 4, fertility: 4, agility: 4 },
} as const;

/** Point transfers applied to an all-base build when a glorp is first spawned. */
export const SPAWN_SHUFFLES = 12;

/** Chance a clone moves one trait point. Clones stay close to their parent. */
export const CLONE_MUTATION_CHANCE = 0.25;

/**
 * Chance a pair-born child moves one trait point, on top of the variance from
 * recombining two parents.
 */
export const MATED_MUTATION_CHANCE = 0.5;

export const MOVEMENT = {
  /** Fraction of a glorp's top speed used when moving without sprinting. */
  walkFactor: 0.45,
  /**
   * Jog tier: fraction of top speed an exhausted glorp keeps while pursuing or
   * fleeing. It scales with `endurance`, interpolating from `jogFactorMin`
   * (least endurance) to `jogFactorMax` (most), so endurance buys speed once
   * tired instead of a flat rate for everyone. `jogFactorMin` anchors the
   * extrapolated level 0; level 1 still jogs at 0.55.
   */
  jogFactorMin: 0.5,
  jogFactorMax: 0.85,
} as const;

/** How quickly velocity is steered toward its target, in 1/s. */
export const STEER_RATE = 8;

/** How quickly wander headings drift, in radians/s. */
export const WANDER_TURN_RATE = 2;

export const STAMINA = {
  drainPerSecond: 1.0,
  /** Recovery rate at `referenceMax`; scales with a glorp's own capacity. */
  recoverPerSecond: 0.6,
  /**
   * `endurance` value at which recovery runs at `recoverPerSecond`. Recovery
   * scales linearly with capacity relative to this, so a bigger reserve refills
   * proportionally faster and spends a larger share of time sprinting. Anchored
   * at the base build, so an all-base glorp behaves as it always did.
   */
  referenceMax: traitValue("endurance", TRAIT_BASE),
  /**
   * A glorp that drains its stamina to empty latches into exhaustion and cannot
   * sprint again until stamina recovers to this fraction of its endurance. This
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
 * carrying capacity: at level-0 endurance prey need ~`METABOLISM *
 * PREY_CONSUME_PER_SECOND / PREY_ENERGY_PER_SECOND` grass per second, so this
 * sustains roughly 400 prey before food becomes limiting. Endurance lowers that
 * need, raising the ceiling.
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
 * When true, a prey whose `agility` exceeds its attacker's can dodge the catch.
 * Off makes agility inert, which the headless simulator uses as an A/B control.
 */
export const DODGE_ENABLED = true;
/** Dodge chance added per agility level the prey has over the hunter. */
export const DODGE_CHANCE_PER_LEVEL = 0.15;

/** Ceiling on dodge chance, however large the agility gap. */
export const DODGE_CHANCE_MAX = 0.9;

/**
 * Seconds a dodging prey commits to its escape dart. While dodging it is
 * untargetable: no hunter can pick it or eat it.
 */
export const DODGE_DURATION = 0.3;

/**
 * Fixed distance, in world units, a dodge carries the prey over its dart. The
 * escape is independent of the `speed` trait, so speed gets no second payoff.
 */
export const DODGE_DISTANCE = 40;

/**
 * Escape-dart speed, derived from the fixed distance and duration so a dart
 * covers `DODGE_DISTANCE` however fast the prey's `speed` trait is.
 */
export const DODGE_SPEED = DODGE_DISTANCE / DODGE_DURATION;

/**
 * Contact range, in world units, at which a catch resolves and a dodge can
 * fire: one glorp body diameter. While a dodge lasts the prey is untargetable,
 * so the hunter's normal prey search simply reprioritizes to the next victim.
 */
export const CATCH_PREY_RANGE = 2 * GLORP_RADIUS;

/**
 * Speed every glorp walks and wanders at, whatever its `speed` trait. Speed
 * then only pays off in pursuit and flight, so prey don't evolve top speed just
 * to graze faster and hunters can catch them.
 */
export const WALK_SPEED = 50;
