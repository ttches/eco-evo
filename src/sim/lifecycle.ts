import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import { removeGlorp } from '@/sim/store'
import { ENDURANCE, METABOLISM } from '@/sim/config'
import { TRAIT_MAX, TRAIT_MIN, scaleTrait } from '@/sim/traits'
import type { World } from '@/sim/world'

/**
 * Hunger-drain multiplier per `endurance` level, precomputed so the per-step
 * drain stays a lookup. Level 0 drains at the base `METABOLISM` rate; each
 * point trims it linearly until `ENDURANCE.drainFactorAtMax` at level 7.
 */
const DRAIN_FACTOR_BY_LEVEL = (() => {
  const table = new Float64Array(TRAIT_MAX + 1)
  for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
    table[level] = scaleTrait('endurance', level, 1, ENDURANCE.drainFactorAtMax)
  }
  return table
})()

/** Burning energy over time; starving glorps fall to zero and die. */
export const applyMetabolism = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    world.fed[index] -=
      METABOLISM * DRAIN_FACTOR_BY_LEVEL[world.endurance[index]] * dt
  }
}

/** Remove every glorp that has run out of energy. */
export const applyDeath = (world: World): void => {
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.fed[index] > 0) continue
    recordDeath(world, index, DEATH_CAUSE.starved)
    removeGlorp(world, index)
  }
}
