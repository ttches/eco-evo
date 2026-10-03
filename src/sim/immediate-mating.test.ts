import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, GESTATION_SECONDS: 0, MATE_ENERGY_COST: 30 }
})

import { MATE_RANGE, OFFSPRING_FED } from '@/sim/config'
import { applyPairReproduction } from '@/sim/reproduction'
import { TRAIT_MIN } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('immediate mating', () => {
  it('births immediately and charges both parents when gestation is zero', () => {
    const world = createWorld(2, 17)
    for (const index of [0, 1]) {
      world.type[index] = GLORP_TYPE.hunter
      world.y[index] = 100
      world.fed[index] = 100
      world.cooldown[index] = 0
      world.fertility[index] = TRAIT_MIN
    }
    world.x[0] = 100
    world.x[1] = 100 + MATE_RANGE / 2

    applyPairReproduction(world)

    expect(world.count).toBe(3)
    expect(world.fed[2]).toBe(OFFSPRING_FED)
    expect(world.fed[0]).toBeCloseTo(70)
    expect(world.fed[1]).toBeCloseTo(70)
    expect(world.pregnant[0] + world.pregnant[1]).toBe(0)
  })
})
