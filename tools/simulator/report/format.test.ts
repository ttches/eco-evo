import { describe, expect, it } from 'vitest'
import { flagLines, num, pct, signed, signedPct, table } from './format.ts'

describe('number formatting', () => {
  it('renders missing or non-finite values as n/a', () => {
    for (const fn of [num, pct, signed, signedPct]) {
      expect(fn(null)).toBe('n/a')
      expect(fn(undefined)).toBe('n/a')
      expect(fn(Number.NaN)).toBe('n/a')
    }
  })

  it('formats values with sign and unit', () => {
    expect(num(1.236)).toBe('1.24')
    expect(pct(0.256)).toBe('26%')
    expect(signed(2)).toBe('+2.00')
    expect(signed(-2)).toBe('-2.00')
    expect(signedPct(-0.5)).toBe('-50%')
  })
})

describe('table', () => {
  it('pads columns and right-aligns numeric ones', () => {
    const text = table(['name', 'n'], [['alpha', '5'], ['b', '120']])
    const lines = text.split('\n')
    expect(lines[0]).toBe('| name  |   n |')
    expect(lines[2]).toBe('| alpha |   5 |')
    expect(lines[3]).toBe('| b     | 120 |')
    expect(new Set(lines.map((line) => line.length)).size).toBe(1)
  })
})

describe('flagLines', () => {
  it('prefixes severity icons and handles the empty case', () => {
    expect(flagLines([])).toBe('- none')
    expect(flagLines([{ level: 'crash', code: 'x', message: 'boom' }])).toBe('- ✖ boom')
  })
})
