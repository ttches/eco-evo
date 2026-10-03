import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, CANNIBALISM: true }
})

import { CANNIBAL_HUNGER, CANNIBAL_KILL_FED, GLORP_RADIUS } from '@/sim/config'
import { DEATH_CAUSE } from '@/sim/lineage'
import { applyEating } from '@/sim/predation'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

/** Two hunters within eating reach, both set up for cannibalism. */
const setupCannibals = (
  aAgility: number,
  bAgility: number,
  aFed: number,
  bFed: number,
) => {
  const world = createWorld(2, 23)
  world.type[0] = GLORP_TYPE.hunter
  world.type[1] = GLORP_TYPE.hunter
  world.x[0] = 100
  world.y[0] = 100
  world.x[1] = 100 + 2 * GLORP_RADIUS - 1
  world.y[1] = 100
  world.agility[0] = aAgility
  world.agility[1] = bAgility
  world.fed[0] = aFed
  world.fed[1] = bFed
  return world
}

describe('hunter cannibalism', () => {
  it('lets a starving hunter eat another hunter', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + 2 * GLORP_RADIUS - 1
    world.y[1] = 100
    world.fed[0] = CANNIBAL_HUNGER - 5
    world.fed[1] = 50
    world.agility[0] = 6
    world.agility[1] = 3

    applyEating(world, 0.1)

    expect(world.count).toBe(1)
    expect(world.fed[0]).toBeCloseTo(CANNIBAL_HUNGER - 5 + CANNIBAL_KILL_FED)
  })

  it('stops a weaker hunter from eating a stronger one', () => {
    const world = setupCannibals(3, 6, CANNIBAL_HUNGER - 5, 50)
    applyEating(world, 0.1)
    expect(world.count).toBe(2)
  })

  it('breaks an equal agility by energy', () => {
    const world = setupCannibals(5, 5, 15, 10)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.id[0]).toBe(0)
    expect(world.fed[0]).toBeCloseTo(15 + CANNIBAL_KILL_FED)
  })

  it('breaks an equal agility and energy by age (older lives)', () => {
    const world = setupCannibals(5, 5, 10, 10)
    world.lineage.bornAt[world.id[0]] = 0
    world.lineage.bornAt[world.id[1]] = 5
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.id[0]).toBe(0)
  })

  it('breaks a full tie with a deterministic coin', () => {
    const first = setupCannibals(5, 5, 10, 10)
    applyEating(first, 0.1)
    const second = setupCannibals(5, 5, 10, 10)
    applyEating(second, 0.1)

    expect(first.count).toBe(1)
    expect(second.count).toBe(1)
    expect(first.id[0]).toBe(second.id[0])
  })

  it('leaves a fed hunter alone', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + 2 * GLORP_RADIUS - 1
    world.y[1] = 100
    world.fed[0] = CANNIBAL_HUNGER + 10
    world.fed[1] = 50

    applyEating(world, 0.1)

    expect(world.count).toBe(2)
  })

  it('removes multiple victims in an order that keeps the lineage consistent', () => {
    // Victim 0 is eaten first, then victim 3, so the removal order is not
    // descending. Swap-removing index 0 before index 3 shifts a survivor into
    // the removed slot; a naive pass then removes the wrong glorp.
    const world = createWorld(4, 31)
    for (let index = 0; index < 4; index += 1) world.type[index] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100
    world.y[1] = 130
    world.x[2] = 110
    world.y[2] = 100
    world.x[3] = 105
    world.y[3] = 100
    world.fed[0] = CANNIBAL_HUNGER - 5
    world.fed[1] = 50
    world.fed[2] = CANNIBAL_HUNGER - 5
    world.fed[3] = CANNIBAL_HUNGER - 5
    world.agility[0] = 1
    world.agility[1] = 5
    world.agility[2] = 7
    world.agility[3] = 4

    applyEating(world, 0.1)

    // Glorps 1 and 2 survive; 0 and 3 were eaten. A wrong removal order would
    // leave a survivor marked eaten and silently evict another glorp.
    expect(world.count).toBe(2)
    const liveIds = Array.from({ length: world.count }, (_, index) => world.id[index])
    expect(liveIds.sort((a, b) => a - b)).toEqual([1, 2])
    expect(world.lineage.deathCause[0]).toBe(DEATH_CAUSE.eaten)
    expect(world.lineage.deathCause[3]).toBe(DEATH_CAUSE.eaten)
  })
})
