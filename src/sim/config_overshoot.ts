// VARIANT: traction (fast glorps turn wide) + dodge chance scales with the hunter's lunge speed + a juked hunter loses track for 2s (recommended)
// Changed from config.ts: TRACTION.enabled, DODGE_LUNGE.enabled, DODGE_LOSES_TRACK_SECONDS. Rename to config.ts to play it.

import { TRAIT_BASE, TRAIT_KEYS, traitValue } from '@/sim/traits'

/**
 * Central tuning levers for the simulation. Grouped by concern; every value is a
 * flat named export so the headless simulator can sweep it with `--set NAME=...`.
 */

// ---------------------------------------------------------------------------
// World & population
// ---------------------------------------------------------------------------

/**
 * Total levels every glorp holds across all traits: the all-`TRAIT_BASE` build.
 * Inheritance and trait drift only ever move points between traits. Living in
 * the config (rather than `traits`) lets the headless simulator override the
 * total with `--set TRAIT_BUDGET=N` when experimenting with trait budgets.
 */
export const TRAIT_BUDGET = TRAIT_BASE * TRAIT_KEYS.length

/** Maximum number of glorps the simulation can hold at once. */
export const MAX_GLORPS = 2048

/** Collision / draw radius of a single glorp, in world units. */
export const GLORP_RADIUS = 12

export const DEFAULT_SEED = 0x00c0ffee

/** Population the world starts with. */
export const START_PREY = 120

export const START_HUNTERS = 10

// ---------------------------------------------------------------------------
// Energy & metabolism
// ---------------------------------------------------------------------------

/** Initial energy every glorp spawns with, as a percentage of satiation. */
export const FED_START = 50

/** Energy an offspring starts life with at minimum parent fertility. */
export const OFFSPRING_FED = 50

/** Energy a clone starts life with at maximum parent fertility. */
export const CLONE_OFFSPRING_FED_MAX = 75

/** Energy a pregnancy-born child starts life with at maximum mother fertility. */
export const MATED_OFFSPRING_FED_MAX = 100

export const FED_MAX = 100

/** Energy every glorp burns per second at level-0 endurance. */
export const METABOLISM = 2.85

export const ENDURANCE = {
  /**
   * Life-force (hunger) drain multiplier at maximum endurance. `0.8` means a
   * glorp at `TRAIT_MAX` burns hunger 20% slower than at level 0. Interpolated
   * linearly across levels, so each point trims drain a little.
   */
  drainFactorAtMax: 0.85,
} as const

/** Below this fed value a glorp becomes hungry and starts seeking food. */
export const HUNGER = 70

// ---------------------------------------------------------------------------
// Reproduction
// ---------------------------------------------------------------------------

/**
 * Two hunters within this distance (world units) can pair-reproduce. Four body
 * radii keeps mates visually "touching" without requiring pixel-perfect contact.
 */
export const MATE_RANGE = 48

/** Minimum fed each parent needs to pair-reproduce. */
export const MATE_FED_MIN = 50

/**
 * When false, hunters reproduce only by mating and never by asexual
 * duplication. Prey are unaffected.
 */
export const HUNTER_ASEXUAL = true

/**
 * Fraction of a clone's starting energy its parent pays at birth. Zero makes
 * cloning free: the parent stays full and the child's energy comes from
 * nowhere, so reproduction is limited by cooldown alone.
 */
export const CLONE_COST = 0

/** Energy each parent spends at conception. */
export const MATE_ENERGY_COST = 0

/**
 * Seconds a pregnant glorp carries its offspring before it is born. At
 * conception nothing is allocated: the child does not exist until this timer
 * expires. Zero means the child is born immediately.
 */
export const GESTATION_SECONDS = 30

/** Top-speed multiplier applied while pregnant at minimum fertility. */
export const PREGNANT_SPEED_FACTOR_MIN = 0.8

/** Top-speed multiplier applied while pregnant at maximum fertility. */
export const PREGNANT_SPEED_FACTOR_MAX = 1

/** Whether a pregnant glorp may sprint. */
export const PREGNANT_CAN_SPRINT = true

/**
 * Seconds a pair must stay within `MATE_RANGE` before conceiving. Zero mates
 * on first contact, as before.
 */
export const MATE_CONTACT_SECONDS = 0

