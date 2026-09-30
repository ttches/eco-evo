import { describe, expect, it } from 'vitest'
import { GESTATION_SECONDS, GLORP_RADIUS, MATE_RANGE } from '@/sim/config'
import { applyDeath } from '@/sim/lifecycle'
import { applyEating } from '@/sim/predation'
import {
  DEATH_CAUSE,
  NO_GLORP,
  childrenOf,
  createLineage,
  displayName,
  isAlive,
  readLineage,
  setName,
} from '@/sim/lineage'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
} from '@/sim/reproduction'
import { spawnRandom } from '@/sim/spawn'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step } from '@/sim/world'

describe('lineage births', () => {
  it('logs spawned glorps as generation 0 with no parents', () => {
    const world = createWorld(3, 5)

    expect(world.lineage.size).toBe(3)
    const record = readLineage(world.lineage, world.id[1])
    expect(record?.parentA).toBe(NO_GLORP)
    expect(record?.parentB).toBe(NO_GLORP)
    expect(record?.generation).toBe(0)
    expect(record?.deathCause).toBe(DEATH_CAUSE.alive)
    expect(record?.traits.speed).toBe(world.speed[1])
  })

  it('links clones to their parent one generation down', () => {
    const world = createWorld(1, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0

    applyReproduction(world)

    const child = readLineage(world.lineage, world.id[1])
    expect(child?.parentA).toBe(world.id[0])
    expect(child?.parentB).toBe(NO_GLORP)
    expect(child?.generation).toBe(1)
    expect(child?.traits.speed).toBe(world.speed[1])
    expect(childrenOf(world.lineage, world.id[0])).toEqual([world.id[1]])
  })

  it('links pair offspring to both parents', () => {
    const world = createWorld(2, 17)
    for (const index of [0, 1]) {
      world.type[index] = GLORP_TYPE.hunter
      world.fed[index] = 100
      world.cooldown[index] = 0
      world.y[index] = 100
    }
    world.x[0] = 100
    world.x[1] = 100 + MATE_RANGE / 2

    applyPairReproduction(world)
    applyGestation(world, GESTATION_SECONDS)

    const child = readLineage(world.lineage, world.id[2])
    expect([child?.parentA, child?.parentB].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      [world.id[0], world.id[1]].sort((a, b) => a - b),
    )
    expect(child?.generation).toBe(1)
  })
})

describe('lineage deaths', () => {
  it('keeps starved glorps with their time of death', () => {
    const world = createWorld(2, 5)
    world.time = 12.5
    const id = world.id[0]
    world.fed[0] = 0

    applyDeath(world)

    const record = readLineage(world.lineage, id)
    expect(record?.deathCause).toBe(DEATH_CAUSE.starved)
    expect(record?.diedAt).toBe(12.5)
    expect(record?.killer).toBe(NO_GLORP)
    expect(isAlive(world.lineage, id)).toBe(false)
  })

  it('records who ate whom', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + GLORP_RADIUS
    world.y[1] = 100
    world.strength[0] = 6
    world.strength[1] = 3
    const hunterId = world.id[0]
    const preyId = world.id[1]

    applyEating(world, 0.1)

    const record = readLineage(world.lineage, preyId)
    expect(record?.deathCause).toBe(DEATH_CAUSE.eaten)
    expect(record?.killer).toBe(hunterId)
  })
})

describe('lineage storage', () => {
  it('grows past its initial capacity without losing records', () => {
    const world = createWorld(0, 3)
    Object.assign(world, { lineage: createLineage(4) })
    for (let i = 0; i < 40; i += 1) {
      spawnRandom(world, GLORP_TYPE.prey)
      world.fed[0] = 0
      applyDeath(world)
    }

    expect(world.lineage.size).toBe(40)
    expect(world.lineage.capacity).toBeGreaterThanOrEqual(40)
    for (let id = 0; id < 40; id += 1) {
      expect(world.lineage.deathCause[id]).toBe(DEATH_CAUSE.starved)
    }
  })

  it('names glorps, keeps names after death, and clears blank names', () => {
    const world = createWorld(2, 5)
    const id = world.id[0]
    expect(displayName(world.lineage, id)).toBe(`Glorp #${id}`)

    setName(world.lineage, id, '  Gloria ')
    world.fed[0] = 0
    applyDeath(world)
    expect(readLineage(world.lineage, id)?.name).toBe('Gloria')
    expect(displayName(world.lineage, id)).toBe('Gloria')

    setName(world.lineage, id, '   ')
    expect(readLineage(world.lineage, id)?.name).toBeNull()
  })

  it('stays in sync with the live world over a long run', () => {
    const world = createWorld()
    for (let tick = 0; tick < 60 * 120; tick += 1) step(world, 1 / 60)

    const log = world.lineage
    expect(log.size).toBe(world.nextId)
    const living = new Set(Array.from(world.id.subarray(0, world.count)))
    let dead = 0
    for (let id = 0; id < log.size; id += 1) {
      expect(isAlive(log, id)).toBe(living.has(id))
      if (!living.has(id)) {
        dead += 1
        expect(log.diedAt[id]).toBeGreaterThanOrEqual(log.bornAt[id])
      }
      const parent = log.parentA[id]
      if (parent !== NO_GLORP) {
        expect(parent).toBeLessThan(id)
        expect(log.bornAt[id]).toBeGreaterThanOrEqual(log.bornAt[parent])
      }
    }
    expect(dead).toBeGreaterThan(0)
  }, 30000)
})
