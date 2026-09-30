import { describe, expect, it, vi } from 'vitest'

vi.mock('@/sim/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sim/config')>()
  return { ...actual, MATE_SEEKING: true, MATE_CONTACT_SECONDS: 3 }
})

import { computeSteering } from '@/sim/behavior'
import { MATE_RANGE } from '@/sim/config'
import { applyPairReproduction } from '@/sim/reproduction'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

const DT = 1 / 60

const setupHunters = (): ReturnType<typeof createWorld> => {
  const world = createWorld(2, 7)
  world.type[0] = GLORP_TYPE.hunter
  world.type[1] = GLORP_TYPE.hunter
  world.y[0] = 100
  world.y[1] = 100
  world.fed[0] = 100
  world.fed[1] = 100
  world.cooldown[0] = 0
  world.cooldown[1] = 0
  return world
}

describe('mate seeking', () => {
  it('steers a well-fed hunter toward an eligible mate', () => {
    const world = setupHunters()
    world.x[0] = 100
    world.x[1] = 300
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
  })
})

describe('courtship dwell', () => {
  it('requires sustained contact before conceiving', () => {
    const world = setupHunters()
    world.x[0] = 100
    world.x[1] = 100 + MATE_RANGE / 2

    applyPairReproduction(world, 1)
    applyPairReproduction(world, 1)
    expect(world.pregnant[0] + world.pregnant[1]).toBe(0)

    applyPairReproduction(world, 1)
    expect(world.pregnant[0] + world.pregnant[1]).toBeGreaterThan(0)
  })
})
