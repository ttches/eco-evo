import { describe, expect, it } from 'vitest'
import { XorShift32 } from '@/engine/math'
import {
  CLONE_MUTATION_CHANCE,
  MATED_MUTATION_CHANCE,
  TRAIT_BUDGET,
} from '@/sim/config'
import {
  cloneLevels,
  crossLevels,
  rollLevels,
  transferPoint,
} from '@/sim/genetics'
import {
  TRAIT_BASE,
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  traitValue,
  type TraitLevels,
} from '@/sim/traits'

const total = (levels: TraitLevels): number =>
  TRAIT_KEYS.reduce((sum, key) => sum + levels[key], 0)

const uniform = (level: number): TraitLevels =>
  Object.fromEntries(TRAIT_KEYS.map((key) => [key, level])) as TraitLevels

const isValid = (levels: TraitLevels): boolean =>
  total(levels) === TRAIT_BUDGET &&
  TRAIT_KEYS.every(
    (key) =>
      Number.isInteger(levels[key]) &&
      levels[key] >= TRAIT_MIN &&
      levels[key] <= TRAIT_MAX,
  )

/** Number of traits whose level differs between two builds. */
const distance = (a: TraitLevels, b: TraitLevels): number =>
  TRAIT_KEYS.filter((key) => a[key] !== b[key]).length

describe('traitValue', () => {
  it('maps every trait so a higher level is better', () => {
    expect(traitValue('speed', TRAIT_MAX)).toBeGreaterThan(
      traitValue('speed', TRAIT_MIN),
    )
    expect(traitValue('fertility', TRAIT_MAX)).toBeLessThan(
      traitValue('fertility', TRAIT_MIN),
    )
  })

  it('hits the range endpoints and the midpoint', () => {
    expect(traitValue('speed', TRAIT_MIN)).toBe(30)
    expect(traitValue('speed', TRAIT_MAX)).toBe(70)
    expect(traitValue('speed', TRAIT_BASE)).toBe(50)
  })
})

describe('transferPoint', () => {
  it('conserves the budget and stays inside the scale', () => {
    const random = new XorShift32(7)
    const levels = uniform(TRAIT_BASE)
    for (let i = 0; i < 500; i += 1) {
      transferPoint(random, levels)
      expect(isValid(levels)).toBe(true)
    }
  })

  it('does nothing when no trait can give or receive', () => {
    const random = new XorShift32(1)
    const floor = uniform(TRAIT_MIN)
    transferPoint(random, floor)
    expect(floor).toEqual(uniform(TRAIT_MIN))
  })

  it('has no preferred trait: every trait gains and loses about equally', () => {
    const random = new XorShift32(31)
    const net = Object.fromEntries(TRAIT_KEYS.map((key) => [key, 0]))
    const samples = 20000
    for (let i = 0; i < samples; i += 1) {
      const before = uniform(TRAIT_BASE)
      const after = { ...before }
      transferPoint(random, after)
      for (const key of TRAIT_KEYS) net[key] += after[key] - before[key]
    }
    for (const key of TRAIT_KEYS) {
      expect(Math.abs(net[key]) / samples).toBeLessThan(0.03)
    }
  })
})

describe('rollLevels', () => {
  it('always lands on the budget inside the scale, and varies', () => {
    const random = new XorShift32(13)
    const seen = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      const levels = rollLevels(random)
      expect(isValid(levels)).toBe(true)
      seen.add(TRAIT_KEYS.map((key) => levels[key]).join())
    }
    expect(seen.size).toBeGreaterThan(50)
  })
})

describe('cloneLevels', () => {
  it('moves one point about CLONE_MUTATION_CHANCE of the time', () => {
    const random = new XorShift32(99)
    const parent = uniform(TRAIT_BASE)
    const samples = 6000
    let changed = 0
    for (let i = 0; i < samples; i += 1) {
      const child = cloneLevels(random, parent)
      expect(isValid(child)).toBe(true)
      expect(distance(parent, child)).toBeLessThanOrEqual(2)
      if (distance(parent, child) > 0) changed += 1
    }
    expect(changed / samples).toBeGreaterThan(CLONE_MUTATION_CHANCE - 0.04)
    expect(changed / samples).toBeLessThan(CLONE_MUTATION_CHANCE + 0.04)
  })
})

describe('crossLevels', () => {
  it('always repairs back to the budget', () => {
    const random = new XorShift32(555)
    for (let i = 0; i < 1000; i += 1) {
      const a = rollLevels(random)
      const b = rollLevels(random)
      expect(isValid(crossLevels(random, a, b))).toBe(true)
    }
  })

  it('varies more from its parents than a clone does', () => {
    const random = new XorShift32(2024)
    const samples = 4000
    let cloneSpread = 0
    let crossSpread = 0
    for (let i = 0; i < samples; i += 1) {
      const a = rollLevels(random)
      const b = rollLevels(random)
      cloneSpread += distance(a, cloneLevels(random, a))
      crossSpread += Math.min(
        distance(a, crossLevels(random, a, b)),
        distance(b, crossLevels(random, a, b)),
      )
    }
    expect(MATED_MUTATION_CHANCE).toBeGreaterThan(CLONE_MUTATION_CHANCE)
    expect(crossSpread).toBeGreaterThan(cloneSpread)
  })

  it('inherits identical parents unchanged when no mutation fires', () => {
    const random = new XorShift32(5)
    const parent = rollLevels(random)
    let unchanged = 0
    for (let i = 0; i < 400; i += 1) {
      if (distance(parent, crossLevels(random, parent, parent)) === 0) {
        unchanged += 1
      }
    }
    expect(unchanged).toBeGreaterThan(400 * (1 - MATED_MUTATION_CHANCE) - 60)
  })
})
