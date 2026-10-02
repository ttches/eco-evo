/**
 * Analysis entry point. Reads a finished `World` plus its sampled time series
 * and produces one `RunAnalysis`: population dynamics, deaths, predation,
 * selection, performers, build diversity, health flags and a flat `headline`
 * metric dictionary used for multi-seed aggregation and A/B comparison.
 *
 * Nothing here renders or mutates the world. The computation lives in
 * `analysis/`; this file only wires the pieces together.
 */
import { MAX_GLORPS } from '@/sim/config'
import { TRAIT_BASE, TRAIT_KEYS } from '@/sim/traits'
import type { World } from '@/sim/world'
import { analyzeDiversity, type DiversityReport } from './analysis/diversity.ts'
import { analyzeDynamics, type PopulationDynamics } from './analysis/dynamics.ts'
import { assessHealth, type Health } from './analysis/health.ts'
import { buildHeadline, type Headline } from './analysis/headline.ts'
import { buildTable, type IndividualTable } from './analysis/individuals.ts'
import { checkIntegrity, type IntegrityReport } from './analysis/integrity.ts'
import { extinctionTimes, lineageStats, type LineageStats } from './analysis/lineage-stats.ts'
import {
  analyzeFlows,
  analyzeOverview,
  type EpochFlow,
  type Overview,
} from './analysis/overview.ts'
import { analyzePerformers, type PerformerReport } from './analysis/performers.ts'
import { sampleWorld, type SampleRow } from './analysis/sampling.ts'
import {
  analyzeSelection,
  topBuilds,
  type BuildRow,
  type SelectionReport,
} from './analysis/selection.ts'
import { perType, type TypeName } from './analysis/types.ts'

/** Analysis knobs. Everything has a default; the CLI exposes the useful ones. */
export type AnalysisOptions = {
  seed: number
  /** Start-up seconds excluded from "settled" statistics (clamped to 25% of the run). */
  warmupSeconds: number
  /** Equal time slices used for epoch tables and cohort-by-birth-time rows. */
  epochs: number
  /** Births in the final seconds are excluded from selection (too young to judge). */
  settleSeconds: number
  /** Population at or below this (post-warmup) counts as a near-crash. */
  floors: Record<TypeName, number>
}

const DEFAULT_ANALYSIS: Omit<AnalysisOptions, 'seed' | 'floors'> = {
  warmupSeconds: 120,
  epochs: 5,
  settleSeconds: 60,
}

/** The warmup can never swallow more than this share of a (possibly short) run. */
const MAX_WARMUP_SHARE = 0.25

/** Floors default to a share of the starting population. */
const FLOOR_SHARE = { prey: 0.15, hunter: 0.4 } as const

export const defaultFloors = (
  startPrey: number,
  startHunters: number,
): Record<TypeName, number> => ({
  prey: Math.max(1, Math.ceil(startPrey * FLOOR_SHARE.prey)),
  hunter: Math.max(1, Math.ceil(startHunters * FLOOR_SHARE.hunter)),
})

export type BuildTables = { frequent: BuildRow[]; best: BuildRow[] }

/** The analyses that depend only on the individual table, so they can be pooled across seeds. */
export type IndividualAnalysis = {
  overview: Overview
  selection: Record<TypeName, SelectionReport>
  performers: Record<TypeName, PerformerReport>
  diversity: Record<TypeName, DiversityReport>
  builds: Record<TypeName, BuildTables>
}

export type RunAnalysis = IndividualAnalysis & {
  options: AnalysisOptions & { effectiveWarmup: number }
  health: Health
  integrity: IntegrityReport
  dynamics: PopulationDynamics
  flows: EpochFlow[]
  lineage: LineageStats
  stamina: {
    sprintStarts: number
    exhaustionEvents: number
    sprintStartsPerGlorpSecond: number
  }
  combat: {
    /** Successful prey dodges over the whole run. */
    dodges: number
    dodgesPerGlorpSecond: number
  }
  /** Flat numeric metrics, for aggregation across seeds and baseline diffs. */
  headline: Headline
}

type TimeBounds = { from: number; to: number }[]

const epochBoundsOf = (endedAt: number, epochs: number): TimeBounds =>
  Array.from({ length: epochs }, (_, index) => ({
    from: (endedAt * index) / epochs,
    to: (endedAt * (index + 1)) / epochs,
  }))

export const analyzeIndividuals = (
  table: IndividualTable,
  bounds: TimeBounds = [],
): IndividualAnalysis => ({
  overview: analyzeOverview(table),
  selection: perType((type) => analyzeSelection(table, type)),
  performers: perType((type) => analyzePerformers(table, type)),
  diversity: perType((type) => analyzeDiversity(table, type, bounds)),
  builds: perType((type) => ({
    frequent: topBuilds(table, type, 6),
    best: topBuilds(table, type, 6, 5, 'offspring'),
  })),
})

const resolveOptions = (
  samples: SampleRow[],
  partial: Partial<AnalysisOptions>,
): AnalysisOptions => ({
  ...DEFAULT_ANALYSIS,
  seed: 0,
  floors: defaultFloors(samples[0]?.alivePrey ?? 0, samples[0]?.aliveHunter ?? 0),
  ...partial,
})

const staminaStats = (world: World, table: IndividualTable): RunAnalysis['stamina'] => {
  const glorpSeconds = table.rows.reduce((sum, row) => sum + row.age, 0)
  return {
    sprintStarts: world.sprintStarts,
    exhaustionEvents: world.exhaustionEvents,
    sprintStartsPerGlorpSecond: glorpSeconds === 0 ? 0 : world.sprintStarts / glorpSeconds,
  }
}

const combatStats = (world: World, table: IndividualTable): RunAnalysis['combat'] => {
  const glorpSeconds = table.rows.reduce((sum, row) => sum + row.age, 0)
  return {
    dodges: world.dodges,
    dodgesPerGlorpSecond: glorpSeconds === 0 ? 0 : world.dodges / glorpSeconds,
  }
}

/** Analyze a finished (or early-stopped) world and its sampled time series. */
export const analyzeWorld = (
  world: World,
  samples: SampleRow[] = [sampleWorld(world)],
  partial: Partial<AnalysisOptions> = {},
): RunAnalysis => {
  const options = resolveOptions(samples, partial)
  const endedAt = world.time
  const effectiveWarmup = Math.min(options.warmupSeconds, endedAt * MAX_WARMUP_SHARE)

  const table = buildTable(world, options)
  const individuals = analyzeIndividuals(table, epochBoundsOf(endedAt, options.epochs))
  const dynamics = analyzeDynamics(samples, {
    warmupSeconds: effectiveWarmup,
    floors: options.floors,
    extinctAt: extinctionTimes(world),
    windows: options.epochs,
  })
  const integrity = checkIntegrity(world)
  const health = assessHealth({
    ...individuals,
    dynamics,
    integrity,
    maxGlorps: MAX_GLORPS,
    traitKeys: TRAIT_KEYS,
    traitBase: TRAIT_BASE,
  })

  const analysis: RunAnalysis = {
    ...individuals,
    options: { ...options, effectiveWarmup },
    health,
    integrity,
    dynamics,
    flows: analyzeFlows(table, endedAt),
    lineage: lineageStats(world, table),
    stamina: staminaStats(world, table),
    combat: combatStats(world, table),
    headline: {},
  }
  analysis.headline = buildHeadline(analysis, endedAt)
  return analysis
}
