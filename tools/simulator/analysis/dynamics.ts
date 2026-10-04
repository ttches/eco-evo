/**
 * Population time-series analysis: did anything crash? How low did it get once
 * the start-up transient was over? Is it cycling, and is the cycle widening?
 */
import { countOf, type SampleRow } from './sampling.ts'
import { findCycles, type CycleStats } from './cycles.ts'
import { perType, type TypeName } from './types.ts'
import { describe, mean, sd } from './stats.ts'

export type SeriesStats = {
  min: number
  minAt: number
  max: number
  maxAt: number
  mean: number
  median: number
  p10: number
  p90: number
  sd: number
  /** Coefficient of variation (sd / mean): how violently the count swings. */
  cv: number
}

export type PopulationStatus = 'extinct' | 'near-crash' | 'early-dip' | 'ok'

export type TypeDynamics = {
  start: number
  end: number
  /** Whole run including the start-up transient. */
  whole: SeriesStats
  /** After the warmup: the numbers that describe steady-state behaviour. */
  settled: SeriesStats
  /** Exact extinction time (from the lineage log), or null if it survived. */
  extinctAt: number | null
  /** Population at or below this counts as a near-crash. */
  floor: number
  /** First time at/below the floor, and how long it stayed there, post-warmup. */
  belowFloor: { firstAt: number | null; seconds: number; inWarmup: boolean }
  /** Worst peak-to-trough fall after warmup, as a 0..1 fraction of the peak. */
  drawdown: {
    fraction: number
    peak: number
    peakAt: number
    trough: number
    troughAt: number
  }
  /** Change in mean count, second half vs first half of the settled period. */
  trend: { firstHalf: number; secondHalf: number; change: number | null }
  /** Boom/bust cycling, found by zig-zag over a smoothed series. */
  cycles: CycleStats
  status: PopulationStatus
}

export type WindowRow = {
  index: number
  from: number
  to: number
  prey: { mean: number; min: number; max: number }
  hunter: { mean: number; min: number; max: number }
  preyFed: number
  hunterFed: number
  grass: number
}

export type PopulationDynamics = {
  warmup: number
  sampleSeconds: number
  samples: number
  prey: TypeDynamics
  hunter: TypeDynamics
  /** Highest total population seen, for spotting the world cap. */
  peakTotal: number
  windows: WindowRow[]
}

export type DynamicsOptions = {
  warmupSeconds: number
  floors: Record<TypeName, number>
  extinctAt: Record<TypeName, number | null>
  windows: number
  /** Minimum swing, as a fraction of the settled mean, that counts as a cycle. */
  cycleProminence?: number
}

const seriesStats = (values: number[], times: number[]): SeriesStats => {
  if (values.length === 0) {
    return {
      min: 0,
      minAt: 0,
      max: 0,
      maxAt: 0,
      mean: 0,
      median: 0,
      p10: 0,
      p90: 0,
      sd: 0,
      cv: 0,
    }
  }
  let minIndex = 0
  let maxIndex = 0
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[minIndex]) minIndex = index
    if (values[index] > values[maxIndex]) maxIndex = index
  }
  const spread = describe(values)
  const center = mean(values)
  const deviation = sd(values)
  return {
    min: values[minIndex],
    minAt: times[minIndex],
    max: values[maxIndex],
    maxAt: times[maxIndex],
    mean: center,
    median: spread.median,
    p10: spread.p10,
    p90: spread.p90,
    sd: deviation,
    cv: center === 0 ? 0 : deviation / center,
  }
}

const smooth = (values: number[], radius: number): number[] => {
  if (radius <= 0) return values
  return values.map((_, index) => {
    const from = Math.max(0, index - radius)
    const to = Math.min(values.length - 1, index + radius)
    let sum = 0
    for (let at = from; at <= to; at += 1) sum += values[at]
    return sum / (to - from + 1)
  })
}

const maxDrawdown = (
  values: number[],
  times: number[],
): TypeDynamics['drawdown'] => {
  let peak = values[0] ?? 0
  let peakAt = times[0] ?? 0
  let best = { fraction: 0, peak, peakAt, trough: peak, troughAt: peakAt }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value > peak) {
      peak = value
      peakAt = times[index]
    }
    const fraction = peak <= 0 ? 0 : (peak - value) / peak
    if (fraction > best.fraction) {
      best = { fraction, peak, peakAt, trough: value, troughAt: times[index] }
    }
  }
  return best
}

/** Seconds of the series averaged together before looking for cycles. */
const SMOOTHING_SECONDS = 10
/** A cycle needs a swing of at least this fraction of the settled mean... */
const CYCLE_PROMINENCE = 0.35
/** ...and never fewer than this many individuals. */
const MIN_CYCLE_SWING = 3

