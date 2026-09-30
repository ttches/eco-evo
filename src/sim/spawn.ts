import { WORLD } from '@/engine/config'
import { clamp } from '@/engine/math'
import { FED_START } from '@/sim/config'
import { rollTraits } from '@/sim/genetics'
import { recordBirth } from '@/sim/lineage'
import { allocGlorp } from '@/sim/store'
import { traitValue } from '@/sim/traits'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * Add one glorp with freshly rolled traits at a world position, clamped inside
 * the world. Returns its index, or -1 when the population is already capped.
 */
export const spawnGlorp = (
  world: World,
  type: GlorpType,
  x: number,
  y: number,
): number => {
  const index = allocGlorp(world)
  if (index < 0) return -1

  world.x[index] = clamp(x, world.radius, WORLD.width - world.radius)
  world.y[index] = clamp(y, world.radius, WORLD.height - world.radius)
  world.type[index] = type
  world.fed[index] = FED_START
  world.wanderSeed[index] = world.random.unit()
  rollTraits(world, index)
  world.stamina[index] = traitValue('staminaMax', world.staminaMax[index])
  recordBirth(world, index)
  return index
}

/** Add one glorp with freshly rolled traits at a random world position. */
export const spawnRandom = (world: World, type: GlorpType): number =>
  spawnGlorp(
    world,
    type,
    world.random.range(world.radius, WORLD.width - world.radius),
    world.random.range(world.radius, WORLD.height - world.radius),
  )
