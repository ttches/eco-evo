import { WORLD } from '@/engine/config'
import { TAU, XorShift32, clamp, hashUnit } from '@/engine/math'
import {
  FED_MAX,
  GESTATION_SECONDS,
  HUNTER_ASEXUAL,
  MATE_CONTACT_SECONDS,
  MATE_ENERGY_COST,
  MATE_RANGE,
  MOVEMENT,
  OFFSPRING_FED,
} from '@/sim/config'
import {
  cloneTraits,
  crossTraitsFrom,
  mixDirective,
  mutateDirective,
} from '@/sim/genetics'
import { NO_GLORP, recordBirth, recordBirthFromIds } from '@/sim/lineage'
import { isEligibleMate } from '@/sim/mate'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { allocGlorp } from '@/sim/store'
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/** Newborn state shared by every reproduction path, once traits are set. */
const initOffspring = (world: World, child: number): void => {
  world.fed[child] = OFFSPRING_FED
  world.stamina[child] = world.staminaMax[child]
  world.cooldown[child] = world.reproCooldown[child]
  // Its own wander seed, so parent and child don't move in lockstep.
  world.wanderSeed[child] = hashUnit(child ^ 0x9e3779b9)
}

/** Scatter a newborn one body radius from a parent so it never stacks. */
const placeOffspring = (
  world: World,
  parentIndex: number,
  child: number,
): void => {
  const angle = hashUnit(child) * TAU
  const walk = world.speed[child] * MOVEMENT.walkFactor
  world.x[child] = clamp(
    world.x[parentIndex] + Math.cos(angle) * world.radius,
    world.radius,
    WORLD.width - world.radius,
  )
  world.y[child] = clamp(
    world.y[parentIndex] + Math.sin(angle) * world.radius,
    world.radius,
    WORLD.height - world.radius,
  )
  world.vx[child] = Math.cos(angle) * walk
  world.vy[child] = Math.sin(angle) * walk
}

/** Count down every glorp's reproduction cooldown. */
export const tickCooldowns = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.cooldown[index] <= 0) continue
    const next = world.cooldown[index] - dt
    world.cooldown[index] = next > 0 ? next : 0
  }
}

/** Snapshot one glorp's live trait values, keyed by trait. */
const liveTraits = (world: World, index: number): Record<TraitKey, number> => {
  const values = {} as Record<TraitKey, number>
  for (const key of TRAIT_KEYS) values[key] = world[key][index]
  return values
}

/** Snapshot one (possibly dead) glorp's trait values from the lineage log. */
const lineageTraits = (world: World, id: number): Record<TraitKey, number> => {
  const values = {} as Record<TraitKey, number>
  for (const key of TRAIT_KEYS) values[key] = world.lineage.traits[key][id]
  return values
}

/**
 * Well-fed, off-cooldown glorps spawn an offspring at their position. Hunters
 * are skipped when `HUNTER_ASEXUAL` is off, forcing them to mate instead.
 */
export const applyReproduction = (world: World): void => {
  const population = world.count
  for (let index = 0; index < population; index += 1) {
    if (!HUNTER_ASEXUAL && world.type[index] === GLORP_TYPE.hunter) continue
    if (world.pregnant[index] > 0) continue
    if (world.cooldown[index] > 0) continue
    if (world.fed[index] < FED_MAX) continue

    const child = allocGlorp(world)
    if (child < 0) return

    // A clone inherits the parent's directive (with occasional flips), then
    // mutates each trait in the direction that directive prefers.
    world.type[child] = world.type[index]
    world.directive[child] = mutateDirective(
      world.random,
      world.directive[index],
    )
    cloneTraits(world, index, child)
    initOffspring(world, child)
    placeOffspring(world, index, child)
    recordBirth(world, child, index)

    world.fed[index] = FED_MAX
    world.cooldown[index] = world.reproCooldown[index]
  }
}

/**
 * Materialize a mated child beside its mother. Genes are drawn from a captured
 * seed and both parents' trait values. When the father is still live his index
 * is passed (`fatherIndex >= 0`); otherwise his immutable lineage record is
 * used, so a father who has since died still contributes. Nothing is allocated
 * before this runs, so the unborn child never occupies a live slot or a lineage
 * record.
 */
