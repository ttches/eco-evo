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
  DODGE_CHANCE_PER_ADVANTAGE_POINT,
  DODGE_CHANCE_PER_AGILITY_POINT,
  DODGE_DURATION,
  DODGE_ENABLED,
  DODGE_EXHAUSTS_HUNTER,
  DODGE_LOSES_TRACK_SECONDS,
  DODGE_LUNGE,
  FED_MAX,
  HUNTER_KILL_FED,
  MAX_GLORPS,
  PREY_CONSUME_PER_SECOND,
  PREY_ENERGY_PER_SECOND,
  SCAVENGER,
} from '@/sim/config'
import { nearestCorpse, removeCorpse } from '@/sim/corpses'
import { noteDodge } from '@/sim/encounters'
import { consumeGrass, fillGrass } from '@/sim/grass'
import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import {
  isScavenger,
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
    // A scavenger that just ate a corpse must not immediately graze the grass
    // it created, so the patch survives.
    if (world.grazeCooldown[index] > 0) continue
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
 * How dodgeable a hunter's lunge is under `DODGE_LUNGE`: its speed at contact
 * relative to the reference, clamped. Always 1 when lunge dodging is off.
 */
const lungeFactor = (world: World, hunter: number): number => {
  if (!DODGE_LUNGE.enabled) return 1
  const speed = Math.hypot(world.vx[hunter], world.vy[hunter])
  const factor = speed / DODGE_LUNGE.referenceSpeed
  if (factor < DODGE_LUNGE.minFactor) return DODGE_LUNGE.minFactor
  return factor > DODGE_LUNGE.maxFactor ? DODGE_LUNGE.maxFactor : factor
}

/**
 * Chance the prey dodges a specific attacker. Every point of the prey's own
 * agility adds `DODGE_CHANCE_PER_AGILITY_POINT`, so agility pays off even
 * without an edge; each point it outscores the hunter by adds
 * `DODGE_CHANCE_PER_ADVANTAGE_POINT` on top, so winning the contest pays more.
 * Under `DODGE_LUNGE` the sum scales with how fast the hunter is lunging.
 * Multiplied by the prey's mutation factor (jumper doubles it), capped at
 * `DODGE_CHANCE_MAX`.
 */
export const dodgeChance = (
  world: World,
  hunter: number,
  prey: number,
): number => {
  const agility = world.agility[prey]
  const edge = agility - world.agility[hunter]
  const advantage = edge > 0 ? edge : 0
  const chance =
    (agility * DODGE_CHANCE_PER_AGILITY_POINT +
      advantage * DODGE_CHANCE_PER_ADVANTAGE_POINT) *
    lungeFactor(world, hunter) *
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

  if (DODGE_LOSES_TRACK_SECONDS > 0) {
    world.lostId[hunter] = world.id[prey]
    world.lostTimer[hunter] = DODGE_LOSES_TRACK_SECONDS
  }
  if (DODGE_EXHAUSTS_HUNTER) {
    world.stamina[hunter] = 0
    world.exhausted[hunter] = 1
  }

  noteDodge(world, hunter, prey)
  world.dodges += 1
}

/** Count down active dodge darts and hunters' lost-track timers. */
export const tickDodges = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.lostTimer[index] > 0) {
      const lost = world.lostTimer[index] - dt
      world.lostTimer[index] = lost > 0 ? lost : 0
    }
    if (world.dodgeTimer[index] <= 0) continue
    const next = world.dodgeTimer[index] - dt
    world.dodgeTimer[index] = next > 0 ? next : 0
  }
}

/** Count down the post-scavenge graze cooldown on every glorp. */
export const tickGrazeCooldowns = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.grazeCooldown[index] <= 0) continue
    const next = world.grazeCooldown[index] - dt
    world.grazeCooldown[index] = next > 0 ? next : 0
  }
}

/**
 * Hunters remove and gain energy from nearby prey. A prey may dodge instead
 * (see `dodgeChance`), escaping the catch; while its dart lasts it is
 * untargetable and cannot be eaten. Kills are collected and removed afterwards
 * so indices stored in the grid stay valid for the whole hunt; descending order
 * keeps swap-remove safe. Returns the number of kills so callers know whether
 * the grid went stale.
 */
export const huntPrey = (world: World, reach: number): number => {
  rebuildSpatialGrid(world)
  let kills = 0
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.type[index] !== GLORP_TYPE.prey) continue
    // A dodging prey is untargetable for the whole dart.
    if (world.dodgeTimer[index] > 0) continue
    const preyId = world.id[index]
    // A hunter that lost track of this prey cannot catch it by bumping into it.
    const hunter = nearestOfType(
      world,
      index,
      GLORP_TYPE.hunter,
      reach,
      (candidate) =>
        world.lostTimer[candidate] <= 0 || world.lostId[candidate] !== preyId,
    )
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

/**
 * Scavengers eat any corpse they have reached, gaining `SCAVENGER.energy` and
 * turning the tile beneath it into full grass. The eater is put on a
 * `SCAVENGER.grazeCooldown` so it does not immediately graze that grass.
 * Contact eating is additive, so a glorp that also caught live prey this step
 * still gets its corpse; running last leaves the catch/cannibal removal
 * bookkeeping untouched. Draws no randomness, so the simulation stream (and
 * determinism) is untouched.
 */
export const scavengeCorpses = (world: World): void => {
  if (world.corpses.count === 0) return
  for (let index = 0; index < world.count; index += 1) {
    if (!isScavenger(world.mutations[index])) continue
    if (world.fed[index] >= FED_MAX) continue
    const corpse = nearestCorpse(
      world,
      world.x[index],
      world.y[index],
      CATCH_PREY_RANGE,
    )
    if (corpse < 0) continue
    const next = world.fed[index] + SCAVENGER.energy
    world.fed[index] = next < FED_MAX ? next : FED_MAX
    world.grazeCooldown[index] = SCAVENGER.grazeCooldown
    fillGrass(world.grass, world.corpses.x[corpse], world.corpses.y[corpse])
    removeCorpse(world, corpse)
    world.scavenges += 1
  }
}

/** Prey graze, hunters hunt, starving hunters may cannibalize, scavengers eat. */
export const applyEating = (world: World, dt: number): void => {
  grazePrey(world, dt)
  // Catches and dodges both resolve at one body diameter, so a dodge only fires
  // when the hunter is right on top of the prey.
  const preyKills = huntPrey(world, CATCH_PREY_RANGE)
  if (CANNIBALISM) cannibalize(world, 2 * world.radius, preyKills > 0)
  scavengeCorpses(world)
}
