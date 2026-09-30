/**
 * Filesystem artifacts for a simulator run: the machine-readable summary and
 * the CSV exports. Kept apart from `format.ts` so the formatters stay pure.
 */
import { writeFileSync } from 'node:fs'
import { DEATH_CAUSE } from '@/sim/lineage'
import { TRAIT_KEYS } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'
import type { SampleRow } from './analyze.ts'
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

export const writeSummaryJson = (path: string, summary: RunSummary): void => {
  writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`)
}

/** One CSV row per glorp ever born, for external analysis. */
export const writeLineageCsv = (path: string, world: World): void => {
  const log = world.lineage
  const header = [
    'id',
    'type',
    'parentA',
    'parentB',
    'generation',
    'bornAt',
    'diedAt',
    'alive',
    'deathCause',
    'killer',
    'directive',
    ...TRAIT_KEYS,
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
        log.directive[id],
        ...TRAIT_KEYS.map((key) => log.traits[key][id].toFixed(4)),
      ].join(','),
    )
  }
  writeFileSync(path, `${rows.join('\n')}\n`)
}

/** Sampled live-population metrics over sim time. */
export const writeTimeseriesCsv = (path: string, rows: SampleRow[]): void => {
  const header = [
    'time',
    'alivePrey',
    'aliveHunter',
    'aliveTotal',
    'everBorn',
    'meanSpeed',
    'meanStamina',
    'meanMetabolism',
    'meanReproCooldown',
    'meanGeneration',
    'grassMean',
  ].join(',')
  const body = rows.map((row) =>
    [
      row.time.toFixed(3),
      row.alivePrey,
      row.aliveHunter,
      row.aliveTotal,
      row.everBorn,
      row.meanSpeed.toFixed(4),
      row.meanStamina.toFixed(4),
      row.meanMetabolism.toFixed(4),
      row.meanReproCooldown.toFixed(4),
      row.meanGeneration.toFixed(4),
      row.grassMean.toFixed(6),
    ].join(','),
  )
  writeFileSync(path, `${[header, ...body].join('\n')}\n`)
}
