import type { ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { outlineWidth, pixelSize } from '@/render/glorp-detail'
import { GlorpDetailLayer } from '@/render/glorp-detail-layer'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }

/** One glorp inside the view and one far outside it. */
const makeWorld = (): RenderableWorld =>
  ({
    count: 2,
    x: Float32Array.of(100, 5000),
    y: Float32Array.of(100, 5000),
    radius: 12,
    id: Uint32Array.of(1, 2),
    type: new Uint8Array(2),
    fed: new Float32Array(2),
    pregnant: new Float32Array(2),
    dodgeTimer: new Float32Array(2),
    grass: {} as never,
  }) as RenderableWorld

describe('GlorpDetailLayer', () => {
  it('draws nothing while zoomed out', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM - 0.01)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('draws only the glorps inside the view when zoomed in', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM)
    expect(layer.mesh.count).toBe(1)
    layer.dispose()
  })

  it('sizes the outline and pixel grid for the current zoom', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, 1)
    const material = layer.mesh.material as ShaderMaterial
    expect(material.uniforms.uOutlineWidth.value).toBeCloseTo(
      outlineWidth(12, 1),
    )
    expect(material.uniforms.uPixel.value).toBeCloseTo(pixelSize(12, 1))
    layer.dispose()
  })
})
