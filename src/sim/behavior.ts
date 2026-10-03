import {
  DODGE_SPEED,
  HUNGER,
  HUNTER_SIGHT,
  HUNTER_SPRINT_MULTIPLIER,
  MATE_SEEKING,
  MOVEMENT,
  PREGNANT_CAN_SPRINT,
  PREGNANT_SPEED_FACTOR,
  PREY_FLEE,
  STEER_RATE,
  WALK_SPEED,
} from '@/sim/config'
import { nearestGrassTile } from '@/sim/grass'
import { isEligibleMate } from '@/sim/mate'
import { TRAITS, TRAIT_MAX, TRAIT_MIN, traitValue } from '@/sim/traits'

import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { steerFlee, steerSampled } from '@/sim/steering/context-steering'
import {
  steerToward,
  steerWander,
  type Steering,
} from '@/sim/steering/steering'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * One motivation a glorp can act on. Returns a steering to take over this
 * step, or null to defer to the next, lower-priority drive.
 */
export type Drive = (
  world: World,
  index: number,
  dt: number,
) => Steering | null

const WALK = WALK_SPEED * MOVEMENT.walkFactor

/**
 * Jog fraction per `endurance` level, precomputed so the pursuit hot path is a
 * lookup. It interpolates from `jogFactorMin` (least endurance, level 0) to
 * `jogFactorMax` (most, level 7), so the base build keeps its old 0.65 rate.
 */
const JOG_FACTOR_BY_LEVEL = (() => {
  const { atMin, atMax } = TRAITS.endurance
  const span = atMax - atMin
  const table = new Float64Array(TRAIT_MAX + 1)
  for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
    const t = (traitValue('endurance', level) - atMin) / span
    table[level] =
      MOVEMENT.jogFactorMin +
      (MOVEMENT.jogFactorMax - MOVEMENT.jogFactorMin) * t
  }
  return table
})()

const jogSpeed = (world: World, index: number): number =>
  traitValue('speed', world.speed[index]) *
  JOG_FACTOR_BY_LEVEL[world.endurance[index]]

/**
 * Speed for a glorp actively pursuing or fleeing: sprint when fresh, otherwise
 * jog. `sprintMultiplier` scales the sprint only (hunters close faster than
 * prey). Keeping speed and the sprint flag together stops the two from drifting
 * out of sync.
 */
const pursuitSpeed = (
  world: World,
  index: number,
  sprint: boolean,
  sprintMultiplier = 1,
): number =>
  sprint ? traitValue('speed', world.speed[index]) * sprintMultiplier : jogSpeed(world, index)

// The latch normally implies `stamina === 0` while exhausted, but the explicit
// `stamina > 0` guard also stops a zero-capacity glorp from sprinting forever.
const canSprint = (world: World, index: number): boolean =>
  world.exhausted[index] === 0 && world.stamina[index] > 0

/**
 * Hungry hunters sprint at prey in sight, jogging once exhausted. The search
 * runs fresh every step and skips dodging prey, so a hunt that loses its target
 * reprioritizes to the next victim with no extra state.
 */
const chasePrey: Drive = (world, index, dt) => {
  if (world.fed[index] >= HUNGER) return null
  const prey = nearestOfType(
    world,
    index,
    GLORP_TYPE.prey,
    HUNTER_SIGHT,
    // A dodging prey is untargetable, so the search skips it entirely.
    (candidate) => world.dodgeTimer[candidate] <= 0,
  )
  if (prey < 0) return null
  const sprint = canSprint(world, index)
  return steerToward(
    world,
    index,
    world.x[prey],
    world.y[prey],
    pursuitSpeed(world, index, sprint, HUNTER_SPRINT_MULTIPLIER),
    sprint,
    dt,
  )
}

/** A dodging prey commits to its escape dart at the fixed dart speed. */
const dodge: Drive = (world, index, dt) => {
  if (world.dodgeTimer[index] <= 0) return null
  return steerSampled(
    world,
    index,
    world.dodgeDirX[index],
    world.dodgeDirY[index],
    DODGE_SPEED,
    true,
    dt,
  )
}

/** Prey run from the nearest hunter, sprinting while fresh and jogging after. */
const fleeHunters: Drive = (world, index, dt) => {
  const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, PREY_FLEE)
  if (hunter < 0) return null
  const sprint = canSprint(world, index)
  return steerFlee(
    world,
    index,
    world.x[hunter],
    world.y[hunter],
    pursuitSpeed(world, index, sprint),
    sprint,
    dt,
  )
}

/** Hungry prey walk to the nearest tile with grass. */
const seekGrass: Drive = (world, index, dt) => {
  if (world.fed[index] >= HUNGER) return null
  const tile = nearestGrassTile(world.grass, world.x[index], world.y[index])
  if (!tile) return null
  return steerToward(world, index, tile.x, tile.y, WALK, false, dt)
}

/** Well-fed, off-cooldown hunters walk toward the nearest eligible mate. */
const seekMate: Drive = (world, index, dt) => {
  if (!MATE_SEEKING) return null
  if (world.fed[index] < HUNGER) return null
  if (!isEligibleMate(world, index)) return null
  const mate = nearestOfType(
    world,
    index,
    GLORP_TYPE.hunter,
    HUNTER_SIGHT,
    (candidate) => isEligibleMate(world, candidate),
  )
  if (mate < 0) return null
  return steerToward(
    world,
    index,
    world.x[mate],
    world.y[mate],
    WALK,
    false,
    dt,
  )
}

/** Drives per glorp type, highest priority first. Wandering is the fallback. */
const DRIVES: Readonly<Record<GlorpType, readonly Drive[]>> = {
  [GLORP_TYPE.prey]: [dodge, fleeHunters, seekGrass],
  [GLORP_TYPE.hunter]: [chasePrey, seekMate],
}

/** Pick the steering one glorp would take with no pregnancy modifier. */
const decideSteering = (world: World, index: number, dt: number): Steering => {
  for (const drive of DRIVES[world.type[index] as GlorpType]) {
    const steering = drive(world, index, dt)
    if (steering) return steering
  }
  return steerWander(world, index, WALK, dt)
}

/** Slow a pregnant glorp down (and optionally stop it sprinting). */
const applyPregnancy = (
  world: World,
  index: number,
  steering: Steering,
): Steering => {
  if (world.pregnant[index] <= 0) return steering
  return {
    x: steering.x * PREGNANT_SPEED_FACTOR,
    y: steering.y * PREGNANT_SPEED_FACTOR,
    sprint: PREGNANT_CAN_SPRINT ? steering.sprint : false,
  }
}

/** Decide where one glorp wants to go this step. */
export const computeSteering = (
  world: World,
  index: number,
  dt: number,
): Steering => {
  const steering = decideSteering(world, index, dt)
  // A dodge is a fixed-distance escape, so pregnancy must not shorten it.
  if (world.dodgeTimer[index] > 0) return steering
  return applyPregnancy(world, index, steering)
}

/** Steer every glorp's velocity toward its desired velocity. */
export const updateBehavior = (world: World, dt: number): void => {
  rebuildSpatialGrid(world)
  const blend = 1 - Math.exp(-STEER_RATE * dt)
  for (let index = 0; index < world.count; index += 1) {
    const steering = computeSteering(world, index, dt)
    if (world.sprinting[index] === 0 && steering.sprint) {
      world.sprintStarts += 1
    }
    world.sprinting[index] = steering.sprint ? 1 : 0
    world.vx[index] += (steering.x - world.vx[index]) * blend
    world.vy[index] += (steering.y - world.vy[index]) * blend
  }
}
