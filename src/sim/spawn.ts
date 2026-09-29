import { WORLD } from '@/engine/config'
import { clamp } from '@/engine/math'
import {
  FED_START,
  GLORP_RADIUS,
  MAX_GLORPS,
  TRAIT,
} from '@/sim/config'
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
  if (world.count >= MAX_GLORPS) return -1

  const index = world.count
  const staminaMax = world.random.range(
    TRAIT.staminaMaxMin,
    TRAIT.staminaMaxMax,
  )

  world.x[index] = clamp(x, GLORP_RADIUS, WORLD.width - GLORP_RADIUS)
  world.y[index] = clamp(y, GLORP_RADIUS, WORLD.height - GLORP_RADIUS)
  world.vx[index] = 0
  world.vy[index] = 0
  world.type[index] = type
  world.fed[index] = FED_START
  world.stamina[index] = staminaMax
  world.staminaMax[index] = staminaMax
  world.sprinting[index] = 0
  world.cooldown[index] = 0
  world.wanderSeed[index] = world.random.unit()
  world.speed[index] = world.random.range(TRAIT.speedMin, TRAIT.speedMax)
  world.metabolism[index] = world.random.range(
    TRAIT.metabolismMin,
    TRAIT.metabolismMax,
  )
  world.reproCooldown[index] = world.random.range(
    TRAIT.reproCooldownMin,
    TRAIT.reproCooldownMax,
  )
  world.id[index] = world.nextId
  world.nextId += 1
  world.count += 1
  return index
}

/** Add one glorp with freshly rolled traits at a random world position. */
export const spawnRandom = (world: World, type: GlorpType): number =>
  spawnGlorp(
    world,
    type,
    world.random.range(GLORP_RADIUS, WORLD.width - GLORP_RADIUS),
    world.random.range(GLORP_RADIUS, WORLD.height - GLORP_RADIUS),
  )
