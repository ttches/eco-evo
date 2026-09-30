/**
 * Pure formatting for simulator results: console summaries and baseline diffs.
 * No filesystem or process access, so everything here is trivially testable.
 */
import type { RunSummary } from './types.ts'

const num = (value: number, digits = 2): string =>
  Number.isFinite(value) ? value.toFixed(digits) : 'n/a'

const pad = (value: string, width: number): string => value.padEnd(width, ' ')

const padStart = (value: string, width: number): string =>
  value.padStart(width, ' ')

/** A compact, aligned summary suitable for a terminal. */
export const formatSummary = (summary: RunSummary): string => {
  const { run, analysis } = summary
  const lines: string[] = []
  const rule = '─'.repeat(56)

  lines.push(rule)
  lines.push(
    `seed ${run.seed}  ${num(run.endedAt, 1)}s / ${run.simSeconds}s  ` +
      `${run.survived ? 'survived' : `stopped: ${run.stopReason}`}`,
  )
  lines.push(
    `start ${run.startPrey} prey / ${run.startHunters} hunters  ·  ` +
      `config: ${run.configLayers.length > 0 ? run.configLayers.join(' + ') : 'game default'}` +
      (Object.keys(run.overrides).length > 0 ? ' + --set' : ''),
  )
  lines.push(rule)

  const p = analysis.population
  lines.push('POPULATION')
  lines.push(
    `  born    prey ${padStart(String(p.born.prey), 6)}   hunter ${padStart(String(p.born.hunter), 6)}   total ${p.born.total}`,
  )
  lines.push(
    `  alive   prey ${padStart(String(p.alive.prey), 6)}   hunter ${padStart(String(p.alive.hunter), 6)}   total ${p.alive.total}`,
  )
  lines.push(
    `  deaths  prey ${padStart(String(p.deaths.prey.total), 6)} ` +
      `(starved ${p.deaths.prey.starved}, eaten ${p.deaths.prey.eaten})`,
  )
  lines.push(
    `          hunter ${padStart(String(p.deaths.hunter.total), 4)} ` +
      `(starved ${p.deaths.hunter.starved}, eaten ${p.deaths.hunter.eaten})`,
  )
  lines.push('')

  const dist = (
    label: string,
    d: RunSummary['analysis']['timeToDeath']['prey']['all'],
  ): string =>
    `  ${pad(label, 7)} n=${padStart(String(d.count), 6)}  ` +
    `mean ${padStart(num(d.mean, 1), 7)}s  med ${padStart(num(d.median, 1), 7)}s  ` +
    `p10 ${padStart(num(d.p10, 1), 7)}s  p90 ${padStart(num(d.p90, 1), 7)}s`

  lines.push('TIME TO DEATH (seconds)')
  lines.push(' prey')
  lines.push(dist('all', analysis.timeToDeath.prey.all))
  lines.push(dist('eaten', analysis.timeToDeath.prey.eaten))
  lines.push(dist('starved', analysis.timeToDeath.prey.starved))
  lines.push(' hunter')
  lines.push(dist('all', analysis.timeToDeath.hunter.all))
  lines.push(dist('starved', analysis.timeToDeath.hunter.starved))
  lines.push('')

  const pr = analysis.predation
  lines.push('PREDATION')
  lines.push(
    `  kills ${pr.totalKills}  huntersWithKills ${pr.huntersWithKills}/${pr.huntersEverBorn}  ` +
      `mean/hunter ${num(pr.meanKillsPerHunter)}  max ${pr.maxKills}`,
  )
  lines.push(
    `  time to first kill  mean ${pr.meanTimeToFirstKill === null ? 'n/a' : `${num(pr.meanTimeToFirstKill, 1)}s`}  ` +
      `median ${pr.medianTimeToFirstKill === null ? 'n/a' : `${num(pr.medianTimeToFirstKill, 1)}s`}`,
  )
  lines.push('')

  const l = analysis.lineage
  lines.push('LINEAGE')
  lines.push(
    `  max generation ${l.maxGeneration}  mean generation at death ${num(l.meanGenerationDead)}  ` +
      `generation time ${l.generationTimeMean === null ? 'n/a' : `${num(l.generationTimeMean, 1)}s`}`,
  )
  lines.push(`  offspring per parent ${num(l.offspringPerParentMean)}`)
  lines.push('')

  const st = analysis.stamina
  lines.push('STAMINA')
  lines.push(
    `  sprint starts ${st.sprintStarts}  exhaustions ${st.exhaustionEvents}  ` +
      `sprint starts/glorp/s ${num(st.sprintStartsPerGlorpSecond, 3)}`,
  )
  lines.push('')

  lines.push('TRAITS (all ever born)')
  for (const [key, value] of Object.entries(analysis.traits.overall)) {
    lines.push(`  ${pad(key, 15)} ${num(value)}`)
  }
  lines.push(rule)
  return lines.join('\n')
}

