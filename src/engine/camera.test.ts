import { describe, expect, it } from 'vitest'
import {
  centerCamera,
  clampCamera,
  createCamera,
  fitCamera,
  fitZoom,
  panBy,
  resizeCamera,
  screenToWorld,
  startZoom,
  viewBounds,
  viewportFor,
  worldToScreen,
  zoomAt,
  type Camera,
} from '@/engine/camera'
import { CAMERA, VIEWPORT, WORLD } from '@/engine/config'

const LANDSCAPE = { width: 480, height: 270 }
const PORTRAIT = { width: 270, height: 584 }

const at = (x: number, y: number, zoom: number, viewport = LANDSCAPE): Camera =>
  clampCamera({ x, y, zoom, viewport })

describe('viewportFor', () => {
  it('renders a 16:9 display at 480x270 regardless of its CSS size', () => {
    expect(viewportFor(1920, 1080)).toEqual({ width: 480, height: 270 })
    expect(viewportFor(1280, 720)).toEqual({ width: 480, height: 270 })
  })

  it('keeps the short side fixed and follows the aspect ratio', () => {
    const phone = viewportFor(390, 844)
    expect(phone.width).toBe(VIEWPORT.shortSide)
    expect(phone.height).toBe(Math.round((844 * VIEWPORT.shortSide) / 390))
  })

  it('falls back before the display is laid out', () => {
    expect(viewportFor(0, 0)).toEqual(VIEWPORT.fallback)
  })
})

describe('createCamera', () => {
  it('starts centered, filling a 16:9 viewport with the starting view area', () => {
    const camera = createCamera(LANDSCAPE)
    const bounds = viewBounds(camera)
    expect(camera.x).toBe(WORLD.width / 2)
    expect(camera.y).toBe(WORLD.height / 2)
    expect(camera.zoom).toBeCloseTo(0.25)
    expect(bounds.right - bounds.left).toBeCloseTo(CAMERA.startView.width)
    expect(bounds.bottom - bounds.top).toBeCloseTo(CAMERA.startView.height)
  })

  it('fills a portrait viewport, cropping the sides of the starting view', () => {
    const camera = createCamera(PORTRAIT)
    const bounds = viewBounds(camera)
    expect(camera.zoom).toBeCloseTo(startZoom(PORTRAIT))
    expect(bounds.bottom - bounds.top).toBeCloseTo(CAMERA.startView.height)
    expect(bounds.right - bounds.left).toBeLessThan(CAMERA.startView.width)
  })

  it('leaves room to zoom out on any viewport shape', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT]) {
      expect(createCamera(viewport).zoom).toBeGreaterThan(fitZoom(viewport))
    }
  })
})

describe('fitCamera', () => {
  it('shows the whole world, centered, on any viewport shape', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT]) {
      const bounds = viewBounds(fitCamera(viewport))
      expect(bounds.left).toBeLessThanOrEqual(1e-9)
      expect(bounds.top).toBeLessThanOrEqual(1e-9)
      expect(bounds.right).toBeGreaterThanOrEqual(WORLD.width - 1e-9)
      expect(bounds.bottom).toBeGreaterThanOrEqual(WORLD.height - 1e-9)
      expect((bounds.left + bounds.right) / 2).toBeCloseTo(WORLD.width / 2)
    }
  })
})

describe('viewBounds', () => {
  it('spans the viewport divided by zoom', () => {
    const camera = at(900, 500, 1)
    const bounds = viewBounds(camera)
    expect(bounds.right - bounds.left).toBeCloseTo(LANDSCAPE.width)
    expect(bounds.bottom - bounds.top).toBeCloseTo(LANDSCAPE.height)
  })
})

describe('clampCamera', () => {
  it('clamps zoom between whole-world fit and the maximum', () => {
    expect(at(0, 0, 0.01).zoom).toBeCloseTo(fitZoom(LANDSCAPE))
    expect(at(0, 0, 0.01, PORTRAIT).zoom).toBeCloseTo(fitZoom(PORTRAIT))
    expect(at(0, 0, 99).zoom).toBe(CAMERA.maxZoom)
  })

  it('keeps the view inside the world', () => {
    const bounds = viewBounds(at(-500, 9999, 1))
    expect(bounds.left).toBeGreaterThanOrEqual(-1e-9)
    expect(bounds.top).toBeGreaterThanOrEqual(-1e-9)
    expect(bounds.right).toBeLessThanOrEqual(WORLD.width + 1e-9)
    expect(bounds.bottom).toBeLessThanOrEqual(WORLD.height + 1e-9)
  })
})

describe('resizeCamera', () => {
  it('keeps center and zoom when rotating, clamped to the new shape', () => {
    const camera = at(900, 500, 1)
    const rotated = resizeCamera(camera, PORTRAIT)
    expect(rotated.viewport).toBe(PORTRAIT)
    expect(rotated.zoom).toBe(1)
    expect(rotated.x).toBeCloseTo(900)
    expect(rotated.y).toBeCloseTo(500)
  })
})

describe('centerCamera', () => {
  it('centers on a world point, keeping zoom', () => {
    const centered = centerCamera(at(0, 0, 1), 900, 500)
    expect(centered.x).toBeCloseTo(900)
    expect(centered.y).toBeCloseTo(500)
    expect(centered.zoom).toBe(1)
  })

  it('clamps near the world edge', () => {
    const centered = centerCamera(at(0, 0, 1), -500, 9999)
    const bounds = viewBounds(centered)
    expect(bounds.left).toBeGreaterThanOrEqual(-1e-9)
    expect(bounds.bottom).toBeLessThanOrEqual(WORLD.height + 1e-9)
  })
})

describe('screenToWorld / worldToScreen', () => {
  it('maps viewport corners to view bounds corners', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT]) {
      const camera = at(900, 500, 1, viewport)
      const bounds = viewBounds(camera)
      const topLeft = screenToWorld(camera, 0, 0)
      const bottomRight = screenToWorld(camera, viewport.width, viewport.height)
      expect(topLeft.x).toBeCloseTo(bounds.left)
      expect(topLeft.y).toBeCloseTo(bounds.top)
      expect(bottomRight.x).toBeCloseTo(bounds.right)
      expect(bottomRight.y).toBeCloseTo(bounds.bottom)
    }
  })

  it('round-trips world -> screen -> world', () => {
    const camera = at(640, 360, 2)
    const point = screenToWorld(camera, 123, 45)
    const screen = worldToScreen(camera, point.x, point.y)
    expect(screen.x).toBeCloseTo(123)
    expect(screen.y).toBeCloseTo(45)
  })
})

describe('panBy', () => {
  it('moves the camera opposite to the content delta', () => {
    const camera = at(960, 540, 1)
    const panned = panBy(camera, 40, -20)
    expect(panned.x).toBeCloseTo(camera.x - 40)
    expect(panned.y).toBeCloseTo(camera.y + 20)
  })
})

describe('zoomAt', () => {
  it('keeps the cursor world point fixed', () => {
    for (const viewport of [LANDSCAPE, PORTRAIT]) {
      const camera = at(960, 540, 1, viewport)
      const before = screenToWorld(camera, 100, 120)
      const zoomed = zoomAt(camera, 2, 100, 120)
      const after = screenToWorld(zoomed, 100, 120)
      expect(after.x).toBeCloseTo(before.x)
      expect(after.y).toBeCloseTo(before.y)
    }
  })
})
