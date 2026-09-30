import { describe, expect, it } from 'vitest'
import { steerFlee, steerSampled } from '@/sim/steering/context-steering'
import { createWorld } from '@/sim/world'

const DT = 1 / 60

describe('steerSampled', () => {
  it('follows the desired heading in the open field', () => {
    const world = createWorld(1, 1)
    world.x[0] = 1000
    world.y[0] = 1000

    const steering = steerSampled(world, 0, 3, 4, 50, true, DT)

    expect(steering.x).toBeCloseTo(30)
    expect(steering.y).toBeCloseTo(40)
    expect(steering.sprint).toBe(true)
  })

  it('turns tangent when the desired heading would hit a wall', () => {
    const world = createWorld(1, 1)
    world.x[0] = world.radius + 1
    world.y[0] = 1000

    const steering = steerSampled(world, 0, -1, 0, 50, false, DT)

    expect(Math.abs(steering.x)).toBeLessThan(1e-6)
    expect(Math.abs(steering.y)).toBeCloseTo(50)
  })

  it('escapes a corner along the wall instead of pressing into it', () => {
    const world = createWorld(1, 1)
    world.x[0] = world.radius
    world.y[0] = world.radius

    const steering = steerSampled(world, 0, -1, -1, 50, false, DT)

    expect(steering.x).toBeGreaterThanOrEqual(0)
    expect(steering.y).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(50)
  })
})

describe('steerFlee', () => {
  it('flees straight away in the open field', () => {
    const world = createWorld(1, 1)
    world.x[0] = 1000
    world.y[0] = 1000

    const steering = steerFlee(world, 0, 900, 1000, 40, true, DT)

    expect(steering.x).toBeCloseTo(40)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
    expect(steering.sprint).toBe(true)
  })
})
