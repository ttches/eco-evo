/**
 * Flatten an analysis to `name -> number` so runs can be averaged across seeds
 * and diffed against a baseline without knowing the report's shape. Keys are
 * dotted paths like `prey.pop.min`; `sweep/metrics.ts` picks which to display.
 */
import { TRAIT_KEYS } from '@/sim/traits'
import type { RunAnalysis } from '../analyze.ts'
import { round } from './stats.ts'
import { TYPE_NAMES, type TypeName } from './types.ts'

export type Headline = Record<string, number | null>

const runMetrics = (analysis: RunAnalysis, endedAt: number): Headline => {
  const { health, lineage } = analysis
  return {
    'run.endedAt': endedAt,
    'run.crashed': health.status === 'CRASH' ? 1 : 0,
    'run.nearCrash': health.status === 'NEAR-CRASH' ? 1 : 0,
    'run.flags.warn': health.flags.filter((flag) => flag.level === 'warn').length,
    'lineage.maxGeneration': lineage.maxGeneration,
    'lineage.generationTime': round(lineage.generationTimeMean, 2),
  }
}

const predationMetrics = (analysis: RunAnalysis): Headline => {
  const { predation } = analysis.overview
  return {
    'pred.preyKills': predation.preyKills,
    'pred.cannibalKills': predation.cannibalKills,
    'pred.killsPerHunterMinute': round(predation.killsPerHunterMinute, 4),
    'pred.top10Share': round(predation.top10Share, 4),
    'pred.zeroKillShare': round(predation.zeroKillShare, 4),
    'pred.timeToFirstKill': round(analysis.lineage.timeToFirstKill.mean, 2),
    'pred.dodges': analysis.combat.dodges,
    'pred.dodgesPerGlorpSecond': round(analysis.combat.dodgesPerGlorpSecond, 5),
  }
}

const populationMetrics = (analysis: RunAnalysis, type: TypeName): Headline => {
  const d = analysis.dynamics[type]
  return {
    [`${type}.extinct`]: d.extinctAt === null ? 0 : 1,
    [`${type}.extinctAt`]: round(d.extinctAt, 1),
    [`${type}.pop.start`]: d.start,
    [`${type}.pop.end`]: d.end,
    [`${type}.pop.min`]: d.settled.min,
    [`${type}.pop.max`]: d.settled.max,
    [`${type}.pop.mean`]: round(d.settled.mean, 2),
    [`${type}.pop.median`]: d.settled.median,
    [`${type}.pop.p10`]: d.settled.p10,
    [`${type}.pop.p90`]: d.settled.p90,
    [`${type}.pop.cv`]: round(d.settled.cv, 4),
    [`${type}.pop.drawdown`]: round(d.drawdown.fraction, 4),
    [`${type}.pop.trend`]: round(d.trend.change, 4),
    [`${type}.pop.belowFloorSeconds`]: d.belowFloor.seconds,
    [`${type}.cycle.peaks`]: d.cycles.peaks,
    [`${type}.cycle.period`]: round(d.cycles.meanPeriod, 2),
    [`${type}.cycle.swing`]: round(d.cycles.swingRatio, 3),
  }
}

const mortalityMetrics = (analysis: RunAnalysis, type: TypeName): Headline => {
  const { overview } = analysis
  const lifespan = overview.timeToDeath[type].all
  return {
    [`${type}.born`]: overview.born[type],
    [`${type}.deaths.eatenShare`]: round(overview.eatenShare[type], 4),
    [`${type}.lifespan.mean`]: round(lifespan.mean, 2),
    [`${type}.lifespan.median`]: round(lifespan.median, 2),
  }
}

const buildMetrics = (analysis: RunAnalysis, type: TypeName): Headline => {
  const diversity = analysis.diversity[type]
  const last = [...diversity.rows].reverse().find((row) => row.epoch >= 0)
  const h: Headline = {
    [`${type}.div.distance`]: round(last?.pairwiseDistance ?? null, 3),
    [`${type}.div.distanceChange`]: round(diversity.trend.distanceChange, 4),
    [`${type}.div.effBuilds`]: round(last?.effectiveBuilds ?? null, 2),
    [`${type}.div.topBuildShare`]: round(last?.topBuildShare ?? null, 4),
  }
  for (const key of TRAIT_KEYS) {
    h[`${type}.trait.${key}`] = round(last?.traitMean[key] ?? null, 3)
    h[`${type}.traitSd.${key}`] = round(last?.traitSd[key] ?? null, 3)
  }
  return h
}

const selectionMetrics = (analysis: RunAnalysis, type: TypeName): Headline => {
  const h: Headline = {}
  for (const trait of analysis.selection[type].traits) {
    for (const [outcome, effect] of Object.entries(trait.effect)) {
      h[`${type}.sel.${trait.trait}.${outcome}`] = round(effect ?? null, 3)
    }
  }
  return h
}

export const buildHeadline = (analysis: RunAnalysis, endedAt: number): Headline => ({
  ...runMetrics(analysis, endedAt),
  ...predationMetrics(analysis),
  ...Object.assign(
    {},
    ...TYPE_NAMES.map((type) => ({
      ...populationMetrics(analysis, type),
      ...mortalityMetrics(analysis, type),
      ...buildMetrics(analysis, type),
      ...selectionMetrics(analysis, type),
    })),
  ),
})
