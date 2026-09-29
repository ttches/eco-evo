import { WORLD } from '@/engine/config'
import { STAMINA } from '@/sim/config'
import type { World } from '@/sim/world'

/** Sprinting drains stamina; everything else recharges it. */
export const updateStamina = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.sprinting[index] === 1 && world.stamina[index] > 0) {
      const next = world.stamina[index] - STAMINA.drainPerSecond * dt
      world.stamina[index] = next > 0 ? next : 0
    } else {
      const next = world.stamina[index] + STAMINA.recoverPerSecond * dt
      world.stamina[index] =
        next < world.staminaMax[index] ? next : world.staminaMax[index]
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
