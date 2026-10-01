/**
 * Baseline comparison: mean-across-seeds per curated metric, with a change
 * called "real" only when it exceeds the across-seed noise.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { num, table } from '../report/format.ts'
import type { RunSummary } from '../types.ts'
import {
  aggregateHeadlines,
  type Aggregate,
  type MetricStats,
  type SweepFile,
} from './aggregate.ts'
import { formatValue, METRICS, type MetricDef } from './metrics.ts'

/** z above this is called a real change; with n=1 nothing can be called real. */
export const SIGNIFICANT_Z = 2

/** How many significant metrics to name in the one-line summary. */
const SUMMARY_LIMIT = 12

/** Load a baseline: a sweep dir / sweep.json, or a lone summary.json. */
export const readBaseline = (root: string, baselineArg: string): Aggregate => {
  let file = path.resolve(root, baselineArg)
  if (existsSync(file) && statSync(file).isDirectory()) {
    const sweep = path.join(file, 'sweep.json')
    file = existsSync(sweep) ? sweep : path.join(file, 'summary.json')
  }
  if (!existsSync(file)) {
    throw new Error(
      `Baseline not found: ${baselineArg} (point at a run/sweep directory, sweep.json or summary.json)`,
    )
  }
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<SweepFile> & Partial<RunSummary>
  if (parsed.aggregate) return parsed.aggregate
  const headline = parsed.analysis?.headline
  if (!headline) {
    throw new Error(
      `Baseline has no headline metrics: ${file}. It was probably produced by an older simulator; re-run it.`,
    )
  }
  return aggregateHeadlines([headline])
}

type Change = {
  def: MetricDef
  before: MetricStats
  after: MetricStats
  delta: number
  /** |delta| relative to the across-seed noise; null when either side has one run. */
  z: number | null
}

const measureChange = (def: MetricDef, before: MetricStats, after: MetricStats): Change => {
  const delta = after.mean - before.mean
  if (before.n < 2 || after.n < 2) return { def, before, after, delta, z: null }
  const standardError = Math.sqrt(
    (before.sd * before.sd) / before.n + (after.sd * after.sd) / after.n,
  )
  const z = standardError === 0 ? (delta === 0 ? 0 : Infinity) : Math.abs(delta) / standardError
  return { def, before, after, delta, z }
}

const isSignificant = (change: Change): boolean =>
  change.z !== null && change.z >= SIGNIFICANT_Z

const significanceMark = (change: Change): string => {
  if (!isSignificant(change)) return ''
  return change.delta > 0 ? 'sig ↑' : 'sig ↓'
}

const changeRow = (change: Change): string[] => {
  const { def } = change
  const relative =
    change.before.mean === 0 ? null : change.delta / Math.abs(change.before.mean)
  const delta = def.percent
    ? `${(change.delta * 100).toFixed(0)}pt`
    : `${change.delta >= 0 ? '+' : ''}${formatValue(def, change.delta)}`
  return [
    def.label,
    formatValue(def, change.before.mean),
    formatValue(def, change.after.mean),
    delta,
    relative === null ? 'n/a' : `${relative >= 0 ? '+' : ''}${(relative * 100).toFixed(0)}%`,
    significanceMark(change),
  ]
}

const groupByMetricGroup = (changes: Change[]): Map<string, Change[]> => {
  const groups = new Map<string, Change[]>()
  for (const change of changes) {
    const list = groups.get(change.def.group) ?? []
    list.push(change)
    groups.set(change.def.group, list)
  }
  return groups
}

const explanation = (hasNoise: boolean): string =>
  hasNoise
    ? `Mean across seeds. "sig" marks changes larger than ${SIGNIFICANT_Z}x the across-seed standard error (Welch-style; ` +
      'seeds diverge chaotically, so runs are treated as independent samples). Unmarked changes are within seed-to-seed noise. ' +
      `With ~${METRICS.length} correlated metrics a stray "sig" or two is expected by chance: trust patterns (several related metrics moving together) over isolated marks.`
    : 'Single runs on at least one side: no noise estimate, so every delta is descriptive, not proof. Use --seeds/--runs on both sides for real A/B.'

const summaryLine = (changes: Change[]): string => {
  const significant = changes.filter(isSignificant)
  if (significant.length === 0) {
    return `0 of ${changes.length} metrics changed beyond noise: none. The change is not distinguishable from seed variance at this sample size.`
  }
  const named = significant
    .slice(0, SUMMARY_LIMIT)
    .map((change) => `${change.def.key} (${change.delta > 0 ? '+' : ''}${num(change.delta)})`)
    .join(', ')
  const more = significant.length > SUMMARY_LIMIT ? ', ...' : ''
  return `${significant.length} of ${changes.length} metrics changed beyond noise: ${named}${more}`
}

export const formatComparison = (before: Aggregate, after: Aggregate): string => {
  const changes: Change[] = []
  for (const def of METRICS) {
    const a = before[def.key]
    const b = after[def.key]
    if (a && b) changes.push(measureChange(def, a, b))
  }
  const hasNoise = changes.some((change) => change.z !== null)

  const sections = [...groupByMetricGroup(changes)].flatMap(([group, list]) => {
    const rows = list
      .filter((change) => change.delta !== 0 || change.before.mean !== 0)
      .map(changeRow)
    if (rows.length === 0) return []
    return [
      [`#### ${group}`, '', table(['metric', 'baseline', 'current', 'delta', 'rel', hasNoise ? 'sig' : ''], rows)].join('\n'),
    ]
  })

  return [
    '# Baseline comparison (current vs baseline)',
    '',
    explanation(hasNoise),
    '',
    hasNoise ? summaryLine(changes) : '',
    '',
    sections.join('\n\n'),
  ].join('\n')
}
