import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'
import { TAU, hashUnit } from '@/engine/math'
import { CORPSE_COLORS, CORPSE_MIN_SCALE } from '@/render/corpse-look'
import { CorpseLayer } from '@/render/corpse-layer'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { CORPSE_SECONDS, MAX_CORPSES } from '@/sim/config'
import { createCorpses } from '@/sim/corpses'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }
const RADIUS = 12

type CorpseSeed = {
  x?: number
  y?: number
  type?: number
  id?: number
  remaining?: number
}

const makeWorld = (corpses: readonly CorpseSeed[]): RenderableWorld => {
  const field = createCorpses()
  field.count = corpses.length
  corpses.forEach((corpse, index) => {
    field.x[index] = corpse.x ?? 100
    field.y[index] = corpse.y ?? 100
    field.type[index] = corpse.type ?? GLORP_TYPE.prey
    field.id[index] = corpse.id ?? index + 1
    field.remaining[index] = corpse.remaining ?? CORPSE_SECONDS
  })
  return { radius: RADIUS, corpses: field } as RenderableWorld
}

const scaleAt = (layer: CorpseLayer, index = 0): number => {
  const matrix = new Matrix4()
  layer.mesh.getMatrixAt(index, matrix)
  return matrix.getMaxScaleOnAxis()
}

describe('CorpseLayer', () => {
  it('draws nothing while zoomed out', () => {
    const layer = new CorpseLayer()
    layer.update(makeWorld([{}]), BOUNDS, DETAIL_MIN_ZOOM - 0.01)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('draws corpses inside the view and culls those outside', () => {
    const layer = new CorpseLayer()
    layer.update(
      makeWorld([
        { x: 100, y: 100 },
        { x: 5000, y: 5000 },
      ]),
      BOUNDS,
      DETAIL_MIN_ZOOM,
    )
    expect(layer.mesh.count).toBe(1)
    layer.dispose()
  })

  it('deflates a corpse as its time runs out', () => {
    const fresh = new CorpseLayer()
    fresh.update(makeWorld([{ remaining: CORPSE_SECONDS }]), BOUNDS, 1)
    expect(scaleAt(fresh)).toBeCloseTo(RADIUS)

    const spent = new CorpseLayer()
    spent.update(makeWorld([{ remaining: 0 }]), BOUNDS, 1)
    expect(scaleAt(spent)).toBeCloseTo(RADIUS * CORPSE_MIN_SCALE)
    expect(scaleAt(spent)).toBeLessThan(scaleAt(fresh))
    fresh.dispose()
    spent.dispose()
  })

  it('uploads the type-darkened color and the id-hashed silhouette seed', () => {
    const layer = new CorpseLayer()
    layer.update(
      makeWorld([{ type: GLORP_TYPE.hunter, id: 42 }]),
      BOUNDS,
      DETAIL_MIN_ZOOM,
    )

    const expected = CORPSE_COLORS[GLORP_TYPE.hunter]
    const color = layer.mesh.geometry.getAttribute('aColor')
    expect(color.getX(0)).toBeCloseTo(expected[0])
    expect(color.getY(0)).toBeCloseTo(expected[1])
    expect(color.getZ(0)).toBeCloseTo(expected[2])

    const seed = layer.mesh.geometry.getAttribute('aSeed')
    expect(seed.getX(0)).toBeCloseTo(hashUnit(42) * TAU)
    layer.dispose()
  })

  it('colors prey and hunter corpses from their type', () => {
    for (const type of [GLORP_TYPE.prey, GLORP_TYPE.hunter]) {
      const layer = new CorpseLayer()
      layer.update(makeWorld([{ type }]), BOUNDS, DETAIL_MIN_ZOOM)
      const expected = CORPSE_COLORS[type]
      const color = layer.mesh.geometry.getAttribute('aColor')
      expect(color.getX(0)).toBeCloseTo(expected[0])
      expect(color.getY(0)).toBeCloseTo(expected[1])
      expect(color.getZ(0)).toBeCloseTo(expected[2])
      layer.dispose()
    }
  })

  it('never draws more corpses than its capacity', () => {
    const corpses = createCorpses()
    corpses.count = MAX_CORPSES + 100
    const layer = new CorpseLayer()
    layer.update({ radius: RADIUS, corpses } as RenderableWorld, BOUNDS, 1)
    expect(layer.mesh.count).toBe(MAX_CORPSES)
    layer.dispose()
  })
})
