import {
  FED_MAX,
  MAX_GLORPS,
  HUNTER_KILL_FED,
  PREY_CONSUME_PER_SECOND,
  PREY_ENERGY_PER_SECOND,
} from '@/sim/config'
import { consumeGrass } from '@/sim/grass'
import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { removeGlorp } from '@/sim/store'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Energy gained per unit of grass eaten. */
const GRASS_ENERGY = PREY_ENERGY_PER_SECOND / PREY_CONSUME_PER_SECOND

/** Scratch list of prey eaten this step, in descending index order. */
const eaten = new Int32Array(MAX_GLORPS)

/** Burning energy over time; starving glorps fall to zero and die. */
export const applyMetabolism = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    world.fed[index] -= world.metabolism[index] * dt
  }
}

/** Prey graze on grass; hunters remove and gain energy from nearby prey. */
export const applyEating = (world: World, dt: number): void => {
  const desired = PREY_CONSUME_PER_SECOND * dt
  for (let index = 0; index < world.count; index += 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    if (world.fed[index] >= FED_MAX) continue
    const consumed = consumeGrass(
      world.grass,
      world.x[index],
      world.y[index],
      desired,
    )
    if (consumed <= 0) continue
    const next = world.fed[index] + consumed * GRASS_ENERGY
    world.fed[index] = next < FED_MAX ? next : FED_MAX
  }

  // Kills are collected and removed afterwards so indices stored in the grid
  // stay valid for the whole hunt. Descending order keeps swap-remove safe.
  rebuildSpatialGrid(world)
  const reach = 2 * world.radius
  let kills = 0
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, reach)
    if (hunter < 0) continue
    const next = world.fed[hunter] + HUNTER_KILL_FED
    world.fed[hunter] = next < FED_MAX ? next : FED_MAX
    recordDeath(world, index, DEATH_CAUSE.eaten, hunter)
    eaten[kills] = index
    kills += 1
  }
  for (let kill = 0; kill < kills; kill += 1) removeGlorp(world, eaten[kill])
}

/** Remove every glorp that has run out of energy. */
export const applyDeath = (world: World): void => {
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.fed[index] > 0) continue
    recordDeath(world, index, DEATH_CAUSE.starved)
    removeGlorp(world, index)
  }
}
