/**
 * Turns the raw analyses into a short list of things a designer should look at.
 * Every threshold is named and exported, so a flag never hides an arbitrary
 * number and the docs can quote them.
 */
import { TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
import type { DiversityReport } from './diversity.ts'
import type { PopulationDynamics, TypeDynamics } from './dynamics.ts'
import type { IntegrityReport } from './integrity.ts'
import type { Overview } from './overview.ts'
import { LOW_N, type SelectionReport } from './selection.ts'
import { TYPE_NAMES, type TypeName } from './types.ts'

export const THRESHOLDS = {
  /** Population swing (max/min of settled series) that marks violent boom/bust. */
  swingRatioWarn: 5,
  /** Second-half vs first-half settled mean: a decline worse than this is a slide. */
  declineWarn: -0.4,
  /** A type's end-of-run mean level beyond this distance from TRAIT_BASE is "converged". */
  convergedMean: 1.5,
  /** Share of the final cohort at one extreme level that marks fixation. */
  fixationShare: 0.5,
  /** Standardized selection effect below this (all outcomes) is "no signal". */
  neutralEffect: 0.1,
  /** Share of hunters that never made a kill. */
  zeroKillWarn: 0.35,
  /** Top-decile hunters taking more than this share of kills is an elite-killer game. */
  killConcentrationWarn: 0.45,
  /** Predation barely registers below this share of prey deaths. */
  weakPredation: 0.1,
  /** Predation dominates above this share of prey deaths. */
  strongPredation: 0.6,
  /** Live population this close to the world cap means births are being dropped. */
  capShare: 0.98,
  /** Minimum hunters before per-hunter flags (kill share) mean anything. */
  minHuntersForShares: 10,
  /** Minimum kills before kill-concentration flags mean anything. */
  minKillsForConcentration: 20,
  /** Smallest final cohort in which trait convergence is judged. */
  minCohortForTraits: 10,
} as const

export type FlagLevel = 'crash' | 'warn' | 'info'

export type Flag = { level: FlagLevel; code: string; message: string }

export type RunStatus = 'CRASH' | 'NEAR-CRASH' | 'WARN' | 'OK'

export type Health = {
  status: RunStatus
  flags: Flag[]
}

export type HealthInput = {
  dynamics: PopulationDynamics
  overview: Overview
  selection: Record<TypeName, SelectionReport>
  diversity: Record<TypeName, DiversityReport>
  integrity: IntegrityReport
  maxGlorps: number
  traitKeys: readonly string[]
  traitBase: number
}

const secs = (seconds: number): string => `${seconds.toFixed(0)}s`
const pct = (value: number): string => `${(value * 100).toFixed(0)}%`
const flag = (level: FlagLevel, code: string, message: string): Flag => ({
  level,
  code,
  message,
})

const integrityFlags = ({ integrity }: HealthInput): Flag[] =>
  integrity.failures.map((failure) => flag('crash', 'integrity', `integrity: ${failure}`))

const populationFlags = (type: TypeName, d: TypeDynamics): Flag[] => {
  if (d.extinctAt !== null) {
    return [flag('crash', `${type}-extinct`, `${type}s went extinct at ${secs(d.extinctAt)}`)]
  }
  const flags: Flag[] = []
  if (d.belowFloor.firstAt !== null) {
    flags.push(
      flag(
        'warn',
        `${type}-near-crash`,
        `${type} population fell to ${d.settled.min} (floor ${d.floor}) at ${secs(d.settled.minAt)}` +
          `, first at/below floor ${secs(d.belowFloor.firstAt)}, ${secs(d.belowFloor.seconds)} total`,
      ),
    )
  } else if (d.belowFloor.inWarmup) {
    flags.push(flag('info', `${type}-early-dip`, `${type} dipped to the floor (${d.floor}) during warmup only`))
  }

  const { swingRatio, swingGrowth, peaks } = d.cycles
  if (swingRatio !== null && swingRatio >= THRESHOLDS.swingRatioWarn) {
    const growth = swingGrowth === null ? '' : `, swing growth x${swingGrowth.toFixed(2)} later vs earlier`
    flags.push(
      flag('info', `${type}-deep-cycles`, `${type} boom/bust is deep: ${peaks} peaks, peak/trough ${swingRatio.toFixed(1)}x${growth}`),
    )
  }
  if (d.trend.change !== null && d.trend.change <= THRESHOLDS.declineWarn) {
    flags.push(
      flag(
        'warn',
        `${type}-declining`,
        `${type} mean fell ${pct(-d.trend.change)} between the first and second half (${d.trend.firstHalf.toFixed(0)} -> ${d.trend.secondHalf.toFixed(0)})`,
      ),
    )
  }
  return flags
}

const capFlags = ({ dynamics, maxGlorps }: HealthInput): Flag[] =>
  dynamics.peakTotal >= maxGlorps * THRESHOLDS.capShare
    ? [flag('warn', 'pop-cap', `population reached ${dynamics.peakTotal}/${maxGlorps}: births are dropped at the cap`)]
    : []

const predationFlags = ({ overview }: HealthInput): Flag[] => {
  const flags: Flag[] = []
  const preyEaten = overview.eatenShare.prey
  if (preyEaten < THRESHOLDS.weakPredation) {
    flags.push(flag('info', 'weak-predation', `only ${pct(preyEaten)} of prey deaths are predation: hunters barely shape the prey`))
  } else if (preyEaten > THRESHOLDS.strongPredation) {
    flags.push(flag('info', 'strong-predation', `${pct(preyEaten)} of prey deaths are predation: hunters dominate prey mortality`))
  }

  const p = overview.predation
  if (p.cannibalizedNewborns > 0) {
    flags.push(
      flag(
        'warn',
        'newborn-cannibalism',
        `${p.cannibalizedNewborns} hunter newborn(s) were eaten within seconds of birth by a starving hunter (of ${p.cannibalKills} cannibal kills)`,
      ),
    )
  }
  if (p.huntersEverBorn >= THRESHOLDS.minHuntersForShares && p.zeroKillShare >= THRESHOLDS.zeroKillWarn) {
    flags.push(flag('warn', 'hunters-no-kills', `${pct(p.zeroKillShare)} of hunters never killed anything`))
  }
  if (p.preyKills >= THRESHOLDS.minKillsForConcentration && p.top10Share >= THRESHOLDS.killConcentrationWarn) {
    flags.push(flag('info', 'elite-killers', `the top 10% of hunters made ${pct(p.top10Share)} of kills (gini ${p.gini.toFixed(2)})`))
  }
  return flags
}

const neutralTraitFlags = (type: TypeName, selection: SelectionReport): Flag[] =>
  selection.traits
    .filter((trait) => trait.verdict === 'neutral')
    .map((trait) => {
      const strongest = Math.max(...Object.values(trait.effect).map((value) => Math.abs(value ?? 0)))
      return flag(
        'info',
        `${type}-${trait.trait}-neutral`,
        `${type} ${trait.trait} shows no selection signal (max |effect| ${strongest.toFixed(2)} < ${THRESHOLDS.neutralEffect}): possibly a dead stat`,
      )
    })

/** Traits that pinned to an extreme, or that the population stopped caring about. */
const traitFlags = (type: TypeName, input: HealthInput): Flag[] => {
  const diversity = input.diversity[type]
  const selection = input.selection[type]
  const last = [...diversity.rows].reverse().find((row) => row.epoch >= 0)
  if (!last || last.n < THRESHOLDS.minCohortForTraits) return []

  const flags: Flag[] = []
  for (const key of input.traitKeys) {
    const average = last.traitMean[key]
    const extreme = diversity.extremeShare[key]
    const pinned = Math.max(extreme.low, extreme.high)
    if (Math.abs(average - input.traitBase) >= THRESHOLDS.convergedMean) {
      const verdict = average > input.traitBase ? 'everyone stacks it' : 'everyone dumps it'
      flags.push(flag('warn', `${type}-${key}-converged`, `${type} ${key} converged to ${average.toFixed(2)} (base ${input.traitBase}): ${verdict}`))
    } else if (pinned >= THRESHOLDS.fixationShare) {
      const level = extreme.high > extreme.low ? TRAIT_MAX : TRAIT_MIN
      flags.push(flag('warn', `${type}-${key}-fixed`, `${type} ${key}: ${pct(pinned)} of the final cohort sits at level ${level}`))
    }
  }
  if (selection.n >= LOW_N) {
    flags.push(...neutralTraitFlags(type, selection))
  } else {
    flags.push(flag('info', `${type}-low-n`, `only ${selection.n} ${type}s in the selection analysis (< ${LOW_N}): verdicts are noisy, use more seeds`))
  }
  if (diversity.trend.verdict === 'converging') {
    flags.push(flag('info', `${type}-converging`, `${type} builds are converging: pairwise build distance ${pct(diversity.trend.distanceChange ?? 0)} vs founders`))
  }
  return flags
}

const SEVERITY: Record<FlagLevel, number> = { crash: 0, warn: 1, info: 2 }

const statusOf = (flags: Flag[], dynamics: PopulationDynamics): RunStatus => {
  if (flags.some((f) => f.level === 'crash')) return 'CRASH'
  if (TYPE_NAMES.some((type) => dynamics[type].belowFloor.firstAt !== null)) return 'NEAR-CRASH'
  return flags.some((f) => f.level === 'warn') ? 'WARN' : 'OK'
}

export const assessHealth = (input: HealthInput): Health => {
  const flags = [
    ...integrityFlags(input),
    ...TYPE_NAMES.flatMap((type) => populationFlags(type, input.dynamics[type])),
    ...capFlags(input),
    ...predationFlags(input),
    ...TYPE_NAMES.flatMap((type) => traitFlags(type, input)),
  ].sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level])
  return { status: statusOf(flags, input.dynamics), flags }
}
