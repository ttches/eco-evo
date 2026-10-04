import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import {
  FED_MAX,
  FED_START,
  GLORP_RADIUS,
  MAX_GLORPS,
  TRAIT_BUDGET,
} from '@/sim/config'
import { seedPopulation, spawnGlorp, spawnRandom } from '@/sim/spawn'
import { TRAIT_KEYS, TRAIT_MAX, TRAIT_MIN, traitValue } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step } from '@/sim/world'

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
      traitValue('endurance', world.endurance[index]),
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

  it('spawns with an explicit starting energy', () => {
    const world = createWorld(0, 9)

    const index = spawnGlorp(world, GLORP_TYPE.hunter, 100, 100, FED_MAX)

    expect(world.fed[index]).toBe(FED_MAX)
  })
})

describe('seedPopulation', () => {
  it('starts predators full and on cooldown, prey at the default', () => {
    const world = createWorld(0, 10)

    seedPopulation(world, 3, 2)

    expect(world.count).toBe(5)
    for (let index = 0; index < 3; index += 1) {
      expect(world.type[index]).toBe(GLORP_TYPE.prey)
      expect(world.fed[index]).toBe(FED_START)
    }
    for (let index = 3; index < 5; index += 1) {
      expect(world.type[index]).toBe(GLORP_TYPE.hunter)
      expect(world.fed[index]).toBe(FED_MAX)
      expect(world.cooldown[index]).toBeCloseTo(
        traitValue('fertility', world.fertility[index]),
      )
    }
  })

  it('does not let full predators reproduce on the first step', () => {
    const world = createWorld(0, 11)
    seedPopulation(world, 3, 2)
    const countHunters = () =>
      Array.from(world.type.subarray(0, world.count)).filter(
        (type) => type === GLORP_TYPE.hunter,
      ).length

    step(world, 1 / 60)

    expect(countHunters()).toBe(2)
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
