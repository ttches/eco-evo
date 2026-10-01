import { describe, expect, it } from 'vitest'
import { parseSeed, resolveInitialSeed } from '@/sim/seed'

describe('parseSeed', () => {
  it('reads a non-negative decimal integer', () => {
    expect(parseSeed('?seed=42')).toBe(42)
    expect(parseSeed('?foo=1&seed=123456')).toBe(123456)
  })

  it('accepts the uint32 boundaries and leading zeros', () => {
    expect(parseSeed('?seed=0')).toBe(0)
    expect(parseSeed('?seed=007')).toBe(7)
    expect(parseSeed('?seed=4294967295')).toBe(4294967295)
  })

  it('rejects missing or malformed values', () => {
    expect(parseSeed('')).toBeNull()
    expect(parseSeed('?other=1')).toBeNull()
    expect(parseSeed('?seed=')).toBeNull()
    expect(parseSeed('?seed=abc')).toBeNull()
    expect(parseSeed('?seed=-1')).toBeNull()
    expect(parseSeed('?seed=1.5')).toBeNull()
    expect(parseSeed('?seed=%2042')).toBeNull()
  })

  it('rejects values outside the uint32 range', () => {
    expect(parseSeed('?seed=4294967296')).toBeNull()
    expect(parseSeed('?seed=999999999999999999999')).toBeNull()
  })
})

describe('resolveInitialSeed', () => {
  it('prefers an explicit seed from the URL', () => {
    expect(resolveInitialSeed('?seed=7', () => 99)).toBe(7)
  })

  it('falls back to a random draw when no valid seed is given', () => {
    expect(resolveInitialSeed('', () => 12345)).toBe(12345)
    expect(resolveInitialSeed('?seed=abc', () => 12345)).toBe(12345)
  })

  it('nudges zero away from the fixed default, explicit or random', () => {
    expect(resolveInitialSeed('?seed=0', () => 99)).toBe(1)
    expect(resolveInitialSeed('', () => 0)).toBe(1)
  })
})
