import { describe, expect, it } from 'vitest'
import { clamp, lerp, XorShift32 } from '@/engine/math'

describe('XorShift32', () => {
  it('is deterministic for a given seed', () => {
    const first = new XorShift32(123)
    const second = new XorShift32(123)

    const firstSequence = Array.from({ length: 8 }, () => first.nextUint32())
    const secondSequence = Array.from({ length: 8 }, () => second.nextUint32())

    expect(firstSequence).toEqual(secondSequence)
  })

  it('produces units within [0, 1)', () => {
    const random = new XorShift32()
    for (let index = 0; index < 1000; index += 1) {
      const unit = random.unit()
      expect(unit).toBeGreaterThanOrEqual(0)
      expect(unit).toBeLessThan(1)
    }
  })

  it('respects range bounds', () => {
    const random = new XorShift32()
    for (let index = 0; index < 1000; index += 1) {
      const value = random.range(-5, 12)
      expect(value).toBeGreaterThanOrEqual(-5)
      expect(value).toBeLessThan(12)
    }
  })
})

describe('clamp', () => {
  it('limits values to the inclusive bounds', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(4, 0, 10)).toBe(4)
    expect(clamp(42, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('interpolates between two values', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(0, 10, 1)).toBe(10)
  })
})
