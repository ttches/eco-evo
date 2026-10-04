/** Aggregating run summaries into the `sweep.json` record. */
import { mean, sampleSd } from '../analysis/stats.ts'
import type { Headline } from '../analysis/headline.ts'
import type { RunSummary } from '../types.ts'

export type MetricStats = {
  n: number
  mean: number
  sd: number
  min: number
  max: number
}

export type Aggregate = Record<string, MetricStats>

export type SweepRun = {
  seed: number
  dir: string
  status: string
  endedAt: number
  headline: Headline
}

export type SweepFile = {
  generatedAt: string
  configLayers: string[]
  overrides: Record<string, unknown>
  seeds: number[]
  statusCounts: Record<string, number>
  aggregate: Aggregate
  runs: SweepRun[]
}

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Mean/sd/min/max of every headline metric across runs (nulls skipped). */
export const aggregateHeadlines = (headlines: Headline[]): Aggregate => {
  const keys = new Set(headlines.flatMap((headline) => Object.keys(headline)))
  const result: Aggregate = {}
  for (const key of keys) {
    const values = headlines.map((headline) => headline[key]).filter(isNumber)
    if (values.length === 0) continue
    result[key] = {
      n: values.length,
      mean: mean(values),
      sd: sampleSd(values),
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }
  return result
}

const countStatuses = (summaries: RunSummary[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const { analysis } of summaries) {
    counts[analysis.health.status] = (counts[analysis.health.status] ?? 0) + 1
  }
  return counts
}

export const buildSweepFile = (
  summaries: RunSummary[],
  dirOf: (summary: RunSummary) => string,
  configLayers: string[],
  overrides: Record<string, unknown>,
): SweepFile => ({
  generatedAt: new Date().toISOString(),
  configLayers,
  overrides,
  seeds: summaries.map((summary) => summary.run.seed),
  statusCounts: countStatuses(summaries),
  aggregate: aggregateHeadlines(
    summaries.map((summary) => summary.analysis.headline),
  ),
  runs: summaries.map((summary) => ({
    seed: summary.run.seed,
    dir: dirOf(summary),
    status: summary.analysis.health.status,
    endedAt: summary.run.endedAt,
    headline: summary.analysis.headline,
  })),
})
