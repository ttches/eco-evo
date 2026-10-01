/**
 * Table-derived run overview: who was born, who died of what, how long they
 * lived, how much killing happened, and how all that flowed over time.
 */
import { epochOf, type Individual, type IndividualTable } from './individuals.ts'
import { TYPE_NAMES, type TypeCounts, type TypeName } from './types.ts'
import { describe, gini, mean, type Distribution } from './stats.ts'

export type DeathBreakdown = { starved: number; eaten: number; total: number }

export type TimeToDeath = {
  all: Distribution
  eaten: Distribution
  starved: Distribution
}

export type AgeBucket = { seconds: number; count: number }

export type Overview = {
  born: TypeCounts
  alive: TypeCounts
  deaths: Record<TypeName, DeathBreakdown>
  timeToDeath: Record<TypeName, TimeToDeath>
  /** Share of a type's deaths that were predation (eaten) rather than hunger. */
  eatenShare: Record<TypeName, number>
  predation: {
    preyKills: number
    cannibalKills: number
    /** Hunters eaten by another hunter within seconds of birth. */
    cannibalizedNewborns: number
    huntersEverBorn: number
    huntersWithKills: number
    meanKillsPerHunter: number
    maxKills: number
    /** Prey kills per hunter-minute alive: predation intensity normalized by effort. */
    killsPerHunterMinute: number
    top10Share: number
    gini: number
    zeroKillShare: number
  }
  ageAtDeath: {
    bucketSeconds: number
    prey: AgeBucket[]
    hunter: AgeBucket[]
  }
}

export type EpochFlow = {
  index: number
  from: number
  to: number
  born: Record<TypeName, number>
  starved: Record<TypeName, number>
  eaten: Record<TypeName, number>
  /** Mean lifespan of those who died in this window. */
  lifespan: Record<TypeName, number>
}

const AGE_BUCKET_SECONDS = 30

/** A hunter eaten this soon after birth counts as a cannibalized newborn. */
const NEWBORN_SECONDS = 10

const emptyCounts = (): TypeCounts => ({ prey: 0, hunter: 0, total: 0 })

const toBuckets = (ages: number[]): AgeBucket[] => {
  if (ages.length === 0) return []
  const counts = new Map<number, number>()
  let last = 0
  for (const age of ages) {
    const index = Math.floor(age / AGE_BUCKET_SECONDS)
    counts.set(index, (counts.get(index) ?? 0) + 1)
    if (index > last) last = index
  }
  return Array.from({ length: last + 1 }, (_, index) => ({
    seconds: index * AGE_BUCKET_SECONDS,
    count: counts.get(index) ?? 0,
  }))
}

const timeToDeath = (rows: Individual[]): TimeToDeath => {
  const dead = rows.filter((row) => !row.alive)
  return {
    all: describe(dead.map((row) => row.age)),
    eaten: describe(dead.filter((row) => row.cause === 'eaten').map((row) => row.age)),
    starved: describe(dead.filter((row) => row.cause === 'starved').map((row) => row.age)),
  }
}

export const analyzeOverview = (table: IndividualTable): Overview => {
  const born = emptyCounts()
  const alive = emptyCounts()
  const deaths = {
    prey: { starved: 0, eaten: 0, total: 0 },
    hunter: { starved: 0, eaten: 0, total: 0 },
  }
  const byType: Record<TypeName, Individual[]> = { prey: [], hunter: [] }
  for (const row of table.rows) {
    byType[row.type].push(row)
    born[row.type] += 1
    born.total += 1
    if (row.alive) {
      alive[row.type] += 1
      alive.total += 1
    } else {
      deaths[row.type].total += 1
      if (row.cause === 'eaten') deaths[row.type].eaten += 1
      else deaths[row.type].starved += 1
    }
  }

  const hunters = byType.hunter
  const kills = hunters.map((row) => row.kills)
  const preyKills = kills.reduce((sum, value) => sum + value, 0)
  const hunterMinutes = hunters.reduce((sum, row) => sum + row.age, 0) / 60
  const topCount = Math.max(1, Math.ceil(kills.length * 0.1))
  const topKills = [...kills].sort((a, b) => b - a).slice(0, topCount)

  return {
    born,
    alive,
    deaths,
    timeToDeath: { prey: timeToDeath(byType.prey), hunter: timeToDeath(byType.hunter) },
    eatenShare: {
      prey: deaths.prey.total === 0 ? 0 : deaths.prey.eaten / deaths.prey.total,
      hunter: deaths.hunter.total === 0 ? 0 : deaths.hunter.eaten / deaths.hunter.total,
    },
    predation: {
      preyKills,
      cannibalKills: hunters.reduce((sum, row) => sum + row.cannibalKills, 0),
      cannibalizedNewborns: hunters.filter(
        (row) => row.cause === 'eaten' && row.age < NEWBORN_SECONDS,
      ).length,
      huntersEverBorn: hunters.length,
      huntersWithKills: hunters.filter((row) => row.kills > 0).length,
      meanKillsPerHunter: hunters.length === 0 ? 0 : preyKills / hunters.length,
      maxKills: kills.length === 0 ? 0 : Math.max(...kills),
      killsPerHunterMinute: hunterMinutes === 0 ? 0 : preyKills / hunterMinutes,
      top10Share:
        preyKills === 0 ? 0 : topKills.reduce((sum, value) => sum + value, 0) / preyKills,
      gini: gini(kills),
      zeroKillShare:
        hunters.length === 0 ? 0 : hunters.filter((row) => row.kills === 0).length / hunters.length,
    },
    ageAtDeath: {
      bucketSeconds: AGE_BUCKET_SECONDS,
      prey: toBuckets(byType.prey.filter((row) => !row.alive).map((row) => row.age)),
      hunter: toBuckets(byType.hunter.filter((row) => !row.alive).map((row) => row.age)),
    },
  }
}

/** Births and deaths per equal slice of a single run's timeline. */
export const analyzeFlows = (table: IndividualTable, endedAt: number): EpochFlow[] => {
  const epochs = table.epochs
  const flows: EpochFlow[] = Array.from({ length: epochs }, (_, index) => ({
    index,
    from: (endedAt * index) / epochs,
    to: (endedAt * (index + 1)) / epochs,
    born: { prey: 0, hunter: 0 },
    starved: { prey: 0, hunter: 0 },
    eaten: { prey: 0, hunter: 0 },
    lifespan: { prey: 0, hunter: 0 },
  }))
  const lives: Record<TypeName, number[][]> = {
    prey: Array.from({ length: epochs }, () => []),
    hunter: Array.from({ length: epochs }, () => []),
  }
  for (const row of table.rows) {
    if (!row.founder) flows[epochOf(row.bornAt, endedAt, epochs)].born[row.type] += 1
    if (row.alive) continue
    const at = epochOf(row.endAt, endedAt, epochs)
    if (row.cause === 'eaten') flows[at].eaten[row.type] += 1
    else flows[at].starved[row.type] += 1
    lives[row.type][at].push(row.age)
  }
  for (const flow of flows) {
    for (const type of TYPE_NAMES) flow.lifespan[type] = mean(lives[type][flow.index])
  }
  return flows
}
