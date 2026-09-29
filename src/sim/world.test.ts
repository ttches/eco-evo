import { describe, expect, it } from 'vitest'
import { MAX_GLORPS, WORLD } from '@/engine/config'
import { createWorld, step } from '@/sim/world'

describe('createWorld', () => {
  it('creates the requested number of glorps', () => {
    const world = createWorld(10)
    expect(world.count).toBe(10)
    expect(world.radius).toBeGreaterThan(0)
  })

  it('clamps the population to the engine capacity', () => {
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
    expect(Array.from(first.colors)).toEqual(Array.from(second.colors))
  })
})

describe('step', () => {
  it('advances positions by velocity times delta', () => {
    const world = createWorld(4)
    world.x[0] = 500
    world.y[0] = 500
    world.vx[0] = 10
    world.vy[0] = -4

    step(world, 0.5)

    expect(world.x[0]).toBeCloseTo(505)
    expect(world.y[0]).toBeCloseTo(498)
  })

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

  it('reflects velocity when hitting a wall', () => {
    const world = createWorld(1)
    world.x[0] = world.radius + 1
    world.vx[0] = -50

    step(world, 1)

    expect(world.x[0]).toBe(world.radius)
    expect(world.vx[0]).toBeGreaterThan(0)
  })
})
