import { describe, expect, it } from 'vitest'
import { CANVAS, MAX_GLORPS } from '@/engine/config'
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
    world.x[0] = 100
    world.y[0] = 100
    world.vx[0] = 10
    world.vy[0] = -4

    step(world, 0.5)

    expect(world.x[0]).toBeCloseTo(105)
    expect(world.y[0]).toBeCloseTo(98)
  })

  it('keeps glorps within the wrapped bounds over time', () => {
    const world = createWorld(32)
    const { radius } = world

    for (let tick = 0; tick < 600; tick += 1) step(world, 1 / 60)

    for (let index = 0; index < world.count; index += 1) {
      expect(world.x[index]).toBeGreaterThanOrEqual(-radius)
      expect(world.x[index]).toBeLessThanOrEqual(CANVAS.width + radius)
      expect(world.y[index]).toBeGreaterThanOrEqual(-radius)
      expect(world.y[index]).toBeLessThanOrEqual(CANVAS.height + radius)
    }
  })
})
