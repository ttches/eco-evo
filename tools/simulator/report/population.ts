/** Population and epoch sections of a run report. */
import type {
  PopulationDynamics,
  PopulationStatus,
  WindowRow,
} from '../analysis/dynamics.ts'
import type { SampleRow } from '../analysis/sampling.ts'
import type { EpochFlow } from '../analysis/overview.ts'
import { sparkline } from '../analysis/stats.ts'
import { TYPE_NAMES } from '../analysis/types.ts'
import { num, pct, secs, signedPct, table } from './format.ts'

const STATUS_NOTE: Record<PopulationStatus, string> = {
  extinct: 'EXTINCT',
  'near-crash': 'near-crash',
  'early-dip': 'early dip only',
  ok: 'ok',
}

const SPARK_WIDTH = 60

const settledTable = (dynamics: PopulationDynamics): string =>
  table(
    [
      'type',
      'start',
      'end',
      'min',
      'p10',
      'median',
      'mean',
      'p90',
      'max',
      'cv',
      'status',
    ],
    TYPE_NAMES.map((type) => {
      const d = dynamics[type]
      const s = d.settled
      return [
        type,
        String(d.start),
        String(d.end),
        `${s.min} @${secs(s.minAt)}`,
        num(s.p10, 0),
        num(s.median, 0),
        num(s.mean, 0),
        num(s.p90, 0),
        `${s.max} @${secs(s.maxAt)}`,
        num(s.cv, 2),
        STATUS_NOTE[d.status] +
          (d.extinctAt !== null ? ` @${secs(d.extinctAt)}` : ''),
      ]
    }),
  )

const shapeTable = (dynamics: PopulationDynamics): string =>
  table(
    [
      'type',
      'worst drawdown',
      'trend',
      'cycles',
      'period',
      'swing',
      'growth',
      'time at/below floor',
    ],
    TYPE_NAMES.map((type) => {
      const d = dynamics[type]
      const { drawdown, cycles } = d
      return [
        type,
        `${pct(drawdown.fraction)} (${drawdown.peak}@${secs(drawdown.peakAt)} -> ${drawdown.trough}@${secs(drawdown.troughAt)})`,
        signedPct(d.trend.change),
        String(cycles.peaks),
        cycles.meanPeriod === null ? 'n/a' : secs(cycles.meanPeriod),
        cycles.swingRatio === null ? 'n/a' : `${cycles.swingRatio.toFixed(1)}x`,
        cycles.swingGrowth === null
          ? 'n/a'
          : `x${cycles.swingGrowth.toFixed(2)}`,
        `${secs(d.belowFloor.seconds)} (floor ${d.floor})`,
      ]
    }),
  )

const sparklines = (
  dynamics: PopulationDynamics,
  samples: SampleRow[],
): string => {
  const prey = samples.map((row) => row.alivePrey)
  const hunter = samples.map((row) => row.aliveHunter)
  const end = samples.length > 0 ? samples[samples.length - 1].time : 1
  const marker = Math.round((dynamics.warmup / Math.max(1, end)) * SPARK_WIDTH)
  return [
    '```',
    `prey   ${sparkline(prey, SPARK_WIDTH)}  0-${Math.max(0, ...prey)}`,
    `hunter ${sparkline(hunter, SPARK_WIDTH)}  0-${Math.max(0, ...hunter)}`,
    `       ${' '.repeat(Math.max(0, marker))}^ warmup ends   (0s -> ${end.toFixed(0)}s)`,
    '```',
  ].join('\n')
}

export const populationSection = (
  dynamics: PopulationDynamics,
  samples: SampleRow[],
): string =>
  [
    `Settled statistics (after the ${dynamics.warmup.toFixed(0)}s warmup):`,
    '',
    settledTable(dynamics),
    '',
    'Shape (settled): drawdown = worst peak-to-trough fall; trend = 2nd half mean vs 1st half;',
    'swing = mean peak / mean trough; growth = later vs earlier swing size (>1 means cycles widening).',
    '',
    shapeTable(dynamics),
    '',
    sparklines(dynamics, samples),
  ].join('\n')

const windowLabel = (
  window: WindowRow | undefined,
  fallback: number,
): string =>
  window
    ? `${window.from.toFixed(0)}-${window.to.toFixed(0)}s`
    : String(fallback)

export const epochSection = (
  windows: WindowRow[],
  flows: EpochFlow[],
): string => {
  const populations = windows.map((w) => [
    windowLabel(w, w.index),
    `${w.prey.mean.toFixed(0)} (${w.prey.min}-${w.prey.max})`,
    `${w.hunter.mean.toFixed(0)} (${w.hunter.min}-${w.hunter.max})`,
    num(w.preyFed, 0),
    num(w.hunterFed, 0),
    num(w.grass, 2),
  ])
  const life = (seconds: number): string =>
    seconds === 0 ? '-' : secs(seconds)
  const flowRows = flows.map((f) => [
    windowLabel(windows[f.index], f.index),
    `${f.born.prey}/${f.starved.prey}/${f.eaten.prey}`,
    life(f.lifespan.prey),
    `${f.born.hunter}/${f.starved.hunter}/${f.eaten.hunter}`,
    life(f.lifespan.hunter),
  ])
  return [
    table(
      [
        'window',
        'prey mean (min-max)',
        'hunter mean (min-max)',
        'prey fed',
        'hunter fed',
        'grass',
      ],
      populations,
    ),
    '',
    'Births / starved / eaten per window (eaten = killed by a hunter; for hunters, cannibalism):',
    '',
    table(
      ['window', 'prey b/s/e', 'prey life', 'hunter b/s/e', 'hunter life'],
      flowRows,
    ),
  ].join('\n')
}