const birthMatedChild = (
  world: World,
  motherIndex: number,
  fatherId: number,
  random: XorShift32,
  fatherIndex = NO_GLORP,
): void => {
  const child = allocGlorp(world)
  if (child < 0) return

  const motherId = world.id[motherIndex]
  const motherDirective = world.directive[motherIndex]
  const motherTraits = liveTraits(world, motherIndex)

  let fatherDirective = motherDirective
  let fatherTraits = motherTraits
  if (fatherIndex >= 0) {
    fatherDirective = world.directive[fatherIndex]
    fatherTraits = liveTraits(world, fatherIndex)
  } else if (fatherId !== NO_GLORP) {
    fatherDirective = world.lineage.directive[fatherId]
    fatherTraits = lineageTraits(world, fatherId)
  }

  world.type[child] = GLORP_TYPE.hunter
  world.directive[child] = mixDirective(random, motherDirective, fatherDirective)
  crossTraitsFrom(world, child, motherTraits, fatherTraits, random)
  initOffspring(world, child)
  placeOffspring(world, motherIndex, child)
  recordBirthFromIds(world, child, motherId, fatherId)
}

/**
 * One mating: spend energy, then either start a pregnancy or (when gestation is
 * zero) birth the child immediately. A random parent carries the offspring.
 */
const conceive = (world: World, a: number, b: number): void => {
  const mother = world.random.unit() < 0.5 ? a : b
  const father = mother === a ? b : a
  const fatherId = world.id[father]

  world.fed[a] = Math.max(0, world.fed[a] - MATE_ENERGY_COST)
  world.fed[b] = Math.max(0, world.fed[b] - MATE_ENERGY_COST)
  world.cooldown[a] = world.reproCooldown[a]
  world.cooldown[b] = world.reproCooldown[b]
  world.mateContact[a] = 0
  world.mateContact[b] = 0

  if (GESTATION_SECONDS <= 0) {
    birthMatedChild(world, mother, fatherId, world.random, father)
    return
  }
  world.pregnant[mother] = GESTATION_SECONDS
  world.gestationFather[mother] = fatherId
  world.gestationSeed[mother] = world.random.nextUint32()
}

/**
 * Two nearby, well-fed, off-cooldown hunters conceive. When `MATE_CONTACT_SECONDS`
 * is positive they must first stay within `MATE_RANGE` for that long. Nothing is
 * born here: conception starts a pregnancy (see `applyGestation`).
 */
export const applyPairReproduction = (world: World, dt = 0): void => {
  rebuildSpatialGrid(world)

  if (MATE_CONTACT_SECONDS > 0) {
    for (let index = 0; index < world.count; index += 1) {
      if (!isEligibleMate(world, index)) {
        world.mateContact[index] = 0
        continue
      }
      const mate = nearestOfType(
        world,
        index,
        GLORP_TYPE.hunter,
        MATE_RANGE,
        (candidate) => isEligibleMate(world, candidate),
      )
      world.mateContact[index] = mate < 0 ? 0 : world.mateContact[index] + dt
    }
  }

  for (let index = 0; index < world.count; index += 1) {
    if (!isEligibleMate(world, index)) continue
    if (MATE_CONTACT_SECONDS > 0 && world.mateContact[index] < MATE_CONTACT_SECONDS) {
      continue
    }
    const mate = nearestOfType(
      world,
      index,
      GLORP_TYPE.hunter,
      MATE_RANGE,
      (candidate) => isEligibleMate(world, candidate),
    )
    if (mate < 0) continue
    conceive(world, index, mate)
  }
}

/**
 * Count down pregnancies; when one reaches term, materialize the child. A mother
 * who is removed before term simply loses the pregnancy. If the population is at
 * the cap the slot is unavailable and the pregnancy is dropped, since the
 * parents already paid the mating cost at conception.
 */
export const applyGestation = (world: World, dt: number): void => {
  const population = world.count
  for (let index = 0; index < population; index += 1) {
    if (world.pregnant[index] <= 0) continue
    const next = world.pregnant[index] - dt
    if (next > 0) {
      world.pregnant[index] = next
      continue
    }
    const fatherId = world.gestationFather[index]
    const seed = world.gestationSeed[index]
    world.pregnant[index] = 0
    birthMatedChild(world, index, fatherId, new XorShift32(seed))
  }
}
