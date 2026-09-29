import { describe, expect, it } from 'vitest'
import { MAX_GLORPS } from '@/sim/config'
import { allocGlorp, removeGlorp } from '@/sim/store'
import { TRAIT_KEYS } from '@/sim/traits'
import { createWorld } from '@/sim/world'

describe('allocGlorp', () => {
  it('claims a zeroed slot with a fresh id', () => {
    const world = createWorld(3, 5)
    world.fed.fill(42)
    const nextId = world.nextId

    const index = allocGlorp(world)

    expect(index).toBe(3)
    expect(world.count).toBe(4)
    expect(world.id[index]).toBe(nextId)
    expect(world.nextId).toBe(nextId + 1)
    expect(world.fed[index]).toBe(0)
  })

  it('returns -1 at the population cap', () => {
    const world = createWorld(MAX_GLORPS, 5)
    expect(allocGlorp(world)).toBe(-1)
    expect(world.count).toBe(MAX_GLORPS)
  })
})

describe('removeGlorp', () => {
  it('moves the last glorp into the gap along with its id and traits', () => {
    const world = createWorld(4, 5)
    const lastId = world.id[3]
    const lastX = world.x[3]
    const lastTraits = TRAIT_KEYS.map((key) => world[key][3])

    removeGlorp(world, 0)

    expect(world.count).toBe(3)
    expect(world.id[0]).toBe(lastId)
    expect(world.x[0]).toBe(lastX)
    expect(TRAIT_KEYS.map((key) => world[key][0])).toEqual(lastTraits)
  })
})