/** Well-fed, off-cooldown hunters actively steer toward eligible mates. */
export const MATE_SEEKING = true

// ---------------------------------------------------------------------------
// Traits, spawning & mutations
// ---------------------------------------------------------------------------

/**
 * Levels a glorp of each type starts from before `SPAWN_SHUFFLES`. The total is
 * rebalanced to `TRAIT_BUDGET`, so it need not sum to it.
 */
export const SPAWN_BASE = {
  prey: { speed: 4, endurance: 4, fertility: 4, agility: 4 },
  hunter: { speed: 4, endurance: 4, fertility: 4, agility: 4 },
} as const

/** Point transfers applied to an all-base build when a glorp is first spawned. */
export const SPAWN_SHUFFLES = 12

/** Chance a clone's trait points drift by one. Clones stay close to their parent. */
export const CLONE_TRAIT_DRIFT_CHANCE = 0.25

/**
 * Chance a pair-born child's trait points drift by one, on top of the variance
 * from recombining two parents.
 */
export const MATED_TRAIT_DRIFT_CHANCE = 0.5

/**
 * Chance a clone or spawned glorp rolls a brand-new mutation when it did not
 * inherit one. Mated pregnancies use `MUTATION_PREGNANCY_BIRTH_CHANCE` instead.
 * A glorp never holds more than `MAX_MUTATIONS`.
 */
export const MUTATION_BIRTH_CHANCE = 0.01

/** Chance a mated pregnancy rolls a brand-new mutation when it inherited none. */
export const MUTATION_PREGNANCY_BIRTH_CHANCE = 0.05

/** Chance each parent's carried mutation is inherited by a child, in parent order. */
export const MUTATION_INHERIT_CHANCE = 0.25

/** Most mutations a single glorp can hold; further rolls are discarded. */
export const MAX_MUTATIONS = 1

/**
 * Master switch for the mutation system. When false no glorp ever rolls or
 * inherits a mutation, whatever the chances above. The headless simulator uses
 * it to turn the whole system off cleanly (`--set MUTATIONS_ENABLED=false`).
 */
export const MUTATIONS_ENABLED = true

/**
 * Cold blooded mutation effect levers. Kept here (not in the registry) so the
 * headless simulator can sweep them with `--set COLD_BLOODED.hungerDrain=...`.
 */
export const COLD_BLOODED = {
  /** Multiplier on hunger drain: 0.5 means it burns half as fast. */
  hungerDrain: 0.75,
  /** Multiplier on the mechanical value of the `speed` trait. */
  speedEffectiveness: 0.7,
} as const

/**
 * Stoat mutation effect levers. Kept here so the headless simulator can sweep
 * them with `--set STOAT.speedMultiplier=...` or `--set STOAT.hungerDrain=...`.
 */
export const STOAT = {
  /** Multiplier on every movement speed the glorp uses. */
  speedMultiplier: 2,
  /**
   * Multiplier on hunger drain: 3 means it burns three times as fast. Applied
   * after the `endurance` modifier, mirroring how cold blooded cuts the drain.
   */
  hungerDrain: 3,
} as const

/**
 * Jumper mutation effect levers. Prey only: multiplies the prey's dodge chance
 * (clamped to `DODGE_CHANCE_MAX`), and stretches its fixed dodge dart by
 * `dodgeDistancePerAgility` world units per point of `agility`, so an agile
 * jumper escapes further over the same `DODGE_DURATION`. Kept here so the
 * headless simulator can sweep either lever with
 * `--set JUMPER.dodgeChanceMultiplier=...` or
 * `--set JUMPER.dodgeDistancePerAgility=...`.
 */
export const JUMPER = {
  /** World units added to a dodge's distance per point of prey agility. */
  dodgeDistancePerAgility: 4,
  /** Multiplier on the prey's dodge chance, before the max clamp. */
  dodgeChanceMultiplier: 2,
} as const

/**
 * Camouflage mutation effect levers. Prey only: cut the range a predator sees a
 * camouflaged prey at for pursuit, as a fraction of `HUNTER_SIGHT`. Contact and
 * the catch are unaffected, so a camouflaged prey still dodges as normal.
 */
export const CAMOUFLAGE = {
  /** Multiplier on a predator's pursuit sight range against this prey. */
  visionMultiplier: 0.5,
} as const

