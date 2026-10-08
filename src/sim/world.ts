import { XorShift32 } from '@/engine/math'
import {
  DEFAULT_SEED,
  GLORP_RADIUS,
  MAX_GLORPS,
  START_HUNTERS,
  START_PREY,
} from '@/sim/config'
import { updateBehavior } from '@/sim/behavior'
import { createCorpses, tickCorpses } from '@/sim/corpses'
import { tickFlights } from '@/sim/encounters'
import { createGrass, regrowGrass } from '@/sim/grass'
import { applyDeath, applyMetabolism } from '@/sim/lifecycle'
import { createLineage, type LineageLog } from '@/sim/lineage'
import { integrateMotion, updateStamina } from '@/sim/motion'
import { applyEating, tickDodges, tickGrazeCooldowns } from '@/sim/predation'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
  tickCooldowns,
} from '@/sim/reproduction'
import { createSpatialGrid, type SpatialGrid } from '@/sim/spatial'
import { seedPopulation } from '@/sim/spawn'
import { createColumns, type GlorpColumns } from '@/sim/store'
import type { RenderableWorld } from '@/sim/view'

export type World = RenderableWorld &
  GlorpColumns & {
    count: number
    /** Next id handed out to a newborn or spawned glorp. */
    nextId: number
    /** Seed every RNG stream in this world was derived from. */
    readonly seed: number
    /** Seeded source of runtime randomness (spawns, offspring scatter). */
    readonly random: XorShift32
    /** Position buckets for range queries; see `rebuildSpatialGrid`. */
    readonly neighbors: SpatialGrid
    /** Every glorp ever born, including the dead, keyed by id. */
    readonly lineage: LineageLog
    /** Simulation seconds elapsed. */
    time: number
    /** Cumulative 0->1 sprint transitions, for fatigue/flicker analysis. */
    sprintStarts: number
    /** Cumulative times a glorp entered exhaustion. */
    exhaustionEvents: number
    /** Cumulative successful prey dodges. */
    dodges: number
    /** Cumulative corpses eaten by scavengers. */
    scavenges: number
  }

const DEFAULT_COUNT = START_PREY + START_HUNTERS

export const createWorld = (
  count = DEFAULT_COUNT,
  seed = DEFAULT_SEED,
): World => {
  // `XorShift32` substitutes `DEFAULT_SEED` for a zero state, so record the seed
  // actually in use rather than the raw argument.
  const effectiveSeed = seed >>> 0 || DEFAULT_SEED
  const world: World = {
    ...createColumns(),
    count: 0,
    nextId: 0,
    seed: effectiveSeed,
    random: new XorShift32(effectiveSeed),
    neighbors: createSpatialGrid(),
    lineage: createLineage(),
    time: 0,
    sprintStarts: 0,
    exhaustionEvents: 0,
    dodges: 0,
    scavenges: 0,
    grass: createGrass(effectiveSeed),
    corpses: createCorpses(),
    radius: GLORP_RADIUS,
  }

  const active = Math.max(0, Math.min(count, MAX_GLORPS))
  const prey = Math.min(START_PREY, active)
  seedPopulation(world, prey, active - prey)
  return world
}

/** Advance the whole simulation one fixed step. */
export const step = (world: World, deltaSeconds: number): void => {
  // Age corpses before any death this step, so a corpse always lives the full
  // `CORPSE_SECONDS` from the moment it appears.
  tickCorpses(world, deltaSeconds)
  tickDodges(world, deltaSeconds)
  tickGrazeCooldowns(world, deltaSeconds)
  updateBehavior(world, deltaSeconds)
  integrateMotion(world, deltaSeconds)
  applyEating(world, deltaSeconds)
  // After eating, so a prey caught mid-flight never counts as escaped.
  tickFlights(world, deltaSeconds)
  // Cooldowns tick once per step, then both reproduction paths read them.
  tickCooldowns(world, deltaSeconds)
  // Reproduction must run before metabolism: eating tops `fed` up to exactly
  // FED_MAX, and metabolism would immediately drain it below the threshold.
  applyReproduction(world)
  applyPairReproduction(world, deltaSeconds)
  applyGestation(world, deltaSeconds)
  applyMetabolism(world, deltaSeconds)
  updateStamina(world, deltaSeconds)
  applyDeath(world)
  regrowGrass(world.grass, deltaSeconds)
  world.time += deltaSeconds
}
