import type { XorShift32 } from '@/engine/math'
import {
  CLONE_MUTATION_CHANCE,
  MATED_MUTATION_CHANCE,
  SPAWN_BASE,
  SPAWN_SHUFFLES,
  TRAIT_BUDGET,
} from '@/sim/config'
import {
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  type TraitKey,
  type TraitLevels,
} from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

const pick = (random: XorShift32, count: number): number =>
  Math.floor(random.unit() * count)

/** A random key whose level satisfies `eligible`, or null when none does. */
const pickKey = (
  random: XorShift32,
  eligible: (key: TraitKey) => boolean,
): TraitKey | null => {
  const candidates = TRAIT_KEYS.filter(eligible)
  return candidates.length === 0 ? null : candidates[pick(random, candidates.length)]
}

/**
 * Move one point from a random trait above the minimum to a different random
 * trait below the maximum. Zero-sum and directionless, so the budget holds.
 */
export const transferPoint = (random: XorShift32, levels: TraitLevels): void => {
  const from = pickKey(random, (key) => levels[key] > TRAIT_MIN)
  if (from === null) return
  const to = pickKey(
    random,
    (key) => key !== from && levels[key] < TRAIT_MAX,
  )
  if (to === null) return
  levels[from] -= 1
  levels[to] += 1
}

/** Add or remove random points until the levels sum to `TRAIT_BUDGET`. */
const rebalance = (random: XorShift32, levels: TraitLevels): void => {
  let surplus = TRAIT_KEYS.reduce((sum, key) => sum + levels[key], 0) - TRAIT_BUDGET
  while (surplus !== 0) {
    const step = surplus > 0 ? -1 : 1
    const key = pickKey(random, (candidate) =>
      step < 0 ? levels[candidate] > TRAIT_MIN : levels[candidate] < TRAIT_MAX,
    )
    if (key === null) return
    levels[key] += step
    surplus += step
  }
}

const copyLevels = (levels: Readonly<TraitLevels>): TraitLevels => ({ ...levels })

/** A type's `SPAWN_BASE` build, shuffled by `SPAWN_SHUFFLES` transfers. */
export const rollLevels = (
  random: XorShift32,
  type: GlorpType = GLORP_TYPE.prey,
): TraitLevels => {
  const base = SPAWN_BASE[type === GLORP_TYPE.hunter ? 'hunter' : 'prey']
  const levels = {} as TraitLevels
  for (const key of TRAIT_KEYS) levels[key] = base[key]
  rebalance(random, levels)
  for (let i = 0; i < SPAWN_SHUFFLES; i += 1) transferPoint(random, levels)
  return levels
}

/** Clone a parent's levels; with `CLONE_MUTATION_CHANCE`, move one point. */
export const cloneLevels = (
  random: XorShift32,
  parent: Readonly<TraitLevels>,
): TraitLevels => {
  const levels = copyLevels(parent)
  if (random.unit() < CLONE_MUTATION_CHANCE) transferPoint(random, levels)
  return levels
}

/**
 * Recombine two parents: each trait comes from a random parent, the total is
 * repaired back to budget, then with `MATED_MUTATION_CHANCE` one point moves.
 */
export const crossLevels = (
  random: XorShift32,
  a: Readonly<TraitLevels>,
  b: Readonly<TraitLevels>,
): TraitLevels => {
  const levels = {} as TraitLevels
  for (const key of TRAIT_KEYS) {
    levels[key] = random.unit() < 0.5 ? a[key] : b[key]
  }
  rebalance(random, levels)
  if (random.unit() < MATED_MUTATION_CHANCE) transferPoint(random, levels)
  return levels
}

const writeLevels = (
  world: World,
  index: number,
  levels: Readonly<TraitLevels>,
): void => {
  for (const key of TRAIT_KEYS) world[key][index] = levels[key]
}

/** Read one glorp's levels from per-trait columns (the world or the lineage log). */
export const readLevels = (
  columns: Readonly<Record<TraitKey, ArrayLike<number>>>,
  index: number,
): TraitLevels => {
  const levels = {} as TraitLevels
  for (const key of TRAIT_KEYS) levels[key] = columns[key][index]
  return levels
}

/** Roll a freshly spawned glorp's levels; its type must already be set. */
export const rollTraits = (world: World, index: number): void =>
  writeLevels(world, index, rollLevels(world.random, world.type[index] as GlorpType))

/** Asexual inheritance: copy the parent's levels, occasionally moving a point. */
export const cloneTraits = (
  world: World,
  parent: number,
  child: number,
): void =>
  writeLevels(world, child, cloneLevels(world.random, readLevels(world, parent)))

/**
 * Paired inheritance from explicit parent levels, for cases where the parents
 * are no longer live (e.g. deferred birth after a father has died).
 */
export const crossTraitsFrom = (
  world: World,
  child: number,
  levelsA: Readonly<TraitLevels>,
  levelsB: Readonly<TraitLevels>,
  random: XorShift32,
): void => writeLevels(world, child, crossLevels(random, levelsA, levelsB))
