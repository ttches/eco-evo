import { describe, expect, it } from 'vitest'
import { XorShift32 } from '@/engine/math'
import {
  METABOLISM,
  MUTATION_BIRTH_CHANCE,
  MUTATION_INHERIT_CHANCE,
} from '@/sim/config'
import { applyMetabolism } from '@/sim/lifecycle'
import { readLineage } from '@/sim/lineage'
import {
  MUTATIONS,
  MUTATION_KEYS,
  MUTATION_MASK_ALL,
  countMutations,
  hasMutation,
  inheritMutations,
  mutationDrainMultiplier,
  mutationKeys,
  mutationSpeedFactor,
  rollBirthMutations,
  rollSpawnMutations,
} from '@/sim/mutations'
import { applyReproduction } from '@/sim/reproduction'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { TRAIT_MIN } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { computeSteering } from '@/sim/behavior'
import { createWorld, step } from '@/sim/world'

const COLD = MUTATIONS.coldBlooded.bit

describe('mutation registry', () => {
  it('gives every mutation a unique power-of-two bit', () => {
    const bits = MUTATION_KEYS.map((key) => MUTATIONS[key].bit)
    expect(new Set(bits).size).toBe(bits.length)
    for (const bit of bits) expect(bit & (bit - 1)).toBe(0)
    expect(MUTATION_MASK_ALL).toBe(bits.reduce((mask, bit) => mask | bit, 0))
  })

  it('reads membership, count, and decoded keys from a mask', () => {
    expect(hasMutation(0, COLD)).toBe(false)
    expect(hasMutation(COLD, COLD)).toBe(true)
    expect(countMutations(0)).toBe(0)
    expect(countMutations(COLD)).toBe(1)
    expect(mutationKeys(COLD)).toEqual(['coldBlooded'])
    expect(mutationKeys(0)).toEqual([])
  })
})

describe('inheritMutations', () => {
  it('inherits a carried mutation near MUTATION_INHERIT_CHANCE of the time', () => {
    const random = new XorShift32(1234)
    const samples = 20000
    let inherited = 0
    for (let i = 0; i < samples; i += 1) {
      if (inheritMutations(random, [COLD]) !== 0) inherited += 1
    }
    expect(inherited / samples).toBeGreaterThan(MUTATION_INHERIT_CHANCE - 0.02)
    expect(inherited / samples).toBeLessThan(MUTATION_INHERIT_CHANCE + 0.02)
  })

  it('rolls once for a mutation both parents carry, not once per parent', () => {
    const random = new XorShift32(4321)
    const samples = 20000
    let inherited = 0
    for (let i = 0; i < samples; i += 1) {
      if (inheritMutations(random, [COLD, COLD]) !== 0) inherited += 1
    }
    expect(inherited / samples).toBeLessThan(MUTATION_INHERIT_CHANCE + 0.02)
  })

  it('never inherits a mutation no parent carries', () => {
    const random = new XorShift32(7)
    for (let i = 0; i < 5000; i += 1) {
      expect(inheritMutations(random, [0, 0])).toBe(0)
    }
  })
})

describe('rollBirthMutations', () => {
  it('grants a spontaneous mutation near MUTATION_BIRTH_CHANCE with no parents', () => {
    const random = new XorShift32(55)
    const samples = 100000
    let mutated = 0
    for (let i = 0; i < samples; i += 1) {
      if (rollBirthMutations(random, [0, 0]) !== 0) mutated += 1
    }
    expect(mutated / samples).toBeGreaterThan(MUTATION_BIRTH_CHANCE - 0.005)
    expect(mutated / samples).toBeLessThan(MUTATION_BIRTH_CHANCE + 0.005)
  })

  it('stays within the known mutation mask', () => {
    const random = new XorShift32(99)
    for (let i = 0; i < 20000; i += 1) {
      const mask = rollBirthMutations(random, [COLD])
      expect(mask & ~MUTATION_MASK_ALL).toBe(0)
      expect(countMutations(mask)).toBeLessThanOrEqual(MUTATION_KEYS.length)
    }
  })

  it('is deterministic for a given seed', () => {
    const masks = (seed: number): number[] => {
      const random = new XorShift32(seed)
      return Array.from({ length: 50 }, () => rollBirthMutations(random, [COLD]))
    }
    expect(masks(2024)).toEqual(masks(2024))
  })

  it('rollSpawnMutations matches the same spontaneous chance', () => {
    const random = new XorShift32(808)
    const samples = 100000
    let mutated = 0
    for (let i = 0; i < samples; i += 1) {
      if (rollSpawnMutations(random) !== 0) mutated += 1
    }
    expect(mutated / samples).toBeGreaterThan(MUTATION_BIRTH_CHANCE - 0.005)
    expect(mutated / samples).toBeLessThan(MUTATION_BIRTH_CHANCE + 0.005)
  })
})