/**
 * Stealth mutation effect levers. Predators only: a stealth hunter cannot
 * sprint (pursuit is capped at its jog) and prey do not flee from it, though
 * they still dodge at contact. Both halves are levered so the headless
 * simulator can sweep them apart.
 */
export const STEALTH = {
  /** Whether a stealth predator may sprint. */
  canSprint: false,
  /** Whether prey run from a stealth predator at all. */
  preyFlee: false,
} as const

/**
 * Scavenger mutation effect levers. Available to both types: a scavenger
 * prefers a corpse over grass or prey, sprints to the nearest one within
 * `sight`, and eats it for `energy`, leaving the tile as full grass. The eater
 * cannot graze for `grazeCooldown` seconds afterwards, so the grass it just
 * created survives. Kept here so the headless simulator can sweep any lever,
 * e.g. `--set SCAVENGER.energy=...` or `--set SCAVENGER.grazeCooldown=...`.
 */
export const SCAVENGER = {
  /** Energy gained from eating one corpse. */
  energy: 15,
  /** How far, in world units, a scavenger spots a corpse to steer toward. */
  sight: 120,
  /** Seconds after eating a corpse during which the scavenger cannot graze. */
  grazeCooldown: 3,
} as const

// ---------------------------------------------------------------------------
// Movement & stamina
// ---------------------------------------------------------------------------

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
} as const

/** How quickly velocity is steered toward its target, in 1/s. */
export const STEER_RATE = 8

/**
 * Traction: above `referenceSpeed` a glorp loses grip, steering its velocity
 * toward where it wants to go more slowly the faster it moves, so a sprinting
 * hunter overshoots a prey that sidesteps. `agility` buys grip back: the slip
 * per unit of excess speed runs from `slipAtMinAgility` (level 0) down to
 * `slipAtMaxAgility` (level 7). Rate = `STEER_RATE / (1 + excess * slip)`,
 * where excess = (speed - referenceSpeed) / referenceSpeed. A dodge dart sets
 * velocity directly, so the juke itself never slips.
 */
export const TRACTION = {
  enabled: true,
  referenceSpeed: 50,
  slipAtMinAgility: 6,
  slipAtMaxAgility: 0.5,
} as const

/** How quickly wander headings drift, in radians/s. */
export const WANDER_TURN_RATE = 2

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
  referenceMax: traitValue('endurance', TRAIT_BASE),
  /**
   * A glorp that drains its stamina to empty latches into exhaustion and cannot
   * sprint again until stamina recovers to this fraction of its endurance. This
   * hysteresis is what stops the per-frame sprint/walk flicker that pinned
   * stamina at zero.
   */
  sprintReadyFraction: 0.5,
} as const

/**
 * Speed every glorp walks and wanders at, whatever its `speed` trait. Speed
 * then only pays off in pursuit and flight, so prey don't evolve top speed just
 * to graze faster and hunters can catch them.
 */
export const WALK_SPEED = 50

/**
 * When true, an exhausted hunter stops chasing until its stamina recovers,
 * instead of jogging after its prey.
 */
export const HUNTER_REST_WHEN_EXHAUSTED = false

/**
 * Hunters sprint this much faster than their `speed` trait, so they can close
 * on fleeing prey. Without an edge predators never catch anything and starve.
 */
export const HUNTER_SPRINT_MULTIPLIER = 1.4

/**
 * How far ahead, in world units, a steering glorp checks the arena bounds when
 * choosing a heading. Wide enough to begin turning before reaching a wall.
 */
export const STEER_LOOKAHEAD = 48

// ---------------------------------------------------------------------------
// Senses & spatial index
// ---------------------------------------------------------------------------

/**
 * Side of a spatial-grid cell, in world units. Near the common query ranges
 * (prey flee, mating) so most lookups only touch a few cells.
 */
export const SPATIAL_CELL = 64

/** Hunter perception range. */
export const HUNTER_SIGHT = 220

/** Prey flight range. */
export const PREY_FLEE = 120

// ---------------------------------------------------------------------------
// Grass & food
// ---------------------------------------------------------------------------

/** Grass is laid out on a grid of this many world units per tile. */
export const GRASS_TILE = 32

