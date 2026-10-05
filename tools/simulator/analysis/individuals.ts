/**
 * One flat row per glorp ever born, with the derived per-individual outcomes
 * (offspring, kills, age) that every selection/performer analysis needs.
 *
 * The table is deliberately free of `World` references so the exact same
 * analysis code runs on a single run or on many seeds pooled together, and so
 * it can be round-tripped through `individuals.json`.
 */
import { DEATH_CAUSE } from '@/sim/lineage'
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'
import type { TypeName } from './types.ts'

export type Cause = 'alive' | 'starved' | 'eaten'

export type Individual = {
  /** Which run (seed) this glorp came from; 0 for a single run. */
  run: number
  id: number
  type: TypeName
  generation: number
  /** Spawned at t=0 rather than born (no parents). */
  founder: boolean
  bornAt: number
  /** Death time, or the run's end time when still alive (right-censored). */
  endAt: number
  /** Seconds lived; for the living, seconds lived so far. */
  age: number
  alive: boolean
  cause: Cause
  /** Children credited to this glorp (mated children count for both parents). */
  offspring: number
  /** Prey this glorp ate. */
  kills: number
  /** Other hunters this glorp ate. */
  cannibalKills: number
  /**
   * Born early enough to have had a fair chance to live and reproduce: excludes
   * the last `settleSeconds` of the run so late births do not look barren.
   */
  eligible: boolean
  /** Birth time bucket: -1 for founders, else 0..epochs-1 over the run. */
  epoch: number
  /** Trait levels in `TRAIT_KEYS` order. */
  traits: number[]
  /** Mutation bitmask as rolled or inherited at birth (see `@/sim/mutations`). */
  mutations: number
}

export type IndividualTable = {
  traitKeys: readonly TraitKey[]
  epochs: number
  /** Per run: how long it lasted and the epoch width used for bucketing. */
  runs: { seed: number; endedAt: number }[]
  rows: Individual[]
}

export type TableOptions = {
  epochs: number
  settleSeconds: number
  seed: number
  run?: number
}

const CAUSE_OF: Record<number, Cause> = {
  [DEATH_CAUSE.alive]: 'alive',
  [DEATH_CAUSE.starved]: 'starved',
  [DEATH_CAUSE.eaten]: 'eaten',
}

/** Bucket a birth time into one of `epochs` equal slices of the run. */
export const epochOf = (
  time: number,
  endedAt: number,
  epochs: number,
): number => {
  if (endedAt <= 0) return 0
  return Math.min(
    epochs - 1,
    Math.max(0, Math.floor((time / endedAt) * epochs)),
  )
}

/** Read the lineage log of a finished world into an `IndividualTable`. */
export const buildTable = (
  world: World,
  options: TableOptions,
): IndividualTable => {
  const log = world.lineage
  const { epochs, settleSeconds, seed } = options
  const run = options.run ?? 0
  const endedAt = world.time
  const offspring = new Uint32Array(log.size)
  const kills = new Uint32Array(log.size)
  const cannibalKills = new Uint32Array(log.size)

  for (let id = 0; id < log.size; id += 1) {
    const a = log.parentA[id]
    const b = log.parentB[id]
    if (a >= 0) offspring[a] += 1
    if (b >= 0 && b !== a) offspring[b] += 1
    if (log.deathCause[id] === DEATH_CAUSE.eaten && log.killer[id] >= 0) {
      if (log.type[id] === GLORP_TYPE.prey) kills[log.killer[id]] += 1
      else cannibalKills[log.killer[id]] += 1
    }
  }

  const rows: Individual[] = []
  for (let id = 0; id < log.size; id += 1) {
    const alive = log.deathCause[id] === DEATH_CAUSE.alive
    const endAt = alive ? endedAt : log.diedAt[id]
    const founder = log.parentA[id] < 0 && log.parentB[id] < 0
    rows.push({
      run,
      id,
      type: log.type[id] === GLORP_TYPE.hunter ? 'hunter' : 'prey',
      generation: log.generation[id],
      founder,
      bornAt: log.bornAt[id],
      endAt,
      age: endAt - log.bornAt[id],
      alive,
      cause: CAUSE_OF[log.deathCause[id]] ?? 'alive',
      offspring: offspring[id],
      kills: kills[id],
      cannibalKills: cannibalKills[id],
      eligible: founder || log.bornAt[id] <= endedAt - settleSeconds,
      epoch: founder ? -1 : epochOf(log.bornAt[id], endedAt, epochs),
      traits: TRAIT_KEYS.map((key) => log.traits[key][id]),
      mutations: log.mutations[id],
    })
  }
  return { traitKeys: TRAIT_KEYS, epochs, runs: [{ seed, endedAt }], rows }
}

/** Pool several runs into one table, tagging each row with its run index. */
export const concatTables = (tables: IndividualTable[]): IndividualTable => {
  const runs: IndividualTable['runs'] = []
  const rows: Individual[] = []
  for (const table of tables) {
    const offset = runs.length
    runs.push(...table.runs)
    for (const row of table.rows) rows.push({ ...row, run: row.run + offset })
  }
  return {
    traitKeys: tables[0]?.traitKeys ?? TRAIT_KEYS,
    epochs: tables[0]?.epochs ?? 0,
    runs,
    rows,
  }
}

const COLUMNS = [
  'run',
  'id',
  'type',
  'generation',
  'founder',
  'bornAt',
  'endAt',
  'age',
  'alive',
  'cause',
  'offspring',
  'kills',
  'cannibalKills',
  'eligible',
  'epoch',
  'mutations',
] as const

/** Values for columns absent from older `individuals.json` files. */
const COLUMN_DEFAULTS: Partial<Record<(typeof COLUMNS)[number], number>> = {
  mutations: 0,
}

/** Compact columnar-ish JSON: a header plus one array per row. */
export const serializeTable = (table: IndividualTable): string =>
  JSON.stringify({
    traitKeys: table.traitKeys,
    epochs: table.epochs,
    runs: table.runs,
    columns: COLUMNS,
    rows: table.rows.map((row) => [
      ...COLUMNS.map((column) => {
        const value = row[column]
        return typeof value === 'boolean' ? (value ? 1 : 0) : value
      }),
      ...row.traits,
    ]),
  })

export const parseTable = (text: string): IndividualTable => {
  const raw = JSON.parse(text) as {
    traitKeys: TraitKey[]
    epochs: number
    runs: IndividualTable['runs']
    columns: (typeof COLUMNS)[number][]
    rows: (string | number)[][]
  }
  const rows = raw.rows.map((values) => {
    const row: Record<string, unknown> = {}
    raw.columns.forEach((column, index) => {
      const value = values[index]
      row[column] =
        column === 'founder' || column === 'alive' || column === 'eligible'
          ? value === 1
          : value
    })
    for (const column of COLUMNS) {
      if (!(column in row) && COLUMN_DEFAULTS[column] !== undefined) {
        row[column] = COLUMN_DEFAULTS[column]
      }
    }
    row.traits = values.slice(raw.columns.length) as number[]
    return row as Individual
  })
  return { traitKeys: raw.traitKeys, epochs: raw.epochs, runs: raw.runs, rows }
}

/** Compact build signature, e.g. `4-4-4-4` in `TRAIT_KEYS` order. */
export const buildKey = (traits: readonly number[]): string => traits.join('-')
