import type { XorShift32 } from '@/engine/math'
import {
  COLD_BLOODED,
  MAX_MUTATIONS,
  MUTATION_BIRTH_CHANCE,
  MUTATION_INHERIT_CHANCE,
} from '@/sim/config'

/**
 * Every rogue-like mutation a glorp can hold, one bit each in a `mutations`
 * mask. Unlike traits, mutations are not a fixed budget: they are won at birth
 * and inherited from parents, and each folds its own modifiers into the systems
 * it touches (hunger, speed, later behavior). Adding an entry here is enough for
 * it to be inheritable and rollable; only its effect sites need to read it.
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
    /** Multiplier on hunger drain. */
    hungerDrain: COLD_BLOODED.hungerDrain,
    /** Multiplier on the mechanical value of the `speed` trait. */
    speedEffectiveness: COLD_BLOODED.speedEffectiveness,
  },
} as const

export type MutationKey = keyof typeof MUTATIONS

export const MUTATION_KEYS = Object.keys(MUTATIONS) as readonly MutationKey[]

/** Bits actually defined by `MUTATIONS`, in declaration order. */
const MUTATION_BITS: readonly number[] = MUTATION_KEYS.map(
  (key) => MUTATIONS[key].bit,
)

/** Mask with every defined mutation bit set, used to reject unknown bits. */
export const MUTATION_MASK_ALL = MUTATION_BITS.reduce((mask, bit) => mask | bit, 0)

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

/** Add a random not-yet-held mutation, if any remain under the cap. */
const addRandomMutation = (random: XorShift32, mask: number): number => {
  if (countMutations(mask) >= MAX_MUTATIONS) return mask
  const missing = MUTATION_BITS.filter((bit) => (mask & bit) === 0)
  if (missing.length === 0) return mask
  return mask | missing[Math.floor(random.unit() * missing.length)]
}

/**
 * Inherit from parent masks: every mutation any parent carries is copied
 * independently with `MUTATION_INHERIT_CHANCE`, up to `MAX_MUTATIONS`. The
 * distinct-union rule means a mutation both parents carry is still one 25% roll,
 * not two.
 */
export const inheritMutations = (
  random: XorShift32,
  parentMasks: readonly number[],
): number => {
  let mask = 0
  let count = 0
  for (const bit of MUTATION_BITS) {
    if (count >= MAX_MUTATIONS) break
    const carried = parentMasks.some((parent) => (parent & bit) !== 0)
    if (carried && random.unit() < MUTATION_INHERIT_CHANCE) {
      mask |= bit
      count += 1
    }
  }
  return mask
}

/**
 * Roll a newborn's mutations from its parents' masks, then apply the
 * `MUTATION_BIRTH_CHANCE` roll for a brand-new mutation. The result is capped
 * at `MAX_MUTATIONS`.
 */
export const rollBirthMutations = (
  random: XorShift32,
  parentMasks: readonly number[],
): number => {
  let mask = inheritMutations(random, parentMasks)
  if (random.unit() < MUTATION_BIRTH_CHANCE) mask = addRandomMutation(random, mask)
  return mask
}

/** Roll a parentless glorp's mutations: only the spontaneous birth roll. */
export const rollSpawnMutations = (random: XorShift32): number =>
  random.unit() < MUTATION_BIRTH_CHANCE ? addRandomMutation(random, 0) : 0

/** Multiplier a mask applies to hunger drain. */
export const mutationDrainMultiplier = (mask: number): number =>
  hasMutation(mask, MUTATIONS.coldBlooded.bit)
    ? MUTATIONS.coldBlooded.hungerDrain
    : 1

/** Multiplier a mask applies to the mechanical value of the `speed` trait. */
export const mutationSpeedFactor = (mask: number): number =>
  hasMutation(mask, MUTATIONS.coldBlooded.bit)
    ? MUTATIONS.coldBlooded.speedEffectiveness
    : 1
