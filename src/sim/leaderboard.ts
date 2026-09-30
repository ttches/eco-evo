import { NO_GLORP, displayName, isAlive } from '@/sim/lineage'
import { TRAITS, TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** The stats a leaderboard can rank by, all derived from the lineage log. */
const STAT_KEYS = [
  'offspring',
  'descendants',
  'kills',
  'timeAlive',
] as const

export type StatKey = (typeof STAT_KEYS)[number]

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
  /** Every descendant in the family tree, direct or not. */
  readonly descendants: number
}

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
  readonly value: number
}

/**
 * Reused tallies so a rebuild never re-allocates arrays sized to the ever-
 * growing lineage log. The sim is single-threaded, so module scratch is safe.
 */
let tallyCapacity = 0
let killsTally = new Int32Array(0)
let offspringTally = new Int32Array(0)
let descendantsTally = new Int32Array(0)

const ensureTallies = (size: number): void => {
  if (size <= tallyCapacity) return
  tallyCapacity = Math.max(size, tallyCapacity * 2, 256)
  killsTally = new Int32Array(tallyCapacity)
  offspringTally = new Int32Array(tallyCapacity)
  descendantsTally = new Int32Array(tallyCapacity)
}

/**
 * Aggregate every glorp ever born into a leaderboard in one O(size) pass over
 * the lineage log. Kills and offspring are tallied from the `killer` and parent
 * columns; descendants use a reverse pass because a child always has a higher
 * id than its parents, so a glorp's subtree is complete before it is visited.
 */
export const buildLeaderboard = (world: World): GlorpStat[] => {
  const log = world.lineage
  const size = log.size
  ensureTallies(size)
  const kills = killsTally
  const offspring = offspringTally
  const descendants = descendantsTally
  kills.fill(0, 0, size)
  offspring.fill(0, 0, size)
  descendants.fill(0, 0, size)

  for (let id = size - 1; id >= 0; id -= 1) {
    const killer = log.killer[id]
    if (killer !== NO_GLORP) kills[killer] += 1

    const parentA = log.parentA[id]
    if (parentA !== NO_GLORP) {
      offspring[parentA] += 1
      descendants[parentA] += 1 + descendants[id]
    }
    const parentB = log.parentB[id]
    if (parentB !== NO_GLORP) {
      offspring[parentB] += 1
      descendants[parentB] += 1 + descendants[id]
    }
  }

  const stats: GlorpStat[] = new Array(size)
  for (let id = 0; id < size; id += 1) {
    const alive = isAlive(log, id)
    const endedAt = alive ? world.time : log.diedAt[id]
    stats[id] = {
      id,
      name: displayName(log, id),
      type: log.type[id] as GlorpType,
      alive,
      timeAlive: endedAt - log.bornAt[id],
      kills: kills[id],
      offspring: offspring[id],
      descendants: descendants[id],
    }
  }
  return stats
}

/** Copy sorted by `key` descending, ties broken by ascending id. */
export const sortStats = (
  stats: readonly GlorpStat[],
  key: StatKey,
): GlorpStat[] =>
  [...stats].sort((a, b) => {
    const delta = b[key] - a[key]
    return delta !== 0 ? delta : a.id - b.id
  })

/** Live/dead and diet counts across the whole history. */
export const summarizePopulation = (world: World): PopulationSummary => {
  const log = world.lineage
  let alive = 0
  let prey = 0
  let hunters = 0
  for (let id = 0; id < log.size; id += 1) {
    if (!isAlive(log, id)) continue
    alive += 1
    if (log.type[id] === GLORP_TYPE.prey) prey += 1
    else hunters += 1
  }
  return {
    alive,
    totalBorn: log.size,
    deaths: log.size - alive,
    prey,
    hunters,
  }
}

/**
 * The best glorp for each trait, in the direction the lineage favors: highest
 * speed and stamina, lowest metabolism and reproduction cooldown.
 */
export const traitExtremes = (world: World): TraitExtreme[] => {
  const log = world.lineage
  if (log.size === 0) return []

  return TRAIT_KEYS.map((key) => {
    const column = log.traits[key]
    const favorsHigher = TRAITS[key].favorsHigher
    let bestId = 0
    let bestValue = column[0]
    for (let id = 1; id < log.size; id += 1) {
      const value = column[id]
      if (favorsHigher ? value > bestValue : value < bestValue) {
        bestValue = value
        bestId = id
      }
    }
    return { key, id: bestId, name: displayName(log, bestId), value: bestValue }
  })
}
