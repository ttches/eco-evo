import { clamp } from '@/engine/math'
import type { XorShift32 } from '@/engine/math'
import {
  DIRECTIVE_FLIP_CHANCE,
  INHERIT_BEST_CHANCE,
  MUTATION_BIAS,
  MUTATION_RATE,
  TRAIT_BIT,
} from '@/sim/config'

/** Global favorable direction per trait, used to pick the better parent. */
export const FAVORS_HIGHER = {
  speed: true,
  staminaMax: true,
  metabolism: false,
  reproCooldown: false,
} as const

/** Every trait bit, in a fixed order so directive rolls stay deterministic. */
export const TRAIT_BITS = [
  TRAIT_BIT.speed,
  TRAIT_BIT.staminaMax,
  TRAIT_BIT.metabolism,
  TRAIT_BIT.reproCooldown,
] as const

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
