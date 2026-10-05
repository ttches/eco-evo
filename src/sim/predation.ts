/**
 * Predation and cannibalism. Holds the eating passes, so `lifecycle` stays a
 * thin orchestrator and `behavior` never needs to import the mutation modules.
 */
import { TAU, hashUnit } from '@/engine/math'
import {
  CANNIBALISM,
  CANNIBAL_HUNGER,
  CANNIBAL_KILL_FED,
  CATCH_PREY_RANGE,
  DODGE_CHANCE_MAX,
  DODGE_CHANCE_PER_LEVEL,
  DODGE_DURATION,
  DODGE_ENABLED,
  FED_MAX,
  HUNTER_KILL_FED,
  MAX_GLORPS,
  PREY_CONSUME_PER_SECOND,
  PREY_ENERGY_PER_SECOND,
} from '@/sim/config'
import { consumeGrass } from '@/sim/grass'
import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import {
  mutationDodgeChanceMultiplier,
  mutationDodgeSpeed,
} from '@/sim/mutations'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { removeGlorp } from '@/sim/store'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Energy gained per unit of grass eaten. */
const GRASS_ENERGY = PREY_ENERGY_PER_SECOND / PREY_CONSUME_PER_SECOND

/** Scratch list of glorps eaten this step; each pass sets its own removal order. */
const eaten = new Int32Array(MAX_GLORPS)

/** Scratch flags marking glorps already claimed by a cannibal this step. */
const cannibalEaten = new Uint8Array(MAX_GLORPS)

/**
 * Whether attacker `a` wins a cannibalism contest against `b`: higher agility,
 * then higher energy, then older (smaller `bornAt`), then a deterministic coin
 * flip derived from the pair's ids so both scan directions agree.
 */
export const cannibalWins = (world: World, a: number, b: number): boolean => {
  const agilityA = world.agility[a]
  const agilityB = world.agility[b]
  if (agilityA !== agilityB) return agilityA > agilityB

  if (world.fed[a] !== world.fed[b]) return world.fed[a] > world.fed[b]

  const bornA = world.lineage.bornAt[world.id[a]]
  const bornB = world.lineage.bornAt[world.id[b]]
  if (bornA !== bornB) return bornA < bornB

  const idA = world.id[a]
  const idB = world.id[b]
  const low = Math.min(idA, idB)
  const high = Math.max(idA, idB)
  const flip = hashUnit(Math.imul(low ^ 0x9e3779b9, 0x85ebca6b) ^ high)
  return flip < 0.5 === (idA === low)
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
 * Chance the prey dodges a specific attacker: zero unless the prey's agility
 * exceeds the hunter's, then `DODGE_CHANCE_PER_LEVEL` per level of advantage,
 * multiplied by the prey's mutation factor (jumper doubles it), capped at
 * `DODGE_CHANCE_MAX`.
 */
export const dodgeChance = (
  world: World,
  hunter: number,
  prey: number,
): number => {
  const edge = world.agility[prey] - world.agility[hunter]
  if (edge <= 0) return 0
  const chance =
    edge *
    DODGE_CHANCE_PER_LEVEL *
    mutationDodgeChanceMultiplier(world.mutations[prey])
  return chance < DODGE_CHANCE_MAX ? chance : DODGE_CHANCE_MAX
}

/** Roll the dodge chance. Only consumes RNG when a dodge is possible. */
const tryDodge = (world: World, hunter: number, prey: number): boolean => {
  if (!DODGE_ENABLED) return false
  const chance = dodgeChance(world, hunter, prey)
  return chance > 0 && world.random.unit() < chance
}

/**
 * Launch a prey's escape dart. The prey jukes perpendicular to its own heading
 * (toward the side that opens distance from the attacker), so the escape reads
 * as a sharp sidestep rather than a straight sprint. While the dart lasts the
 * prey is untargetable, so the hunter's prey search reprioritizes on its own.
 */
const triggerDodge = (world: World, hunter: number, prey: number): void => {
  const speedX = world.vx[prey]
  const speedY = world.vy[prey]
  const speedMagnitude = Math.hypot(speedX, speedY)
  let directionX: number
  let directionY: number

  if (speedMagnitude > 1e-4) {
    // Perpendicular to the direction of travel...
    directionX = -speedY / speedMagnitude
    directionY = speedX / speedMagnitude
    // ...picking the side that moves away from the hunter.
    const awayX = world.x[prey] - world.x[hunter]
    const awayY = world.y[prey] - world.y[hunter]
    if (directionX * awayX + directionY * awayY < 0) {
      directionX = -directionX
      directionY = -directionY
    }
  } else {
    // Standing still: dart straight away from the hunter.
    const deltaX = world.x[prey] - world.x[hunter]
    const deltaY = world.y[prey] - world.y[hunter]
    const magnitude = Math.hypot(deltaX, deltaY)
    if (magnitude < 1e-4) {
      const angle = world.wanderSeed[prey] * TAU
      directionX = Math.cos(angle)
      directionY = Math.sin(angle)
    } else {
      directionX = deltaX / magnitude
      directionY = deltaY / magnitude
    }
  }

  const dodgeSpeed = mutationDodgeSpeed(
    world.mutations[prey],
    world.agility[prey],
  )
  world.dodgeDirX[prey] = directionX
  world.dodgeDirY[prey] = directionY
  world.dodgeTimer[prey] = DODGE_DURATION

  world.vx[prey] = directionX * dodgeSpeed
  world.vy[prey] = directionY * dodgeSpeed

  world.dodges += 1
}

/** Count down active dodge darts. */
export const tickDodges = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.dodgeTimer[index] <= 0) continue
    const next = world.dodgeTimer[index] - dt
    world.dodgeTimer[index] = next > 0 ? next : 0
  }
}

/**
 * Hunters remove and gain energy from nearby prey. A prey agile enough to beat
 * the hunter's agility may dodge instead, escaping the catch; while its dart
 * lasts it is untargetable and cannot be eaten. Kills are collected and removed
 * afterwards so indices stored in the grid stay valid for the whole hunt;
 * descending order keeps swap-remove safe. Returns the number of kills so
 * callers know whether the grid went stale.
 */
export const huntPrey = (world: World, reach: number): number => {
  rebuildSpatialGrid(world)
  let kills = 0
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    // A dodging prey is untargetable for the whole dart.
    if (world.dodgeTimer[index] > 0) continue
    const hunter = nearestOfType(world, index, GLORP_TYPE.hunter, reach)
    if (hunter < 0) continue
    if (tryDodge(world, hunter, index)) {
      triggerDodge(world, hunter, index)
      continue
    }
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
 * Starving hunters may turn on each other, resolved by the agility contest.
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
  // Victims are found in nearest-first order, not by index, so sort before
  // swap-removing: removing a lower index first would shift a survivor into
  // the removed slot and a later higher index would evict the wrong glorp.
  const victims = eaten.subarray(0, kills)
  victims.sort()
  for (let kill = kills - 1; kill >= 0; kill -= 1)
    removeGlorp(world, victims[kill])
}

/** Prey graze, hunters hunt, and starving hunters may cannibalize. */
export const applyEating = (world: World, dt: number): void => {
  grazePrey(world, dt)
  // Catches and dodges both resolve at one body diameter, so a dodge only fires
  // when the hunter is right on top of the prey.
  const preyKills = huntPrey(world, CATCH_PREY_RANGE)
  if (CANNIBALISM) cannibalize(world, 2 * world.radius, preyKills > 0)
}
