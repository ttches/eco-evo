/** Lineage-log scans that need the world itself (not just the individual table). */
import { DEATH_CAUSE } from '@/sim/lineage'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'
import { countAlive } from './sampling.ts'
import { describe } from './stats.ts'
import type { IndividualTable } from './individuals.ts'
import type { TypeName } from './types.ts'

export type LineageStats = {
  maxGeneration: number
  meanGenerationDead: number
  /** Mean parent age at the birth of a child, in seconds. */
  generationTimeMean: number | null
  /** Mean children per individual that had at least one. */
  offspringPerParentMean: number
  timeToFirstKill: { mean: number | null; median: number | null }
}

/** Exact extinction time: the last death of a type that has no living members. */
export const extinctionTimes = (
  world: World,
): Record<TypeName, number | null> => {
  const log = world.lineage
  const alive = countAlive(world)
  const last: Record<TypeName, number> = { prey: 0, hunter: 0 }
  for (let id = 0; id < log.size; id += 1) {
    if (log.deathCause[id] === DEATH_CAUSE.alive) continue
    const type: TypeName =
      log.type[id] === GLORP_TYPE.hunter ? 'hunter' : 'prey'
    if (log.diedAt[id] > last[type]) last[type] = log.diedAt[id]
  }
  return {
    prey: alive.prey === 0 && log.size > 0 ? last.prey : null,
    hunter: alive.hunter === 0 && log.size > 0 ? last.hunter : null,
  }
}

export const lineageStats = (
  world: World,
  table: IndividualTable,
): LineageStats => {
  const log = world.lineage
  let generationTimeSum = 0
  let generationTimeCount = 0
  let maxGeneration = 0
  let generationSumDead = 0
  let deadCount = 0
  const firstKillAt = new Map<number, number>()
  for (let id = 0; id < log.size; id += 1) {
    if (log.generation[id] > maxGeneration) maxGeneration = log.generation[id]
    for (const parent of [log.parentA[id], log.parentB[id]]) {
      if (parent < 0) continue
      generationTimeSum += log.bornAt[id] - log.bornAt[parent]
      generationTimeCount += 1
    }
    if (log.deathCause[id] === DEATH_CAUSE.alive) continue
    generationSumDead += log.generation[id]
    deadCount += 1
    const killer = log.killer[id]
    if (
      log.deathCause[id] === DEATH_CAUSE.eaten &&
      killer >= 0 &&
      log.type[id] === GLORP_TYPE.prey
    ) {
      const previous = firstKillAt.get(killer)
      if (previous === undefined || log.diedAt[id] < previous) {
        firstKillAt.set(killer, log.diedAt[id])
      }
    }
  }
  const firstKill = describe(
    [...firstKillAt].map(([hunter, at]) => at - log.bornAt[hunter]),
  )
  const parents = table.rows.filter((row) => row.offspring > 0)
  return {
    maxGeneration,
    meanGenerationDead: deadCount === 0 ? 0 : generationSumDead / deadCount,
    generationTimeMean:
      generationTimeCount === 0
        ? null
        : generationTimeSum / generationTimeCount,
    offspringPerParentMean:
      parents.length === 0
        ? 0
        : parents.reduce((sum, row) => sum + row.offspring, 0) / parents.length,
    timeToFirstKill: {
      mean: firstKill.count === 0 ? null : firstKill.mean,
      median: firstKill.count === 0 ? null : firstKill.median,
    },
  }
}
