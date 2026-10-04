/**
 * Build diversity. Every glorp's build is its vector of trait levels (all sum
 * to the same budget), so "how different are two glorps" has a natural answer:
 * the number of points you would have to move to turn one build into the other.
 *
 * Rows are cohorts by *birth time* (founders, then equal slices of the run, then
 * whoever is alive at the end). Mean pairwise distance and per-trait sd do not
 * depend on cohort size, so they are the honest way to ask "did variance grow
 * or shrink?". Effective builds (exp of Shannon entropy) is descriptive only:
 * it grows with sample size.
 */
import { TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
import {
  buildKey,
  type Individual,
  type IndividualTable,
} from './individuals.ts'
import type { TypeName } from './types.ts'
import { entropy, mean, sd } from './stats.ts'

export type DiversityRow = {
  label: string
  /** -1 founders, 0..epochs-1, or -2 for "alive at end". */
  epoch: number
  n: number
  distinctBuilds: number
  effectiveBuilds: number
  topBuild: string
  topBuildShare: number
  /** Mean points to move between two random members (0 = clones). */
  pairwiseDistance: number
  traitMean: Record<string, number>
  traitSd: Record<string, number>
  /** Mean of the per-trait sds: one number for "how spread out". */
  meanTraitSd: number
}

export type DiversityVerdict = 'diverging' | 'converging' | 'stable' | 'unknown'

export type DiversityReport = {
  type: TypeName
  rows: DiversityRow[]
  trend: {
    /** Last epoch vs founders, as a fraction of the founders' value. */
    distanceChange: number | null
    meanTraitSdChange: number | null
    traitSdChange: Record<string, number | null>
    traitMeanShift: Record<string, number>
    verdict: DiversityVerdict
  }
  /** Share of the final cohort at each level 0..7, per trait. */
  levelShares: Record<string, number[]>
  /** Share of the final cohort sitting at the floor or cap of each trait. */
  extremeShare: Record<string, { low: number; high: number }>
}

/** A swing larger than this in pairwise distance counts as a real trend. */
export const DIVERSITY_TREND_THRESHOLD = 0.15

const distance = (a: number[], b: number[]): number => {
  let total = 0
  for (let index = 0; index < a.length; index += 1)
    total += Math.abs(a[index] - b[index])
  return total / 2
}

const summarize = (
  label: string,
  epoch: number,
  rows: Individual[],
  keys: readonly string[],
): DiversityRow => {
  const groups = new Map<string, { traits: number[]; n: number }>()
  for (const row of rows) {
    const key = buildKey(row.traits)
    const group = groups.get(key)
    if (group) group.n += 1
    else groups.set(key, { traits: row.traits, n: 1 })
  }
  const builds = [...groups.entries()].sort((a, b) => b[1].n - a[1].n)
  const n = rows.length
  let pairSum = 0
  for (let i = 0; i < builds.length; i += 1) {
    for (let j = i + 1; j < builds.length; j += 1) {
      pairSum +=
        builds[i][1].n *
        builds[j][1].n *
        distance(builds[i][1].traits, builds[j][1].traits)
    }
  }
  const pairs = (n * (n - 1)) / 2
  const traitMean: Record<string, number> = {}
  const traitSd: Record<string, number> = {}
  keys.forEach((key, index) => {
    const levels = rows.map((row) => row.traits[index])
    traitMean[key] = mean(levels)
    traitSd[key] = sd(levels)
  })
  return {
    label,
    epoch,
    n,
    distinctBuilds: builds.length,
    effectiveBuilds: Math.exp(entropy(builds.map(([, group]) => group.n))),
    topBuild: builds[0]?.[0] ?? '-',
    topBuildShare: n === 0 ? 0 : (builds[0]?.[1].n ?? 0) / n,
    pairwiseDistance: pairs === 0 ? 0 : pairSum / pairs,
    traitMean,
    traitSd,
    meanTraitSd: mean(Object.values(traitSd)),
  }
}

const change = (from: number, to: number): number | null =>
  from === 0 ? null : (to - from) / from

export const analyzeDiversity = (
  table: IndividualTable,
  type: TypeName,
  epochBounds: { from: number; to: number }[],
): DiversityReport => {
  const keys = table.traitKeys
  const all = table.rows.filter((row) => row.type === type)
  const rows: DiversityRow[] = []

  const founders = all.filter((row) => row.founder)
  if (founders.length > 0) rows.push(summarize('founders', -1, founders, keys))
  for (let epoch = 0; epoch < table.epochs; epoch += 1) {
    const cohort = all.filter((row) => !row.founder && row.epoch === epoch)
    if (cohort.length === 0) continue
    const bound = epochBounds[epoch]
    const label = bound
      ? `born ${bound.from.toFixed(0)}-${bound.to.toFixed(0)}s`
      : `epoch ${epoch}`
    rows.push(summarize(label, epoch, cohort, keys))
  }
  const alive = all.filter((row) => row.alive)
  if (alive.length > 0) rows.push(summarize('alive at end', -2, alive, keys))

  const first =
    rows.find((row) => row.epoch === -1) ?? rows.find((row) => row.epoch >= 0)
  const lastEpochRow = [...rows].reverse().find((row) => row.epoch >= 0)
  const traitSdChange: Record<string, number | null> = {}
  const traitMeanShift: Record<string, number> = {}
  for (const key of keys) {
    traitSdChange[key] =
      first && lastEpochRow
        ? change(first.traitSd[key], lastEpochRow.traitSd[key])
        : null
    traitMeanShift[key] =
      first && lastEpochRow
        ? lastEpochRow.traitMean[key] - first.traitMean[key]
        : 0
  }
  const distanceChange =
    first && lastEpochRow && first !== lastEpochRow
      ? change(first.pairwiseDistance, lastEpochRow.pairwiseDistance)
      : null
  let verdict: DiversityVerdict = 'unknown'
  if (distanceChange !== null) {
    verdict =
      distanceChange > DIVERSITY_TREND_THRESHOLD
        ? 'diverging'
        : distanceChange < -DIVERSITY_TREND_THRESHOLD
          ? 'converging'
          : 'stable'
  }

  const finalCohort =
    alive.length > 0
      ? alive
      : all.filter((row) => row.epoch === table.epochs - 1)
  const levelShares: Record<string, number[]> = {}
  const extremeShare: Record<string, { low: number; high: number }> = {}
  keys.forEach((key, index) => {
    const shares = new Array<number>(TRAIT_MAX + 1).fill(0)
    for (const row of finalCohort) shares[row.traits[index]] += 1
    const total = finalCohort.length || 1
    levelShares[key] = shares.slice(TRAIT_MIN).map((count) => count / total)
    extremeShare[key] = {
      low: shares[TRAIT_MIN] / total,
      high: shares[TRAIT_MAX] / total,
    }
  })

  return {
    type,
    rows,
    trend: {
      distanceChange,
      meanTraitSdChange:
        first && lastEpochRow
          ? change(first.meanTraitSd, lastEpochRow.meanTraitSd)
          : null,
      traitSdChange,
      traitMeanShift,
      verdict,
    },
    levelShares,
    extremeShare,
  }
}
