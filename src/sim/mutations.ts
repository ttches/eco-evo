import type { XorShift32 } from '@/engine/math'
import {
  CAMOUFLAGE,
  COLD_BLOODED,
  DODGE_DURATION,
  DODGE_SPEED,
  JUMPER,
  MAX_MUTATIONS,
  MUTATION_BIRTH_CHANCE,
  MUTATION_INHERIT_CHANCE,
  MUTATIONS_ENABLED,
  SCAVENGER,
  STEALTH,
  STOAT,
} from '@/sim/config'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'

/**
 * Every rogue-like mutation a glorp can hold, one bit each in a `mutations`
 * mask. Unlike traits, mutations are not a fixed budget: they are won at birth
 * and inherited from parents, and each folds its own modifiers into the systems
 * it touches (hunger, speed, later behavior). Adding an entry here is enough for
 * it to be inheritable and rollable; only its effect sites need to read it.
 *
 * `exclusive` locks a mutation to one glorp type (`null` means both). A type
 * can never roll or inherit an exclusive mutation of the other type.
 */
export const MUTATIONS = {
  coldBlooded: {
    bit: 1 << 0,
    name: 'Cold Blooded',
    description: `Hunger depletes ${Math.round(
      (1 - COLD_BLOODED.hungerDrain) * 100,
    )}% slower; speed trait ${Math.round(
      (1 - COLD_BLOODED.speedEffectiveness) * 100,
    )}% less effective.`,
    exclusive: null,
    /** Multiplier on hunger drain. */
    hungerDrain: COLD_BLOODED.hungerDrain,
    /** Multiplier on the mechanical value of the `speed` trait. */
    speedEffectiveness: COLD_BLOODED.speedEffectiveness,
  },
  stoat: {
    bit: 1 << 1,
    name: 'Stoat',
    description: `Moves ${STOAT.speedMultiplier}x as fast but burns hunger ${STOAT.hungerDrain}x as fast. Predators only.`,
    exclusive: GLORP_TYPE.hunter,
    /** Multiplier on every movement speed the glorp uses. */
    speedMultiplier: STOAT.speedMultiplier,
    /** Multiplier on hunger drain. */
    hungerDrain: STOAT.hungerDrain,
  },
  jumper: {
    bit: 1 << 2,
    name: 'Jumper',
    description: `${JUMPER.dodgeChanceMultiplier}x dodge chance (capped at the maximum) and dodges ${JUMPER.dodgeDistancePerAgility} world units further per agility point. Prey only.`,
    exclusive: GLORP_TYPE.prey,
    /** World units added to a dodge per point of `agility`. */
    dodgeDistancePerAgility: JUMPER.dodgeDistancePerAgility,
    /** Multiplier on dodge chance, before the max clamp. */
    dodgeChanceMultiplier: JUMPER.dodgeChanceMultiplier,
  },
  camouflage: {
    bit: 1 << 3,
    name: 'Camouflage',
    description: `Predators only spot them for pursuit within ${Math.round(
      CAMOUFLAGE.visionMultiplier * 100,
    )}% of their sight range. Prey only.`,
    exclusive: GLORP_TYPE.prey,
    /** Multiplier on a predator's pursuit sight range against this prey. */
    visionMultiplier: CAMOUFLAGE.visionMultiplier,
  },
  stealth: {
    bit: 1 << 4,
    name: 'Stealth',
    description:
      'Cannot sprint, so its top speed is its jog. Prey do not flee from it, but still dodge. Predators only.',
    exclusive: GLORP_TYPE.hunter,
    /** Whether it may still sprint despite being stealthy. */
    canSprint: STEALTH.canSprint,
    /** Whether prey flee from it despite its stealth. */
    preyFlee: STEALTH.preyFlee,
  },
  scavenger: {
    bit: 1 << 5,
    name: 'Scavenger',
    description: `Prefers a corpse over grass or prey, jogging to one in sight and eating it for ${SCAVENGER.energy} energy. The tile it eats on becomes full grass.`,
    exclusive: null,
  },
} as const

export type MutationKey = keyof typeof MUTATIONS

export const MUTATION_KEYS = Object.keys(MUTATIONS) as readonly MutationKey[]

/** Bits actually defined by `MUTATIONS`, in declaration order. */
const MUTATION_BITS: readonly number[] = MUTATION_KEYS.map(
  (key) => MUTATIONS[key].bit,
)

/** Mask with every defined mutation bit set, used to reject unknown bits. */
export const MUTATION_MASK_ALL = MUTATION_BITS.reduce(
  (mask, bit) => mask | bit,
  0,
)

/** True when the glorp's mask carries the mutation. */
export const hasMutation = (mask: number, bit: number): boolean =>
  (mask & bit) !== 0

/** How many mutations a mask holds. */
export const countMutations = (mask: number): number => {
  let count = 0
  for (const bit of MUTATION_BITS) if ((mask & bit) !== 0) count += 1
  return count
}

/** Decode a mask into its mutation keys, for display or analysis. */
export const mutationKeys = (mask: number): MutationKey[] =>
  MUTATION_KEYS.filter((key) => (mask & MUTATIONS[key].bit) !== 0)

/** True when a glorp of `type` may hold this mutation. */
export const mutationAllowedForType = (
  key: MutationKey,
  type: GlorpType,
): boolean =>
  MUTATIONS[key].exclusive === null || MUTATIONS[key].exclusive === type

