import { describe, expect, it } from 'vitest'
import { CANNIBAL_HUNGER, CANNIBAL_KILL_FED, GLORP_RADIUS, HUNTER_KILL_FED } from '@/sim/config'
import { applyEating } from '@/sim/predation'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

/** One hunter and one prey, within eating reach. */
const setupHunt = (hunterStrength: number, preyStrength: number) => {
  const world = createWorld(2, 21)
  world.type[0] = GLORP_TYPE.hunter
  world.type[1] = GLORP_TYPE.prey
  world.x[0] = 100
  world.y[0] = 100
  world.x[1] = 100 + 2 * GLORP_RADIUS - 1
  world.y[1] = 100
  world.fed[0] = 50
  world.fed[1] = 50
  world.strength[0] = hunterStrength
  world.strength[1] = preyStrength
  return world
}

describe('strength predation gate', () => {
  it('eats a prey of a lower strength tier', () => {
    const world = setupHunt(6, 3)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.fed[0]).toBeCloseTo(50 + HUNTER_KILL_FED)
  })

  it('eats a prey of the same tier', () => {
    const world = setupHunt(5.0, 5.9)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
  })

  it('refuses a prey of a higher strength tier', () => {
    const world = setupHunt(1, 9)
    applyEating(world, 0.1)
    expect(world.count).toBe(2)
    expect(world.fed[0]).toBeCloseTo(50)
  })

  it('eats at exactly the strength edge and refuses one tier beyond', () => {
    const atEdge = setupHunt(3, 7)
    applyEating(atEdge, 0.1)
    expect(atEdge.count).toBe(1)

    const beyond = setupHunt(3, 8)
    applyEating(beyond, 0.1)
    expect(beyond.count).toBe(2)
  })
})

/** Two hunters within eating reach, both set up for cannibalism. */
const setupCannibals = (
  aStrength: number,
  bStrength: number,
  aFed: number,
  bFed: number,
) => {
  const world = createWorld(2, 23)
  world.type[0] = GLORP_TYPE.hunter
  world.type[1] = GLORP_TYPE.hunter
  world.x[0] = 100
  world.y[0] = 100
  world.x[1] = 100 + 2 * GLORP_RADIUS - 1
  world.y[1] = 100
  world.strength[0] = aStrength
  world.strength[1] = bStrength
  world.fed[0] = aFed
  world.fed[1] = bFed
  return world
}

describe('strength cannibalism contest', () => {
  it('lets a stronger starving hunter eat a weaker one', () => {
    const world = setupCannibals(6, 3, CANNIBAL_HUNGER - 5, 50)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.id[0]).toBe(0)
    expect(world.fed[0]).toBeCloseTo(CANNIBAL_HUNGER - 5 + CANNIBAL_KILL_FED)
  })

  it('stops a weaker hunter from eating a stronger one', () => {
    const world = setupCannibals(3, 6, CANNIBAL_HUNGER - 5, 50)
    applyEating(world, 0.1)
    expect(world.count).toBe(2)
  })

  it('breaks an equal tier by energy', () => {
    const world = setupCannibals(5, 5, 15, 10)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.id[0]).toBe(0)
    expect(world.fed[0]).toBeCloseTo(15 + CANNIBAL_KILL_FED)
  })

  it('breaks an equal tier and energy by age (older lives)', () => {
    const world = setupCannibals(5, 5, 10, 10)
    world.lineage.bornAt[world.id[0]] = 0
    world.lineage.bornAt[world.id[1]] = 5
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.id[0]).toBe(0)
  })

  it('breaks a full tie with a deterministic coin', () => {
    const first = setupCannibals(5, 5, 10, 10)
    applyEating(first, 0.1)
    const second = setupCannibals(5, 5, 10, 10)
    applyEating(second, 0.1)

    expect(first.count).toBe(1)
    expect(second.count).toBe(1)
    expect(first.id[0]).toBe(second.id[0])
  })

  it('swap-removes the victim without disturbing the rest', () => {
    const world = createWorld(3, 29)
    for (const index of [0, 1, 2]) {
      world.type[index] = GLORP_TYPE.hunter
      world.y[index] = 100
      world.x[index] = 100 + index * 10
    }
    world.strength[0] = 6
    world.strength[1] = 3
    world.strength[2] = 4
    world.fed[0] = CANNIBAL_HUNGER - 5
    world.fed[1] = 50
    world.fed[2] = 50
    const bystanderId = world.id[2]

    applyEating(world, 0.1)

    // The nearest (index 1) is eaten; the last glorp swaps into its slot.
    expect(world.count).toBe(2)
    expect(world.id[1]).toBe(bystanderId)
  })
})
