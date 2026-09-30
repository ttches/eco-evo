import { describe, expect, it } from 'vitest'
import { formatElapsed } from './formatElapsed'

describe('formatElapsed', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(60)).toBe('01:00')
    expect(formatElapsed(75.9)).toBe('01:15')
    expect(formatElapsed(3599)).toBe('59:59')
  })

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatElapsed(3600)).toBe('1:00:00')
    expect(formatElapsed(3661)).toBe('1:01:01')
    expect(formatElapsed(360000)).toBe('100:00:00')
  })

  it('clamps negative values to zero', () => {
    expect(formatElapsed(-5)).toBe('00:00')
  })
})
