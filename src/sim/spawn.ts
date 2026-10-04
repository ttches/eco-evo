import { WORLD } from '@/engine/config'
import { clamp } from '@/engine/math'
import { FED_MAX, FED_START } from '@/sim/config'
import { rollTraits } from '@/sim/genetics'
import { recordBirth } from '@/sim/lineage'
import { rollSpawnMutations } from '@/sim/mutations'
import { allocGlorp } from '@/sim/store'
import { traitValue } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * Add one glorp with freshly rolled traits at a world position, clamped inside
 * the world. Returns its index, or -1 when the population is already capped.
 * `fed` sets the starting energy, defaulting to the normal spawn value.
 */
export const spawnGlorp = (
  world: World,
  type: GlorpType,
  x: number,
  y: number,
  fed = FED_START,
): number => {
  const index = allocGlorp(world)
  if (index < 0) return -1

  world.x[index] = clamp(x, world.radius, WORLD.width - world.radius)
  world.y[index] = clamp(y, world.radius, WORLD.height - world.radius)
  world.type[index] = type
  world.fed[index] = fed
  world.wanderSeed[index] = world.random.unit()
  rollTraits(world, index)
  world.mutations[index] = rollSpawnMutations(world.random, type)
  world.stamina[index] = traitValue('endurance', world.endurance[index])
  recordBirth(world, index)
  return index
}

/** Add one glorp with freshly rolled traits at a random world position. */
export const spawnRandom = (
  world: World,
  type: GlorpType,
  fed = FED_START,
): number =>
  spawnGlorp(
    world,
    type,
    world.random.range(world.radius, WORLD.width - world.radius),
    world.random.range(world.radius, WORLD.height - world.radius),
    fed,
  )

/**
 * Fill a fresh world with its starting population: `prey` foragers, then
 * `hunters` predators. Initial predators start at full energy but on their
 * fertility cooldown, so they enter the world as if recently reproduced: no
 * reproduction path (asexual clone or mating) can fire on the first step.
 */
export const seedPopulation = (
  world: World,
  prey: number,
  hunters: number,
): void => {
  for (let index = 0; index < prey; index += 1) {
    if (spawnRandom(world, GLORP_TYPE.prey) < 0) return
  }
  for (let index = 0; index < hunters; index += 1) {
    const hunter = spawnRandom(world, GLORP_TYPE.hunter, FED_MAX)
    if (hunter < 0) return
    world.cooldown[hunter] = traitValue('fertility', world.fertility[hunter])
  }
}
