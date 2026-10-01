/** The multi-seed report: verdict, per-seed table, flag rollup, metrics, pooled analysis. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { concatTables, parseTable, type IndividualTable } from '../analysis/individuals.ts'
import { analyzeIndividuals } from '../analyze.ts'
import { renderSweepHtml, type PopulationFile } from '../charts/sweep-charts.ts'
import { flagIcon, table } from '../report/format.ts'
import { deathsSection, predationSection } from '../report/mortality.ts'
import { individualSections } from '../report/traits.ts'
import type { RunSummary } from '../types.ts'
import type { Aggregate, MetricStats, SweepFile, SweepRun } from './aggregate.ts'
import { formatValue, METRICS, type MetricDef } from './metrics.ts'

export type PoolInput = { dir: string; summary: RunSummary }

const readJsonIfPresent = <T>(file: string, parse: (text: string) => T): T | null =>
  existsSync(file) ? parse(readFileSync(file, 'utf8')) : null

// -------------------------------------------------------------- metric tables

const statsCell = (stats: MetricStats | undefined, def: MetricDef): string => {
  if (!stats) return 'n/a'
  if (stats.n === 1) return formatValue(def, stats.mean)
  const plain = { ...def, percent: false }
  const spread = formatValue(plain, def.percent ? stats.sd * 100 : stats.sd)
  return `${formatValue(def, stats.mean)} ±${spread}  [${formatValue(def, stats.min)}..${formatValue(def, stats.max)}]`
}

/** Across-seed metrics, grouped. Rows with no data anywhere are dropped. */
const metricTables = (aggregate: Aggregate): string => {
  const groups = new Map<string, MetricDef[]>()
  for (const def of METRICS) {
    if (!aggregate[def.key]) continue
    groups.set(def.group, [...(groups.get(def.group) ?? []), def])
  }
  return [...groups]
    .map(([group, defs]) =>
      [
        `#### ${group}`,
        '',
        table(['metric', 'mean ±sd [min..max]'], defs.map((def) => [def.label, statsCell(aggregate[def.key], def)])),
      ].join('\n'),
    )
    .join('\n\n')
}

// ------------------------------------------------------------------ per seed

const seedTable = (runs: SweepRun[]): string => {
  const value = (run: SweepRun, key: string): string => {
    const v = run.headline[key]
    return v === null || v === undefined ? '-' : v.toFixed(0)
  }
  const triple = (run: SweepRun, type: string): string =>
    ['min', 'mean', 'max'].map((stat) => value(run, `${type}.pop.${stat}`)).join('/')
  const extinct = (run: SweepRun): string =>
    (['prey', 'hunter'] as const)
      .filter((type) => run.headline[`${type}.extinct`])
      .map((type) => `${type} ${value(run, `${type}.extinctAt`)}s`)
      .join(', ') || '-'
  return table(
    ['seed', 'status', 'ended', 'prey min/mean/max', 'hunter min/mean/max', 'extinct@', 'kills', 'prey life', 'gen'],
    runs.map((run) => [
      String(run.seed),
      run.status,
      `${run.endedAt.toFixed(0)}s`,
      triple(run, 'prey'),
      triple(run, 'hunter'),
      extinct(run),
      value(run, 'pred.preyKills'),
      `${value(run, 'prey.lifespan.mean')}s`,
      value(run, 'lineage.maxGeneration'),
    ]),
  )
}

// ---------------------------------------------------------------- flag rollup

type FlagEntry = { level: 'crash' | 'warn' | 'info'; message: string; seeds: number[] }

const SEVERITY = { crash: 0, warn: 1, info: 2 } as const

