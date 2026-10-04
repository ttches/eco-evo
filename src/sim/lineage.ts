import { TRAIT_KEYS, type TraitKey, type TraitLevels } from '@/sim/traits'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

export const DEATH_CAUSE = {
  alive: 0,
  starved: 1,
  eaten: 2,
} as const

export type DeathCause = (typeof DEATH_CAUSE)[keyof typeof DEATH_CAUSE]

/** Marks a missing parent or killer. */
export const NO_GLORP = -1

const INITIAL_CAPACITY = 1024

/**
 * Append-only record of every glorp ever born, alive or dead, for family
 * trees. Ids are handed out sequentially from 0, so a glorp's record lives at
 * slot `id` and lookups are O(1). Children always have higher ids than their
 * parents. Columns grow by doubling; nothing is ever removed.
 */
export type LineageLog = {
  /** Records written so far; also the next id expected. */
  size: number
  capacity: number
  type: Uint8Array
  /** Parent ids; `NO_GLORP` for spawned glorps, `parentB` too for clones. */
  parentA: Int32Array
  parentB: Int32Array
  /** 0 for spawned glorps, else one more than the older parent's generation. */
  generation: Uint32Array
  /** Simulation seconds. `diedAt` is NaN while alive. */
  bornAt: Float64Array
  diedAt: Float64Array
  deathCause: Uint8Array
  /** Id of the glorp that ate this one, or `NO_GLORP`. */
  killer: Int32Array
  /** Trait levels as rolled or inherited at birth. */
  traits: Record<TraitKey, Float32Array>
  /**
   * Mutation bitmask as rolled or inherited at birth, then updated in place if
   * the glorp later gains one by eating mutated prey; see `@/sim/mutations`.
   */
  mutations: Uint32Array
  /** User-given names, sparse because most glorps are never named. */
  readonly names: Map<number, string>
}

/** A plain copy of one lineage record, safe to hand to React. */
export type LineageRecord = {
  readonly id: number
  readonly type: GlorpType
  readonly parentA: number
  readonly parentB: number
  readonly generation: number
  readonly bornAt: number
  readonly diedAt: number
  readonly deathCause: DeathCause
  readonly killer: number
  readonly traits: Readonly<TraitLevels>
  /**
   * Mutation bitmask as rolled or inherited at birth, then updated in place if
   * the glorp later gains one by eating mutated prey; see `@/sim/mutations`.
   */
  readonly mutations: number
  /** User-given name, or null if never named. */
  readonly name: string | null
}

const createTraitColumns = (capacity: number): Record<TraitKey, Float32Array> =>
  Object.fromEntries(
    TRAIT_KEYS.map((key) => [key, new Float32Array(capacity)]),
  ) as Record<TraitKey, Float32Array>

export const createLineage = (capacity = INITIAL_CAPACITY): LineageLog => ({
  size: 0,
  capacity,
  type: new Uint8Array(capacity),
  parentA: new Int32Array(capacity),
  parentB: new Int32Array(capacity),
  generation: new Uint32Array(capacity),
  bornAt: new Float64Array(capacity),
  diedAt: new Float64Array(capacity),
  deathCause: new Uint8Array(capacity),
  killer: new Int32Array(capacity),
  traits: createTraitColumns(capacity),
  mutations: new Uint32Array(capacity),
  names: new Map(),
})

const grown = <T extends Uint8Array | Int32Array | Uint32Array | Float32Array | Float64Array>(
  column: T,
  capacity: number,
): T => {
  const next = new (column.constructor as new (length: number) => T)(capacity)
  next.set(column)
  return next
}

const grow = (log: LineageLog): void => {
  const capacity = log.capacity * 2
  log.type = grown(log.type, capacity)
  log.parentA = grown(log.parentA, capacity)
  log.parentB = grown(log.parentB, capacity)
  log.generation = grown(log.generation, capacity)
  log.bornAt = grown(log.bornAt, capacity)
  log.diedAt = grown(log.diedAt, capacity)
  log.deathCause = grown(log.deathCause, capacity)
  log.killer = grown(log.killer, capacity)
  log.mutations = grown(log.mutations, capacity)
  for (const key of TRAIT_KEYS) log.traits[key] = grown(log.traits[key], capacity)
  log.capacity = capacity
}

