import { MAX_GLORPS } from '@/sim/config'
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import type { World } from '@/sim/world'

/** Non-trait per-glorp state, one parallel array per entry. */
const STATE_COLUMNS = {
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  type: Uint8Array,
  fed: Float32Array,
  stamina: Float32Array,
  sprinting: Uint8Array,
  /** Latch: 1 while too exhausted to sprint until stamina recovers. */
  exhausted: Uint8Array,
  cooldown: Float32Array,
  wanderSeed: Float32Array,
  /** Stable per-glorp identity, unaffected by swap-removal compaction. */
  id: Uint32Array,
  /** Gestation seconds remaining; 0 when not pregnant. */
  pregnant: Float32Array,
  /** Stable id of the other parent while pregnant, else -1. */
  gestationFather: Int32Array,
  /** RNG seed captured at conception, used to derive the child at birth. */
  gestationSeed: Uint32Array,
  /** Seconds spent beside an eligible mate, for courtship dwell. */
  mateContact: Float32Array,
  /** Seconds after eating a corpse during which the glorp cannot graze. */
  grazeCooldown: Float32Array,
  /** Seconds remaining of an active dodge dart; 0 when not dodging. */
  dodgeTimer: Float32Array,
  /** Committed escape direction during a dodge dart. */
  dodgeDirX: Float32Array,
  dodgeDirY: Float32Array,
  /** Bitmask of rogue-like mutations held; see `mutations`. */
  mutations: Uint32Array,
} as const

type StateColumns = {
  readonly [K in keyof typeof STATE_COLUMNS]: InstanceType<
    (typeof STATE_COLUMNS)[K]
  >
}

type TraitColumns = { readonly [K in TraitKey]: Float32Array }

/** Every per-glorp parallel array: state columns plus one per trait. */
export type GlorpColumns = StateColumns & TraitColumns

type ColumnKey = keyof GlorpColumns

const COLUMN_KEYS: readonly ColumnKey[] = [
  ...(Object.keys(STATE_COLUMNS) as (keyof StateColumns)[]),
  ...TRAIT_KEYS,
]

export const createColumns = (): GlorpColumns => {
  const columns: Record<
    string,
    Float32Array | Uint8Array | Uint32Array | Int32Array
  > = {}
  for (const [key, ArrayType] of Object.entries(STATE_COLUMNS)) {
    columns[key] = new ArrayType(MAX_GLORPS)
  }
  for (const key of TRAIT_KEYS) columns[key] = new Float32Array(MAX_GLORPS)
  return columns as GlorpColumns
}

/**
 * Claim the next slot with every column zeroed and a fresh id. Returns its
 * index, or -1 when the population is already capped.
 */
export const allocGlorp = (world: World): number => {
  if (world.count >= MAX_GLORPS) return -1
  const index = world.count
  for (const key of COLUMN_KEYS) world[key][index] = 0
  world.id[index] = world.nextId
  world.nextId += 1
  world.count += 1
  return index
}

const copyGlorp = (world: World, from: number, to: number): void => {
  for (const key of COLUMN_KEYS) world[key][to] = world[key][from]
}

/** Swap-remove one glorp, keeping every parallel array dense. */
export const removeGlorp = (world: World, index: number): void => {
  const last = world.count - 1
  if (index !== last) copyGlorp(world, last, index)
  world.count = last
}
