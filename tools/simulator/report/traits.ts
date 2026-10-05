/**
 * Trait-centred sections: drift and selection, top-performer cohorts, and build
 * diversity. They take analysis fragments (not whole runs), so the pooled
 * multi-seed report reuses them unchanged.
 */
import { TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
import type { DiversityReport } from '../analysis/diversity.ts'
import type { Cohort, PerformerReport } from '../analysis/performers.ts'
import {
  LOW_N,
  type BuildRow,
  type LevelRow,
  type Outcome,
  type SelectionReport,
  type TraitSelection,
} from '../analysis/selection.ts'
import { TYPE_NAMES } from '../analysis/types.ts'
import type { BuildTables, IndividualAnalysis } from '../analyze.ts'
import { capitalize, num, pct, signed, signedPct, table } from './format.ts'
import { mutationsSection } from './mutations.ts'

const OUTCOME_HEADER: Record<Outcome, string> = {
  lifespan: 'life',
  offspring: 'offsp',
  kills: 'kills',
}

// ------------------------------------------------------------------ selection

const driftTable = (
  selection: SelectionReport,
  diversity: DiversityReport,
): string => {
  const first =
    diversity.rows.find((row) => row.epoch === -1) ?? diversity.rows[0]
  const last = [...diversity.rows].reverse().find((row) => row.epoch >= 0)
  const rows = selection.traits.map((trait) => {
    const key = trait.trait
    const extreme = diversity.extremeShare[key]
    return [
      key,
      first ? num(first.traitMean[key]) : 'n/a',
      last ? num(last.traitMean[key]) : 'n/a',
      first && last
        ? signed(last.traitMean[key] - first.traitMean[key])
        : 'n/a',
      first && last
        ? `${num(first.traitSd[key])}->${num(last.traitSd[key])}`
        : 'n/a',
      `${pct(extreme.low)}/${pct(extreme.high)}`,
      ...selection.outcomes.map((outcome) => signed(trait.effect[outcome])),
      trait.verdict,
    ]
  })
  return table(
    [
      'trait',
      'founders',
      'final',
      'shift',
      'sd first->last',
      '@floor/@cap',
      ...selection.outcomes.map(
        (outcome) => `effect:${OUTCOME_HEADER[outcome]}`,
      ),
      'verdict',
    ],
    rows,
  )
}

/** One metric row across levels, e.g. mean offspring at L0..L7. */
const levelCells = (
  trait: TraitSelection,
  pick: (row: LevelRow) => string,
): string[] => trait.byLevel.map(pick)

const levelRows = (
  selection: SelectionReport,
  trait: TraitSelection,
): string[][] => {
  const present = (format: (row: LevelRow) => string) => (row: LevelRow) =>
    row.n === 0 ? '-' : format(row)
  const extraMetric =
    selection.type === 'hunter'
      ? [
          '',
          'kills',
          ...levelCells(
            trait,
            present((row) => num(row.kills)),
          ),
        ]
      : [
          '',
          'eaten share',
          ...levelCells(trait, (row) =>
            row.eatenShare === null ? '-' : pct(row.eatenShare),
          ),
        ]
  return [
    [
      trait.trait,
      'offspring',
      ...levelCells(
        trait,
        present((row) => num(row.offspring)),
      ),
    ],
    [
      '',
      'lifespan s',
      ...levelCells(
        trait,
        present((row) => num(row.lifespan, 0)),
      ),
    ],
    extraMetric,
    ['', 'n', ...levelCells(trait, (row) => String(row.n))],
  ]
}

const levelTable = (selection: SelectionReport): string => {
  const levels = Array.from(
    { length: TRAIT_MAX - TRAIT_MIN + 1 },
    (_, i) => `L${TRAIT_MIN + i}`,
  )
  return table(
    ['trait', 'metric', ...levels],
    selection.traits.flatMap((trait) => levelRows(selection, trait)),
  )
}

const selectionSection = (
  selection: SelectionReport,
  diversity: DiversityReport,
): string => {
  const noun = selection.type === 'prey' ? 'prey' : 'hunters'
  const lowN =
    selection.n < LOW_N
      ? `  ** LOW n (< ${LOW_N}): treat verdicts as noise; use more seeds **`
      : ''
  const killsMean =
    selection.type === 'hunter' ? `, kills ${num(selection.means.kills)}` : ''
  return [
    `n=${selection.n} eligible ${noun} (${selection.censored} still alive, so lifespan/offspring are lower bounds)${lowN}`,
    `mean lifespan ${num(selection.means.lifespan, 0)}s, offspring ${num(selection.means.offspring)}${killsMean}`,
    '',
    'Trait drift and selection. "effect" = budget-aware selection gradient in outcome-sd per trait-sd',
    '(+0.25 strong, +0.10 real, |x|<0.10 no signal). @floor/@cap = share of the final cohort at level 0 / 7.',
    '',
    driftTable(selection, diversity),
    '',
    'Outcome by trait level (how does having level L in a trait pay off?):',
    '',
    levelTable(selection),
  ].join('\n')
}

// ------------------------------------------------------------------ performers

const cohortCutoff = (cohort: Cohort): string =>
  cohort.kind === 'lifespan' || cohort.kind === 'short-lived'
    ? `${cohort.cutoff.toFixed(0)}s`
    : `>=${cohort.cutoff.toFixed(0)}`

const cohortRow = (cohort: Cohort, keys: string[]): string[] => [
  `${cohort.label} (n=${cohort.n}, ${cohortCutoff(cohort)})`,
  `${cohort.means.lifespan.toFixed(0)}s`,
  num(cohort.means.offspring),
  num(cohort.means.kills),
  ...keys.map(
    (key) =>
      `${num(cohort.traits[key].mean)} (${signed(cohort.traits[key].z, 1)}σ)`,
  ),
  cohort.topBuilds.map((build) => `${build.build} x${build.n}`).join(', '),
]

const performersSection = (performers: PerformerReport): string => {
  if (performers.cohorts.length === 0)
    return 'No cohorts (too few individuals).'
  const keys = Object.keys(performers.population)
  const everyone = [
    `everyone (n=${performers.n})`,
    '',
    '',
    '',
    ...keys.map(
      (key) =>
        `${num(performers.population[key].mean)} (sd ${num(performers.population[key].sd)})`,
    ),
    '',
  ]
  const rows = [
    everyone,
    ...performers.cohorts.map((cohort) => cohortRow(cohort, keys)),
  ]
  return [
    'Top-performer cohorts: trait mean and its gap to the population in σ (population sd). Big |σ| = that',
    'trait separates winners from the rest; ~0σ = winners look like everyone else in that trait.',
    '',
    table(
      ['cohort', 'lived', 'offspring', 'kills', ...keys, 'top builds'],
      rows.map((row) => row.map((cell) => cell || '-')),
    ),
  ].join('\n')
}

// ---------------------------------------------------------------------- builds

const BUILD_HEADERS = ['build', 'n', 'share', 'offspring', 'lived', 'kills']

const buildRow = (row: BuildRow): string[] => [
  row.build,
  String(row.n),
  pct(row.share),
  num(row.offspring),
  `${row.lifespan.toFixed(0)}s`,
  num(row.kills),
]

const diversityTable = (diversity: DiversityReport, keys: string[]): string =>
  table(
    [
      'cohort',
      'n',
      'builds',
      'eff',
      'top build (share)',
      'distance',
      'mean sd',
      ...keys.map((key) => `mean ${key}`),
    ],
    diversity.rows.map((row) => [
      row.label,
      String(row.n),
      String(row.distinctBuilds),
      num(row.effectiveBuilds, 1),
      `${row.topBuild} (${pct(row.topBuildShare)})`,
      num(row.pairwiseDistance),
      num(row.meanTraitSd),
      ...keys.map((key) => num(row.traitMean[key])),
    ]),
  )

const varianceVerdict = (
  diversity: DiversityReport,
  keys: string[],
): string => {
  const { trend } = diversity
  const perTrait = keys
    .map((key) => `${key} ${signedPct(trend.traitSdChange[key])}`)
    .join(', ')
  return (
    `Variance vs founders: ${trend.verdict.toUpperCase()} ` +
    `(pairwise build distance ${signedPct(trend.distanceChange)}, mean trait sd ${signedPct(trend.meanTraitSdChange)}; per trait sd: ${perTrait})`
  )
}

const buildsSection = (
  diversity: DiversityReport,
  builds: BuildTables,
): string => {
  const keys = Object.keys(diversity.rows[0]?.traitMean ?? {})
  const best =
    builds.best.length > 0
      ? `Best builds by offspring (n >= 5):\n\n${table(BUILD_HEADERS, builds.best.map(buildRow))}`
      : 'Best builds by offspring: no build has n >= 5.'
  return [
    'Build diversity by birth cohort. pairwise distance = points to move between two random members',
    '(0 = all clones). "eff" = effective number of builds (exp Shannon entropy; grows with n, so compare',
    'distance/sd across rows, not eff).',
    '',
    diversityTable(diversity, keys),
    '',
    varianceVerdict(diversity, keys),
    '',
    'Most common builds (eligible individuals):',
    '',
    table(BUILD_HEADERS, builds.frequent.map(buildRow)),
    '',
    best,
  ].join('\n')
}

/** The table-derived sections shared by a single run and a pooled sweep. */
export const individualSections = (analysis: IndividualAnalysis): string =>
  TYPE_NAMES.map((type) =>
    [
      `### ${type === 'prey' ? 'Prey' : capitalize(`${type}s`)}`,
      '',
      selectionSection(analysis.selection[type], analysis.diversity[type]),
      '',
      performersSection(analysis.performers[type]),
      '',
      buildsSection(analysis.diversity[type], analysis.builds[type]),
      '',
      '#### Mutations',
      '',
      mutationsSection(analysis.mutations[type]),
    ].join('\n'),
  ).join('\n\n')
