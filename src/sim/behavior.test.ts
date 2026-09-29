import { describe, expect, it } from 'vitest'
import { computeSteering } from '@/sim/behavior'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

const DT = 1 / 60

describe('prey steering', () => {
  it('points away from a nearby hunter', () => {
    const world = createWorld(2, 3)
    world.type[0] = GLORP_TYPE.prey
    world.type[1] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 140
    world.y[1] = 100
    world.fed[0] = 50
    world.stamina[0] = 5

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeLessThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
    expect(steering.sprint).toBe(true)
  })
})

describe('hunter steering', () => {
  it('moves toward a nearby prey when hungry', () => {
    const world = createWorld(2, 4)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 150
    world.y[1] = 100
    world.fed[0] = 50
    world.stamina[0] = 5

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
    expect(steering.sprint).toBe(true)
  })

  it('ignores prey when well fed', () => {
    const world = createWorld(2, 4)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 150
    world.y[1] = 100
    world.fed[0] = 100
    world.stamina[0] = 5

    const steering = computeSteering(world, 0, DT)

    expect(steering.sprint).toBe(false)
  })
})
