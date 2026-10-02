import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import {
  FED_START,
  GLORP_RADIUS,
  MAX_GLORPS,
  TRAIT_BUDGET,
} from '@/sim/config'
import { spawnGlorp, spawnRandom } from '@/sim/spawn'
import {
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  traitValue,
} from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('spawnGlorp', () => {
  it('adds a glorp with levels on the scale that sum to the budget', () => {
    const world = createWorld(4, 5)
    const before = world.count

    const index = spawnGlorp(world, GLORP_TYPE.hunter, 500, 400)

    expect(index).toBe(before)
    expect(world.count).toBe(before + 1)
    expect(world.type[index]).toBe(GLORP_TYPE.hunter)
    expect(world.fed[index]).toBe(FED_START)
    let total = 0
    for (const key of TRAIT_KEYS) {
      expect(Number.isInteger(world[key][index])).toBe(true)
      expect(world[key][index]).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(world[key][index]).toBeLessThanOrEqual(TRAIT_MAX)
      total += world[key][index]
    }
    expect(total).toBe(TRAIT_BUDGET)
    expect(world.stamina[index]).toBe(
      traitValue('staminaMax', world.staminaMax[index]),
    )
  })

  it('clamps the spawn position inside the world', () => {
    const world = createWorld(1, 6)

    const index = spawnGlorp(world, GLORP_TYPE.prey, -100, 99999)

    expect(world.x[index]).toBe(GLORP_RADIUS)
    expect(world.y[index]).toBe(WORLD.height - GLORP_RADIUS)
  })

  it('returns -1 at the population cap', () => {
    const world = createWorld(MAX_GLORPS, 7)

    expect(spawnGlorp(world, GLORP_TYPE.prey, 100, 100)).toBe(-1)
    expect(world.count).toBe(MAX_GLORPS)
  })
})

describe('spawnRandom', () => {
  it('places the glorp inside the world', () => {
    const world = createWorld(2, 8)

    const index = spawnRandom(world, GLORP_TYPE.hunter)

    expect(world.x[index]).toBeGreaterThanOrEqual(GLORP_RADIUS)
    expect(world.x[index]).toBeLessThanOrEqual(WORLD.width - GLORP_RADIUS)
    expect(world.y[index]).toBeGreaterThanOrEqual(GLORP_RADIUS)
    expect(world.y[index]).toBeLessThanOrEqual(WORLD.height - GLORP_RADIUS)
  })
})
