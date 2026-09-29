import { WORLD } from '@/engine/config'
import { TAU, clamp, hashUnit } from '@/engine/math'
import {
  FED_MAX,
  MATE_FED_MIN,
  MATE_RANGE,
  MOVEMENT,
  OFFSPRING_FED,
} from '@/sim/config'
import {
  cloneTraits,
  crossTraits,
  mixDirective,
  mutateDirective,
} from '@/sim/genetics'
import { recordBirth } from '@/sim/lineage'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { allocGlorp } from '@/sim/store'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Newborn state shared by every reproduction path, once traits are set. */
const initOffspring = (world: World, child: number): void => {
  world.fed[child] = OFFSPRING_FED
  world.stamina[child] = world.staminaMax[child]
  world.cooldown[child] = world.reproCooldown[child]
  // Its own wander seed, so parent and child don't move in lockstep.
  world.wanderSeed[child] = hashUnit(child ^ 0x9e3779b9)
}

/** Count down every glorp's reproduction cooldown. */
export const tickCooldowns = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.cooldown[index] <= 0) continue
    const next = world.cooldown[index] - dt
    world.cooldown[index] = next > 0 ? next : 0
  }
}

/** Well-fed, off-cooldown glorps spawn an offspring at their position. */
export const applyReproduction = (world: World): void => {
  const population = world.count
  for (let index = 0; index < population; index += 1) {
    if (world.cooldown[index] > 0) continue
    if (world.fed[index] < FED_MAX) continue

    const child = allocGlorp(world)
    if (child < 0) return

    // A clone inherits the parent's directive (with occasional flips), then
    // mutates each trait in the direction that directive prefers.
    world.type[child] = world.type[index]
    world.directive[child] = mutateDirective(
      world.random,
      world.directive[index],
    )
    cloneTraits(world, index, child)
    initOffspring(world, child)

    // Scatter the offspring deterministically so it never stacks on the parent.
    const angle = hashUnit(child) * TAU
    const walk = world.speed[child] * MOVEMENT.walkFactor
    world.x[child] = clamp(
      world.x[index] + Math.cos(angle) * world.radius,
      world.radius,
      WORLD.width - world.radius,
    )
    world.y[child] = clamp(
      world.y[index] + Math.sin(angle) * world.radius,
      world.radius,
      WORLD.height - world.radius,
    )
    world.vx[child] = Math.cos(angle) * walk
    world.vy[child] = Math.sin(angle) * walk
    recordBirth(world, child, index)

    world.fed[index] = FED_MAX
    world.cooldown[index] = world.reproCooldown[index]
  }
}

/**
 * Two nearby, well-fed, off-cooldown hunters produce one offspring. For each
 * trait the globally favorable parent's value is selected, then mutated in the
 * direction the child's recombined directive prefers. Both parents go on cooldown.
 */
export const applyPairReproduction = (world: World): void => {
  // Newborns added below are missing from the grid, but they start on
  // cooldown and so could never be picked as a mate this step anyway.
  rebuildSpatialGrid(world)
  for (let index = 0; index < world.count; index += 1) {
    if (world.type[index] !== GLORP_TYPE.hunter) continue
    if (world.cooldown[index] > 0) continue
    if (world.fed[index] <= MATE_FED_MIN) continue

    const mate = nearestOfType(
      world,
      index,
      GLORP_TYPE.hunter,
      MATE_RANGE,
      (candidate) =>
        world.cooldown[candidate] <= 0 && world.fed[candidate] > MATE_FED_MIN,
    )
    if (mate < 0) continue

    const child = allocGlorp(world)
    if (child < 0) return

    world.type[child] = GLORP_TYPE.hunter
    world.directive[child] = mixDirective(
      world.random,
      world.directive[index],
      world.directive[mate],
    )
    crossTraits(world, index, mate, child)
    initOffspring(world, child)
    world.x[child] = (world.x[index] + world.x[mate]) / 2
    world.y[child] = (world.y[index] + world.y[mate]) / 2
    recordBirth(world, child, index, mate)

    world.cooldown[index] = world.reproCooldown[index]
    world.cooldown[mate] = world.reproCooldown[mate]
  }
}
