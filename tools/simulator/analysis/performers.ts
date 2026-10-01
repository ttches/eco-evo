/**
 * "Best performing" cohorts and their trait breakdown. A cohort is a slice of
 * one type's eligible individuals (top decile by offspring, by lifespan, by
 * kills, or the short-lived bottom decile). For each, how do its trait levels
 * compare with everyone of that type? `z` is the gap in population standard
 * deviations: +1 means the cohort runs a full sd above average in that trait.
 */
import { buildKey, type Individual, type IndividualTable } from './individuals.ts'
import type { TypeName } from './types.ts'
import { gini, mean, sd } from './stats.ts'

export type CohortKind = 'offspring' | 'lifespan' | 'short-lived' | 'kills'

export type CohortTrait = { mean: number; sd: number; z: number }

export type Cohort = {
  kind: CohortKind
  label: string
  n: number
  /** The cut-off value of the ranking metric that got an individual in. */
  cutoff: number
  means: { lifespan: number; offspring: number; kills: number }
  traits: Record<string, CohortTrait>
  topBuilds: { build: string; n: number; share: number }[]
  deaths: { alive: number; starved: number; eaten: number }
}

export type PopulationTraits = Record<string, { mean: number; sd: number }>

export type Killer = {
  run: number
  id: number
  generation: number
  build: string
  kills: number
  cannibalKills: number
  age: number
  cause: string
  offspring: number
}

export type PerformerReport = {
  type: TypeName
  n: number
  population: PopulationTraits
  cohorts: Cohort[]
  /** Hunters only: the individuals who did the most killing. */
  topKillers: Killer[]
  /** Hunters only: how concentrated the killing was. */
  killShare: { top10Share: number; gini: number; zeroKillShare: number } | null
}

const COHORT_SIZE = 0.1
const MIN_COHORT = 5

const describeTraits = (rows: Individual[], keys: readonly string[]): PopulationTraits =>
  Object.fromEntries(
    keys.map((key, index) => {
      const levels = rows.map((row) => row.traits[index])
      return [key, { mean: mean(levels), sd: sd(levels) }]
    }),
  )

const buildCohort = (
  kind: CohortKind,
  label: string,
  rows: Individual[],
  population: PopulationTraits,
  keys: readonly string[],
  cutoff: number,
): Cohort => {
  const traits: Record<string, CohortTrait> = {}
  keys.forEach((key, index) => {
    const levels = rows.map((row) => row.traits[index])
    const average = mean(levels)
    const spread = population[key].sd
    traits[key] = {
      mean: average,
      sd: sd(levels),
      z: spread === 0 ? 0 : (average - population[key].mean) / spread,
    }
  })
  const builds = new Map<string, number>()
  for (const row of rows) {
    const key = buildKey(row.traits)
    builds.set(key, (builds.get(key) ?? 0) + 1)
  }
  return {
    kind,
    label,
    n: rows.length,
    cutoff,
    means: {
      lifespan: mean(rows.map((row) => row.age)),
      offspring: mean(rows.map((row) => row.offspring)),
      kills: mean(rows.map((row) => row.kills)),
    },
    traits,
    topBuilds: [...builds.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([build, n]) => ({ build, n, share: n / rows.length })),
    deaths: {
      alive: rows.filter((row) => row.alive).length,
      starved: rows.filter((row) => row.cause === 'starved').length,
      eaten: rows.filter((row) => row.cause === 'eaten').length,
    },
  }
}

/** Sort descending by `primary`, breaking ties by `secondary`, then id for stability. */
const ranked = (
  rows: Individual[],
  primary: (row: Individual) => number,
  secondary: (row: Individual) => number,
): Individual[] =>
  [...rows].sort(
    (a, b) =>
      primary(b) - primary(a) ||
      secondary(b) - secondary(a) ||
      a.run - b.run ||
      a.id - b.id,
  )

export const analyzePerformers = (
  table: IndividualTable,
  type: TypeName,
): PerformerReport => {
  const keys = table.traitKeys
  const rows = table.rows.filter((row) => row.type === type && row.eligible)
  const population = describeTraits(rows, keys)
  const size = Math.min(rows.length, Math.max(MIN_COHORT, Math.ceil(rows.length * COHORT_SIZE)))
  const cohorts: Cohort[] = []

  if (rows.length >= MIN_COHORT) {
    const byOffspring = ranked(rows, (r) => r.offspring, (r) => r.age).slice(0, size)
    cohorts.push(
      buildCohort('offspring', 'most offspring', byOffspring, population, keys,
        byOffspring[byOffspring.length - 1].offspring),
    )
    const byLife = ranked(rows, (r) => r.age, (r) => r.offspring).slice(0, size)
    cohorts.push(
      buildCohort('lifespan', 'longest lived', byLife, population, keys,
        byLife[byLife.length - 1].age),
    )
    // Short-lived is only meaningful among those who actually died young.
    const dead = rows.filter((row) => !row.alive)
    if (dead.length >= MIN_COHORT) {
      const shortSize = Math.min(dead.length, size)
      const byDeath = ranked(dead, (r) => -r.age, (r) => -r.offspring).slice(0, shortSize)
      cohorts.push(
        buildCohort('short-lived', 'shortest lived', byDeath, population, keys,
          byDeath[byDeath.length - 1].age),
      )
    }
    if (type === 'hunter') {
      const byKills = ranked(rows, (r) => r.kills, (r) => r.age).slice(0, size)
      cohorts.push(
        buildCohort('kills', 'most kills', byKills, population, keys,
          byKills[byKills.length - 1].kills),
      )
    }
  }

  let topKillers: Killer[] = []
  let killShare: PerformerReport['killShare'] = null
  if (type === 'hunter' && rows.length > 0) {
    topKillers = ranked(rows, (r) => r.kills, (r) => r.age)
      .slice(0, 5)
      .filter((row) => row.kills > 0)
      .map((row) => ({
        run: row.run,
        id: row.id,
        generation: row.generation,
        build: buildKey(row.traits),
        kills: row.kills,
        cannibalKills: row.cannibalKills,
        age: row.age,
        cause: row.cause,
        offspring: row.offspring,
      }))
    const kills = rows.map((row) => row.kills)
    const total = kills.reduce((sum, value) => sum + value, 0)
    const topCount = Math.max(1, Math.ceil(kills.length * COHORT_SIZE))
    const top = [...kills].sort((a, b) => b - a).slice(0, topCount)
    killShare = {
      top10Share: total === 0 ? 0 : top.reduce((sum, value) => sum + value, 0) / total,
      gini: gini(kills),
      zeroKillShare: kills.filter((value) => value === 0).length / kills.length,
    }
  }

  return { type, n: rows.length, population, cohorts, topKillers, killShare }
}
