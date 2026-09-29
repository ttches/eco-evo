import { WORLD } from '@/engine/config'
import { TAU, clamp, hashUnit } from '@/engine/math'
import {
  FED_MAX,
  HUNTER_KILL_FED,
  MAX_GLORPS,
  MOVEMENT,
  OFFSPRING_FED,
  PREY_CONSUME_PER_SECOND,
  PREY_ENERGY_PER_SECOND,
} from '@/sim/config'
import { consumeGrass } from '@/sim/grass'
import { nearestOfType } from '@/sim/query'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Energy gained per unit of grass eaten. */
const GRASS_ENERGY = PREY_ENERGY_PER_SECOND / PREY_CONSUME_PER_SECOND

const copyGlorp = (world: World, from: number, to: number): void => {
  world.x[to] = world.x[from]
  world.y[to] = world.y[from]
  world.vx[to] = world.vx[from]
  world.vy[to] = world.vy[from]
  world.type[to] = world.type[from]
  world.fed[to] = world.fed[from]
  world.stamina[to] = world.stamina[from]
  world.sprinting[to] = world.sprinting[from]
  world.cooldown[to] = world.cooldown[from]
  world.wanderSeed[to] = world.wanderSeed[from]
  world.speed[to] = world.speed[from]
  world.staminaMax[to] = world.staminaMax[from]
  world.metabolism[to] = world.metabolism[from]
  world.reproCooldown[to] = world.reproCooldown[from]
}

/** Swap-remove one glorp, keeping every parallel array dense. */
export const removeGlorp = (world: World, index: number): void => {
  const last = world.count - 1
  if (index !== last) copyGlorp(world, last, index)
  world.count = last
}

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

  const reach = 2 * world.radius
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, reach)
    if (hunter < 0) continue
    const next = world.fed[hunter] + HUNTER_KILL_FED
    world.fed[hunter] = next < FED_MAX ? next : FED_MAX
    removeGlorp(world, index)
  }
}

/** Well-fed, off-cooldown glorps spawn an offspring at their position. */
export const applyReproduction = (world: World, dt: number): void => {
  const population = world.count
  for (let index = 0; index < population; index += 1) {
    if (world.cooldown[index] > 0) {
      const next = world.cooldown[index] - dt
      world.cooldown[index] = next > 0 ? next : 0
      continue
    }
    if (world.fed[index] < FED_MAX) continue
    if (world.count >= MAX_GLORPS) continue

    const child = world.count
    copyGlorp(world, index, child)
    world.fed[child] = OFFSPRING_FED
    world.cooldown[child] = world.reproCooldown[child]
    world.sprinting[child] = 0

    // Scatter the offspring deterministically so it never stacks on the parent,
    // and give it its own wander seed so parent and child don't move in lockstep.
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
    world.wanderSeed[child] = hashUnit(child ^ 0x9e3779b9)

    world.fed[index] = FED_MAX
    world.cooldown[index] = world.reproCooldown[index]
    world.count += 1
  }
}

/** Remove every glorp that has run out of energy. */
export const applyDeath = (world: World): void => {
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.fed[index] <= 0) removeGlorp(world, index)
  }
}
