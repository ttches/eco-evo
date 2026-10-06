import { Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { HEARTS_PER_BURST, HEART_SIZE } from '@/render/heart-burst'
import { HeartLayer } from '@/render/heart-layer'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { GESTATION_SECONDS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 1000 }
const MID_BURST = GESTATION_SECONDS - 0.4

const makeWorld = (pregnant: number): RenderableWorld =>
  ({
    count: 1,
    x: Float32Array.of(100),
    y: Float32Array.of(100),
    radius: 12,
    id: new Uint32Array(1),
    type: new Uint8Array(1),
    fed: new Float32Array(1),
    pregnant: Float32Array.of(pregnant),
    dodgeTimer: new Float32Array(1),
    mutations: new Uint32Array(1),
    grass: {} as never,
    corpses: {} as never,
  }) as RenderableWorld

describe('HeartLayer', () => {
  it('draws the whole burst mid-animation', () => {
    const layer = new HeartLayer()
    layer.update(makeWorld(MID_BURST), BOUNDS, 1)
    expect(layer.mesh.count).toBe(HEARTS_PER_BURST)
    layer.dispose()
  })

  it('draws nothing for a glorp that is not pregnant', () => {
    const layer = new HeartLayer()
    layer.update(makeWorld(0), BOUNDS, 1)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('draws nothing once the burst has passed', () => {
    const layer = new HeartLayer()
    layer.update(makeWorld(GESTATION_SECONDS - 5), BOUNDS, 1)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('skips the layer while zoomed out', () => {
    const layer = new HeartLayer()
    layer.update(makeWorld(MID_BURST), BOUNDS, DETAIL_MIN_ZOOM - 0.01)
    expect(layer.mesh.count).toBe(0)
    layer.dispose()
  })

  it('fans hearts out and lifts them above the glorp', () => {
    const layer = new HeartLayer()
    layer.update(makeWorld(MID_BURST), BOUNDS, 1)

    const matrix = new Matrix4()
    layer.mesh.getMatrixAt(0, matrix)
    const position = new Vector3()
    const scale = new Vector3()
    matrix.decompose(position, new Quaternion(), scale)
    // First heart sits to the left of the glorp and has risen above it.
    expect(position.x).toBeCloseTo(100 - HEART_SIZE)
    expect(position.y).toBeLessThan(100 - 12)

    const size = matrix.getMaxScaleOnAxis()
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThanOrEqual(HEART_SIZE)
    layer.dispose()
  })

  it('points the heart tip downward in the Y-down world', () => {
    const layer = new HeartLayer()
    const position = layer.mesh.geometry.getAttribute('position')
    let maxY = -Infinity
    let maxYx = Infinity
    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i)
      if (y > maxY) {
        maxY = y
        maxYx = position.getX(i)
      }
    }
    expect(maxYx).toBeCloseTo(0, 1)
    layer.dispose()
  })
})
