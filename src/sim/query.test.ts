import { describe, expect, it } from 'vitest'
import { findGlorpById } from '@/sim/inspect'
import { glorpAt, nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('glorpAt', () => {
  it('finds the glorp nearest a world point within range', () => {
    const world = createWorld(2, 3)
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 200
    world.y[1] = 200

    expect(glorpAt(world, 105, 105, 20)).toBe(0)
    expect(glorpAt(world, 500, 500, 20)).toBe(-1)
  })
})

describe('nearestOfType', () => {
  it('honours the eligibility filter', () => {
    const world = createWorld(3, 4)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.hunter
    world.type[2] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 120
    world.y[1] = 100
    world.x[2] = 140
    world.y[2] = 100
    rebuildSpatialGrid(world)

    const nearest = nearestOfType(world, 0, GLORP_TYPE.hunter, 100)
    expect(nearest).toBe(1)

    const filtered = nearestOfType(
      world,
      0,
      GLORP_TYPE.hunter,
      100,
      (candidate) => candidate !== 1,
    )
    expect(filtered).toBe(2)
  })
})

describe('findGlorpById', () => {
  it('locates a glorp by its stable id', () => {
    const world = createWorld(3, 5)
    const targetId = world.id[2]

    expect(findGlorpById(world, targetId)).toBe(2)
  })

  it('returns -1 for a missing id', () => {
    const world = createWorld(2, 5)
    expect(findGlorpById(world, 9999)).toBe(-1)
  })
})