/**
 * Log a newborn once its type and traits are set, linking parents by
 * their stable ids. Pass `NO_GLORP` for a missing parent.
 */
export const recordBirthFromIds = (
  world: World,
  index: number,
  idA: number,
  idB: number,
): void => {
  const log = world.lineage
  const id = world.id[index]
  // Ids are sequential, so the next record always lands at the end.
  if (id !== log.size) throw new Error(`Lineage out of sync at glorp ${id}`)
  if (log.size === log.capacity) grow(log)

  const generationA = idA === NO_GLORP ? -1 : log.generation[idA]
  const generationB = idB === NO_GLORP ? -1 : log.generation[idB]

  log.type[id] = world.type[index]
  log.parentA[id] = idA
  log.parentB[id] = idB
  log.generation[id] = Math.max(generationA, generationB) + 1
  log.bornAt[id] = world.time
  log.diedAt[id] = Number.NaN
  log.deathCause[id] = DEATH_CAUSE.alive
  log.killer[id] = NO_GLORP
  log.mutations[id] = world.mutations[index]
  for (const key of TRAIT_KEYS) log.traits[key][id] = world[key][index]
  log.size += 1
}

/**
 * Log a newborn once its type and traits are set. Pass parent
 * indices (not ids) into the live world, or `NO_GLORP`.
 */
export const recordBirth = (
  world: World,
  index: number,
  parentA = NO_GLORP,
  parentB = NO_GLORP,
): void => {
  const idA = parentA === NO_GLORP ? NO_GLORP : world.id[parentA]
  const idB = parentB === NO_GLORP ? NO_GLORP : world.id[parentB]
  recordBirthFromIds(world, index, idA, idB)
}

/** Log a death. Call while the glorp (and any killer) is still at `index`. */
export const recordDeath = (
  world: World,
  index: number,
  cause: DeathCause,
  killer = NO_GLORP,
): void => {
  const log = world.lineage
  const id = world.id[index]
  log.diedAt[id] = world.time
  log.deathCause[id] = cause
  log.killer[id] = killer === NO_GLORP ? NO_GLORP : world.id[killer]
}

/**
 * Update a glorp's logged mutation mask after birth, e.g. when a hunter takes on
 * a meal's mutation. Keeps the lineage log in step with the live world.
 */
export const recordMutationGain = (
  world: World,
  index: number,
  mask: number,
): void => {
  world.lineage.mutations[world.id[index]] = mask
}

/** Name a glorp, alive or dead. A blank name clears it. */
export const setName = (log: LineageLog, id: number, name: string): void => {
  if (id < 0 || id >= log.size) return
  const trimmed = name.trim()
  if (trimmed) log.names.set(id, trimmed)
  else log.names.delete(id)
}

/** The user-given name, falling back to `Glorp #id`. */
export const displayName = (log: LineageLog, id: number): string =>
  log.names.get(id) ?? `Glorp #${id}`

export const isAlive = (log: LineageLog, id: number): boolean =>
  log.deathCause[id] === DEATH_CAUSE.alive

/** Read one record into a plain snapshot, or null for an unknown id. */
export const readLineage = (
  log: LineageLog,
  id: number,
): LineageRecord | null => {
  if (id < 0 || id >= log.size) return null
  return {
    id,
    type: log.type[id] as GlorpType,
    parentA: log.parentA[id],
    parentB: log.parentB[id],
    generation: log.generation[id],
    bornAt: log.bornAt[id],
    diedAt: log.diedAt[id],
    deathCause: log.deathCause[id] as DeathCause,
    killer: log.killer[id],
    traits: Object.fromEntries(
      TRAIT_KEYS.map((key) => [key, log.traits[key][id]]),
    ) as TraitLevels,
    mutations: log.mutations[id],
    name: log.names.get(id) ?? null,
  }
}

/** Ids of a glorp's direct children, oldest first. */
export const childrenOf = (log: LineageLog, id: number): number[] => {
  const children: number[] = []
  // Children are always born after their parents, so start just past `id`.
  for (let child = id + 1; child < log.size; child += 1) {
    if (log.parentA[child] === id || log.parentB[child] === id) {
      children.push(child)
    }
  }
  return children
}