type FloorBreaches = TypeDynamics['belowFloor']

/** When, and for how long, a series sat at or below `floor` once settled. */
const floorBreaches = (
  values: number[],
  times: number[],
  settledFrom: number,
  floor: number,
  sampleSeconds: number,
): FloorBreaches => {
  let firstAt: number | null = null
  let seconds = 0
  for (let index = settledFrom; index < values.length; index += 1) {
    if (values[index] > floor) continue
    if (firstAt === null) firstAt = times[index]
    seconds += sampleSeconds
  }
  return {
    firstAt,
    seconds,
    inWarmup: values.slice(0, settledFrom).some((value) => value <= floor),
  }
}

const classify = (
  extinctAt: number | null,
  breaches: FloorBreaches,
): PopulationStatus => {
  if (extinctAt !== null) return 'extinct'
  if (breaches.firstAt !== null) return 'near-crash'
  return breaches.inWarmup ? 'early-dip' : 'ok'
}

/** Mean of the second half against the first half of a series. */
const halfTrend = (values: number[]): TypeDynamics['trend'] => {
  const half = Math.floor(values.length / 2)
  const firstHalf = mean(values.slice(0, half))
  const secondHalf = mean(values.slice(half))
  return {
    firstHalf,
    secondHalf,
    change:
      half < 2 || firstHalf === 0 ? null : (secondHalf - firstHalf) / firstHalf,
  }
}

const analyzeType = (
  samples: SampleRow[],
  type: TypeName,
  options: DynamicsOptions,
  sampleSeconds: number,
): TypeDynamics => {
  const times = samples.map((row) => row.time)
  const values = samples.map((row) => countOf(row, type))
  const firstSettled = samples.findIndex(
    (row) => row.time >= options.warmupSeconds,
  )
  const settledFrom = firstSettled < 0 ? samples.length : firstSettled
  const settledValues = values.slice(settledFrom)
  const settledTimes = times.slice(settledFrom)
  const settled = seriesStats(settledValues, settledTimes)
  const extinctAt = options.extinctAt[type]
  const floor = options.floors[type]
  const belowFloor = floorBreaches(
    values,
    times,
    settledFrom,
    floor,
    sampleSeconds,
  )

  const smoothingRadius = Math.max(
    0,
    Math.round(SMOOTHING_SECONDS / sampleSeconds / 2),
  )
  const swingThreshold = Math.max(
    MIN_CYCLE_SWING,
    settled.mean * (options.cycleProminence ?? CYCLE_PROMINENCE),
  )

  return {
    start: values[0] ?? 0,
    end: values[values.length - 1] ?? 0,
    whole: seriesStats(values, times),
    settled,
    extinctAt,
    floor,
    belowFloor,
    drawdown: maxDrawdown(settledValues, settledTimes),
    trend: halfTrend(settledValues),
    cycles: findCycles(
      smooth(settledValues, smoothingRadius),
      settledTimes,
      swingThreshold,
    ),
    status: classify(extinctAt, belowFloor),
  }
}

const windowRows = (samples: SampleRow[], windows: number): WindowRow[] => {
  if (samples.length === 0) return []
  const end = samples[samples.length - 1].time
  const rows: WindowRow[] = []
  for (let index = 0; index < windows; index += 1) {
    const from = (end * index) / windows
    const to = (end * (index + 1)) / windows
    const inside = samples.filter(
      (row) =>
        row.time >= from &&
        (index === windows - 1 ? row.time <= to : row.time < to),
    )
    if (inside.length === 0) continue
    const summarize = (pick: (row: SampleRow) => number) => {
      const values = inside.map(pick)
      return {
        mean: mean(values),
        min: Math.min(...values),
        max: Math.max(...values),
      }
    }
    rows.push({
      index,
      from,
      to,
      prey: summarize((row) => row.alivePrey),
      hunter: summarize((row) => row.aliveHunter),
      preyFed: mean(inside.map((row) => row.preyFed)),
      hunterFed: mean(inside.map((row) => row.hunterFed)),
      grass: mean(inside.map((row) => row.grassMean)),
    })
  }
  return rows
}

export const analyzeDynamics = (
  samples: SampleRow[],
  options: DynamicsOptions,
): PopulationDynamics => {
  const sampleSeconds =
    samples.length > 1
      ? (samples[samples.length - 1].time - samples[0].time) /
        (samples.length - 1)
      : 1
  return {
    warmup: options.warmupSeconds,
    sampleSeconds,
    samples: samples.length,
    ...perType((type) => analyzeType(samples, type, options, sampleSeconds)),
    peakTotal: samples.reduce((top, row) => Math.max(top, row.aliveTotal), 0),
    windows: windowRows(samples, options.windows),
  }
}
