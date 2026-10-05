/**
 * Mutation report section: how common each mutation was and whether carrying it
 * paid off. Shared by the single-run and pooled sweep reports so both tell the
 * same story.
 */
import { MIN_GROUP, type MutationReport } from '../analysis/mutations.ts'
import { num, pct, signed, table } from './format.ts'

const carrierTable = (report: MutationReport): string => {
  const rows = report.keys.flatMap((carrier) =>
    Object.entries(carrier.outcomes).map(([outcome, effect]) => {
      const enough =
        carrier.count >= MIN_GROUP && report.n - carrier.count >= MIN_GROUP
      return [
        carrier.name,
        String(carrier.count),
        pct(carrier.share),
        outcome,
        enough ? num(effect.carrier) : '-',
        enough ? num(effect.nonCarrier) : '-',
        signed(effect.effect),
      ]
    }),
  )
  return table(
    [
      'mutation',
      'carriers',
      'share',
      'outcome',
      'carrier',
      'non-carrier',
      'effect',
    ],
    rows,
  )
}

const epochTable = (report: MutationReport): string => {
  const keys = report.keys.map((carrier) => carrier.key)
  const names = report.keys.map((carrier) => carrier.name)
  return table(
    ['cohort', 'n', 'mutated', ...names],
    report.byEpoch.map((epoch) => [
      epoch.label,
      String(epoch.n),
      pct(epoch.mutatedShare),
      ...keys.map((key) => String(epoch.counts[key])),
    ]),
  )
}

export const mutationsSection = (report: MutationReport): string => {
  if (report.n === 0) return 'No eligible individuals for mutation analysis.'
  const noun = report.type === 'prey' ? 'prey' : 'hunters'
  return [
    `${pct(report.mutatedShare)} of ${report.n} eligible ${noun} carry at least one mutation (mean ${num(report.meanCount)} per glorp).`,
    '',
    'Carrier vs non-carrier outcomes. "effect" = (carrier - non-carrier) mean in outcome sd',
    '(+0.25 strong, +0.10 real, |x|<0.10 no signal). Small groups read n/a.',
    '',
    carrierTable(report),
    '',
    'Prevalence by birth cohort (carriers per cohort):',
    '',
    epochTable(report),
  ].join('\n')
}
