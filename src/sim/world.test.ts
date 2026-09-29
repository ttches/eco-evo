import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import { MAX_GLORPS } from '@/sim/config'
import { createWorld, step } from '@/sim/world'

describe('createWorld', () => {
  it('creates the requested number of glorps', () => {
    const world = createWorld(10)
    expect(world.count).toBe(10)
    expect(world.radius).toBeGreaterThan(0)
  })

  it('clamps the population to the simulation capacity', () => {
    const world = createWorld(MAX_GLORPS + 100)
    expect(world.count).toBe(MAX_GLORPS)
  })

  it('spawns glorps inside the world', () => {
    const world = createWorld(64)
    for (let index = 0; index < world.count; index += 1) {
      expect(world.x[index]).toBeGreaterThanOrEqual(world.radius)
      expect(world.x[index]).toBeLessThanOrEqual(WORLD.width - world.radius)
      expect(world.y[index]).toBeGreaterThanOrEqual(world.radius)
      expect(world.y[index]).toBeLessThanOrEqual(WORLD.height - world.radius)
    }
  })

  it('is deterministic for a given seed', () => {
    const first = createWorld(8, 42)
    const second = createWorld(8, 42)
    expect(Array.from(first.x)).toEqual(Array.from(second.x))
    expect(Array.from(first.y)).toEqual(Array.from(second.y))
    expect(Array.from(first.type)).toEqual(Array.from(second.type))
    expect(Array.from(first.speed)).toEqual(Array.from(second.speed))
    expect(Array.from(first.staminaMax)).toEqual(Array.from(second.staminaMax))
    expect(Array.from(first.metabolism)).toEqual(Array.from(second.metabolism))
    expect(Array.from(first.reproCooldown)).toEqual(
      Array.from(second.reproCooldown),
    )
    expect(Array.from(first.wanderSeed)).toEqual(Array.from(second.wanderSeed))
    expect(Array.from(first.grass.values)).toEqual(
      Array.from(second.grass.values),
    )
  })
})

describe('step', () => {
  it('keeps glorps inside the bounded world over time', () => {
    const world = createWorld(64)

    for (let tick = 0; tick < 1200; tick += 1) step(world, 1 / 60)

    for (let index = 0; index < world.count; index += 1) {
      expect(world.x[index]).toBeGreaterThanOrEqual(world.radius)
      expect(world.x[index]).toBeLessThanOrEqual(WORLD.width - world.radius)
      expect(world.y[index]).toBeGreaterThanOrEqual(world.radius)
      expect(world.y[index]).toBeLessThanOrEqual(WORLD.height - world.radius)
    }
  })

  it('compacts the parallel arrays when glorps die', () => {
    const world = createWorld(6, 21)
    world.fed[1] = -1
    world.fed[3] = -1

    step(world, 1 / 60)

    expect(world.count).toBe(4)
    for (let index = 0; index < world.count; index += 1) {
      expect(world.fed[index]).toBeGreaterThan(0)
      expect(Number.isFinite(world.x[index])).toBe(true)
      expect(Number.isFinite(world.y[index])).toBe(true)
      expect(world.type[index]).toBeGreaterThanOrEqual(0)
      expect(world.type[index]).toBeLessThanOrEqual(1)
    }
  })
})
