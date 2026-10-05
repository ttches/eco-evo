/**
 * Mutation analysis: how common each mutation is and whether carrying it pays
 * off. Mirrors `selection.ts` but for mutations instead of traits.
 *
 * Mutations are not budget-constrained like traits, so a simple carrier vs
 * non-carrier comparison is fair. `effect` standardizes the mean gap by the
 * population outcome sd, matching the trait selection gradient. Every defined
 * mutation gets a row even when absent, so headline keys are stable across
 * configs and can be diffed against a baseline.
 */
import {
  MUTATIONS,
  MUTATION_KEYS,
  countMutations,
  hasMutation,
  type MutationKey,
} from '@/sim/mutations'
import type { Individual, IndividualTable } from './individuals.ts'
import { outcomeMetric, outcomesFor, type Outcome } from './selection.ts'
import { mean, sd } from './stats.ts'
import type { TypeName } from './types.ts'

export type MutationEffect = {
  carrier: number
  nonCarrier: number
  /** (carrier - nonCarrier) / population outcome sd; null when a group is small. */
  effect: number | null
}

export type MutationCarrier = {
  key: MutationKey
  name: string
  /** Eligible individuals of the type carrying this mutation. */
  count: number
  /** Share of eligible individuals of the type carrying it (0..1). */
  share: number
  outcomes: Partial<Record<Outcome, MutationEffect>>
}

export type MutationEpoch = {
  epoch: number
  label: string
  n: number
  /** Share of this birth cohort carrying at least one mutation. */
  mutatedShare: number
  counts: Record<MutationKey, number>
}

export type MutationReport = {
  type: TypeName
  /** Eligible individuals analysed. */
  n: number
  mutated: number
  mutatedShare: number
  /** Mean number of mutations carried per eligible individual. */
  meanCount: number
  keys: MutationCarrier[]
  /** Prevalence by birth cohort (founders, then equal slices of the run). */
  byEpoch: MutationEpoch[]
}

/** Below this many carriers or non-carriers an effect is too noisy to report. */
export const MIN_GROUP = 5

const effectOf = (
  outcome: Outcome,
  carrierRows: Individual[],
  nonCarrierRows: Individual[],
  outcomeSd: number,
): MutationEffect => {
  const carrier = mean(carrierRows.map((row) => outcomeMetric(row, outcome)))
  const nonCarrier = mean(
    nonCarrierRows.map((row) => outcomeMetric(row, outcome)),
  )
  const effect =
    outcomeSd === 0 ||
    carrierRows.length < MIN_GROUP ||
    nonCarrierRows.length < MIN_GROUP
      ? null
      : (carrier - nonCarrier) / outcomeSd
  return { carrier, nonCarrier, effect }
}

const byEpoch = (
  table: IndividualTable,
  rows: Individual[],
): MutationEpoch[] => {
  const buckets = new Map<number, Individual[]>()
  for (const row of rows) {
    const bucket = buckets.get(row.epoch)
    if (bucket) bucket.push(row)
    else buckets.set(row.epoch, [row])
  }
  const epochs = [-1, ...Array.from({ length: table.epochs }, (_, i) => i)]
  return epochs.flatMap((epoch) => {
    const cohort = buckets.get(epoch)
    if (!cohort || cohort.length === 0) return []
    const counts = Object.fromEntries(
      MUTATION_KEYS.map((key) => [key, 0]),
    ) as Record<MutationKey, number>
    let mutated = 0
    for (const row of cohort) {
      if (row.mutations !== 0) mutated += 1
      for (const key of MUTATION_KEYS) {
        if (hasMutation(row.mutations, MUTATIONS[key].bit)) counts[key] += 1
      }
    }
    return [
      {
        epoch,
        label: epoch < 0 ? 'founders' : `epoch ${epoch}`,
        n: cohort.length,
        mutatedShare: mutated / cohort.length,
        counts,
      },
    ]
  })
}

export const analyzeMutations = (
  table: IndividualTable,
  type: TypeName,
): MutationReport => {
  const rows = table.rows.filter((row) => row.type === type && row.eligible)
  const mutatedRows = rows.filter((row) => row.mutations !== 0)
  const outcomes = outcomesFor(type)
  const outcomeSd = Object.fromEntries(
    outcomes.map((outcome) => [
      outcome,
      sd(rows.map((row) => outcomeMetric(row, outcome))),
    ]),
  ) as Record<Outcome, number>

  const keys: MutationCarrier[] = MUTATION_KEYS.map((key) => {
    const bit = MUTATIONS[key].bit
    const carriers = rows.filter((row) => hasMutation(row.mutations, bit))
    const nonCarriers = rows.filter((row) => !hasMutation(row.mutations, bit))
    const effects: MutationCarrier['outcomes'] = {}
    for (const outcome of outcomes) {
      effects[outcome] = effectOf(
        outcome,
        carriers,
        nonCarriers,
        outcomeSd[outcome],
      )
    }
    return {
      key,
      name: MUTATIONS[key].name,
      count: carriers.length,
      share: rows.length === 0 ? 0 : carriers.length / rows.length,
      outcomes: effects,
    }
  })

  const meanCount =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + countMutations(row.mutations), 0) /
        rows.length

  return {
    type,
    n: rows.length,
    mutated: mutatedRows.length,
    mutatedShare: rows.length === 0 ? 0 : mutatedRows.length / rows.length,
    meanCount,
    keys,
    byEpoch: byEpoch(table, rows),
  }
}
