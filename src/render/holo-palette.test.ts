import { describe, expect, it } from 'vitest'
import {
  PREDATOR_HUE_FROM,
  PREDATOR_HUE_TO,
  PREY_HUE_FROM,
  PREY_HUE_TO,
  accentHue,
  flareHue,
  hueInWindow,
  typeHue,
} from '@/render/holo-palette'

describe('typeHue', () => {
  it('keeps prey sheens between yellow and blue', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      expect(hueInWindow(typeHue(t, false), false)).toBe(true)
    }
    expect(typeHue(0, false)).toBeCloseTo(PREY_HUE_FROM, 5)
    expect(typeHue(1, false)).toBeCloseTo(PREY_HUE_TO, 5)
  })

  it('keeps predator sheens between orange and purple', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      expect(hueInWindow(typeHue(t, true), true)).toBe(true)
    }
    expect(typeHue(0, true)).toBeCloseTo(PREDATOR_HUE_FROM, 5)
    expect(typeHue(1, true)).toBeCloseTo(PREDATOR_HUE_TO - 1, 5)
  })
})

describe('accentHue', () => {
  it('lands in the opposite arc, for rare flares', () => {
    expect(hueInWindow(accentHue(0.5, false), false)).toBe(false)
    expect(hueInWindow(accentHue(0.5, true), true)).toBe(false)
  })
})

describe('hueInWindow', () => {
  it('admits in-window hues and rejects the opposite arc', () => {
    expect(hueInWindow(0.2, false)).toBe(true) // green, in prey
    expect(hueInWindow(0.05, false)).toBe(false) // orange, outside prey
    expect(hueInWindow(0.05, true)).toBe(true) // orange, in predator
    expect(hueInWindow(0.5, true)).toBe(false) // cyan, outside predator
  })
})

describe('flareHue', () => {
  it('accepts any hue, including out-of-window accents', () => {
    expect(flareHue(0.78)).toBeCloseTo(0.78, 5) // violet, free accent
    expect(flareHue(1.2)).toBeCloseTo(0.2, 5)
    expect(flareHue(-0.1)).toBeCloseTo(0.9, 5)
  })
})
