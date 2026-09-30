import { clamp } from '@/engine/math'
import type { XorShift32 } from '@/engine/math'
import {
  DIRECTIVE_FLIP_CHANCE,
  INHERIT_BEST_CHANCE,
  MUTATION_BIAS,
  MUTATION_RATE,
} from '@/sim/config'
import { TRAIT_BIT, TRAIT_KEYS, TRAITS, type TraitKey } from '@/sim/traits'
import type { World } from '@/sim/world'

/** Every trait bit, in a fixed order so directive rolls stay deterministic. */
const TRAIT_BITS = TRAIT_KEYS.map((key) => TRAIT_BIT[key])

/** Whether a glorp's directive prefers a higher value for a trait bit. */
export const prefersHigher = (directive: number, bit: number): boolean =>
  (directive & bit) !== 0

/**
 * Pick one parent's value for a trait, favoring the direction that is
 * globally better `INHERIT_BEST_CHANCE` of the time.
 */
export const inheritTrait = (
  random: XorShift32,
  a: number,
  b: number,
  higherIsBetter: boolean,
): number => {
  const favorable = higherIsBetter ? Math.max(a, b) : Math.min(a, b)
  const other = higherIsBetter ? Math.min(a, b) : Math.max(a, b)
  return random.unit() < INHERIT_BEST_CHANCE ? favorable : other
}

/**
 * Mutate one trait: symmetric relative noise plus a directional drift set by
 * the glorp's own directive, clamped to the configured spawn range.
 */
export const mutateTrait = (
  random: XorShift32,
  value: number,
  minimum: number,
  maximum: number,
  preferHigher: boolean,
): number => {
  const bias = preferHigher ? MUTATION_BIAS : -MUTATION_BIAS
  const noise = (random.unit() * 2 - 1) * MUTATION_RATE
  return clamp(value * (1 + bias + noise), minimum, maximum)
}

/** Copy a directive, flipping each trait bit with `DIRECTIVE_FLIP_CHANCE`. */
export const mutateDirective = (
  random: XorShift32,
  directive: number,
): number => {
  let next = directive
  for (const bit of TRAIT_BITS) {
    if (random.unit() < DIRECTIVE_FLIP_CHANCE) next ^= bit
  }
  return next
}

/** Recombine two parents' directives per trait, then mutate the result. */
export const mixDirective = (
  random: XorShift32,
  a: number,
  b: number,
): number => {
  let next = 0
  for (const bit of TRAIT_BITS) {
    const source = random.unit() < 0.5 ? a : b
    if (source & bit) next |= bit
  }
  return mutateDirective(random, next)
}

/** Roll a fresh random directive: every trait bit is a 50/50 coin flip. */
export const rollDirective = (random: XorShift32): number => {
  let directive = 0
  for (const bit of TRAIT_BITS) {
    if (random.unit() < 0.5) directive |= bit
  }
  return directive
}

/** Roll every trait uniformly inside its spawn range. */
export const rollTraits = (world: World, index: number): void => {
  for (const key of TRAIT_KEYS) {
    world[key][index] = world.random.range(TRAITS[key].min, TRAITS[key].max)
  }
}

const mutateInto = (
  world: World,
  child: number,
  key: TraitKey,
  value: number,
  random: XorShift32,
): void => {
  const { min, max } = TRAITS[key]
  const higher = prefersHigher(world.directive[child], TRAIT_BIT[key])
  world[key][child] = mutateTrait(random, value, min, max, higher)
}

/**
 * Asexual inheritance: each trait is copied from the parent, then mutated in
 * the direction the child's directive prefers. Set the child's directive first.
 */
export const cloneTraits = (
  world: World,
  parent: number,
  child: number,
): void => {
  for (const key of TRAIT_KEYS) {
    mutateInto(world, child, key, world[key][parent], world.random)
  }
}

/**
 * Paired inheritance from explicit parent trait values, for cases where the
 * parents are no longer live (e.g. deferred birth after a father has died).
 * Set the child's directive first.
 */
export const crossTraitsFrom = (
  world: World,
  child: number,
  valuesA: Readonly<Record<TraitKey, number>>,
  valuesB: Readonly<Record<TraitKey, number>>,
  random: XorShift32,
): void => {
  for (const key of TRAIT_KEYS) {
    const value = inheritTrait(
      random,
      valuesA[key],
      valuesB[key],
      TRAITS[key].favorsHigher,
    )
    mutateInto(world, child, key, value, random)
  }
}
