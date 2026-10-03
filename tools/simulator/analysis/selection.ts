/**
 * Selection analysis: which traits actually pay off? For each type it relates
 * every trait to lifespan, reproductive success and (hunters) kills.
 *
 * Traits share a fixed point budget, so they are negatively correlated by
 * construction and a plain per-trait correlation is misleading (a point in
 * speed is a point *not* in endurance). `slope` is therefore a budget-aware
 * gradient: the effect of moving one point into this trait, taken from the
 * average of the others. `effect` standardizes it (slope * trait sd / outcome
 * sd) so different traits and outcomes are comparable.
 */
import { TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
import { buildKey, type Individual, type IndividualTable } from './individuals.ts'
import type { TypeName } from './types.ts'
import { mean, ridgeSlopes, sd, spearman } from './stats.ts'

export type Outcome = 'lifespan' | 'offspring' | 'kills'

export type LevelRow = {
  level: number
  n: number
  lifespan: number
  offspring: number
  kills: number
  /** Share of dead glorps at this level that were eaten (vs starved). */
  eatenShare: number | null
}

export type TraitVerdict =
  | 'strong advantage'
  | 'advantage'
  | 'neutral'
  | 'disadvantage'
  | 'strong disadvantage'
  | 'trade-off'

export type TraitSelection = {
  trait: string
  /** Standard deviation of this trait's level in the analysed population. */
  levelSd: number
  spearman: Partial<Record<Outcome, number | null>>
  /** Outcome change per point moved in from the average of the others. */
  slope: Partial<Record<Outcome, number | null>>
  /** Standardized slope: outcome sd change per one sd of trait level. */
  effect: Partial<Record<Outcome, number | null>>
  byLevel: LevelRow[]
  verdict: TraitVerdict
}

export type SelectionReport = {
  type: TypeName
  /** Individuals in the analysis (eligible only). */
  n: number
  /** Of those, how many were still alive at the end (lifespan is a lower bound). */
  censored: number
  /** Mean outcome levels, for scale. */
  means: Record<Outcome, number>
  outcomes: Outcome[]
  traits: TraitSelection[]
}

/** Below this many individuals the per-trait verdicts are flagged as noisy. */
export const LOW_N = 40

const metric = (row: Individual, outcome: Outcome): number =>
  outcome === 'lifespan' ? row.age : outcome === 'offspring' ? row.offspring : row.kills

const verdictOf = (effect: Partial<Record<Outcome, number | null>>): TraitVerdict => {
  const values = Object.values(effect).filter(
    (value): value is number => typeof value === 'number',
  )
  if (values.length === 0) return 'neutral'
  const best = Math.max(...values)
  const worst = Math.min(...values)
  if (best >= 0.1 && worst <= -0.1) return 'trade-off'
  const lead = Math.abs(best) >= Math.abs(worst) ? best : worst
  if (lead >= 0.25) return 'strong advantage'
  if (lead >= 0.1) return 'advantage'
  if (lead <= -0.25) return 'strong disadvantage'
  if (lead <= -0.1) return 'disadvantage'
  return 'neutral'
}

export const analyzeSelection = (
  table: IndividualTable,
  type: TypeName,
): SelectionReport => {
  const rows = table.rows.filter((row) => row.type === type && row.eligible)
  const outcomes: Outcome[] = type === 'hunter' ? ['lifespan', 'offspring', 'kills'] : ['lifespan', 'offspring']
  const series = Object.fromEntries(
    outcomes.map((outcome) => [outcome, rows.map((row) => metric(row, outcome))]),
  ) as Record<Outcome, number[]>
  const slopes = Object.fromEntries(
    outcomes.map((outcome) => [
      outcome,
      ridgeSlopes(
        rows.map((row) => row.traits),
        series[outcome],
      ),
    ]),
  ) as Record<Outcome, number[] | null>

  const traits: TraitSelection[] = table.traitKeys.map((trait, traitIndex) => {
    const levels = rows.map((row) => row.traits[traitIndex])
    const levelSd = sd(levels)
    const spearmanBy: TraitSelection['spearman'] = {}
    const slopeBy: TraitSelection['slope'] = {}
    const effectBy: TraitSelection['effect'] = {}
    for (const outcome of outcomes) {
      spearmanBy[outcome] = levels.length < 5 ? null : spearman(levels, series[outcome])
      const slope = slopes[outcome]?.[traitIndex] ?? null
      slopeBy[outcome] = slope
      const outcomeSd = sd(series[outcome])
      effectBy[outcome] =
        slope === null || outcomeSd === 0 ? null : (slope * levelSd) / outcomeSd
    }
    const byLevel: LevelRow[] = []
    for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
      const at = rows.filter((row) => row.traits[traitIndex] === level)
      const dead = at.filter((row) => !row.alive)
      byLevel.push({
        level,
        n: at.length,
        lifespan: mean(at.map((row) => row.age)),
        offspring: mean(at.map((row) => row.offspring)),
        kills: mean(at.map((row) => row.kills)),
        eatenShare:
          dead.length === 0
            ? null
            : dead.filter((row) => row.cause === 'eaten').length / dead.length,
      })
    }
    return {
      trait,
      levelSd,
      spearman: spearmanBy,
      slope: slopeBy,
      effect: effectBy,
      byLevel,
      verdict: verdictOf(effectBy),
    }
  })

  return {
    type,
    n: rows.length,
    censored: rows.filter((row) => row.alive).length,
    means: {
      lifespan: mean(series.lifespan ?? []),
      offspring: mean(series.offspring ?? []),
      kills: mean(series.kills ?? []),
    },
    outcomes,
    traits,
  }
}

/** Most frequent builds with their outcomes, to see which archetypes win. */
export type BuildRow = {
  build: string
  n: number
  share: number
  lifespan: number
  offspring: number
  kills: number
}

export const topBuilds = (
  table: IndividualTable,
  type: TypeName,
  limit = 8,
  minN = 1,
  sortBy: 'n' | 'offspring' | 'lifespan' = 'n',
): BuildRow[] => {
  const rows = table.rows.filter((row) => row.type === type && row.eligible)
  const groups = new Map<string, Individual[]>()
  for (const row of rows) {
    const key = buildKey(row.traits)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= minN)
    .map(([build, group]) => ({
      build,
      n: group.length,
      share: rows.length === 0 ? 0 : group.length / rows.length,
      lifespan: mean(group.map((row) => row.age)),
      offspring: mean(group.map((row) => row.offspring)),
      kills: mean(group.map((row) => row.kills)),
    }))
    .sort((a, b) => b[sortBy] - a[sortBy] || b.n - a.n)
    .slice(0, limit)
}
