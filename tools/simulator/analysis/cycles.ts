/**
 * Boom/bust cycle detection. A zig-zag filter only confirms a peak or trough
 * once the series has moved `threshold` away from it, so jitter never counts
 * as a cycle.
 */
import { mean } from './stats.ts'

type Extreme = { time: number; value: number }

export type CycleStats = {
  peaks: number
  meanPeriod: number | null
  /** Mean peak height over mean trough depth. */
  swingRatio: number | null
  /** Mean swing of the later half of cycles over the earlier half. */
  swingGrowth: number | null
}

const NO_CYCLES: CycleStats = {
  peaks: 0,
  meanPeriod: null,
  swingRatio: null,
  swingGrowth: null,
}

/** Confirmed peaks and troughs of a series, in time order. */
const zigzag = (
  values: number[],
  times: number[],
  threshold: number,
): { peaks: Extreme[]; troughs: Extreme[] } => {
  const peaks: Extreme[] = []
  const troughs: Extreme[] = []
  let direction: 1 | -1 | 0 = 0
  let extreme: Extreme = { time: times[0], value: values[0] }
  // Until the first swing is confirmed, track the opening stretch's high and low.
  let high = extreme
  let low = extreme

  const turnUp = (from: Extreme, at: Extreme): void => {
    troughs.push(from)
    direction = 1
    extreme = at
  }
  const turnDown = (from: Extreme, at: Extreme): void => {
    peaks.push(from)
    direction = -1
    extreme = at
  }

  for (let index = 1; index < values.length; index += 1) {
    const here: Extreme = { time: times[index], value: values[index] }
    if (direction === 0) {
      if (here.value > high.value) high = here
      if (here.value < low.value) low = here
      if (here.value - low.value >= threshold) turnUp(low, here)
      else if (high.value - here.value >= threshold) turnDown(high, here)
    } else if (direction === 1) {
      if (here.value > extreme.value) extreme = here
      else if (extreme.value - here.value >= threshold) turnDown(extreme, here)
    } else if (here.value < extreme.value) {
      extreme = here
    } else if (here.value - extreme.value >= threshold) {
      turnUp(extreme, here)
    }
  }
  return { peaks, troughs }
}

export const findCycles = (
  values: number[],
  times: number[],
  threshold: number,
): CycleStats => {
  if (values.length < 3 || threshold <= 0) return NO_CYCLES
  const { peaks, troughs } = zigzag(values, times, threshold)

  const gaps = peaks.slice(1).map((peak, index) => peak.time - peaks[index].time)
  const meanTrough = mean(troughs.map((trough) => trough.value))
  const swings = peaks.map((peak, index) => {
    const trough = troughs[index] ?? troughs[index - 1]
    return trough ? peak.value - trough.value : 0
  })
  const half = Math.floor(swings.length / 2)
  const early = mean(swings.slice(0, half))
  const late = mean(swings.slice(swings.length - half))

  return {
    peaks: peaks.length,
    meanPeriod: gaps.length === 0 ? null : mean(gaps),
    swingRatio:
      peaks.length === 0 || meanTrough <= 0
        ? null
        : mean(peaks.map((peak) => peak.value)) / meanTrough,
    swingGrowth: half < 1 || early <= 0 ? null : late / early,
  }
}