/** Add a random not-yet-held mutation of an allowed type, if any remain. */
const addRandomMutation = (
  random: XorShift32,
  mask: number,
  type: GlorpType,
): number => {
  if (countMutations(mask) >= MAX_MUTATIONS) return mask
  const missing = MUTATION_BITS.filter(
    (bit, index) =>
      (mask & bit) === 0 && mutationAllowedForType(MUTATION_KEYS[index], type),
  )
  if (missing.length === 0) return mask
  return mask | missing[Math.floor(random.unit() * missing.length)]
}

/**
 * Inherit from parents in order (mother first). Each parent's carried mutation
 * is rolled independently with `MUTATION_INHERIT_CHANCE`, so a mutation both
 * parents carry gets a mother roll and, only if that fails, a father roll.
 * Picking stops as soon as `MAX_MUTATIONS` is reached.
 */
export const inheritMutations = (
  random: XorShift32,
  parentMasks: readonly number[],
  type: GlorpType,
): number => {
  if (!MUTATIONS_ENABLED) return 0
  let mask = 0
  for (const parent of parentMasks) {
    for (const key of MUTATION_KEYS) {
      if ((parent & MUTATIONS[key].bit) === 0) continue
      if (!mutationAllowedForType(key, type)) continue
      if (random.unit() < MUTATION_INHERIT_CHANCE) {
        mask |= MUTATIONS[key].bit
        if (countMutations(mask) >= MAX_MUTATIONS) return mask
      }
    }
  }
  return mask
}

/**
 * Roll a newborn's mutations from its parents' masks, then, when nothing was
 * inherited, apply the `birthChance` roll for a brand-new mutation. Mated
 * pregnancies pass `MUTATION_PREGNANCY_BIRTH_CHANCE`; clones use the default.
 */
export const rollBirthMutations = (
  random: XorShift32,
  parentMasks: readonly number[],
  type: GlorpType,
  birthChance = MUTATION_BIRTH_CHANCE,
): number => {
  if (!MUTATIONS_ENABLED) return 0
  const mask = inheritMutations(random, parentMasks, type)
  if (mask !== 0) return mask
  return random.unit() < birthChance ? addRandomMutation(random, 0, type) : 0
}

/** Roll a parentless glorp's mutations: only the spontaneous birth roll. */
export const rollSpawnMutations = (
  random: XorShift32,
  type: GlorpType,
): number =>
  MUTATIONS_ENABLED && random.unit() < MUTATION_BIRTH_CHANCE
    ? addRandomMutation(random, 0, type)
    : 0

/** Multiplier a mask applies to hunger drain. */
export const mutationDrainMultiplier = (mask: number): number => {
  let factor = 1
  if (hasMutation(mask, MUTATIONS.coldBlooded.bit)) {
    factor *= MUTATIONS.coldBlooded.hungerDrain
  }
  if (hasMutation(mask, MUTATIONS.stoat.bit)) {
    factor *= MUTATIONS.stoat.hungerDrain
  }
  return factor
}

/** Multiplier a mask applies to the mechanical value of the `speed` trait. */
export const mutationSpeedFactor = (mask: number): number => {
  let factor = 1
  if (hasMutation(mask, MUTATIONS.coldBlooded.bit)) {
    factor *= MUTATIONS.coldBlooded.speedEffectiveness
  }
  if (hasMutation(mask, MUTATIONS.stoat.bit)) {
    factor *= MUTATIONS.stoat.speedMultiplier
  }
  return factor
}

/**
 * Multiplier a mask applies to flat movement (walk, wander, mate-seeking).
 * Only mutations that promise raw speed belong here; ones that reshape the
 * `speed` trait (cold blooded) leave walking untouched.
 */
export const mutationWalkFactor = (mask: number): number =>
  hasMutation(mask, MUTATIONS.stoat.bit) ? MUTATIONS.stoat.speedMultiplier : 1

/** True when the glorp's mask carries the stealthy mutation. */
export const isStealth = (mask: number): boolean =>
  hasMutation(mask, MUTATIONS.stealth.bit)

/** True when the glorp's mask carries the scavenger mutation. */
export const isScavenger = (mask: number): boolean =>
  hasMutation(mask, MUTATIONS.scavenger.bit)

/**
 * Whether a mask permits sprinting. Stealth normally forbids it; the registry
 * value is a lever so the headless simulator can sweep the restriction off.
 */
export const mutationCanSprint = (mask: number): boolean =>
  isStealth(mask) ? MUTATIONS.stealth.canSprint : true

/**
 * Whether prey flee from a glorp. A stealthy hunter normally goes unnoticed; the
 * registry value is a lever so the simulator can sweep that half too.
 */
export const mutationScaresPrey = (mask: number): boolean =>
  isStealth(mask) ? MUTATIONS.stealth.preyFlee : true

/** Fraction of a predator's pursuit range a camouflaged prey is spotted within. */
export const camouflageSightFactor = (mask: number): number =>
  hasMutation(mask, MUTATIONS.camouflage.bit)
    ? MUTATIONS.camouflage.visionMultiplier
    : 1

/**
 * Escape-dart speed for the glorp. Most glorps cover the base dart over
 * `DODGE_DURATION`; a jumper adds its agility bonus on top, so the dart lasts
 * the same time but reaches further.
 */
export const mutationDodgeSpeed = (mask: number, agility: number): number =>
  hasMutation(mask, MUTATIONS.jumper.bit)
    ? DODGE_SPEED +
      (agility * MUTATIONS.jumper.dodgeDistancePerAgility) / DODGE_DURATION
    : DODGE_SPEED

/** Multiplier a mask applies to dodge chance, before the max clamp. */
export const mutationDodgeChanceMultiplier = (mask: number): number =>
  hasMutation(mask, MUTATIONS.jumper.bit)
    ? MUTATIONS.jumper.dodgeChanceMultiplier
    : 1
