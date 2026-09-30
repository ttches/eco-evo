import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, CANNIBALISM: true }
})

import { CANNIBAL_HUNGER, CANNIBAL_KILL_FED, GLORP_RADIUS } from '@/sim/config'
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
})
