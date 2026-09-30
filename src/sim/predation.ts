/**
 * Predation and cannibalism. Holds the pure strength helpers shared with the
 * steering layer plus the eating passes, so `lifecycle` stays a thin orchestrator
 * and `behavior` never needs to import the mutation modules.
 */
import { hashUnit } from '@/engine/math'
import {
  CANNIBALISM,
  CANNIBAL_HUNGER,
  CANNIBAL_KILL_FED,
  FED_MAX,
  HUNTER_KILL_FED,
  MAX_GLORPS,
  PREY_CONSUME_PER_SECOND,
  PREY_ENERGY_PER_SECOND,
  STRENGTH_EDGE,
  STRENGTH_GATES_PREDATION,
} from '@/sim/config'
import { consumeGrass } from '@/sim/grass'
import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { removeGlorp } from '@/sim/store'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Energy gained per unit of grass eaten. */
const GRASS_ENERGY = PREY_ENERGY_PER_SECOND / PREY_CONSUME_PER_SECOND

/** Scratch list of glorps eaten this step, in descending index order. */
const eaten = new Int32Array(MAX_GLORPS)

/** Scratch flags marking glorps already claimed by a cannibal this step. */
const cannibalEaten = new Uint8Array(MAX_GLORPS)

/**
 * Whether a hunter of strength level `hunterLevel` can eat `prey`. Takes the
 * attacker's level so hot scans don't re-read it for every candidate.
 */
export const canEatLevel = (
  world: World,
  hunterLevel: number,
  prey: number,
): boolean =>
  !STRENGTH_GATES_PREDATION ||
  hunterLevel + STRENGTH_EDGE >= world.strength[prey]

/** Whether `hunter` is strong enough to eat `prey`. */
export const canEat = (world: World, hunter: number, prey: number): boolean =>
  canEatLevel(world, world.strength[hunter], prey)

/**
 * Whether attacker `a` wins a cannibalism contest against `b`: higher strength
 * level, then higher energy, then older (smaller `bornAt`), then a deterministic
 * coin flip derived from the pair's ids so both scan directions agree.
 */
export const cannibalWins = (world: World, a: number, b: number): boolean => {
  const levelA = world.strength[a]
  const levelB = world.strength[b]
  if (levelA !== levelB) return levelA > levelB

  if (world.fed[a] !== world.fed[b]) return world.fed[a] > world.fed[b]

  const bornA = world.lineage.bornAt[world.id[a]]
  const bornB = world.lineage.bornAt[world.id[b]]
  if (bornA !== bornB) return bornA < bornB

  const idA = world.id[a]
  const idB = world.id[b]
  const low = Math.min(idA, idB)
  const high = Math.max(idA, idB)
  const flip = hashUnit(Math.imul(low ^ 0x9e3779b9, 0x85ebca6b) ^ high)
  return (flip < 0.5) === (idA === low)
}

/** Prey graze on grass. */
export const grazePrey = (world: World, dt: number): void => {
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
}

/**
 * Hunters remove and gain energy from nearby edible prey. Kills are collected
 * and removed afterwards so indices stored in the grid stay valid for the whole
 * hunt; descending order keeps swap-remove safe. Returns the number of kills so
 * callers know whether the grid went stale.
 */
export const huntPrey = (world: World, reach: number): number => {
  rebuildSpatialGrid(world)
  let kills = 0
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    const hunter = nearestOfType(
      world,
      index,
      GLORP_TYPE.hunter,
      reach,
      (candidate) => canEat(world, candidate, index),
    )
    if (hunter < 0) continue
    const next = world.fed[hunter] + HUNTER_KILL_FED
    world.fed[hunter] = next < FED_MAX ? next : FED_MAX
    recordDeath(world, index, DEATH_CAUSE.eaten, hunter)
    eaten[kills] = index
    kills += 1
  }
  for (let kill = 0; kill < kills; kill += 1) removeGlorp(world, eaten[kill])
  return kills
}

/**
 * Starving hunters may turn on each other, resolved by the strength contest.
 * Only rebuilds the grid when a previous pass removed glorps.
 */
export const cannibalize = (
  world: World,
  reach: number,
  gridStale: boolean,
): void => {
  if (gridStale) rebuildSpatialGrid(world)
  cannibalEaten.fill(0, 0, world.count)
  let kills = 0
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.hunter) continue
    if (cannibalEaten[index] === 1) continue
    if (world.fed[index] >= CANNIBAL_HUNGER) continue
    const victim = nearestOfType(
      world,
      index,
      GLORP_TYPE.hunter,
      reach,
      (candidate) =>
        cannibalEaten[candidate] === 0 && cannibalWins(world, index, candidate),
    )
    if (victim < 0) continue
    const next = world.fed[index] + CANNIBAL_KILL_FED
    world.fed[index] = next < FED_MAX ? next : FED_MAX
    recordDeath(world, victim, DEATH_CAUSE.eaten, index)
    cannibalEaten[victim] = 1
    eaten[kills] = victim
    kills += 1
  }
  for (let kill = 0; kill < kills; kill += 1) removeGlorp(world, eaten[kill])
}

/** Prey graze, hunters hunt, and starving hunters may cannibalize. */
export const applyEating = (world: World, dt: number): void => {
  grazePrey(world, dt)
  const reach = 2 * world.radius
  const preyKills = huntPrey(world, reach)
  if (CANNIBALISM) cannibalize(world, reach, preyKills > 0)
}
