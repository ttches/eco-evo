/** The multi-seed HTML report: every seed's population overlaid per type. */
import { TYPE_NAMES } from '../analysis/types.ts'
import { capitalize } from '../report/format.ts'
import { htmlPage, SLOT, type ChartSeries, type ChartSpec } from './page.ts'

/** One seed's population series, as written to `population.json`. */
export type PopulationFile = {
  seed: number
  times: number[]
  prey: number[]
  hunter: number[]
}

const lowerMedian = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length === 0 ? 0 : sorted[Math.floor((sorted.length - 1) / 2)]
}

const overlay = (
  files: PopulationFile[],
  type: (typeof TYPE_NAMES)[number],
  color: string,
  warmup: number,
): ChartSpec => {
  const seeds: ChartSeries[] = files.map((file) => ({
    name: `seed ${file.seed}`,
    color,
    width: 1,
    opacity: 0.35,
    points: file.times.map(
      (time, at) => [time, file[type][at]] as [number, number],
    ),
  }))
  const longest = files.reduce((best, file) =>
    file.times.length > best.times.length ? file : best,
  )
  const median: ChartSeries = {
    name: `${type} median across seeds`,
    color,
    width: 2.5,
    points: longest.times.map((time, at) => [
      time,
      lowerMedian(
        files
          .filter((file) => at < file.times.length)
          .map((file) => file[type][at]),
      ),
    ]),
  }
  return {
    title: `${capitalize(type)} population, every seed`,
    subtitle:
      'Thin lines are single seeds; the thick line is the median. Dips to zero are extinctions.',
    series: [...seeds, median],
    warmup,
    legend: false,
  }
}

export const renderSweepHtml = (
  title: string,
  intro: string,
  files: PopulationFile[],
  warmup: number,
): string =>
  htmlPage(
    title,
    intro,
    files.length === 0
      ? []
      : TYPE_NAMES.map((type, index) =>
          overlay(files, type, SLOT[index], warmup),
        ),
  )