describe('mutation effects', () => {
  it('maps cold blooded to its hunger and speed modifiers, and others to 1', () => {
    expect(mutationDrainMultiplier(COLD)).toBe(0.5)
    expect(mutationDrainMultiplier(0)).toBe(1)
    expect(mutationSpeedFactor(COLD)).toBe(0.7)
    expect(mutationSpeedFactor(0)).toBe(1)
  })
})

describe('cold blooded in the simulation', () => {
  it('drains hunger at half the rate of an unmutated glorp', () => {
    const world = createWorld(2, 5)
    world.mutations.fill(0)
    world.endurance[0] = TRAIT_MIN
    world.endurance[1] = TRAIT_MIN
    world.mutations[0] = COLD

    applyMetabolism(world, 1)

    // Both start at the same fed; the cold-blooded glorp burns half as much,
    // so the gap between them is exactly the energy it saved.
    expect(world.fed[0] - world.fed[1]).toBeCloseTo(METABOLISM * 0.5)
  })

  it('makes the speed trait 30% less effective when fleeing', () => {
    const setup = (): ReturnType<typeof createWorld> => {
      const world = createWorld(2, 13)
      world.mutations.fill(0)
      world.type[0] = GLORP_TYPE.prey
      world.type[1] = GLORP_TYPE.hunter
      world.x[0] = 100
      world.y[0] = 100
      world.x[1] = 150
      world.y[1] = 100
      world.endurance[0] = 3
      world.speed[0] = 6
      world.stamina[0] = 0 // jog, so the speed trait (not sprint) sets the pace
      rebuildSpatialGrid(world)
      return world
    }

    const control = setup()
    const normal = Math.hypot(
      computeSteering(control, 0, 1 / 60).x,
      computeSteering(control, 0, 1 / 60).y,
    )

    const mutated = setup()
    mutated.mutations[0] = COLD
    const slowed = Math.hypot(
      computeSteering(mutated, 0, 1 / 60).x,
      computeSteering(mutated, 0, 1 / 60).y,
    )

    expect(normal).toBeGreaterThan(0)
    expect(slowed / normal).toBeCloseTo(0.7, 5)
  })

  it('records a newborn clone\u2019s mutations in the lineage log', () => {
    const world = createWorld(1, 9)
    world.mutations[0] = COLD
    world.fed[0] = 100
    world.cooldown[0] = 0

    applyReproduction(world)

    expect(world.count).toBe(2)
    const child = readLineage(world.lineage, world.id[1])
    expect(child?.mutations).toBe(world.mutations[1])
    expect(world.mutations[1] & ~MUTATION_MASK_ALL).toBe(0)
  })
})

describe('mutations over a running world', () => {
  it('keeps every live and logged mask within the known bits', () => {
    const world = createWorld(200, 42)
    for (let i = 0; i < 600; i += 1) step(world, 1 / 60)

    for (let index = 0; index < world.count; index += 1) {
      expect(world.mutations[index] & ~MUTATION_MASK_ALL).toBe(0)
      expect(countMutations(world.mutations[index])).toBeLessThanOrEqual(7)
    }
    for (let id = 0; id < world.lineage.size; id += 1) {
      expect(world.lineage.mutations[id] & ~MUTATION_MASK_ALL).toBe(0)
    }
  })
})
