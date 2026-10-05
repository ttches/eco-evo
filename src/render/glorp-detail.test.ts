import { describe, expect, it } from 'vitest'
import {
  GLORP_OUTLINE_PIXELS,
  GLORP_SILHOUETTE_GLSL,
  detailBodyMetrics,
  detailSpriteMetrics,
  glorpShapeRadius,
  glorpWobble,
  outlineWidth,
  pixelSize,
} from '@/render/glorp-detail'
import { DETAIL_SPRITE_ZOOM } from '@/render/lod'

describe('outlineWidth', () => {
  it('keeps the outline a constant width on screen', () => {
    const radius = 12
    for (const zoom of [0.35, 0.5, 1, 4]) {
      expect(outlineWidth(radius, zoom) * radius * zoom).toBeCloseTo(
        GLORP_OUTLINE_PIXELS,
      )
    }
  })

  it('clamps when the outline would cover the whole glorp', () => {
    expect(outlineWidth(12, 0.35, 100)).toBe(1)
  })

  it('is zero for a glorp with no screen size', () => {
    expect(outlineWidth(0, 1)).toBe(0)
    expect(outlineWidth(12, 0)).toBe(0)
  })
})

describe('pixelSize', () => {
  it('is one render pixel in local units', () => {
    expect(pixelSize(12, 1)).toBeCloseTo(1 / 12)
    expect(pixelSize(12, 4)).toBeCloseTo(1 / 48)
  })

  it('is zero for a glorp with no screen size', () => {
    expect(pixelSize(0, 1)).toBe(0)
    expect(pixelSize(12, 0)).toBe(0)
  })
})

describe('detailBodyMetrics', () => {
  it('scales the snap grid and outline with the camera zoom', () => {
    const zoom = 4
    const metrics = detailBodyMetrics(12, zoom)
    expect(metrics.pixel).toBeCloseTo(pixelSize(12, zoom))
    expect(metrics.outline).toBeCloseTo(outlineWidth(12, zoom))
    expect(metrics.pixel).toBeCloseTo(1 / 48)
  })
})

describe('detailSpriteMetrics', () => {
  it('derives the fixed flare grid and disc from the sprite zoom', () => {
    const spriteZoom = DETAIL_SPRITE_ZOOM
    const metrics = detailSpriteMetrics(12, spriteZoom)
    expect(metrics.pixel).toBeCloseTo(pixelSize(12, spriteZoom))
    expect(metrics.shapeRadius).toBeCloseTo(glorpShapeRadius(12, spriteZoom))
  })
})

describe('glorpWobble', () => {
  it('matches the shared silhouette harmonics', () => {
    expect(glorpWobble(0, 0)).toBeCloseTo(0)
    expect(glorpWobble(Math.PI / 2, 0)).toBeCloseTo(-0.2)
  })

  it('never strays past the summed harmonic weights', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      for (const seed of [0, 1.7, 3.3]) {
        expect(Math.abs(glorpWobble(angle, seed))).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('GLORP_SILHOUETTE_GLSL', () => {
  it('generates its wobble from the shared harmonics', () => {
    expect(GLORP_SILHOUETTE_GLSL).toContain('sin(angle * 3.0 + seed) * 0.6')
    expect(GLORP_SILHOUETTE_GLSL).toContain(
      'sin(angle * 5.0 + seed * (-1.3)) * 0.4',
    )
  })
})
