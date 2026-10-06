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
 * positions without allocating. Corpses are cosmetic: nothing in the sim reads
 * them back, so spawning one never changes the simulation.
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
 * corpse is dropped: corpses are cosmetic, so the cap is never grown.
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

/** Age every corpse and swap-remove the ones that have run out of time. */
export const tickCorpses = (world: World, deltaSeconds: number): void => {
  const corpses = world.corpses
  for (let index = corpses.count - 1; index >= 0; index -= 1) {
    const remaining = corpses.remaining[index] - deltaSeconds
    if (remaining > 0) {
      corpses.remaining[index] = remaining
      continue
    }

    const last = corpses.count - 1
    if (index !== last) copyCorpse(corpses, last, index)
    corpses.count = last
  }
}
