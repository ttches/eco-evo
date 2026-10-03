import { WORLD } from '@/engine/config'
import { STAMINA } from '@/sim/config'
import { traitValue } from '@/sim/traits'
import type { World } from '@/sim/world'

/** Recovery gained per second, per point of a glorp's stamina capacity. */
const RECOVER_PER_CAPACITY = STAMINA.recoverPerSecond / STAMINA.referenceMax

/**
 * Sprinting drains stamina; everything else recharges it, scaled by the
 * glorp's own capacity (`endurance / referenceMax`) so bigger reserves refill
 * faster. Draining to empty latches a glorp into exhaustion until stamina
 * recovers to `sprintReadyFraction`, which replaces the old `stamina > 0`
 * per-frame sprint/walk flicker with distinct bursts and rest gaps.
 */
export const updateStamina = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.sprinting[index] === 1 && world.stamina[index] > 0) {
      const next = world.stamina[index] - STAMINA.drainPerSecond * dt
      if (next > 0) {
        world.stamina[index] = next
      } else {
        world.stamina[index] = 0
        world.exhausted[index] = 1
        world.exhaustionEvents += 1
      }
    } else {
      const max = traitValue('endurance', world.endurance[index])
      const next = world.stamina[index] + max * RECOVER_PER_CAPACITY * dt
      world.stamina[index] = next < max ? next : max
      if (
        world.exhausted[index] === 1 &&
        world.stamina[index] >= max * STAMINA.sprintReadyFraction
      ) {
        world.exhausted[index] = 0
      }
    }
  }
}

/** Reflect glorps off the world edges as they move. */
export const integrateMotion = (world: World, dt: number): void => {
  const minimumX = world.radius
  const maximumX = WORLD.width - world.radius
  const minimumY = world.radius
  const maximumY = WORLD.height - world.radius

  for (let index = 0; index < world.count; index += 1) {
    let nextX = world.x[index] + world.vx[index] * dt
    let nextY = world.y[index] + world.vy[index] * dt

    if (nextX < minimumX) {
      nextX = minimumX
      world.vx[index] = Math.abs(world.vx[index])
    } else if (nextX > maximumX) {
      nextX = maximumX
      world.vx[index] = -Math.abs(world.vx[index])
    }

    if (nextY < minimumY) {
      nextY = minimumY
      world.vy[index] = Math.abs(world.vy[index])
    } else if (nextY > maximumY) {
      nextY = maximumY
      world.vy[index] = -Math.abs(world.vy[index])
    }

    world.x[index] = nextX
    world.y[index] = nextY
  }
}
