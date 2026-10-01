import {
  DEATH_CAUSE,
  displayName,
  isAlive,
  readLineage,
  type DeathCause,
  type LineageLog,
} from '@/sim/lineage'
import type { TraitLevels } from '@/sim/traits'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** A lightweight pointer to another glorp, alive or dead. */
export type GlorpRef = {
  readonly id: number
  readonly name: string
  /** True when the glorp was given a custom name, false for the default. */
  readonly named: boolean
  readonly type: GlorpType
  readonly alive: boolean
  readonly generation: number
  /** Seconds lived so far, or total lifespan once dead. */
  readonly timeAlive: number
}

/** The live simulation state of a glorp, absent once it has died. */
export type GlorpLiveState = {
  readonly fed: number
  readonly stamina: number
  readonly cooldown: number
  /** Gestation seconds remaining; 0 when not pregnant. */
  readonly pregnant: number
  readonly x: number
  readonly y: number
}

/**
 * A full view of one glorp for the inspector, joining live state with its
 * lineage record. Works for any id ever born, alive or dead; `live` is null
 * once the glorp is gone.
 */
export type GlorpView = {
  readonly id: number
  readonly name: string
  readonly type: GlorpType
  readonly alive: boolean
  readonly generation: number
  readonly bornAt: number
  readonly diedAt: number
  /** Seconds lived so far, or total lifespan once dead. */
  readonly timeAlive: number
  readonly deathCause: DeathCause
  readonly killer: GlorpRef | null
  readonly parents: readonly GlorpRef[]
  readonly children: readonly GlorpRef[]
  readonly traits: Readonly<TraitLevels>
  readonly live: GlorpLiveState | null
}

/**
 * Last-seen children of one glorp. The lineage log is append-only and children
 * always have higher ids than their parent, so only the newly appended tail
 * ever needs scanning. One slot per log; only one glorp is inspected at a time.
 */
type ChildCache = {
  id: number
  /** Next lineage slot to scan; everything below has been examined. */
  scannedTo: number
  children: number[]
}

const childCaches = new WeakMap<LineageLog, ChildCache>()

/** Direct children ids of `id`, extending the cache over any new births. */
const readChildren = (world: World, id: number): number[] => {
  const log = world.lineage
  let cache = childCaches.get(log)
  if (!cache || cache.id !== id) {
    // A child's id is always greater than its parent's, so nothing below
    // `id + 1` can match.
    cache = { id, scannedTo: id + 1, children: [] }
    childCaches.set(log, cache)
  }

  for (let child = cache.scannedTo; child < log.size; child += 1) {
    if (log.parentA[child] === id || log.parentB[child] === id) {
      cache.children.push(child)
    }
  }
  cache.scannedTo = log.size
  return cache.children
}

/** Index of the glorp carrying a given stable id, or -1 if it is gone. */
export const findGlorpById = (world: World, id: number): number => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.id[index] === id) return index
  }
  return -1
}

/** Resolve a referenced id to a small, React-safe pointer, or null. */
const readRef = (world: World, id: number): GlorpRef | null => {
  const record = readLineage(world.lineage, id)
  if (!record) return null
  const alive = isAlive(world.lineage, id)
  const endedAt = alive ? world.time : record.diedAt
  return {
    id,
    name: displayName(world.lineage, id),
    named: record.name !== null,
    type: record.type,
    alive,
    generation: record.generation,
    timeAlive: endedAt - record.bornAt,
  }
}

/**
 * Read a glorp for the inspector by stable id, whether it is currently alive
 * or long dead. Returns null for an id that was never born.
 */
export const readGlorpView = (world: World, id: number): GlorpView | null => {
  const record = readLineage(world.lineage, id)
  if (!record) return null

  const index = findGlorpById(world, id)
  const live =
    index < 0
      ? null
      : {
          fed: world.fed[index],
          stamina: world.stamina[index],
          cooldown: world.cooldown[index],
          pregnant: world.pregnant[index],
          x: world.x[index],
          y: world.y[index],
        }

  const alive = record.deathCause === DEATH_CAUSE.alive
  const endedAt = alive ? world.time : record.diedAt

  return {
    id,
    name: displayName(world.lineage, id),
    type: record.type,
    alive,
    generation: record.generation,
    bornAt: record.bornAt,
    diedAt: record.diedAt,
    timeAlive: endedAt - record.bornAt,
    deathCause: record.deathCause,
    killer: readRef(world, record.killer),
    parents: [record.parentA, record.parentB]
      .map((parent) => readRef(world, parent))
      .filter((ref): ref is GlorpRef => ref !== null),
    children: readChildren(world, id)
      .map((child) => readRef(world, child))
      .filter((ref): ref is GlorpRef => ref !== null),
    traits: record.traits,
    live,
  }
}
