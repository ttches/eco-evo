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
    world.strength[0] = 6
    world.strength[1] = 3

    applyEating(world, 0.1)

    expect(world.count).toBe(1)
    expect(world.fed[0]).toBeCloseTo(CANNIBAL_HUNGER - 5 + CANNIBAL_KILL_FED)
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
    world.strength[0] = 1
    world.strength[1] = 5
    world.strength[2] = 7
    world.strength[3] = 4

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
