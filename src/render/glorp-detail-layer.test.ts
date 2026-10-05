import type { ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { detailBodyMetrics, detailSpriteMetrics } from '@/render/glorp-detail'
import { GlorpDetailLayer } from '@/render/glorp-detail-layer'
import { glorpHoloIndex } from '@/render/glorp-holo'
import { DETAIL_SPRITE_ZOOM, DETAIL_MIN_ZOOM } from '@/render/lod'
import { MUTATIONS } from '@/sim/mutations'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }

/** One glorp inside the view and one far outside it. */
const makeWorld = (
  mutations = 0,
  type: GlorpType = GLORP_TYPE.prey,
): RenderableWorld =>
  ({
    count: 2,
    x: Float32Array.of(100, 5000),
    y: Float32Array.of(100, 5000),
    radius: 12,
    id: Uint32Array.of(1, 2),
    type: Uint8Array.of(type, type),
    fed: new Float32Array(2),
    pregnant: new Float32Array(2),
    dodgeTimer: new Float32Array(2),
    mutations: Uint32Array.of(mutations, mutations),
    grass: {} as never,
  }) as RenderableWorld

describe('GlorpDetailLayer', () => {
  it('draws nothing while zoomed out', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM - 0.01, 0)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('draws only the glorps inside the view when zoomed in', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(layer.mesh.count).toBe(1)
    layer.dispose()
  })

  it('sharpens the body with zoom but keeps the flare grid fixed', () => {
    const flare = detailSpriteMetrics(12, DETAIL_SPRITE_ZOOM)
    const layer = new GlorpDetailLayer()
    const material = layer.mesh.material as ShaderMaterial

    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 0)
    const bodyAtThreshold = detailBodyMetrics(12, DETAIL_MIN_ZOOM)
    expect(material.uniforms.uBodyPixel.value).toBeCloseTo(bodyAtThreshold.pixel)
    expect(material.uniforms.uOutlineWidth.value).toBeCloseTo(
      bodyAtThreshold.outline,
    )
    expect(material.uniforms.uFlarePixel.value).toBeCloseTo(flare.pixel)

    const bodyAtMax = detailBodyMetrics(12, 4)
    layer.update(makeWorld(), BOUNDS, 4, 0)
    expect(material.uniforms.uBodyPixel.value).toBeCloseTo(bodyAtMax.pixel)
    expect(material.uniforms.uOutlineWidth.value).toBeCloseTo(bodyAtMax.outline)
    expect(material.uniforms.uFlarePixel.value).toBeCloseTo(flare.pixel)
    expect(bodyAtMax.pixel).toBeLessThan(bodyAtThreshold.pixel)
    layer.dispose()
  })

  it('advances the sheen clock', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 3.25)
    const material = layer.mesh.material as ShaderMaterial
    expect(material.uniforms.uTime.value).toBeCloseTo(3.25)
    layer.dispose()
  })

  it('flags only mutated glorps', () => {
    const layer = new GlorpDetailLayer()
    layer.update(makeWorld(1), BOUNDS, DETAIL_MIN_ZOOM, 0)
    const mutated = layer.mesh.geometry.getAttribute('aMutated')
    expect(mutated.getX(0)).toBe(1)

    layer.update(makeWorld(0), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(mutated.getX(0)).toBe(0)
    layer.dispose()
  })

  it('picks the mutation sheen by default', () => {
    const layer = new GlorpDetailLayer()
    const holo = layer.mesh.geometry.getAttribute('aHolo')

    layer.update(
      makeWorld(MUTATIONS.jumper.bit, GLORP_TYPE.prey),
      BOUNDS,
      DETAIL_MIN_ZOOM,
      0,
    )
    expect(holo.getX(0)).toBe(glorpHoloIndex('beetle-shell'))

    layer.update(
      makeWorld(MUTATIONS.stoat.bit, GLORP_TYPE.hunter),
      BOUNDS,
      DETAIL_MIN_ZOOM,
      0,
    )
    expect(holo.getX(0)).toBe(glorpHoloIndex('beetle-shell'))
    layer.dispose()
  })

  it('lets the lab override the sheen picker', () => {
    const layer = new GlorpDetailLayer(() => glorpHoloIndex('beam'))
    layer.update(makeWorld(1), BOUNDS, DETAIL_MIN_ZOOM, 0)
    const holo = layer.mesh.geometry.getAttribute('aHolo')
    expect(holo.getX(0)).toBe(glorpHoloIndex('beam'))
    layer.dispose()
  })

  it('uploads type warmth separately from the tinted body color', () => {
    const layer = new GlorpDetailLayer()
    const warm = layer.mesh.geometry.getAttribute('aWarm')

    layer.update(makeWorld(0, GLORP_TYPE.prey), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(warm.getX(0)).toBe(0)

    layer.update(makeWorld(0, GLORP_TYPE.hunter), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(warm.getX(0)).toBe(1)
    layer.dispose()
  })
})
