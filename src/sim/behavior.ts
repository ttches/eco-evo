import {
  FED_MAX,
  HUNGER,
  HUNTER_SIGHT,
  HUNTER_SPRINT_MULTIPLIER,
  MATE_SEEKING,
  MOVEMENT,
  PREGNANT_CAN_SPRINT,
  PREGNANT_SPEED_FACTOR_MAX,
  PREGNANT_SPEED_FACTOR_MIN,
  PREY_FLEE,
  SCAVENGER,
  STEER_RATE,
  WALK_SPEED,
} from '@/sim/config'
import { nearestCorpse } from '@/sim/corpses'
import { nearestGrassTile } from '@/sim/grass'
import { isEligibleMate } from '@/sim/mate'
import {
  camouflageSightFactor,
  isScavenger,
  mutationCanSprint,
  mutationDodgeSpeed,
  mutationScaresPrey,
  mutationSpeedFactor,
  mutationWalkFactor,
} from '@/sim/mutations'
import { TRAIT_MAX, TRAIT_MIN, scaleTrait, traitValue } from '@/sim/traits'

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
export type Drive = (world: World, index: number, dt: number) => Steering | null

const WALK = WALK_SPEED * MOVEMENT.walkFactor

/** Flat walk speed, scaled by raw-speed mutations such as stoat. */
const walkSpeed = (world: World, index: number): number =>
  WALK * mutationWalkFactor(world.mutations[index])

/**
 * Jog fraction per `endurance` level, precomputed so the pursuit hot path is a
 * lookup. It interpolates from `jogFactorMin` (least endurance, level 0) to
 * `jogFactorMax` (most, level 7), so the base build keeps its old 0.65 rate.
 */
const JOG_FACTOR_BY_LEVEL = (() => {
  const table = new Float64Array(TRAIT_MAX + 1)
  for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
    table[level] = scaleTrait(
      'endurance',
      level,
      MOVEMENT.jogFactorMin,
      MOVEMENT.jogFactorMax,
    )
  }
  return table
})()

/**
 * Pregnancy speed factor per `fertility` level: `PREGNANT_SPEED_FACTOR_MIN` at
 * level 0, rising linearly to no reduction (`PREGNANT_SPEED_FACTOR_MAX`) at
 * level 7. Precomputed like the jog table.
 */
const PREGNANT_SPEED_BY_LEVEL = (() => {
  const table = new Float64Array(TRAIT_MAX + 1)
  for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
    table[level] = scaleTrait(
      'fertility',
      level,
      PREGNANT_SPEED_FACTOR_MIN,
      PREGNANT_SPEED_FACTOR_MAX,
    )
  }
  return table
})()

/**
 * The mechanical top speed a glorp's `speed` trait grants it, after mutation
 * modifiers (e.g. cold blooded makes speed points less effective). Walk and
 * wander use a flat speed and never call this.
 */
const speedTraitValue = (world: World, index: number): number =>
  traitValue('speed', world.speed[index]) *
  mutationSpeedFactor(world.mutations[index])

const jogSpeed = (world: World, index: number): number =>
  speedTraitValue(world, index) * JOG_FACTOR_BY_LEVEL[world.endurance[index]]

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
  sprint
    ? speedTraitValue(world, index) * sprintMultiplier
    : jogSpeed(world, index)

// The latch normally implies `stamina === 0` while exhausted, but the explicit
// `stamina > 0` guard also stops a zero-capacity glorp from sprinting forever.
// Stealth hunters can never sprint, capping pursuit at the jog tier.
const canSprint = (world: World, index: number): boolean =>
  mutationCanSprint(world.mutations[index]) &&
  world.exhausted[index] === 0 &&
  world.stamina[index] > 0

/** Whether `target` lies within `range` of `observer`, by squared distance. */
const withinSight = (
  world: World,
  observer: number,
  target: number,
  range: number,
): boolean => {
  const deltaX = world.x[target] - world.x[observer]
  const deltaY = world.y[target] - world.y[observer]
  return deltaX * deltaX + deltaY * deltaY <= range * range
}

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
    (candidate) => {
      // A dodging prey is untargetable, so the search skips it entirely.
      if (world.dodgeTimer[candidate] > 0) return false
      // Camouflaged prey are only spotted within a fraction of that range.
      const sight = camouflageSightFactor(world.mutations[candidate])
      if (sight === 1) return true
      return withinSight(world, index, candidate, HUNTER_SIGHT * sight)
    },
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

/** A dodging prey commits to its escape dart at its own dart speed. */
const dodge: Drive = (world, index, dt) => {
  if (world.dodgeTimer[index] <= 0) return null
  return steerSampled(
    world,
    index,
    world.dodgeDirX[index],
    world.dodgeDirY[index],
    mutationDodgeSpeed(world.mutations[index], world.agility[index]),
    true,
    dt,
  )
}

/** Prey run from the nearest hunter, sprinting while fresh and jogging after. */
const fleeHunters: Drive = (world, index, dt) => {
  // Prey do not react to a stealth hunter; they still dodge one at contact.
  const hunter = nearestOfType(
    world,
    index,
    GLORP_TYPE.hunter,
    PREY_FLEE,
    (candidate) => mutationScaresPrey(world.mutations[candidate]),
  )
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

/**
 * Scavengers jog to the nearest corpse in sight, ranked above their type's
 * normal food (grass for prey, live prey for hunters). Prey scavenge at any
 * hunger; hunters only when hungry, so a well-fed predator keeps hunting.
 * Jogging keeps sprint reserved for pursuit and flight while still racing the
 * corpse's short decay.
 */
const scavenge: Drive = (world, index, dt) => {
  if (world.type[index] === GLORP_TYPE.hunter && world.fed[index] >= HUNGER)
    return null
  if (!isScavenger(world.mutations[index])) return null
  const corpse = nearestCorpse(
    world,
    world.x[index],
    world.y[index],
    SCAVENGER.sight,
  )
  if (corpse < 0) return null
  return steerToward(
    world,
    index,
    world.corpses.x[corpse],
    world.corpses.y[corpse],
    jogSpeed(world, index),
    false,
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
    walkSpeed(world, index),
    false,
    dt,
  )
}

/** Drives per glorp type, highest priority first. Wandering is the fallback. */
const DRIVES: Readonly<Record<GlorpType, readonly Drive[]>> = {
  // Survival first: dodge and flee outrank food. Scavenging then outranks the
  // normal meal, and a hunter treats a corpse as preferred over live prey.
  [GLORP_TYPE.prey]: [dodge, fleeHunters, scavenge, seekGrass],
  [GLORP_TYPE.hunter]: [scavenge, chasePrey, seekMate],
}

/** Pick the steering one glorp would take with no pregnancy modifier. */
const decideSteering = (world: World, index: number, dt: number): Steering => {
  for (const drive of DRIVES[world.type[index] as GlorpType]) {
    const steering = drive(world, index, dt)
    if (steering) return steering
  }
  return steerWander(world, index, walkSpeed(world, index), dt)
}

/** Slow a pregnant glorp down (and optionally stop it sprinting). */
const applyPregnancy = (
  world: World,
  index: number,
  steering: Steering,
): Steering => {
  if (world.pregnant[index] <= 0) return steering
  const factor = PREGNANT_SPEED_BY_LEVEL[world.fertility[index]]
  return {
    x: steering.x * factor,
    y: steering.y * factor,
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
