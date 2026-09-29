import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import {
  FED_START,
  GLORP_RADIUS,
  MAX_GLORPS,
} from '@/sim/config'
import { spawnGlorp, spawnRandom } from '@/sim/spawn'
import { TRAITS } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('spawnGlorp', () => {
  it('adds a glorp with traits inside the configured ranges', () => {
    const world = createWorld(4, 5)
    const before = world.count

    const index = spawnGlorp(world, GLORP_TYPE.hunter, 500, 400)

    expect(index).toBe(before)
    expect(world.count).toBe(before + 1)
    expect(world.type[index]).toBe(GLORP_TYPE.hunter)
    expect(world.fed[index]).toBe(FED_START)
    expect(world.speed[index]).toBeGreaterThanOrEqual(TRAITS.speed.min)
    expect(world.speed[index]).toBeLessThanOrEqual(TRAITS.speed.max)
    expect(world.metabolism[index]).toBeGreaterThanOrEqual(
      TRAITS.metabolism.min,
    )
    expect(world.metabolism[index]).toBeLessThanOrEqual(TRAITS.metabolism.max)
    expect(world.stamina[index]).toBe(world.staminaMax[index])
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
