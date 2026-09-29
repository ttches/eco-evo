import { WORLD } from '@/engine/config'
import { TAU } from '@/engine/math'
import {
  HUNGER,
  HUNTER_SIGHT,
  HUNTER_SPRINT_MULTIPLIER,
  MOVEMENT,
  PREY_FLEE,
  STAMINA,
  STEER_RATE,
  WANDER_TURN_RATE,
} from '@/sim/config'
import { nearestGrassTile } from '@/sim/grass'
import { nearestOfType } from '@/sim/query'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Desired velocity for one glorp plus whether it wants to sprint. */
export type Steering = {
  readonly x: number
  readonly y: number
  readonly sprint: boolean
}

/** Drift the current heading by a per-glorp rate; RNG-free and deterministic. */
const wanderDirection = (
  world: World,
  index: number,
  speed: number,
  dt: number,
): Steering => {
  const seed = world.wanderSeed[index]
  const vx = world.vx[index]
  const vy = world.vy[index]
  const magnitude = Math.hypot(vx, vy)
  const angle =
    magnitude < 1e-4
      ? seed * TAU
      : Math.atan2(vy, vx) + (seed - 0.5) * WANDER_TURN_RATE * dt
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, sprint: false }
}

const directionTowardPoint = (
  world: World,
  index: number,
  targetX: number,
  targetY: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering => {
  const deltaX = targetX - world.x[index]
  const deltaY = targetY - world.y[index]
  const magnitude = Math.hypot(deltaX, deltaY)
  if (magnitude < 1e-4) return wanderDirection(world, index, speed, dt)
  return {
    x: (deltaX / magnitude) * speed,
    y: (deltaY / magnitude) * speed,
    sprint,
  }
}

const directionAwayFrom = (
  world: World,
  index: number,
  target: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering => {
  const deltaX = world.x[index] - world.x[target]
  const deltaY = world.y[index] - world.y[target]
  const magnitude = Math.hypot(deltaX, deltaY)
  if (magnitude < 1e-4) return wanderDirection(world, index, speed, dt)
  return {
    x: (deltaX / magnitude) * speed,
    y: (deltaY / magnitude) * speed,
    sprint,
  }
}

/** Decide where one glorp wants to go this step. */
export const computeSteering = (
  world: World,
  index: number,
  dt: number,
): Steering => {
  const speed = world.speed[index]
  const walk = speed * MOVEMENT.walkFactor
  const canSprint = world.stamina[index] > 0

  if (world.type[index] === GLORP_TYPE.hunter) {
    if (world.fed[index] < HUNGER && canSprint) {
      const prey = nearestOfType(world, index, GLORP_TYPE.prey, HUNTER_SIGHT)
      if (prey >= 0) {
        return directionTowardPoint(
          world,
          index,
          world.x[prey],
          world.y[prey],
          speed * HUNTER_SPRINT_MULTIPLIER,
          true,
          dt,
        )
      }
    }
    return wanderDirection(world, index, walk, dt)
  }

  const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, PREY_FLEE)
  if (hunter >= 0) {
    return directionAwayFrom(
      world,
      index,
      hunter,
      canSprint ? speed : walk,
      canSprint,
      dt,
    )
  }

  if (world.fed[index] < HUNGER) {
    const tile = nearestGrassTile(world.grass, world.x[index], world.y[index])
    if (tile) {
      return directionTowardPoint(world, index, tile.x, tile.y, walk, false, dt)
    }
  }

  return wanderDirection(world, index, walk, dt)
}

/** Steer every glorp's velocity toward its desired velocity. */
export const updateBehavior = (world: World, dt: number): void => {
  const blend = 1 - Math.exp(-STEER_RATE * dt)
  for (let index = 0; index < world.count; index += 1) {
    const steering = computeSteering(world, index, dt)
    world.sprinting[index] = steering.sprint ? 1 : 0
    world.vx[index] += (steering.x - world.vx[index]) * blend
    world.vy[index] += (steering.y - world.vy[index]) * blend
  }
}

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
