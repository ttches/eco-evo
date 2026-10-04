/**
 * Small, dependency-free statistics helpers shared by every analysis module.
 * All functions are pure and empty-safe (they return 0 / null instead of NaN).
 */

export type Distribution = {
  count: number
  mean: number
  median: number
  p10: number
  p90: number
  min: number
  max: number
}

/** Nearest-rank distribution summary (p10/p50/p90, no interpolation). */
export const describe = (values: ArrayLike<number>): Distribution => {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, p10: 0, p90: 0, min: 0, max: 0 }
  }
  const sorted = Array.from(values).sort((a, b) => a - b)
  const at = (q: number): number =>
    sorted[
      Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor(q * (sorted.length - 1))),
      )
    ]
  let sum = 0
  for (const value of sorted) sum += value
  return {
    count: sorted.length,
    mean: sum / sorted.length,
    median: at(0.5),
    p10: at(0.1),
    p90: at(0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

export const mean = (values: ArrayLike<number>): number => {
  if (values.length === 0) return 0
  let sum = 0
  for (let index = 0; index < values.length; index += 1) sum += values[index]
  return sum / values.length
}

/** Population standard deviation. */
export const sd = (values: ArrayLike<number>): number => {
  if (values.length < 2) return 0
  const center = mean(values)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += (values[index] - center) ** 2
  }
  return Math.sqrt(sum / values.length)
}

/** Sample standard deviation (n - 1), for small across-seed samples. */
export const sampleSd = (values: ArrayLike<number>): number => {
  if (values.length < 2) return 0
  const center = mean(values)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += (values[index] - center) ** 2
  }
  return Math.sqrt(sum / (values.length - 1))
}

/** Average ranks (ties share the mean rank), for Spearman correlation. */
const ranks = (values: ArrayLike<number>): number[] => {
  const order = Array.from({ length: values.length }, (_, index) => index).sort(
    (a, b) => values[a] - values[b],
  )
  const result = new Array<number>(values.length)
  let start = 0
  while (start < order.length) {
    let end = start
    while (
      end + 1 < order.length &&
      values[order[end + 1]] === values[order[start]]
    ) {
      end += 1
    }
    const rank = (start + end) / 2
    for (let slot = start; slot <= end; slot += 1) result[order[slot]] = rank
    start = end + 1
  }
  return result
}

/** Pearson correlation, or null when either side has no variance. */
export const pearson = (
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
): number | null => {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - mx
    const dy = ys[index] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Spearman rank correlation: robust to the long tails in lifespan/offspring. */
export const spearman = (
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
): number | null => pearson(ranks(xs), ranks(ys))

/**
 * Gini coefficient of a non-negative list: 0 = everyone equal, 1 = one
 * individual holds everything. Used for how concentrated kills/offspring are.
 */
export const gini = (values: ArrayLike<number>): number => {
  const n = values.length
  if (n === 0) return 0
  const sorted = Array.from(values).sort((a, b) => a - b)
  let total = 0
  let weighted = 0
  for (let index = 0; index < n; index += 1) {
    total += sorted[index]
    weighted += (index + 1) * sorted[index]
  }
  if (total === 0) return 0
  return (2 * weighted) / (n * total) - (n + 1) / n
}

/** Shannon entropy (nats) of a count list. */
export const entropy = (counts: ArrayLike<number>): number => {
  let total = 0
  for (let index = 0; index < counts.length; index += 1) total += counts[index]
  if (total === 0) return 0
  let sum = 0
  for (let index = 0; index < counts.length; index += 1) {
    const p = counts[index] / total
    if (p > 0) sum -= p * Math.log(p)
  }
  return sum
}

/**
 * Solve the centered ridge regression `y ~ X` (X is n rows by k columns) and
 * return the k coefficients. A tiny ridge term is what makes this usable for
 * traits that share a fixed point budget: the columns are then collinear and
 * the solution is the minimum-norm one, whose coefficients sum to zero. Each
 * coefficient reads as "effect of moving one point into this trait, taken from
 * the average of the others".
 */
export const ridgeSlopes = (
  rows: ArrayLike<ArrayLike<number>>,
  y: ArrayLike<number>,
  ridge = 1e-6,
): number[] | null => {
  const n = rows.length
  if (n < 5) return null
  const k = rows[0].length
  const means = new Array<number>(k).fill(0)
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < k; col += 1) means[col] += rows[row][col] / n
  }
  const my = mean(y)
  const a: number[][] = Array.from({ length: k }, () =>
    new Array<number>(k + 1).fill(0),
  )
  for (let row = 0; row < n; row += 1) {
    for (let i = 0; i < k; i += 1) {
      const xi = rows[row][i] - means[i]
      for (let j = 0; j < k; j += 1) a[i][j] += xi * (rows[row][j] - means[j])
      a[i][k] += xi * (y[row] - my)
    }
  }
  for (let i = 0; i < k; i += 1) a[i][i] += ridge * n
  // Gauss-Jordan with partial pivoting.
  for (let col = 0; col < k; col += 1) {
    let pivot = col
    for (let row = col + 1; row < k; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    for (let row = 0; row < k; row += 1) {
      if (row === col) continue
      const factor = a[row][col] / a[col][col]
      for (let j = col; j <= k; j += 1) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row, i) => row[k] / row[i])
}

const SPARK = '▁▂▃▄▅▆▇█'

/** Unicode sparkline of a series, downsampled (by mean) to `width` glyphs. */
export const sparkline = (
  values: ArrayLike<number>,
  width = 60,
  ceiling?: number,
): string => {
  if (values.length === 0) return ''
  const cells: number[] = []
  const bucket = Math.max(1, values.length / width)
  for (let cell = 0; cell * bucket < values.length; cell += 1) {
    const from = Math.floor(cell * bucket)
    const to = Math.max(
      from + 1,
      Math.min(values.length, Math.floor((cell + 1) * bucket)),
    )
    let sum = 0
    for (let index = from; index < to; index += 1) sum += values[index]
    cells.push(sum / (to - from))
  }
  const top = ceiling ?? Math.max(...cells)
  if (top <= 0) return SPARK[0].repeat(cells.length)
  return cells
    .map((value) => {
      const level = Math.round((Math.max(0, value) / top) * (SPARK.length - 1))
      return SPARK[Math.min(SPARK.length - 1, level)]
    })
    .join('')
}

/** Round to a fixed number of digits, keeping nulls/NaN as null. */
export const round = (value: number | null, digits = 3): number | null => {
  if (value === null || !Number.isFinite(value)) return null
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}
