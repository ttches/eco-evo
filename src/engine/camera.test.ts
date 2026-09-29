import { describe, expect, it } from 'vitest'
import {
  clampCamera,
  createCamera,
  panBy,
  screenToWorld,
  viewBounds,
  worldToScreen,
  zoomAt,
} from '@/engine/camera'
import { CAMERA, VIEWPORT, WORLD } from '@/engine/config'

describe('createCamera', () => {
  it('starts centered on the world at the default zoom', () => {
    const camera = createCamera()
    expect(camera.x).toBe(WORLD.width / 2)
    expect(camera.y).toBe(WORLD.height / 2)
    expect(camera.zoom).toBe(CAMERA.defaultZoom)
  })
})

describe('viewBounds', () => {
  it('spans the viewport divided by zoom', () => {
    const camera = createCamera()
    const bounds = viewBounds(camera)
    expect(bounds.right - bounds.left).toBeCloseTo(VIEWPORT.width / camera.zoom)
    expect(bounds.bottom - bounds.top).toBeCloseTo(VIEWPORT.height / camera.zoom)
  })

  it('fits the whole world at minimum zoom', () => {
    const camera = clampCamera({ x: 0, y: 0, zoom: CAMERA.minZoom })
    const bounds = viewBounds(camera)
    expect(bounds.left).toBeCloseTo(0)
    expect(bounds.right).toBeCloseTo(WORLD.width)
    expect(bounds.top).toBeCloseTo(0)
    expect(bounds.bottom).toBeCloseTo(WORLD.height)
  })
})

describe('clampCamera', () => {
  it('clamps zoom to the allowed range', () => {
    expect(clampCamera({ x: 0, y: 0, zoom: 0.01 }).zoom).toBe(CAMERA.minZoom)
    expect(clampCamera({ x: 0, y: 0, zoom: 99 }).zoom).toBe(CAMERA.maxZoom)
  })

  it('keeps the view inside the world', () => {
    const camera = clampCamera({ x: -500, y: 9999, zoom: 1 })
    const bounds = viewBounds(camera)
    expect(bounds.left).toBeGreaterThanOrEqual(-1e-9)
    expect(bounds.top).toBeGreaterThanOrEqual(-1e-9)
    expect(bounds.right).toBeLessThanOrEqual(WORLD.width + 1e-9)
    expect(bounds.bottom).toBeLessThanOrEqual(WORLD.height + 1e-9)
  })
})

describe('screenToWorld / worldToScreen', () => {
  it('maps viewport corners to view bounds corners', () => {
    const camera = clampCamera({ x: 900, y: 500, zoom: 1 })
    const bounds = viewBounds(camera)
    const topLeft = screenToWorld(camera, 0, 0)
    const bottomRight = screenToWorld(camera, VIEWPORT.width, VIEWPORT.height)
    expect(topLeft.x).toBeCloseTo(bounds.left)
    expect(topLeft.y).toBeCloseTo(bounds.top)
    expect(bottomRight.x).toBeCloseTo(bounds.right)
    expect(bottomRight.y).toBeCloseTo(bounds.bottom)
  })

  it('round-trips world -> screen -> world', () => {
    const camera = clampCamera({ x: 640, y: 360, zoom: 2 })
    const point = screenToWorld(camera, 123, 45)
    const screen = worldToScreen(camera, point.x, point.y)
    expect(screen.x).toBeCloseTo(123)
    expect(screen.y).toBeCloseTo(45)
  })
})

describe('panBy', () => {
  it('moves the camera opposite to the content delta', () => {
    const camera = clampCamera({ x: 960, y: 540, zoom: 1 })
    const panned = panBy(camera, 40, -20)
    expect(panned.x).toBeCloseTo(camera.x - 40)
    expect(panned.y).toBeCloseTo(camera.y + 20)
  })
})

describe('zoomAt', () => {
  it('keeps the cursor world point fixed', () => {
    const camera = clampCamera({ x: 960, y: 540, zoom: 1 })
    const before = screenToWorld(camera, 300, 100)
    const zoomed = zoomAt(camera, 2, 300, 100)
    const after = screenToWorld(zoomed, 300, 100)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})
