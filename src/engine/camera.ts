import { CAMERA, VIEWPORT, WORLD } from '@/engine/config'
import { clamp } from '@/engine/math'

/** Size of the canvas backing store, in render pixels. */
export type Viewport = {
  readonly width: number
  readonly height: number
}

/**
 * Camera center in world coordinates, a zoom factor (render pixels per world
 * unit), and the viewport it renders into. Y increases downward.
 */
export type Camera = {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly viewport: Viewport
}

export type ViewBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Backing-store size for a display of the given CSS size: the short side is
 * fixed so the pixel-art scale matches on every screen, and the long side
 * follows the display's aspect ratio.
 */
export const viewportFor = (cssWidth: number, cssHeight: number): Viewport => {
  if (cssWidth <= 0 || cssHeight <= 0) return VIEWPORT.fallback
  const scale = VIEWPORT.shortSide / Math.min(cssWidth, cssHeight)
  return {
    width: Math.max(1, Math.round(cssWidth * scale)),
    height: Math.max(1, Math.round(cssHeight * scale)),
  }
}

/** Zoom at which the whole world fits inside the viewport. */
export const fitZoom = (viewport: Viewport): number =>
  Math.min(viewport.width / WORLD.width, viewport.height / WORLD.height)

/** Zoom at which the starting view area fills the whole viewport, cropping the rest. */
export const startZoom = (viewport: Viewport): number =>
  Math.max(
    viewport.width / CAMERA.startView.width,
    viewport.height / CAMERA.startView.height,
  )

/** Centered on the world, filling the viewport with the starting view area. */
export const createCamera = (viewport: Viewport = VIEWPORT.fallback): Camera =>
  clampCamera({
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: startZoom(viewport),
    viewport,
  })

/** Centered on the world, zoomed out until all of it is visible. */
export const fitCamera = (viewport: Viewport): Camera =>
  clampCamera({
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: fitZoom(viewport),
    viewport,
  })

/** Keep the camera's center and zoom across a viewport change. */
export const resizeCamera = (camera: Camera, viewport: Viewport): Camera =>
  clampCamera({ ...camera, viewport })

/** Center the camera on a world point, keeping its zoom and world clamps. */
export const centerCamera = (camera: Camera, x: number, y: number): Camera =>
  clampCamera({ ...camera, x, y })

/** World-space rectangle currently visible through the viewport. */
export const viewBounds = (camera: Camera): ViewBounds => {
  const halfWidth = camera.viewport.width / camera.zoom / 2
  const halfHeight = camera.viewport.height / camera.zoom / 2
  return {
    left: camera.x - halfWidth,
    right: camera.x + halfWidth,
    top: camera.y - halfHeight,
    bottom: camera.y + halfHeight,
  }
}

const clampZoom = (zoom: number, viewport: Viewport): number =>
  clamp(zoom, fitZoom(viewport), CAMERA.maxZoom)

/** Clamp zoom to range and keep the view inside the world (centered if oversized). */
export const clampCamera = (camera: Camera): Camera => {
  const { viewport } = camera
  const zoom = clampZoom(camera.zoom, viewport)
  const halfWidth = viewport.width / zoom / 2
  const halfHeight = viewport.height / zoom / 2

  const x =
    halfWidth >= WORLD.width / 2
      ? WORLD.width / 2
      : clamp(camera.x, halfWidth, WORLD.width - halfWidth)
  const y =
    halfHeight >= WORLD.height / 2
      ? WORLD.height / 2
      : clamp(camera.y, halfHeight, WORLD.height - halfHeight)

  return { x, y, zoom, viewport }
}

/** Convert viewport pixels (origin top-left) to world coordinates. */
export const screenToWorld = (
  camera: Camera,
  screenX: number,
  screenY: number,
): { x: number; y: number } => {
  const bounds = viewBounds(camera)
  return {
    x: bounds.left + screenX / camera.zoom,
    y: bounds.top + screenY / camera.zoom,
  }
}

/** Convert world coordinates to viewport pixels (origin top-left). */
export const worldToScreen = (
  camera: Camera,
  worldX: number,
  worldY: number,
): { x: number; y: number } => {
  const bounds = viewBounds(camera)
  return {
    x: (worldX - bounds.left) * camera.zoom,
    y: (worldY - bounds.top) * camera.zoom,
  }
}

/** Pan by a world-space delta (the amount the view content should move). */
export const panBy = (camera: Camera, deltaX: number, deltaY: number): Camera =>
  clampCamera({
    ...camera,
    x: camera.x - deltaX,
    y: camera.y - deltaY,
  })

/** Zoom by a factor while keeping the world point under the cursor fixed. */
export const zoomAt = (
  camera: Camera,
  factor: number,
  screenX: number,
  screenY: number,
): Camera => {
  const before = screenToWorld(camera, screenX, screenY)
  const zoom = clampZoom(camera.zoom * factor, camera.viewport)
  const after = screenToWorld({ ...camera, zoom }, screenX, screenY)
  return clampCamera({
    ...camera,
    x: camera.x + (before.x - after.x),
    y: camera.y + (before.y - after.y),
    zoom,
  })
}
