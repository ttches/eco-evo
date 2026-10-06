import { describe, expect, it } from 'vitest'
import { glorpColor } from '@/render/appearance'
import {
  CORPSE_COLORS,
  CORPSE_MIN_SCALE,
  CORPSE_SHADE,
  corpseColor,
  corpseDeflate,
} from '@/render/corpse-look'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'

const TYPES: readonly GlorpType[] = [GLORP_TYPE.prey, GLORP_TYPE.hunter]

describe('corpseColor', () => {
  it('is darker than the max-hunger live color', () => {
    for (const type of TYPES) {
      const live = glorpColor(type, 0, false)
      const corpse = corpseColor(type)
      for (let channel = 0; channel < 3; channel += 1) {
        expect(corpse[channel]).toBeLessThan(live[channel])
        expect(corpse[channel]).toBeCloseTo(live[channel] * CORPSE_SHADE)
      }
    }
  })

  it('caches one color per type', () => {
    for (const type of TYPES) {
      expect(CORPSE_COLORS[type]).toEqual(corpseColor(type))
    }
  })
})

describe('corpseDeflate', () => {
  it('starts full and ends at the minimum', () => {
    expect(corpseDeflate(3, 3)).toBeCloseTo(1)
    expect(corpseDeflate(0, 3)).toBeCloseTo(CORPSE_MIN_SCALE)
  })

  it('shrinks monotonically as it ages', () => {
    const scales = [3, 2, 1, 0.5, 0].map((remaining) =>
      corpseDeflate(remaining, 3),
    )
    for (let index = 1; index < scales.length; index += 1) {
      expect(scales[index]).toBeLessThan(scales[index - 1])
    }
  })

  it('clamps out-of-range remaining', () => {
    expect(corpseDeflate(10, 3)).toBeCloseTo(1)
    expect(corpseDeflate(-1, 3)).toBeCloseTo(CORPSE_MIN_SCALE)
  })

  it('handles a zero lifetime', () => {
    expect(corpseDeflate(1, 0)).toBe(CORPSE_MIN_SCALE)
  })
})
