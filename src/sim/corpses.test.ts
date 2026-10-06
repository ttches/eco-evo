import { describe, expect, it } from 'vitest'
import { CORPSE_SECONDS, MAX_CORPSES } from '@/sim/config'
import {
  nearestCorpse,
  removeCorpse,
  spawnCorpse,
  tickCorpses,
} from '@/sim/corpses'
import { createWorld } from '@/sim/world'

describe('spawnCorpse', () => {
  it('leaves a corpse at the dead glorp position with a full lifetime', () => {
    const world = createWorld(1, 5)
    world.x[0] = 123
    world.y[0] = 456
    const id = world.id[0]
    const type = world.type[0]

    spawnCorpse(world, 0)

    expect(world.corpses.count).toBe(1)
    expect(world.corpses.x[0]).toBe(123)
    expect(world.corpses.y[0]).toBe(456)
    expect(world.corpses.id[0]).toBe(id)
    expect(world.corpses.type[0]).toBe(type)
    expect(world.corpses.remaining[0]).toBe(CORPSE_SECONDS)
  })

  it('draws no randomness, leaving the simulation stream untouched', () => {
    const withCorpse = createWorld(4, 7)
    const control = createWorld(4, 7)

    spawnCorpse(withCorpse, 0)

    expect(withCorpse.random.unit()).toBe(control.random.unit())
  })

  it('drops a corpse once the field is full', () => {
    const world = createWorld(1, 5)
    world.corpses.count = MAX_CORPSES

    spawnCorpse(world, 0)

    expect(world.corpses.count).toBe(MAX_CORPSES)
  })
})

describe('removeCorpse', () => {
  it('swap-removes a corpse and keeps the rest dense', () => {
    const world = createWorld(3, 5)
    spawnCorpse(world, 0)
    spawnCorpse(world, 1)
    spawnCorpse(world, 2)
    const survivorX = world.corpses.x[2]

    removeCorpse(world, 0)

    expect(world.corpses.count).toBe(2)
    expect(world.corpses.x[0]).toBeCloseTo(survivorX)
  })
})

describe('nearestCorpse', () => {
  it('finds the closest corpse within range, or -1 when none is near', () => {
    const world = createWorld(3, 5)
    world.x[0] = 10
    world.y[0] = 10
    world.x[1] = 50
    world.y[1] = 10
    world.x[2] = 200
    world.y[2] = 10
    spawnCorpse(world, 0)
    spawnCorpse(world, 1)
    spawnCorpse(world, 2)

    expect(nearestCorpse(world, 0, 0, 100)).toBe(0)
    expect(nearestCorpse(world, 45, 10, 20)).toBe(1)
    expect(nearestCorpse(world, 300, 300, 20)).toBe(-1)
  })
})

describe('tickCorpses', () => {
  it('ages a corpse and clears it after its lifetime', () => {
    const world = createWorld(1, 5)
    spawnCorpse(world, 0)

    tickCorpses(world, CORPSE_SECONDS - 0.1)

    expect(world.corpses.count).toBe(1)
    expect(world.corpses.remaining[0]).toBeCloseTo(0.1)

    tickCorpses(world, 0.2)

    expect(world.corpses.count).toBe(0)
  })

  it('swap-removes only the expired corpses', () => {
    const world = createWorld(3, 5)
    spawnCorpse(world, 0)
    spawnCorpse(world, 1)
    spawnCorpse(world, 2)
    const survivorX = world.corpses.x[2]
    world.corpses.remaining[0] = 0.05
    world.corpses.remaining[1] = 5
    world.corpses.remaining[2] = 5

    tickCorpses(world, 0.1)

    expect(world.corpses.count).toBe(2)
    // The last corpse is moved into the expired slot.
    expect(world.corpses.x[0]).toBeCloseTo(survivorX)
    expect(world.corpses.remaining[0]).toBeCloseTo(4.9)
  })
})
