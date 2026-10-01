/**
 * The curated metric list shown in sweep summaries and baseline comparisons.
 * Every key refers to an entry of a run's flat `analysis.headline`.
 */
import { TRAIT_KEYS } from '@/sim/traits'
import { TYPE_NAMES } from '../analysis/types.ts'

export type MetricDef = {
  group: string
  label: string
  key: string
  /** Decimal places for display. */
  digits?: number
  /** Show as a percentage (value is a 0..1 fraction). */
  percent?: boolean
}

const perType = (
  group: (type: string) => string,
  entries: { label: string; key: string; digits?: number; percent?: boolean }[],
): MetricDef[] =>
  TYPE_NAMES.flatMap((type) =>
    entries.map((entry) => ({
      group: group(type),
      label: entry.label,
      key: `${type}.${entry.key}`,
      digits: entry.digits,
      percent: entry.percent,
    })),
  )

export const METRICS: MetricDef[] = [
  { group: 'Stability', label: 'crashed runs (fraction)', key: 'run.crashed', percent: true },
  { group: 'Stability', label: 'near-crash runs (fraction)', key: 'run.nearCrash', percent: true },
  { group: 'Stability', label: 'warning flags per run', key: 'run.flags.warn', digits: 1 },
  ...perType((type) => `Population: ${type}`, [
    { label: 'extinct (fraction)', key: 'extinct', percent: true },
    { label: 'extinction time (s)', key: 'extinctAt', digits: 0 },
    { label: 'settled min', key: 'pop.min', digits: 0 },
    { label: 'settled p10', key: 'pop.p10', digits: 0 },
    { label: 'settled median', key: 'pop.median', digits: 0 },
    { label: 'settled mean', key: 'pop.mean', digits: 0 },
    { label: 'settled p90', key: 'pop.p90', digits: 0 },
    { label: 'settled max', key: 'pop.max', digits: 0 },
    { label: 'end', key: 'pop.end', digits: 0 },
    { label: 'cv', key: 'pop.cv' },
    { label: 'worst drawdown', key: 'pop.drawdown', percent: true },
    { label: 'trend (2nd vs 1st half)', key: 'pop.trend', percent: true },
    { label: 'seconds at/below floor', key: 'pop.belowFloorSeconds', digits: 0 },
    { label: 'cycle period (s)', key: 'cycle.period', digits: 0 },
    { label: 'cycle swing (peak/trough)', key: 'cycle.swing', digits: 1 },
  ]),
  ...perType((type) => `Lifespan & mortality: ${type}`, [
    { label: 'born', key: 'born', digits: 0 },
    { label: 'lifespan mean (s)', key: 'lifespan.mean', digits: 1 },
    { label: 'lifespan median (s)', key: 'lifespan.median', digits: 1 },
    { label: 'eaten share of deaths', key: 'deaths.eatenShare', percent: true },
  ]),
  { group: 'Predation', label: 'prey kills', key: 'pred.preyKills', digits: 0 },
  { group: 'Predation', label: 'cannibal kills', key: 'pred.cannibalKills', digits: 0 },
  { group: 'Predation', label: 'kills per hunter-minute', key: 'pred.killsPerHunterMinute' },
  { group: 'Predation', label: 'top-10% hunter kill share', key: 'pred.top10Share', percent: true },
  { group: 'Predation', label: 'hunters with zero kills', key: 'pred.zeroKillShare', percent: true },
  { group: 'Predation', label: 'time to first kill (s)', key: 'pred.timeToFirstKill', digits: 1 },
  { group: 'Lineage', label: 'max generation', key: 'lineage.maxGeneration', digits: 1 },
  { group: 'Lineage', label: 'generation time (s)', key: 'lineage.generationTime', digits: 1 },
  ...perType((type) => `Builds: ${type}`, [
    { label: 'pairwise build distance (final)', key: 'div.distance' },
    { label: 'distance change vs founders', key: 'div.distanceChange', percent: true },
    { label: 'effective builds (final)', key: 'div.effBuilds', digits: 1 },
    { label: 'top build share (final)', key: 'div.topBuildShare', percent: true },
    ...TRAIT_KEYS.map((key) => ({ label: `mean ${key} (final)`, key: `trait.${key}` })),
    ...TRAIT_KEYS.map((key) => ({ label: `sd ${key} (final)`, key: `traitSd.${key}` })),
  ]),
  ...TYPE_NAMES.flatMap((type) =>
    TRAIT_KEYS.flatMap((key) =>
      (type === 'hunter' ? ['offspring', 'lifespan', 'kills'] : ['offspring', 'lifespan']).map(
        (outcome) => ({
          group: `Selection effect: ${type}`,
          label: `${key} -> ${outcome}`,
          key: `${type}.sel.${key}.${outcome}`,
        }),
      ),
    ),
  ),
]

export const formatValue = (def: MetricDef, value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  if (def.percent) return `${(value * 100).toFixed(0)}%`
  return value.toFixed(def.digits ?? 2)
}
