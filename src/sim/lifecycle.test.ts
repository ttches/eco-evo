import { describe, expect, it } from 'vitest'
import { computeSteering, updateBehavior } from '@/sim/behavior'
import {
  GLORP_RADIUS,
  HUNTER_KILL_FED,
  MATE_FED_MIN,
  MATE_RANGE,
  MAX_GLORPS,
  MUTATION_BIAS,
  MUTATION_RATE,
  OFFSPRING_FED,
  STAMINA,
} from '@/sim/config'
import { applyDeath, applyEating, applyMetabolism } from '@/sim/lifecycle'
import { updateStamina } from '@/sim/motion'
import { rebuildSpatialGrid } from '@/sim/spatial'
import {
  applyPairReproduction,
  applyReproduction,
  tickCooldowns,
} from '@/sim/reproduction'
import { TRAITS } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('applyMetabolism', () => {
  it('drains fed in proportion to metabolism', () => {
    const world = createWorld(4, 5)
    const before = world.fed[0]
    applyMetabolism(world, 1)
    expect(world.fed[0]).toBeCloseTo(before - world.metabolism[0])
  })
})

describe('applyDeath', () => {
  it('removes starving glorps by swap-remove', () => {
    const world = createWorld(4, 5)
    const lastX = world.x[3]
    const lastY = world.y[3]
    world.fed[0] = 0

    applyDeath(world)

    expect(world.count).toBe(3)
    expect(world.x[0]).toBeCloseTo(lastX)
    expect(world.y[0]).toBeCloseTo(lastY)
  })
})

