import {
  DEATH_CAUSE,
  displayName,
  isAlive,
  readLineage,
  type DeathCause,
} from '@/sim/lineage'
import type { TraitLevels } from '@/sim/traits'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** A lightweight pointer to another glorp, alive or dead. */
export type GlorpRef = {
  readonly id: number
  readonly name: string
  readonly type: GlorpType
  readonly alive: boolean
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
  readonly deathCause: DeathCause
  readonly killer: GlorpRef | null
  readonly parents: readonly GlorpRef[]
  readonly traits: Readonly<TraitLevels>
  readonly live: GlorpLiveState | null
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
  return {
    id,
    name: displayName(world.lineage, id),
    type: record.type,
    alive: isAlive(world.lineage, id),
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

  return {
    id,
    name: displayName(world.lineage, id),
    type: record.type,
    alive: record.deathCause === DEATH_CAUSE.alive,
    generation: record.generation,
    bornAt: record.bornAt,
    diedAt: record.diedAt,
    deathCause: record.deathCause,
    killer: readRef(world, record.killer),
    parents: [record.parentA, record.parentB]
      .map((parent) => readRef(world, parent))
      .filter((ref): ref is GlorpRef => ref !== null),
    traits: record.traits,
    live,
  }
}
