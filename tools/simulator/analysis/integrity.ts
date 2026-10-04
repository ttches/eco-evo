/**
 * Invariant checks over a finished world. Every analysis trusts the lineage
 * log, so if the sim ever corrupts it (a bad swap-remove, a mis-recorded
 * death, a broken trait budget) the report must say so loudly rather than
 * produce confident nonsense.
 */
import { DEATH_CAUSE, NO_GLORP } from '@/sim/lineage'
import { MAX_MUTATIONS, TRAIT_BUDGET } from '@/sim/config'
import {
  MUTATION_MASK_ALL,
  countMutations,
  mutationAllowedForType,
  mutationKeys,
} from '@/sim/mutations'
import { TRAIT_KEYS, TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

export type IntegrityReport = {
  /** Number of invariants evaluated. */
  checks: number
  /** Human-readable descriptions of each violated invariant (capped). */
  failures: string[]
}

const MAX_REPORTED = 12

export const checkIntegrity = (world: World): IntegrityReport => {
  const log = world.lineage
  const failures: string[] = []
  let checks = 0
  const check = (ok: boolean, message: () => string): void => {
    checks += 1
    if (!ok && failures.length < MAX_REPORTED) failures.push(message())
  }

  check(
    log.size === world.nextId,
    () => `lineage size ${log.size} != nextId ${world.nextId}`,
  )

  let aliveInLog = 0
  for (let id = 0; id < log.size; id += 1) {
    const alive = log.deathCause[id] === DEATH_CAUSE.alive
    if (alive) aliveInLog += 1

    let budget = 0
    let inRange = true
    for (const key of TRAIT_KEYS) {
      const level = log.traits[key][id]
      budget += level
      if (level < TRAIT_MIN || level > TRAIT_MAX || !Number.isInteger(level))
        inRange = false
    }
    check(
      budget === TRAIT_BUDGET,
      () => `glorp ${id} trait budget ${budget} != ${TRAIT_BUDGET}`,
    )
    check(
      inRange,
      () => `glorp ${id} has a trait outside ${TRAIT_MIN}..${TRAIT_MAX}`,
    )

    const mutations = log.mutations[id]
    check(
      (mutations & ~MUTATION_MASK_ALL) === 0,
      () => `glorp ${id} has unknown mutation bits ${mutations}`,
    )
    check(
      countMutations(mutations) <= MAX_MUTATIONS,
      () => `glorp ${id} holds more than ${MAX_MUTATIONS} mutations`,
    )
    check(
      mutationKeys(mutations).every((key) =>
        mutationAllowedForType(key, log.type[id] as GlorpType),
      ),
      () => `glorp ${id} holds a mutation exclusive to another type`,
    )

    for (const parent of [log.parentA[id], log.parentB[id]]) {
      if (parent === NO_GLORP) continue
      check(
        parent >= 0 && parent < id,
        () => `glorp ${id} has impossible parent ${parent}`,
      )
      if (parent >= 0 && parent < id) {
        check(
          log.bornAt[parent] <= log.bornAt[id],
          () => `glorp ${id} was born before its parent ${parent}`,
        )
        check(
          log.generation[id] > log.generation[parent],
          () => `glorp ${id} generation does not exceed parent ${parent}`,
        )
      }
    }

    if (alive) {
      check(
        Number.isNaN(log.diedAt[id]),
        () => `living glorp ${id} has a death time`,
      )
      continue
    }
    check(
      Number.isFinite(log.diedAt[id]) && log.diedAt[id] >= log.bornAt[id],
      () => `glorp ${id} died before it was born`,
    )
    if (log.deathCause[id] === DEATH_CAUSE.eaten) {
      const killer = log.killer[id]
      check(
        killer >= 0 && killer < log.size,
        () => `eaten glorp ${id} has no killer`,
      )
      if (killer >= 0 && killer < log.size) {
        check(
          log.type[killer] === GLORP_TYPE.hunter,
          () => `glorp ${id} was eaten by non-hunter ${killer}`,
        )
        check(
          log.bornAt[killer] <= log.diedAt[id] && killer !== id,
          () => `glorp ${id} was eaten by ${killer} before it existed`,
        )
      }
    } else {
      check(
        log.killer[id] === NO_GLORP,
        () => `starved glorp ${id} has a killer`,
      )
    }
  }

  check(
    aliveInLog === world.count,
    () => `${aliveInLog} alive in lineage but ${world.count} live`,
  )
  const seen = new Set<number>()
  for (let index = 0; index < world.count; index += 1) {
    const id = world.id[index]
    check(!seen.has(id), () => `live id ${id} appears twice`)
    seen.add(id)
    check(
      id < log.size && log.deathCause[id] === DEATH_CAUSE.alive,
      () =>
        `live glorp at slot ${index} (id ${id}) is not alive in the lineage`,
    )
    check(
      world.fed[index] > 0 || world.count === 0,
      () => `live glorp ${id} has no energy but was not removed`,
    )
    check(
      world.mutations[index] === log.mutations[id],
      () =>
        `live glorp ${id} mutations ${world.mutations[index]} != log ${log.mutations[id]}`,
    )
  }
  return { checks, failures }
}
