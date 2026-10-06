import { CORPSE_SECONDS, MAX_CORPSES } from '@/sim/config'
import type { World } from '@/sim/world'

/** Per-corpse state, one parallel array per entry. */
const STATE_COLUMNS = {
  x: Float32Array,
  y: Float32Array,
  type: Uint8Array,
  /** Stable id of the dead glorp, hashed for a silhouette shape. */
  id: Uint32Array,
  /** Seconds left before the corpse is cleared. */
  remaining: Float32Array,
} as const

type StateColumns = {
  readonly [K in keyof typeof STATE_COLUMNS]: InstanceType<
    (typeof STATE_COLUMNS)[K]
  >
}

const COLUMN_KEYS = Object.keys(STATE_COLUMNS) as (keyof StateColumns)[]

/**
 * Dead glorps that linger for `CORPSE_SECONDS` before they are cleared. One
 * parallel array per entry, like the glorp store, so the renderer can read
 * positions without allocating. Corpses are only read back by scavengers, so a
 * corpse left to expire never changes the simulation, but eating one does.
 */
export type CorpseField = StateColumns & { count: number }

export const createCorpses = (): CorpseField => {
  const columns: Record<string, Float32Array | Uint8Array | Uint32Array> = {}
  for (const [key, ArrayType] of Object.entries(STATE_COLUMNS)) {
    columns[key] = new ArrayType(MAX_CORPSES)
  }
  return { count: 0, ...columns } as CorpseField
}

/** Move one corpse (all columns) into another slot for swap-removal. */
const copyCorpse = (corpses: CorpseField, from: number, to: number): void => {
  for (const key of COLUMN_KEYS) corpses[key][to] = corpses[key][from]
}

/**
 * Leave a corpse where a glorp died. Call while the glorp is still at `index`.
 * Draws no randomness, so adding corpses leaves the simulation's RNG stream
 * (and thus determinism) untouched. Once the field is full at `MAX_CORPSES` the
 * corpse is dropped: corpses are short-lived, so the cap is never grown.
 */
export const spawnCorpse = (world: World, index: number): void => {
  const corpses = world.corpses
  if (corpses.count >= MAX_CORPSES) return

  const slot = corpses.count
  corpses.x[slot] = world.x[index]
  corpses.y[slot] = world.y[index]
  corpses.type[slot] = world.type[index]
  corpses.id[slot] = world.id[index]
  corpses.remaining[slot] = CORPSE_SECONDS
  corpses.count += 1
}

/** Swap-remove one corpse, keeping the field dense. Used when a scavenger eats. */
export const removeCorpse = (world: World, index: number): void => {
  const corpses = world.corpses
  const last = corpses.count - 1
  if (index !== last) copyCorpse(corpses, last, index)
  corpses.count = last
}

/**
 * Index of the corpse nearest a world point within `maxDistance`, or -1. Any
 * corpse type qualifies. Corpses are not in the spatial grid, so this is a flat
 * scan; the field is small and short-lived, so scavengers can afford it. Equal
 * distances resolve to the higher index, matching `glorpAt`.
 */
export const nearestCorpse = (
  world: World,
  worldX: number,
  worldY: number,
  maxDistance: number,
): number => {
  const corpses = world.corpses
  let bestDistance = maxDistance * maxDistance
  let best = -1
  for (let index = 0; index < corpses.count; index += 1) {
    const deltaX = corpses.x[index] - worldX
    const deltaY = corpses.y[index] - worldY
    const distance = deltaX * deltaX + deltaY * deltaY
    if (distance <= bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** Age every corpse and swap-remove the ones that have run out of time. */
export const tickCorpses = (world: World, deltaSeconds: number): void => {
  const corpses = world.corpses
  for (let index = corpses.count - 1; index >= 0; index -= 1) {
    const remaining = corpses.remaining[index] - deltaSeconds
    if (remaining > 0) {
      corpses.remaining[index] = remaining
      continue
    }
    removeCorpse(world, index)
  }
}
