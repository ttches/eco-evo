import {
  HUNGER,
  HUNTER_SIGHT,
  HUNTER_SPRINT_MULTIPLIER,
  MOVEMENT,
  PREY_FLEE,
  STEER_RATE,
} from '@/sim/config'
import { nearestGrassTile } from '@/sim/grass'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import {
  steerAway,
  steerToward,
  steerWander,
  type Steering,
} from '@/sim/steering'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * One motivation a glorp can act on. Returns a steering to take over this
 * step, or null to defer to the next, lower-priority drive.
 */
export type Drive = (world: World, index: number, dt: number) => Steering | null

const walkSpeed = (world: World, index: number): number =>
  world.speed[index] * MOVEMENT.walkFactor

const canSprint = (world: World, index: number): boolean =>
  world.stamina[index] > 0

/** Hungry hunters with stamina left sprint at the nearest prey in sight. */
const chasePrey: Drive = (world, index, dt) => {
  if (world.fed[index] >= HUNGER || !canSprint(world, index)) return null
  const prey = nearestOfType(world, index, GLORP_TYPE.prey, HUNTER_SIGHT)
  if (prey < 0) return null
  return steerToward(
    world,
    index,
    world.x[prey],
    world.y[prey],
    world.speed[index] * HUNTER_SPRINT_MULTIPLIER,
    true,
    dt,
  )
}

/** Prey run from the nearest hunter in range, sprinting while they can. */
const fleeHunters: Drive = (world, index, dt) => {
  const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, PREY_FLEE)
  if (hunter < 0) return null
  const sprint = canSprint(world, index)
  return steerAway(
    world,
    index,
    world.x[hunter],
    world.y[hunter],
    sprint ? world.speed[index] : walkSpeed(world, index),
    sprint,
    dt,
  )
}

/** Hungry prey walk to the nearest tile with grass. */
const seekGrass: Drive = (world, index, dt) => {
  if (world.fed[index] >= HUNGER) return null
  const tile = nearestGrassTile(world.grass, world.x[index], world.y[index])
  if (!tile) return null
  return steerToward(
    world,
    index,
    tile.x,
    tile.y,
    walkSpeed(world, index),
    false,
    dt,
  )
}

/** Drives per glorp type, highest priority first. Wandering is the fallback. */
const DRIVES: Readonly<Record<GlorpType, readonly Drive[]>> = {
  [GLORP_TYPE.prey]: [fleeHunters, seekGrass],
  [GLORP_TYPE.hunter]: [chasePrey],
}

/** Decide where one glorp wants to go this step. */
export const computeSteering = (
  world: World,
  index: number,
  dt: number,
): Steering => {
  for (const drive of DRIVES[world.type[index] as GlorpType]) {
    const steering = drive(world, index, dt)
    if (steering) return steering
  }
  return steerWander(world, index, walkSpeed(world, index), dt)
}

/** Steer every glorp's velocity toward its desired velocity. */
export const updateBehavior = (world: World, dt: number): void => {
  rebuildSpatialGrid(world)
  const blend = 1 - Math.exp(-STEER_RATE * dt)
  for (let index = 0; index < world.count; index += 1) {
    const steering = computeSteering(world, index, dt)
    world.sprinting[index] = steering.sprint ? 1 : 0
    world.vx[index] += (steering.x - world.vx[index]) * blend
    world.vy[index] += (steering.y - world.vy[index]) * blend
  }
}
