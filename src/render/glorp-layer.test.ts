import { describe, expect, it } from 'vitest'
import { GlorpLayer } from '@/render/glorp-layer'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }

const makeWorld = (): RenderableWorld =>
  ({
    count: 1,
    x: Float32Array.of(100),
    y: Float32Array.of(100),
    radius: 12,
    id: new Uint32Array(1),
    type: new Uint8Array(1),
    fed: new Float32Array(1),
    pregnant: new Float32Array(1),
    dodgeTimer: new Float32Array(1),
    mutations: new Uint32Array(1),
    grass: {} as never,
    corpses: {} as never,
  }) as RenderableWorld

describe('GlorpLayer', () => {
  it('draws the flat disc while zoomed out', () => {
    const layer = new GlorpLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM - 0.01)
    expect(layer.mesh.count).toBe(1)
    layer.dispose()
  })

  it('yields to the detail layer when zoomed in', () => {
    const layer = new GlorpLayer()
    layer.update(makeWorld(), BOUNDS, DETAIL_MIN_ZOOM)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })
})