describe('applyReproduction', () => {
  it('spawns a mutated offspring when fed and off cooldown', () => {
    const world = createWorld(2, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0
    const type = world.type[0]
    const speed = world.speed[0]
    const staminaMax = world.staminaMax[0]
    const metabolism = world.metabolism[0]
    const reproCooldown = world.reproCooldown[0]
    const x = world.x[0]
    const y = world.y[0]
    const parentSeed = world.wanderSeed[0]

    applyReproduction(world)

    expect(world.count).toBe(3)
    expect(world.fed[0]).toBe(100)
    expect(world.cooldown[0]).toBeCloseTo(reproCooldown)
    expect(world.fed[2]).toBe(50)
    expect(world.type[2]).toBe(type)
    expect(world.stamina[2]).toBeCloseTo(world.staminaMax[2])
    expect(world.cooldown[2]).toBeCloseTo(world.reproCooldown[2])

    // Traits mutate but stay inside the configured ranges and near the parent.
    const envelope = MUTATION_RATE + MUTATION_BIAS + 1e-9
    expect(Math.abs(world.speed[2] - speed) / speed).toBeLessThanOrEqual(
      envelope,
    )
    expect(Math.abs(world.staminaMax[2] - staminaMax) / staminaMax).toBeLessThanOrEqual(
      envelope,
    )
    expect(
      Math.abs(world.metabolism[2] - metabolism) / metabolism,
    ).toBeLessThanOrEqual(envelope)
    expect(
      Math.abs(world.reproCooldown[2] - reproCooldown) / reproCooldown,
    ).toBeLessThanOrEqual(envelope)
    expect(world.speed[2]).toBeGreaterThanOrEqual(TRAITS.speed.min)
    expect(world.speed[2]).toBeLessThanOrEqual(TRAITS.speed.max)

    expect(Math.hypot(world.x[2] - x, world.y[2] - y)).toBeCloseTo(GLORP_RADIUS)
    expect(world.wanderSeed[2]).not.toBe(parentSeed)
  })

  it('does not reproduce while on cooldown or underfed', () => {
    const world = createWorld(2, 9)
    world.fed[0] = 100
    world.cooldown[0] = 10
    world.fed[1] = 50
    world.cooldown[1] = 0

    tickCooldowns(world, 0.1)
    applyReproduction(world)

    expect(world.count).toBe(2)
    expect(world.cooldown[0]).toBeCloseTo(9.9)
  })

  it('respects the population cap', () => {
    const world = createWorld(MAX_GLORPS, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0

    applyReproduction(world)

    expect(world.count).toBe(MAX_GLORPS)
  })
})

describe('applyPairReproduction', () => {
  const setupPair = (): ReturnType<typeof createWorld> => {
    const world = createWorld(2, 17)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + MATE_RANGE / 2
    world.y[1] = 100
    world.fed[0] = 100
    world.fed[1] = 100
    world.cooldown[0] = 0
    world.cooldown[1] = 0
    world.speed[0] = 40
    world.speed[1] = 60
    world.staminaMax[0] = 4
    world.staminaMax[1] = 8
    world.metabolism[0] = 2
    world.metabolism[1] = 4
    world.reproCooldown[0] = 10
    world.reproCooldown[1] = 20
    return world
  }

  it('inherits from two nearby, well-fed hunters', () => {
    const world = setupPair()

    applyPairReproduction(world)

    expect(world.count).toBe(3)
    expect(world.type[2]).toBe(GLORP_TYPE.hunter)
    expect(world.fed[2]).toBe(OFFSPRING_FED)
    expect(world.stamina[2]).toBeCloseTo(world.staminaMax[2])
    expect(world.cooldown[2]).toBeCloseTo(world.reproCooldown[2])
    expect(world.cooldown[0]).toBeCloseTo(10)
    expect(world.cooldown[1]).toBeCloseTo(20)
    expect(world.speed[2]).toBeGreaterThanOrEqual(TRAITS.speed.min)
    expect(world.speed[2]).toBeLessThanOrEqual(TRAITS.speed.max)
    expect(world.staminaMax[2]).toBeGreaterThanOrEqual(TRAITS.staminaMax.min)
    expect(world.staminaMax[2]).toBeLessThanOrEqual(TRAITS.staminaMax.max)
    expect(world.metabolism[2]).toBeGreaterThanOrEqual(TRAITS.metabolism.min)
    expect(world.metabolism[2]).toBeLessThanOrEqual(TRAITS.metabolism.max)
    expect(world.reproCooldown[2]).toBeGreaterThanOrEqual(
      TRAITS.reproCooldown.min,
    )
    expect(world.reproCooldown[2]).toBeLessThanOrEqual(TRAITS.reproCooldown.max)
  })

  it('trends toward the globally favorable parent across many matings', () => {
    const world = setupPair()
    const samples = 600
    let speed = 0
    let metabolism = 0
    let reproCooldown = 0
    for (let i = 0; i < samples; i += 1) {
      world.count = 2
      world.fed[0] = 100
      world.fed[1] = 100
      world.cooldown[0] = 0
      world.cooldown[1] = 0
      world.speed[0] = 40
      world.speed[1] = 60
      world.metabolism[0] = 2
      world.metabolism[1] = 4
      world.reproCooldown[0] = 10
      world.reproCooldown[1] = 20

      applyPairReproduction(world)

      speed += world.speed[2]
      metabolism += world.metabolism[2]
      reproCooldown += world.reproCooldown[2]
    }

    expect(speed / samples).toBeGreaterThan(50)
    expect(metabolism / samples).toBeLessThan(3)
    expect(reproCooldown / samples).toBeLessThan(15)
  })

  it('does not mate out of range, on cooldown, or while hungry', () => {
    const far = setupPair()
    far.x[1] = 100 + MATE_RANGE * 2
    applyPairReproduction(far)
    expect(far.count).toBe(2)

    const cooling = setupPair()
    cooling.cooldown[1] = 5
    applyPairReproduction(cooling)
    expect(cooling.count).toBe(2)

    const hungry = setupPair()
    hungry.fed[1] = MATE_FED_MIN
    applyPairReproduction(hungry)
    expect(hungry.count).toBe(2)
  })

  it('respects the population cap', () => {
    const world = createWorld(MAX_GLORPS, 9)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.hunter
    world.fed[0] = 100
    world.fed[1] = 100
    world.cooldown[0] = 0
    world.cooldown[1] = 0
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 110
    world.y[1] = 100

    applyPairReproduction(world)

    expect(world.count).toBe(MAX_GLORPS)
  })
})

describe('applyEating', () => {
  const setupHunt = (hunterFed: number): ReturnType<typeof createWorld> => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + 2 * GLORP_RADIUS - 1
    world.y[1] = 100
    world.fed[0] = hunterFed
    return world
  }

  it('lets a hunter eat a nearby prey and gain energy', () => {
    const world = setupHunt(50)

    applyEating(world, 0.1)

    expect(world.count).toBe(1)
    expect(world.fed[0]).toBeCloseTo(50 + HUNTER_KILL_FED)
  })

  it('caps the energy gained at the maximum', () => {
    const world = setupHunt(90)

    applyEating(world, 0.1)

    expect(world.fed[0]).toBe(100)
  })
})

describe('stamina', () => {
  const setupChase = (): ReturnType<typeof createWorld> => {
    const world = createWorld(2, 13)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 150
    world.y[1] = 100
    world.fed[0] = 50
    return world
  }

  it('drains while sprinting', () => {
    const world = setupChase()
    world.stamina[0] = 5

    updateBehavior(world, 1 / 60)
    updateStamina(world, 1 / 60)

    expect(world.stamina[0]).toBeCloseTo(5 - STAMINA.drainPerSecond / 60)
  })

  it('recharges while resting', () => {
    const world = createWorld(2, 13)
    world.fed[0] = 100
    world.stamina[0] = 0

    updateBehavior(world, 1 / 60)
    updateStamina(world, 1 / 60)

    expect(world.stamina[0]).toBeCloseTo(STAMINA.recoverPerSecond / 60)
  })

  it('cannot sprint at zero stamina', () => {
    const world = setupChase()
    world.stamina[0] = 0
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, 1 / 60)

    expect(steering.sprint).toBe(false)
  })
})
