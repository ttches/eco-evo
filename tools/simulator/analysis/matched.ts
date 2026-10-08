/**
 * Matched selection: what is one trait point worth, judged only against glorps
 * born at the same time in the same run?
 *
 * The pooled gradient in `selection.ts` mixes situations: prey born late face
 * more hunters than prey born early, and a seed whose hunters died out sits
 * beside one where they thrived. Here every glorp is compared only with its
 * birth-window peers (same run, same `windowSeconds` slice), so the result
 * answers "given the world it was born into, did this build do better?".
 *
 * Traits share a fixed budget, so a point gained is a point lost elsewhere. The
 * gradient is reported as moving one point out of a reference trait (default
 * `fertility`, the intended stat sink) into each other trait. Positive means
 * the trait beats the reference; every trait losing means the reference
 * dominates.
 */
import type { Individual, IndividualTable } from './individuals.ts'
import type { TypeName } from './types.ts'

export const MATCHED_WINDOW_SECONDS = 30

/** Reference trait points are moved out of; falls back to the last trait. */
export const MATCHED_REFERENCE = 'fertility'

/** An offspring change this small (as a share of the mean) is "on par". */
export const MATCHED_PAR_SHARE = 0.02

export type MatchedOutcome =
  'offspring' | 'lifespan' | 'eaten' | 'escape' | 'kills'

export type Estimate = {
  /** Outcome change per point moved out of the reference into this trait. */
  perPoint: number
  /** Standard error of `perPoint`. */
  se: number
}

export type MatchedVerdict = 'beats' | 'on par' | 'loses to'

export type MatchedTrait = {
  trait: string
  estimates: Partial<Record<MatchedOutcome, Estimate>>
  /** `perPoint` offspring as a share of mean offspring. */
  offspringShare: number | null
  verdict: MatchedVerdict
}

export type MatchedReport = {
  type: TypeName
  reference: string
  windowSeconds: number
  n: number
  meanOffspring: number
  outcomes: MatchedOutcome[]
  traits: MatchedTrait[]
}

/** Outcomes judged for a type. `escape` only uses prey that ever fled. */
export const matchedOutcomesFor = (type: TypeName): MatchedOutcome[] =>
  type === 'hunter'
    ? ['offspring', 'lifespan', 'eaten', 'kills']
    : ['offspring', 'lifespan', 'eaten', 'escape']

const outcomeOf = (row: Individual, outcome: MatchedOutcome): number | null => {
  if (outcome === 'offspring') return row.offspring
  if (outcome === 'lifespan') return row.age
  if (outcome === 'eaten') return row.cause === 'eaten' ? 1 : 0
  if (outcome === 'kills') return row.kills
  return row.flights > 0 ? row.escapes / row.flights : null
}

/** Invert a small symmetric matrix by Gauss-Jordan; null when singular. */
const invert = (matrix: number[][]): number[][] | null => {
  const size = matrix.length
  const work = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: size }, (_, j) => (i === j ? 1 : 0)),
  ])
  for (let col = 0; col < size; col += 1) {
    let pivot = col
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) pivot = row
    }
    if (Math.abs(work[pivot][col]) < 1e-9) return null
    ;[work[col], work[pivot]] = [work[pivot], work[col]]
    const scale = work[col][col]
    for (let j = 0; j < 2 * size; j += 1) work[col][j] /= scale
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue
      const factor = work[row][col]
      for (let j = 0; j < 2 * size; j += 1)
        work[row][j] -= factor * work[col][j]
    }
  }
  return work.map((row) => row.slice(size))
}

type Sample = { group: string; x: number[]; y: number }

/**
 * OLS of `y` on `x` after removing each group's mean from both (a fixed effect
 * per birth window). A regressor with no variation within any window cannot be
 * judged and gets null, without spoiling the others. Returns null when the
 * whole design is degenerate (too few rows).
 */
