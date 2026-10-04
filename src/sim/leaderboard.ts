import { NO_GLORP, displayName, isAlive } from '@/sim/lineage'
import { TRAIT_KEYS, type TraitKey, type TraitLevels } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** The stats a leaderboard can rank by, all derived from the lineage log. */
const STAT_KEYS = ['offspring', 'kills', 'timeAlive'] as const

export type StatKey = (typeof STAT_KEYS)[number]

/** Anything the ranked list can be sorted by: a tally or a heritable trait. */
export type SortKey = StatKey | TraitKey

/** One glorp's all-time stats, alive or dead, ready for React. */
export type GlorpStat = {
  readonly id: number
  readonly name: string
  readonly type: GlorpType
  readonly alive: boolean
  /** Seconds lived so far, or total lifespan once dead. */
  readonly timeAlive: number
  /** Prey this glorp has eaten. */
  readonly kills: number
  /** Direct children. */
  readonly offspring: number
  /** Heritable trait values, as rolled or inherited at birth. */
  readonly traits: Readonly<TraitLevels>
  /** Mutation bitmask as rolled or inherited at birth; see `@/sim/mutations`. */
  readonly mutations: number
}

/** Diet restriction for the leaderboard, or `all`. */
export type DietFilter = 'all' | GlorpType

/** Life-status restriction for the leaderboard. */
export type StatusFilter = 'both' | 'alive' | 'dead'

const TRAIT_KEY_SET: ReadonlySet<string> = new Set(TRAIT_KEYS)

const isTraitKey = (key: SortKey): key is TraitKey => TRAIT_KEY_SET.has(key)

/** Narrow a sort key to one of the tallies (i.e. not a trait). */
export const isStatKey = (key: SortKey): key is StatKey => !isTraitKey(key)

/** The value a sort key reads off a stat, whether a tally or a trait. */
export const sortValue = (stat: GlorpStat, key: SortKey): number =>
  isTraitKey(key) ? stat.traits[key] : stat[key]

/** Population totals for the stats header. */
export type PopulationSummary = {
  readonly alive: number
  readonly totalBorn: number
  readonly deaths: number
  readonly prey: number
  readonly hunters: number
}

/** The glorp holding the most favorable value of one trait. */
export type TraitExtreme = {
  readonly key: TraitKey
  readonly id: number
  readonly name: string
  readonly type: GlorpType
  readonly alive: boolean
  readonly value: number
  /** Mutation bitmask as rolled or inherited at birth; see `@/sim/mutations`. */
  readonly mutations: number
}

/**
 * Reused tallies so a rebuild never re-allocates arrays sized to the ever-
 * growing lineage log. The sim is single-threaded, so module scratch is safe.
 */
let tallyCapacity = 0
let killsTally = new Int32Array(0)
let offspringTally = new Int32Array(0)

const ensureTallies = (size: number): void => {
  if (size <= tallyCapacity) return
  tallyCapacity = Math.max(size, tallyCapacity * 2, 256)
  killsTally = new Int32Array(tallyCapacity)
  offspringTally = new Int32Array(tallyCapacity)
}

/**
 * Aggregate every glorp ever born into a leaderboard in one O(size) pass over
 * the lineage log. Kills and offspring are tallied from the `killer` and parent
 * columns.
 */
export const buildLeaderboard = (world: World): GlorpStat[] => {
  const log = world.lineage
  const size = log.size
  ensureTallies(size)
  const kills = killsTally
  const offspring = offspringTally
  kills.fill(0, 0, size)
  offspring.fill(0, 0, size)

  for (let id = 0; id < size; id += 1) {
    const killer = log.killer[id]
    if (killer !== NO_GLORP) kills[killer] += 1

    const parentA = log.parentA[id]
    if (parentA !== NO_GLORP) offspring[parentA] += 1
    const parentB = log.parentB[id]
    if (parentB !== NO_GLORP) offspring[parentB] += 1
  }

  const stats: GlorpStat[] = new Array(size)
  for (let id = 0; id < size; id += 1) {
    const alive = isAlive(log, id)
    const endedAt = alive ? world.time : log.diedAt[id]
    const traits = {} as TraitLevels
    for (const key of TRAIT_KEYS) traits[key] = log.traits[key][id]
    stats[id] = {
      id,
      name: displayName(log, id),
      type: log.type[id] as GlorpType,
      alive,
      timeAlive: endedAt - log.bornAt[id],
      kills: kills[id],
      offspring: offspring[id],
      traits,
      mutations: log.mutations[id],
    }
  }
  return stats
}

/** Keep only the glorps matching a diet and life status. */
export const filterStats = (
  stats: readonly GlorpStat[],
  diet: DietFilter,
  status: StatusFilter,
): GlorpStat[] =>
  stats.filter((stat) => {
    if (diet !== 'all' && stat.type !== diet) return false
    if (status === 'alive') return stat.alive
    if (status === 'dead') return !stat.alive
    return true
  })

/** Copy sorted by `key`, best first, ties broken by ascending id. */
export const sortStats = (
  stats: readonly GlorpStat[],
  key: SortKey,
): GlorpStat[] =>
  [...stats].sort((a, b) => {
    const delta = sortValue(b, key) - sortValue(a, key)
    return delta !== 0 ? delta : a.id - b.id
  })

/** Live/dead and diet counts across a set of stats. */
export const summarizeStats = (
  stats: readonly GlorpStat[],
): PopulationSummary => {
  let alive = 0
  let prey = 0
  let hunters = 0
  for (const stat of stats) {
    if (!stat.alive) continue
    alive += 1
    if (stat.type === GLORP_TYPE.prey) prey += 1
    else hunters += 1
  }
  return {
    alive,
    totalBorn: stats.length,
    deaths: stats.length - alive,
    prey,
    hunters,
  }
}

/**
 * The glorp with the highest level in each trait. Ties keep the earlier stat,
 * so the lower id wins.
 */
export const traitExtremesFromStats = (
  stats: readonly GlorpStat[],
): TraitExtreme[] => {
  if (stats.length === 0) return []

  return TRAIT_KEYS.map((key) => {
    let best = stats[0]
    for (const stat of stats) {
      const value = stat.traits[key]
      const bestValue = best.traits[key]
      if (value > bestValue) best = stat
    }
    return {
      key,
      id: best.id,
      name: best.name,
      type: best.type,
      alive: best.alive,
      value: best.traits[key],
      mutations: best.mutations,
    }
  })
}
