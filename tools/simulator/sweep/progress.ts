/**
 * Console formatting for multi-run sweeps. Single-run output is `report.md`;
 * pooled and comparison output live in `sweep.ts`. Pure: no filesystem access.
 */
import type { RunSummary } from '../types.ts'

export const formatCompactHeader =
  `${'seed'.padStart(6)} ${'status'.padEnd(10)} ${'ended'.padStart(6)} ` +
  `${'prey min/mean/max'.padStart(18)} ${'hunt min/mean/max'.padStart(18)} ` +
  `${'kills'.padStart(6)} ${'preyLife'.padStart(8)} ${'gen'.padStart(4)}`

/** One row of the sweep table. */
export const formatCompactRow = (summary: RunSummary): string => {
  const { run, analysis } = summary
  const h = analysis.headline
  const triple = (type: string): string =>
    `${h[`${type}.pop.min`]}/${Math.round(h[`${type}.pop.mean`] ?? 0)}/${h[`${type}.pop.max`]}`
  const extinct = (['prey', 'hunter'] as const).find((type) => h[`${type}.extinct`])
  return [
    String(run.seed).padStart(6),
    (extinct ? `${analysis.health.status}:${extinct[0]}` : analysis.health.status).padEnd(10),
    `${run.endedAt.toFixed(0)}s`.padStart(6),
    triple('prey').padStart(18),
    triple('hunter').padStart(18),
    String(analysis.overview.predation.preyKills).padStart(6),
    `${(h['prey.lifespan.mean'] ?? 0).toFixed(0)}s`.padStart(8),
    String(analysis.lineage.maxGeneration).padStart(4),
  ].join(' ')
}