export const withinGroupOls = (
  samples: Sample[],
): (Estimate | null)[] | null => {
  if (samples.length === 0) return null
  const k = samples[0].x.length
  const groups = new Map<string, Sample[]>()
  for (const sample of samples) {
    const group = groups.get(sample.group)
    if (group) group.push(sample)
    else groups.set(sample.group, [sample])
  }

  const centered: { x: number[]; y: number }[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const meanX = Array.from(
      { length: k },
      (_, i) => group.reduce((sum, s) => sum + s.x[i], 0) / group.length,
    )
    const meanY = group.reduce((sum, s) => sum + s.y, 0) / group.length
    for (const s of group) {
      centered.push({ x: s.x.map((v, i) => v - meanX[i]), y: s.y - meanY })
    }
  }
  const varies = Array.from({ length: k }, (_, i) =>
    centered.some(({ x }) => Math.abs(x[i]) > 1e-9),
  )
  const used = varies.flatMap((flag, i) => (flag ? [i] : []))
  const dof = centered.length - groups.size - used.length
  if (used.length === 0 || dof <= 0) return null

  const m = used.length
  const xtx = Array.from({ length: m }, () => new Array<number>(m).fill(0))
  const xty = new Array<number>(m).fill(0)
  for (const { x, y } of centered) {
    for (let a = 0; a < m; a += 1) {
      xty[a] += x[used[a]] * y
      for (let b = 0; b < m; b += 1) xtx[a][b] += x[used[a]] * x[used[b]]
    }
  }
  const inverse = invert(xtx)
  if (!inverse) return null
  const beta = inverse.map((row) =>
    row.reduce((sum, value, b) => sum + value * xty[b], 0),
  )
  let residual = 0
  for (const { x, y } of centered) {
    const fit = used.reduce((sum, i, a) => sum + x[i] * beta[a], 0)
    residual += (y - fit) ** 2
  }
  const variance = residual / dof
  const estimates: (Estimate | null)[] = new Array(k).fill(null)
  used.forEach((i, a) => {
    estimates[i] = {
      perPoint: beta[a],
      se: Math.sqrt(Math.max(0, variance * inverse[a][a])),
    }
  })
  return estimates
}

const verdictOf = (
  estimate: Estimate | undefined,
  meanOffspring: number,
): MatchedVerdict => {
  if (!estimate || meanOffspring <= 0) return 'on par'
  const { perPoint, se } = estimate
  if (Math.abs(perPoint) < MATCHED_PAR_SHARE * meanOffspring) return 'on par'
  if (Math.abs(perPoint) < 2 * se) return 'on par'
  return perPoint > 0 ? 'beats' : 'loses to'
}

export const analyzeMatched = (
  table: IndividualTable,
  type: TypeName,
  windowSeconds = MATCHED_WINDOW_SECONDS,
): MatchedReport => {
  const keys = table.traitKeys as readonly string[]
  const referenceIndex = keys.includes(MATCHED_REFERENCE)
    ? keys.indexOf(MATCHED_REFERENCE)
    : keys.length - 1
  const others = keys
    .map((trait, index) => ({ trait, index }))
    .filter(({ index }) => index !== referenceIndex)

  const rows = table.rows.filter(
    (row) => row.type === type && row.eligible && !row.founder,
  )
  const outcomes = matchedOutcomesFor(type)
  const meanOffspring =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.offspring, 0) / rows.length

  const fits = Object.fromEntries(
    outcomes.map((outcome) => {
      const samples: Sample[] = []
      for (const row of rows) {
        const y = outcomeOf(row, outcome)
        if (y === null) continue
        samples.push({
          group: `${row.run}:${Math.floor(row.bornAt / windowSeconds)}`,
          x: others.map(({ index }) => row.traits[index]),
          y,
        })
      }
      return [outcome, withinGroupOls(samples)]
    }),
  ) as Record<MatchedOutcome, (Estimate | null)[] | null>

  const traits: MatchedTrait[] = others.map(({ trait }, i) => {
    const estimates: MatchedTrait['estimates'] = {}
    for (const outcome of outcomes) {
      const estimate = fits[outcome]?.[i]
      if (estimate) estimates[outcome] = estimate
    }
    const offspring = estimates.offspring
    return {
      trait,
      estimates,
      offspringShare:
        offspring && meanOffspring > 0
          ? offspring.perPoint / meanOffspring
          : null,
      verdict: verdictOf(offspring, meanOffspring),
    }
  })

  return {
    type,
    reference: keys[referenceIndex],
    windowSeconds,
    n: rows.length,
    meanOffspring,
    outcomes,
    traits,
  }
}
