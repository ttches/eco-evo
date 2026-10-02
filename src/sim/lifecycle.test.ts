import { describe, expect, it } from 'vitest'
import { computeSteering, updateBehavior } from '@/sim/behavior'
import {
  GESTATION_SECONDS,
  GLORP_RADIUS,
  HUNTER_KILL_FED,
  MATE_FED_MIN,
  MATE_RANGE,
  MAX_GLORPS,
  METABOLISM,
  OFFSPRING_FED,
  STAMINA,
  TRAIT_BUDGET,
} from '@/sim/config'
import { applyDeath, applyMetabolism } from '@/sim/lifecycle'
import { applyEating } from '@/sim/predation'
import { readLineage } from '@/sim/lineage'
import { updateStamina } from '@/sim/motion'
import { rebuildSpatialGrid } from '@/sim/spatial'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
  tickCooldowns,
} from '@/sim/reproduction'
import {
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  traitValue,
} from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

/** Sum of a glorp's trait levels. */
const levelTotal = (world: ReturnType<typeof createWorld>, index: number) =>
  TRAIT_KEYS.reduce((sum, key) => sum + world[key][index], 0)

describe('applyMetabolism', () => {
  it('drains fed by the fixed metabolism', () => {
    const world = createWorld(4, 5)
    const before = world.fed[0]
    applyMetabolism(world, 1)
    expect(world.fed[0]).toBeCloseTo(before - METABOLISM)
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
  it('spawns an offspring that keeps the parent budget', () => {
    const world = createWorld(2, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0
    const type = world.type[0]
    const x = world.x[0]
    const y = world.y[0]
    const parentSeed = world.wanderSeed[0]

    applyReproduction(world)

    expect(world.count).toBe(3)
    expect(world.fed[0]).toBe(100)
    expect(world.cooldown[0]).toBeCloseTo(
      traitValue('fertility', world.fertility[0]),
    )
    expect(world.fed[2]).toBe(50)
    expect(world.type[2]).toBe(type)
    expect(world.stamina[2]).toBeCloseTo(
      traitValue('staminaMax', world.staminaMax[2]),
    )
    expect(world.cooldown[2]).toBeCloseTo(
      traitValue('fertility', world.fertility[2]),
    )

    // A clone moves at most one point, so it stays within two traits of its parent.
    expect(levelTotal(world, 2)).toBe(TRAIT_BUDGET)
    const changed = TRAIT_KEYS.filter((key) => world[key][2] !== world[key][0])
    expect(changed.length).toBeLessThanOrEqual(2)

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
  /** Two distinct, in-budget builds so a child's blend is observable. */
  const setParentLevels = (world: ReturnType<typeof createWorld>): void => {
    const a = { speed: 6, staminaMax: 2, fertility: 3, strength: 5, agility: 4 }
    const b = { speed: 2, staminaMax: 6, fertility: 5, strength: 3, agility: 4 }
    for (const key of TRAIT_KEYS) {
      world[key][0] = a[key]
      world[key][1] = b[key]
    }
  }

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
    setParentLevels(world)
    return world
  }

  it('conceives without spawning, then births at term', () => {
    const world = setupPair()

    applyPairReproduction(world)

    // Conception leaves only a pregnancy behind: no child is allocated.
    expect(world.count).toBe(2)
    const mother = world.pregnant[0] > 0 ? 0 : 1
    const father = mother === 0 ? 1 : 0
    expect(world.pregnant[mother]).toBeCloseTo(GESTATION_SECONDS)
    expect(world.gestationFather[mother]).toBe(world.id[father])
    expect(world.cooldown[0]).toBeCloseTo(traitValue('fertility', 3))
    expect(world.cooldown[1]).toBeCloseTo(traitValue('fertility', 5))

    applyGestation(world, GESTATION_SECONDS)

    expect(world.count).toBe(3)
    expect(world.pregnant[mother]).toBe(0)
    expect(world.type[2]).toBe(GLORP_TYPE.hunter)
    expect(world.fed[2]).toBe(OFFSPRING_FED)
    expect(world.stamina[2]).toBeCloseTo(
      traitValue('staminaMax', world.staminaMax[2]),
    )
    expect(world.cooldown[2]).toBeCloseTo(
      traitValue('fertility', world.fertility[2]),
    )
    expect(levelTotal(world, 2)).toBe(TRAIT_BUDGET)
    for (const key of TRAIT_KEYS) {
      expect(world[key][2]).toBeGreaterThanOrEqual(TRAIT_MIN)
      expect(world[key][2]).toBeLessThanOrEqual(TRAIT_MAX)
    }
  })

  it('loses the pregnancy if the mother is gone before term', () => {
    const world = setupPair()
    applyPairReproduction(world)
    const mother = world.pregnant[0] > 0 ? 0 : 1

    // Models a mother removed before the gestation tick (e.g. eaten); note that
    // in `step` gestation runs before starvation death, so a starved mother
    // would actually give birth first.
    world.fed[mother] = 0
    applyDeath(world)
    applyGestation(world, GESTATION_SECONDS)

    // Only the surviving parent remains; no orphan is born.
    expect(world.count).toBe(1)
  })

  it('keeps using a dead father\u2019s genes at birth', () => {
    const world = setupPair()
    applyPairReproduction(world)
    const mother = world.pregnant[0] > 0 ? 0 : 1
    const father = mother === 0 ? 1 : 0
    const motherId = world.id[mother]
    const fatherId = world.id[father]

    world.fed[father] = 0
    applyDeath(world)
    applyGestation(world, GESTATION_SECONDS)

    expect(world.count).toBe(2)
    const child = readLineage(world.lineage, world.id[1])
    expect([child?.parentA, child?.parentB]).toEqual([motherId, fatherId])
    expect(child?.generation).toBe(1)
  })

  it('blends both parents and holds the budget across many matings', () => {
    const world = setupPair()
    const samples = 600
    let speed = 0
    for (let i = 0; i < samples; i += 1) {
      world.count = 2
      world.fed[0] = 100
      world.fed[1] = 100
      world.cooldown[0] = 0
      world.cooldown[1] = 0
      world.pregnant[0] = 0
      world.pregnant[1] = 0
      setParentLevels(world)
      // Deferred birth reads the father's immutable lineage record, so mirror
      // the values we just set onto the records for parents 0 and 1.
      for (const key of TRAIT_KEYS) {
        world.lineage.traits[key][0] = world[key][0]
        world.lineage.traits[key][1] = world[key][1]
      }

      applyPairReproduction(world)
      applyGestation(world, GESTATION_SECONDS)

      expect(levelTotal(world, 2)).toBe(TRAIT_BUDGET)
      speed += world.speed[2]
    }

    // Parents hold speed 6 and 2, so children average near 4 with no pull
    // toward either.
    expect(speed / samples).toBeGreaterThan(3.6)
    expect(speed / samples).toBeLessThan(4.4)
  })

  it('does not mate out of range, on cooldown, or while hungry', () => {
    const far = setupPair()
    far.x[1] = 100 + MATE_RANGE * 2
    applyPairReproduction(far)
    expect(far.count).toBe(2)
    expect(far.pregnant[0]).toBe(0)
    expect(far.pregnant[1]).toBe(0)

    const cooling = setupPair()
    cooling.cooldown[1] = 5
    applyPairReproduction(cooling)
    expect(cooling.count).toBe(2)

    const hungry = setupPair()
    hungry.fed[1] = MATE_FED_MIN
    applyPairReproduction(hungry)
    expect(hungry.count).toBe(2)
    expect(hungry.pregnant[0]).toBe(0)
    expect(hungry.pregnant[1]).toBe(0)
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
    applyGestation(world, GESTATION_SECONDS)

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
    world.strength[0] = 6
    world.strength[1] = 3
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
    world.staminaMax[0] = 4 // mechanical value 5 === STAMINA.referenceMax

    updateBehavior(world, 1 / 60)
    updateStamina(world, 1 / 60)

    expect(world.stamina[0]).toBeCloseTo(STAMINA.recoverPerSecond / 60)
  })

  it('recovers faster with more stamina and slower with less', () => {
    const world = createWorld(2, 13)
    world.fed[0] = 100
    world.fed[1] = 100
    world.stamina[0] = 0
    world.stamina[1] = 0
    world.staminaMax[0] = 1 // mechanical value 2
    world.staminaMax[1] = 7 // mechanical value 8

    updateBehavior(world, 1 / 60)
    updateStamina(world, 1 / 60)

    expect(world.stamina[0]).toBeCloseTo(
      (STAMINA.recoverPerSecond *
        (traitValue('staminaMax', world.staminaMax[0]) / STAMINA.referenceMax)) /
        60,
    )
    expect(world.stamina[1]).toBeCloseTo(
      (STAMINA.recoverPerSecond *
        (traitValue('staminaMax', world.staminaMax[1]) / STAMINA.referenceMax)) /
        60,
    )
  })

  it('cannot sprint at zero stamina', () => {
    const world = setupChase()
    world.stamina[0] = 0
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, 1 / 60)

    expect(steering.sprint).toBe(false)
  })

  it('does not flicker between sprint and walk at low stamina', () => {
    const world = setupChase()
    world.strength[0] = 6
    world.strength[1] = 3
    world.stamina[0] = 1
    world.stamina[1] = 1
    const before = world.sprintStarts

    for (let step = 0; step < 600; step += 1) {
      updateBehavior(world, 1 / 60)
      updateStamina(world, 1 / 60)
    }

    const starts = world.sprintStarts - before
    expect(starts).toBeGreaterThan(0)
    expect(starts).toBeLessThanOrEqual(8)
  })

  it('latches into exhaustion when stamina empties', () => {
    const world = setupChase()
    world.stamina[0] = STAMINA.drainPerSecond / 120
    world.sprinting[0] = 1

    updateStamina(world, 1 / 60)

    expect(world.stamina[0]).toBe(0)
    expect(world.exhausted[0]).toBe(1)
  })

  it('stays exhausted until stamina recovers to the ready fraction', () => {
    const world = setupChase()
    world.exhausted[0] = 1
    const staminaMax = traitValue('staminaMax', world.staminaMax[0])
    world.stamina[0] = staminaMax * STAMINA.sprintReadyFraction - 0.01
    rebuildSpatialGrid(world)

    expect(computeSteering(world, 0, 1 / 60).sprint).toBe(false)

    world.stamina[0] = staminaMax * STAMINA.sprintReadyFraction
    updateStamina(world, 0)
    expect(world.exhausted[0]).toBe(0)
    expect(computeSteering(world, 0, 1 / 60).sprint).toBe(true)
  })
})
