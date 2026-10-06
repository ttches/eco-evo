import type { ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { AURA_VARIANTS, glorpAuraIndex } from '@/render/glorp-aura'
import { GlorpAuraLayer } from '@/render/glorp-aura-layer'
import { GLORP_AURA_GLSL } from '@/render/glorp-aura-shader'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }

/** One glorp inside the view and one far outside it. */
const makeWorld = (type: GlorpType = GLORP_TYPE.prey): RenderableWorld =>
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
    mutations: new Uint32Array(2),
    grass: {} as never,
    corpses: {} as never,
  }) as RenderableWorld

describe('GlorpAuraLayer', () => {
  it('draws nothing while zoomed out', () => {
    const layer = new GlorpAuraLayer(() => glorpAuraIndex('smoke'))
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM - 0.01, 0)
    expect(layer.shadeMesh.count).toBe(0)
    expect(layer.glowMesh.count).toBe(0)
    layer.dispose()
  })

  it('draws only the glorps inside the view when zoomed in', () => {
    const layer = new GlorpAuraLayer(() => glorpAuraIndex('smoke'))
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(layer.shadeMesh.count).toBe(1)
    expect(layer.glowMesh.count).toBe(0)
    layer.dispose()
  })

  it('skips glorps whose picker reports no aura', () => {
    const layer = new GlorpAuraLayer(() => -1)
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(layer.shadeMesh.count).toBe(0)
    expect(layer.glowMesh.count).toBe(0)
    layer.dispose()
  })

  it('routes additive auras to the glow pass and dark ones to the shade pass', () => {
    const layer = new GlorpAuraLayer(() => glorpAuraIndex('chromatic'))
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 0)
    expect(layer.glowMesh.count).toBe(1)
    expect(layer.shadeMesh.count).toBe(0)
    layer.dispose()
  })

  it('advances the aura clock', () => {
    const layer = new GlorpAuraLayer(() => glorpAuraIndex('smoke'))
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM, 2.5)
    const material = layer.shadeMesh.material as ShaderMaterial
    expect(material.uniforms.uTime.value).toBeCloseTo(2.5)
    layer.dispose()
  })
})

describe('aura variants', () => {
  it('gives every variant a distinct index', () => {
    const indices = AURA_VARIANTS.map(glorpAuraIndex)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('keeps one shader branch per variant', () => {
    const branches = GLORP_AURA_GLSL.match(/aura < /g) ?? []
    expect(branches.length).toBe(AURA_VARIANTS.length)
  })
})
