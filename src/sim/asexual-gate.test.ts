import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, HUNTER_ASEXUAL: false }
})

import { applyReproduction } from '@/sim/reproduction'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('hunter asexual gate', () => {
  it('lets prey clone but never hunters when HUNTER_ASEXUAL is off', () => {
    const world = createWorld(2, 9)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.fed[0] = 100
    world.cooldown[0] = 0
    world.fed[1] = 100
    world.cooldown[1] = 0

    applyReproduction(world)

    expect(world.count).toBe(3)
    expect(world.type[2]).toBe(GLORP_TYPE.prey)
  })
})
