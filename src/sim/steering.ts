import { TAU } from '@/engine/math'
import { WANDER_TURN_RATE } from '@/sim/config'
import type { World } from '@/sim/world'

/** Desired velocity for one glorp plus whether it wants to sprint. */
export type Steering = {
  readonly x: number
  readonly y: number
  readonly sprint: boolean
}

/** Drift the current heading by a per-glorp rate; RNG-free and deterministic. */
export const steerWander = (
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

/** Head along a direction vector; wanders instead if it has no length. */
const steerAlong = (
  world: World,
  index: number,
  deltaX: number,
  deltaY: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering => {
  const magnitude = Math.hypot(deltaX, deltaY)
  if (magnitude < 1e-4) return steerWander(world, index, speed, dt)
  return {
    x: (deltaX / magnitude) * speed,
    y: (deltaY / magnitude) * speed,
    sprint,
  }
}

export const steerToward = (
  world: World,
  index: number,
  targetX: number,
  targetY: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering =>
  steerAlong(
    world,
    index,
    targetX - world.x[index],
    targetY - world.y[index],
    speed,
    sprint,
    dt,
  )

export const steerAway = (
  world: World,
  index: number,
  threatX: number,
  threatY: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering =>
  steerAlong(
    world,
    index,
    world.x[index] - threatX,
    world.y[index] - threatY,
    speed,
    sprint,
    dt,
  )
