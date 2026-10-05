import { describe, expect, it } from 'vitest'
import {
  GLORP_OUTLINE_PIXELS,
  detailSpriteMetrics,
  glorpShapeRadius,
  outlineWidth,
  pixelSize,
} from '@/render/glorp-detail'
import { DETAIL_SPRITE_ZOOM } from '@/render/lod'

describe('outlineWidth', () => {
  it('keeps the outline a constant width in sprite pixels', () => {
    const radius = 12
    for (const spriteZoom of [0.35, 0.5, 1, 4]) {
      expect(
        outlineWidth(radius, spriteZoom) * radius * spriteZoom,
      ).toBeCloseTo(GLORP_OUTLINE_PIXELS)
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
  it('is one sprite pixel in local units', () => {
    expect(pixelSize(12, 1)).toBeCloseTo(1 / 12)
    expect(pixelSize(12, 4)).toBeCloseTo(1 / 48)
  })

  it('is zero for a glorp with no screen size', () => {
    expect(pixelSize(0, 1)).toBe(0)
    expect(pixelSize(12, 0)).toBe(0)
  })
})

describe('detailSpriteMetrics', () => {
  it('derives the grid, outline, and disc from one sprite zoom', () => {
    const spriteZoom = DETAIL_SPRITE_ZOOM
    const metrics = detailSpriteMetrics(12, spriteZoom)
    expect(metrics.pixel).toBeCloseTo(pixelSize(12, spriteZoom))
    expect(metrics.outline).toBeCloseTo(outlineWidth(12, spriteZoom))
    expect(metrics.shapeRadius).toBeCloseTo(glorpShapeRadius(12, spriteZoom))
  })
})