const flagRollup = (summaries: RunSummary[]): string => {
  const byCode = new Map<string, FlagEntry>()
  for (const { run, analysis } of summaries) {
    for (const flag of analysis.health.flags) {
      const entry = byCode.get(flag.code) ?? { level: flag.level, message: flag.message, seeds: [] }
      entry.seeds.push(run.seed)
      byCode.set(flag.code, entry)
    }
  }
  const lines = [...byCode]
    .sort(([, a], [, b]) => SEVERITY[a.level] - SEVERITY[b.level] || b.seeds.length - a.seeds.length)
    .map(
      ([code, entry]) =>
        `- ${flagIcon(entry.level)} ${code}: ${entry.seeds.length}/${summaries.length} seeds (${entry.seeds.join(',')}). e.g. ${entry.message}`,
    )
  return lines.length === 0 ? '- none' : lines.join('\n')
}

// --------------------------------------------------------------------- pooled

const pooledSection = (tables: IndividualTable[]): string => {
  if (tables.length === 0) return '(no individuals.json found: pooled selection analysis skipped)'
  const pooled = analyzeIndividuals(concatTables(tables))
  const individuals = tables.reduce((sum, t) => sum + t.rows.length, 0)
  return [
    '## Pooled over every seed',
    '',
    `${individuals} individuals pooled from ${tables.length} runs. Pooling gives the selection and performer ` +
      'analysis far more statistical power than one run (especially for hunters).',
    '',
    '### Deaths and lifespans',
    '',
    deathsSection(pooled.overview),
    '',
    '### Predation',
    '',
    predationSection(pooled.overview, pooled.performers.hunter),
    '',
    individualSections(pooled),
  ].join('\n')
}

const statusSummary = (sweep: SweepFile): string =>
  Object.entries(sweep.statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ')

const sweepMarkdown = (sweep: SweepFile, summaries: RunSummary[], tables: IndividualTable[]): string => {
  const first = summaries[0].run
  const config = sweep.configLayers.join(' + ') || 'game default'
  const overrides = Object.keys(sweep.overrides).length > 0 ? ` + ${JSON.stringify(sweep.overrides)}` : ''
  return [
    `# eco-evo sweep report: ${summaries.length} seeds`,
    '',
    `seeds ${sweep.seeds.join(',')} · ${first.simSeconds}s each · start ${first.startPrey} prey / ${first.startHunters} hunters · config: ${config}${overrides}`,
    '',
    `## Verdict: ${statusSummary(sweep)}`,
    '',
    'Flags across seeds (a flag in most seeds is a property of the design; in one seed it may be luck):',
    '',
    flagRollup(summaries),
    '',
    '## Per seed',
    '',
    seedTable(sweep.runs),
    '',
    '## Across-seed metrics',
    '',
    'Population stats are "settled" (after warmup). Per-seed values are in sweep.json.',
    '',
    metricTables(sweep.aggregate),
    '',
    pooledSection(tables),
  ].join('\n')
}

/** Pool every seed's individuals and build the multi-seed report. */
export const formatSweepReport = (
  sweep: SweepFile,
  inputs: PoolInput[],
): { markdown: string; html: string } => {
  const summaries = inputs.map((input) => input.summary)
  const tables = inputs
    .map((input) => readJsonIfPresent(path.join(input.dir, 'individuals.json'), parseTable))
    .filter((t): t is IndividualTable => t !== null)
  const populations = inputs
    .map((input) =>
      readJsonIfPresent(path.join(input.dir, 'population.json'), (text) => JSON.parse(text) as PopulationFile),
    )
    .filter((p): p is PopulationFile => p !== null)

  return {
    markdown: sweepMarkdown(sweep, summaries, tables),
    html: renderSweepHtml(
      `eco-evo sweep: ${summaries.length} seeds`,
      `<p class="sub">${statusSummary(sweep)} · full numbers in report.md</p>`,
      populations,
      summaries[0].analysis.options.effectiveWarmup,
    ),
  }
}

export const writeSweepReport = (baseOut: string, markdown: string, html: string): void => {
  writeFileSync(path.join(baseOut, 'report.md'), `${markdown}\n`)
  writeFileSync(path.join(baseOut, 'report.html'), html)
}