/**
 * Grass regrows at this fraction per second, capped at 1. Total regrowth is
 * `tiles * GRASS_REGROW` (~33 grass/s across the 120x68 grid), which sets the
 * carrying capacity: at level-0 endurance prey need ~`METABOLISM *
 * PREY_CONSUME_PER_SECOND / PREY_ENERGY_PER_SECOND` grass per second, so this
 * sustains roughly 400 prey before food becomes limiting. Endurance lowers that
 * need, raising the ceiling.
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

// ---------------------------------------------------------------------------
// Predation & combat
// ---------------------------------------------------------------------------

/** Starving hunters may prey on other hunters when this is true. */
export const CANNIBALISM = true

/** Below this fed a hunter will prey on other hunters. */
export const CANNIBAL_HUNGER = 20

/** Energy gained from eating another hunter. */
export const CANNIBAL_KILL_FED = 15

/**
 * When true, a prey can dodge a catch using its `agility`. Off makes agility
 * inert, which the headless simulator uses as an A/B control.
 */
export const DODGE_ENABLED = true

/**
 * Baseline dodge chance the prey gains per point of its own `agility`, applied
 * whether or not it outscores the hunter. Every agility point is worth
 * something even against a more agile predator.
 */
export const DODGE_CHANCE_PER_AGILITY_POINT = 0.03

/**
 * Extra dodge chance per agility point the prey has over its hunter, added on
 * top of the baseline: the reward for winning the agility contest.
 */
export const DODGE_CHANCE_PER_ADVANTAGE_POINT = 0.25

/**
 * When true, a dodged hunter whiffs its lunge: its stamina empties and it is
 * exhausted, dropping to its jog until it recovers.
 */
export const DODGE_EXHAUSTS_HUNTER = false

/**
 * Lunge dodging: when enabled, the dodge chance (see `dodgeChance`) scales with
 * how fast the hunter is moving at contact, by clamp(hunter speed /
 * `referenceSpeed`, `minFactor`, `maxFactor`): a fast lunge is easy to
 * sidestep, a slow stalk is not. Pair with `TRACTION` so the dodged hunter
 * visibly overshoots.
 */
export const DODGE_LUNGE = {
  enabled: true,
  referenceSpeed: 60,
  minFactor: 0.5,
  maxFactor: 2,
} as const

/**
 * Seconds a dodged hunter loses track of the prey that juked it. It keeps
 * hunting, switching to the nearest other prey in sight, and may pick the same
 * one up again once the time runs out. Zero turns it off.
 */
export const DODGE_LOSES_TRACK_SECONDS = 2

/** Ceiling on dodge chance, however high the prey's agility. */
export const DODGE_CHANCE_MAX = 0.9

/**
 * Seconds a dodging prey commits to its escape dart. While dodging it is
 * untargetable: no hunter can pick it or eat it.
 */
export const DODGE_DURATION = 0.3

/**
 * Base distance, in world units, a dodge carries the prey over its dart. The
 * escape is independent of the `speed` trait, so speed gets no second payoff;
 * the jumper mutation is the only thing that stretches it (see `JUMPER`).
 */
export const DODGE_DISTANCE = 44

/**
 * Escape-dart speed, derived from the fixed distance and duration so a dart
 * covers `DODGE_DISTANCE` however fast the prey's `speed` trait is.
 */
export const DODGE_SPEED = DODGE_DISTANCE / DODGE_DURATION

/**
 * Contact range, in world units, at which a catch resolves and a dodge can
 * fire: one glorp body diameter. While a dodge lasts the prey is untargetable,
 * so the hunter's normal prey search simply reprioritizes to the next victim.
 */
export const CATCH_PREY_RANGE = 2 * GLORP_RADIUS

// ---------------------------------------------------------------------------
// Death & corpses
// ---------------------------------------------------------------------------

/**
 * Seconds a starved glorp's corpse lingers in the world before it is cleared.
 * Only unconsumed deaths leave a corpse; eaten glorps are gone immediately.
 */
export const CORPSE_SECONDS = 8

/**
 * Most corpses the world tracks at once. When the cap is hit new ones are
 * simply dropped rather than growing the arrays; corpses expire quickly, so the
 * cap is a deliberate bound, not a target.
 */
export const MAX_CORPSES = 4096
