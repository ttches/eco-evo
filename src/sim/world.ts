import { XorShift32 } from '@/engine/math'
import {
  DEFAULT_SEED,
  GLORP_RADIUS,
  MAX_GLORPS,
  START_HUNTERS,
  START_PREY,
} from '@/sim/config'
import { updateBehavior } from '@/sim/behavior'
import { createGrass, regrowGrass } from '@/sim/grass'
import { applyDeath, applyMetabolism } from '@/sim/lifecycle'
import { createLineage, type LineageLog } from '@/sim/lineage'
import { integrateMotion, updateStamina } from '@/sim/motion'
import { applyEating } from '@/sim/predation'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
  tickCooldowns,
} from '@/sim/reproduction'
import { createSpatialGrid, type SpatialGrid } from '@/sim/spatial'
import { spawnRandom } from '@/sim/spawn'
import { createColumns, type GlorpColumns } from '@/sim/store'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

export type World = RenderableWorld &
  GlorpColumns & {
    count: number
    /** Next id handed out to a newborn or spawned glorp. */
    nextId: number
    /** Seeded source of runtime randomness (spawns, offspring scatter). */
    readonly random: XorShift32
    /** Position buckets for range queries; see `rebuildSpatialGrid`. */
    readonly neighbors: SpatialGrid
    /** Every glorp ever born, including the dead, keyed by id. */
    readonly lineage: LineageLog
    /** Simulation seconds elapsed. */
    time: number
  }

const DEFAULT_COUNT = START_PREY + START_HUNTERS

export const createWorld = (
  count = DEFAULT_COUNT,
  seed = DEFAULT_SEED,
): World => {
  const world: World = {
    ...createColumns(),
    count: 0,
    nextId: 0,
    random: new XorShift32(seed),
    neighbors: createSpatialGrid(),
    lineage: createLineage(),
    time: 0,
    grass: createGrass(seed),
    radius: GLORP_RADIUS,
  }

  const active = Math.max(0, Math.min(count, MAX_GLORPS))
  for (let index = 0; index < active; index += 1) {
    spawnRandom(world, index < START_PREY ? GLORP_TYPE.prey : GLORP_TYPE.hunter)
  }
  return world
}

/** Advance the whole simulation one fixed step. */
export const step = (world: World, deltaSeconds: number): void => {
  updateBehavior(world, deltaSeconds)
  integrateMotion(world, deltaSeconds)
  applyEating(world, deltaSeconds)
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
