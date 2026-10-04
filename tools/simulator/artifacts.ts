/**
 * Filesystem artifacts for a simulator run: the machine-readable summary, the
 * human/LLM reports and the CSV/JSON exports. Kept apart from the formatters
 * so those stay pure.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEATH_CAUSE } from '@/sim/lineage'
import { TRAIT_KEYS } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'
import { buildTable, serializeTable } from './analysis/individuals.ts'
import type { SampleRow } from './analysis/sampling.ts'
import { TYPE_NAMES } from './analysis/types.ts'
import { renderRunHtml } from './charts/run-charts.ts'
import { formatReport } from './report/run-report.ts'
import type { RunSummary } from './types.ts'

const TYPE_NAME: Record<number, string> = {
  [GLORP_TYPE.prey]: 'prey',
  [GLORP_TYPE.hunter]: 'hunter',
}

const CAUSE_NAME: Record<number, string> = {
  [DEATH_CAUSE.alive]: 'alive',
  [DEATH_CAUSE.starved]: 'starved',
  [DEATH_CAUSE.eaten]: 'eaten',
}

export const writeSummaryJson = (file: string, summary: RunSummary): void => {
  writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`)
}

/** `report.md` (for people and LLMs) and `report.html` (charts) for one run. */
export const writeReports = (
  dir: string,
  summary: RunSummary,
  samples: SampleRow[],
): void => {
  writeFileSync(path.join(dir, 'report.md'), `${formatReport(summary, samples)}\n`)
  writeFileSync(path.join(dir, 'report.html'), renderRunHtml(summary, samples))
}

/** Per-individual table used to pool selection data across a sweep's seeds. */
export const writePoolingData = (
  dir: string,
  world: World,
  summary: RunSummary,
  samples: SampleRow[],
): void => {
  const { epochs, settleSeconds, seed } = summary.run
  writeFileSync(
    path.join(dir, 'individuals.json'),
    serializeTable(buildTable(world, { epochs, settleSeconds, seed })),
  )
  writeFileSync(
    path.join(dir, 'population.json'),
    JSON.stringify({
      seed,
      times: samples.map((row) => row.time),
      prey: samples.map((row) => row.alivePrey),
      hunter: samples.map((row) => row.aliveHunter),
    }),
  )
}

/** One CSV row per glorp ever born, for external analysis. */
export const writeLineageCsv = (file: string, world: World): void => {
  const log = world.lineage
  const header = [
    'id', 'type', 'parentA', 'parentB', 'generation', 'bornAt', 'diedAt',
    'alive', 'deathCause', 'killer', ...TRAIT_KEYS, 'mutations',
  ].join(',')
  const rows = [header]
  for (let id = 0; id < log.size; id += 1) {
    const alive = log.deathCause[id] === DEATH_CAUSE.alive
    rows.push(
      [
        id,
        TYPE_NAME[log.type[id]] ?? log.type[id],
        log.parentA[id],
        log.parentB[id],
        log.generation[id],
        log.bornAt[id].toFixed(3),
        alive ? '' : log.diedAt[id].toFixed(3),
        alive ? 1 : 0,
        CAUSE_NAME[log.deathCause[id]] ?? log.deathCause[id],
        log.killer[id],
        ...TRAIT_KEYS.map((key) => log.traits[key][id]),
        log.mutations[id],
      ].join(','),
    )
  }
  writeFileSync(file, `${rows.join('\n')}\n`)
}

/** Sampled live-population metrics over sim time, traits split by type. */
export const writeTimeseriesCsv = (file: string, rows: SampleRow[]): void => {
  const header = [
    'time', 'alivePrey', 'aliveHunter', 'aliveTotal', 'everBorn',
    'preyFed', 'hunterFed', 'hunterPregnant',
    'meanGenerationPrey', 'meanGenerationHunter',
    'sprintDutyCycle', 'exhaustedFraction', 'grassMean',
    ...TYPE_NAMES.flatMap((type) => TRAIT_KEYS.map((key) => `${type}_${key}`)),
  ].join(',')
  const body = rows.map((row) =>
    [
      row.time.toFixed(3),
      row.alivePrey,
      row.aliveHunter,
      row.aliveTotal,
      row.everBorn,
      row.preyFed.toFixed(3),
      row.hunterFed.toFixed(3),
      row.hunterPregnant,
      row.meanGenerationPrey.toFixed(3),
      row.meanGenerationHunter.toFixed(3),
      row.sprintDutyCycle.toFixed(4),
      row.exhaustedFraction.toFixed(4),
      row.grassMean.toFixed(6),
      ...TYPE_NAMES.flatMap((type) => TRAIT_KEYS.map((key) => row.traits[type][key].toFixed(3))),
    ].join(','),
  )
  writeFileSync(file, `${[header, ...body].join('\n')}\n`)
}
