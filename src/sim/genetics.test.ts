import { describe, expect, it } from 'vitest'
import { XorShift32 } from '@/engine/math'
import {
  DIRECTIVE_FLIP_CHANCE,
  INHERIT_BEST_CHANCE,
  MUTATION_BIAS,
  MUTATION_RATE,
} from '@/sim/config'
import {
  inheritTrait,
  mixDirective,
  mutateDirective,
  mutateTrait,
  prefersHigher,
  rollDirective,
} from '@/sim/genetics'
import { TRAIT_BIT, TRAIT_KEYS, TRAITS } from '@/sim/traits'

const popcount = (value: number): number => {
  let count = 0
  let bits = value
  while (bits) {
    count += bits & 1
    bits >>>= 1
  }
  return count
}

describe('prefersHigher', () => {
  it('reads a single trait bit out of a directive mask', () => {
    const directive = TRAIT_BIT.speed | TRAIT_BIT.metabolism
    expect(prefersHigher(directive, TRAIT_BIT.speed)).toBe(true)
    expect(prefersHigher(directive, TRAIT_BIT.metabolism)).toBe(true)
    expect(prefersHigher(directive, TRAIT_BIT.staminaMax)).toBe(false)
  })
})

describe('inheritTrait', () => {
  it('selects the favorable parent about INHERIT_BEST_CHANCE of the time', () => {
    const random = new XorShift32(123)
    let better = 0
    const samples = 4000
    for (let i = 0; i < samples; i += 1) {
      if (inheritTrait(random, 40, 60, true) === 60) better += 1
    }
    const ratio = better / samples
    expect(ratio).toBeGreaterThan(INHERIT_BEST_CHANCE - 0.05)
    expect(ratio).toBeLessThan(INHERIT_BEST_CHANCE + 0.05)
  })

  it('treats the lower value as favorable when higher is worse', () => {
    const random = new XorShift32(321)
    let lower = 0
    const samples = 4000
    for (let i = 0; i < samples; i += 1) {
      if (inheritTrait(random, 2, 4, false) === 2) lower += 1
    }
    const ratio = lower / samples
    expect(ratio).toBeGreaterThan(INHERIT_BEST_CHANCE - 0.05)
    expect(ratio).toBeLessThan(INHERIT_BEST_CHANCE + 0.05)
  })
})

describe('mutateTrait', () => {
  it('stays inside the configured range even against a bound', () => {
    const random = new XorShift32(7)
    for (let i = 0; i < 500; i += 1) {
      const up = mutateTrait(
        random,
        TRAITS.speed.max,
        TRAITS.speed.min,
        TRAITS.speed.max,
        true,
      )
      const down = mutateTrait(
        random,
        TRAITS.speed.min,
        TRAITS.speed.min,
        TRAITS.speed.max,
        false,
      )
      expect(up).toBeLessThanOrEqual(TRAITS.speed.max)
      expect(up).toBeGreaterThanOrEqual(TRAITS.speed.min)
      expect(down).toBeGreaterThanOrEqual(TRAITS.speed.min)
      expect(down).toBeLessThanOrEqual(TRAITS.speed.max)
    }
  })

  it('never drifts further than the bias plus noise allows', () => {
    const random = new XorShift32(11)
    const value = 50
    for (let i = 0; i < 500; i += 1) {
      const next = mutateTrait(random, value, 0, 1000, true)
      expect(Math.abs(next - value) / value).toBeLessThanOrEqual(
        MUTATION_BIAS + MUTATION_RATE + 1e-9,
      )
    }
  })

  it('drifts upward when the directive prefers higher, downward otherwise', () => {
    const random = new XorShift32(99)
    const samples = 4000
    let up = 0
    let down = 0
    for (let i = 0; i < samples; i += 1) {
      up += mutateTrait(random, 50, 0, 1000, true)
      down += mutateTrait(random, 50, 0, 1000, false)
    }
    expect(up / samples).toBeGreaterThan(50)
    expect(down / samples).toBeLessThan(50)
  })
})

describe('mutateDirective', () => {
  it('flips each bit about DIRECTIVE_FLIP_CHANCE of the time', () => {
    const random = new XorShift32(2024)
    const samples = 20000
    let bits = 0
    for (let i = 0; i < samples; i += 1) {
      bits += popcount(mutateDirective(random, 0))
    }
    const ratio = bits / (samples * TRAIT_KEYS.length)
    expect(ratio).toBeGreaterThan(DIRECTIVE_FLIP_CHANCE - 0.02)
    expect(ratio).toBeLessThan(DIRECTIVE_FLIP_CHANCE + 0.02)
  })
})

describe('mixDirective', () => {
  it('recombines roughly half the bits from each parent', () => {
    const random = new XorShift32(555)
    const samples = 20000
    let bits = 0
    for (let i = 0; i < samples; i += 1) {
      bits += popcount(mixDirective(random, 0, (1 << TRAIT_KEYS.length) - 1))
    }
    const ratio = bits / (samples * TRAIT_KEYS.length)
    expect(ratio).toBeGreaterThan(0.42)
    expect(ratio).toBeLessThan(0.58)
  })
})

describe('rollDirective', () => {
  it('only ever sets known trait bits', () => {
    const random = new XorShift32(13)
    const valid = TRAIT_KEYS.reduce((mask, key) => mask | TRAIT_BIT[key], 0)
    for (let i = 0; i < 500; i += 1) {
      const directive = rollDirective(random)
      expect(directive & ~valid).toBe(0)
    }
  })
})
