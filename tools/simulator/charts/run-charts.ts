/** The per-run HTML report: populations, energy, grass and trait drift. */
import { TRAIT_KEYS } from '@/sim/traits'
import { countOf, type SampleRow } from '../analysis/sampling.ts'
import { TYPE_NAMES } from '../analysis/types.ts'
import { capitalize, flagIcon } from '../report/format.ts'
import type { RunSummary } from '../types.ts'
import { escapeHtml, htmlPage, SLOT, type ChartSpec } from './page.ts'

type Point = [number, number]

const series = (
  samples: SampleRow[],
  pick: (row: SampleRow) => number,
): Point[] => samples.map((row) => [row.time, pick(row)])

const traitChart = (
  type: (typeof TYPE_NAMES)[number],
  samples: SampleRow[],
  warmup: number,
): ChartSpec => {
  const alive = samples.filter((row) => countOf(row, type) > 0)
  return {
    title: `${capitalize(type)} mean trait levels (living)`,
    subtitle: 'How the average build drifts over time',
    warmup,
    series: TRAIT_KEYS.map((key, index) => ({
      name: key,
      color: SLOT[index % SLOT.length],
      points: series(alive, (row) => row.traits[type][key]),
    })),
  }
}

const runCharts = (summary: RunSummary, samples: SampleRow[]): ChartSpec[] => {
  const { options } = summary.analysis
  const warmup = options.effectiveWarmup
  return [
    {
      title: 'Prey population',
      series: [
        {
          name: 'prey',
          color: SLOT[0],
          points: series(samples, (row) => row.alivePrey),
        },
      ],
      warmup,
      floor: options.floors.prey,
      legend: false,
    },
    {
      title: 'Hunter population',
      series: [
        {
          name: 'hunters',
          color: SLOT[1],
          points: series(samples, (row) => row.aliveHunter),
        },
      ],
      warmup,
      floor: options.floors.hunter,
      legend: false,
    },
    {
      title: 'Mean energy',
      subtitle: 'Average fed level of living glorps (0 = starving, 100 = full)',
      series: [
        {
          name: 'prey',
          color: SLOT[0],
          points: series(samples, (row) => row.preyFed),
        },
        {
          name: 'hunters',
          color: SLOT[1],
          points: series(samples, (row) => row.hunterFed),
        },
      ],
      warmup,
    },
    {
      title: 'Grass',
      subtitle: 'Mean grass density across the map (food supply)',
      series: [
        {
          name: 'grass',
          color: SLOT[2],
          points: series(samples, (row) => row.grassMean),
        },
      ],
      warmup,
      legend: false,
    },
    ...TYPE_NAMES.map((type) => traitChart(type, samples, warmup)),
  ]
}

const introHtml = (summary: RunSummary): string => {
  const { run, analysis } = summary
  const flags = analysis.health.flags
    .map(
      (flag) => `<li>${flagIcon(flag.level)} ${escapeHtml(flag.message)}</li>`,
    )
    .join('')
  return (
    `<p class="sub">seed ${run.seed} · ${run.endedAt.toFixed(0)}s simulated · ` +
    `config ${escapeHtml(run.configLayers.join(' + ') || 'game default')} · full numbers in report.md</p>` +
    `<h2>Verdict: ${analysis.health.status}</h2><ul class="flags">${flags || '<li>no flags</li>'}</ul>`
  )
}

export const renderRunHtml = (
  summary: RunSummary,
  samples: SampleRow[],
): string =>
  htmlPage(
    `eco-evo run: seed ${summary.run.seed}`,
    introHtml(summary),
    runCharts(summary, samples),
  )
