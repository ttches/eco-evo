import { describe, expect, it, vi } from 'vitest'
import { GLORP_RADIUS } from '@/sim/config'
import { applyEating } from '@/sim/predation'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

// Turn the mechanic off for this file only, to prove `DODGE_ENABLED` gates it.
vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, DODGE_ENABLED: false }
})

describe('DODGE_ENABLED=false', () => {
  it('never lets a more agile prey escape', () => {
    const world = createWorld(2, 21)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + 2 * GLORP_RADIUS - 1
    world.y[1] = 100
    world.fed[0] = 50
    world.fed[1] = 50
    world.strength[0] = 6
    world.strength[1] = 3
    world.agility[0] = 1
    world.agility[1] = 7
    vi.spyOn(world.random, 'unit').mockReturnValue(0)

    applyEating(world, 0.1)

    expect(world.count).toBe(1)
    expect(world.dodges).toBe(0)
  })
})