/** Header for the one-line-per-seed sweep table. */
export const formatCompactHeader =
  `${'seed'.padStart(6)} ${'ended'.padStart(7)} ${'alive'.padStart(6)} ` +
  `${'born'.padStart(6)} ${'preyT'.padStart(7)} ${'huntT'.padStart(7)} ` +
  `${'kills'.padStart(7)} ${'gen'.padStart(4)}`

/** One row of the sweep table. */
export const formatCompactRow = (summary: RunSummary): string => {
  const { run, analysis } = summary
  return [
    String(run.seed).padStart(6),
    `${run.endedAt.toFixed(0)}s`.padStart(7),
    String(analysis.population.alive.total).padStart(6),
    String(analysis.population.born.total).padStart(6),
    analysis.timeToDeath.prey.all.mean.toFixed(0).padStart(7),
    analysis.timeToDeath.hunter.all.mean.toFixed(0).padStart(7),
    String(analysis.predation.totalKills).padStart(7),
    String(analysis.lineage.maxGeneration).padStart(4),
  ].join(' ')
}

const get = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)

const DIFF_METRICS: { label: string; path: string }[] = [
  { label: 'ended at (s)', path: 'run.endedAt' },
  { label: 'born total', path: 'analysis.population.born.total' },
  { label: 'alive total', path: 'analysis.population.alive.total' },
  { label: 'prey eaten', path: 'analysis.population.deaths.prey.eaten' },
  { label: 'prey starved', path: 'analysis.population.deaths.prey.starved' },
  { label: 'hunter starved', path: 'analysis.population.deaths.hunter.starved' },
  { label: 'prey lifespan mean', path: 'analysis.timeToDeath.prey.all.mean' },
  { label: 'prey lifespan median', path: 'analysis.timeToDeath.prey.all.median' },
  { label: 'prey time-to-kill mean', path: 'analysis.timeToDeath.prey.eaten.mean' },
  { label: 'hunter lifespan mean', path: 'analysis.timeToDeath.hunter.all.mean' },
  { label: 'total kills', path: 'analysis.predation.totalKills' },
  { label: 'kills per hunter', path: 'analysis.predation.meanKillsPerHunter' },
  { label: 'max generation', path: 'analysis.lineage.maxGeneration' },
  { label: 'generation time', path: 'analysis.lineage.generationTimeMean' },
  { label: 'sprint starts/glorp/s', path: 'analysis.stamina.sprintStartsPerGlorpSecond' },
  { label: 'exhaustion events', path: 'analysis.stamina.exhaustionEvents' },
  { label: 'mean speed', path: 'analysis.traits.overall.speed' },
  { label: 'mean efficiency', path: 'analysis.traits.overall.efficiency' },
]

/** Compare a baseline summary against a current one, per-metric. */
export const formatDiff = (
  baseline: RunSummary,
  current: RunSummary,
): string => {
  const lines: string[] = []
  lines.push('BASELINE DIFF  (current vs baseline)')
  lines.push(
    `${'metric'.padEnd(24)}${'baseline'.padStart(12)}${'current'.padStart(12)}${'delta'.padStart(12)}`,
  )
  for (const { label, path } of DIFF_METRICS) {
    const before = get(baseline, path)
    const after = get(current, path)
    if (typeof before !== 'number' || typeof after !== 'number') continue
    const delta = before === 0 ? (after === 0 ? 0 : Infinity) : (after - before) / before
    const deltaText = Number.isFinite(delta)
      ? `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`
      : 'n/a'
    lines.push(
      `${label.padEnd(24)}${num(before).padStart(12)}${num(after).padStart(12)}${deltaText.padStart(12)}`,
    )
  }
  return lines.join('\n')
}
