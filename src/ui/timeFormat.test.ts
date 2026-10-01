import { describe, expect, it } from 'vitest'
import { formatDuration } from './timeFormat'

describe('formatDuration', () => {
  it('drops empty leading units', () => {
    expect(formatDuration(59)).toBe(':59')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('pads lower units once a higher one shows', () => {
    expect(formatDuration(61)).toBe('1:01')
    expect(formatDuration(3599)).toBe('59:59')
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('rounds to whole seconds and clamps negatives', () => {
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(0.4)).toBe(':00')
    expect(formatDuration(-5)).toBe(':00')
  })
})
