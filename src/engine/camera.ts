import { CAMERA, VIEWPORT, WORLD } from '@/engine/config'
import { clamp } from '@/engine/math'

/** Camera center in world coordinates, with a zoom factor. Y increases downward. */
export type Camera = {
  x: number
  y: number
  zoom: number
}

export type ViewBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export const createCamera = (): Camera => ({
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  zoom: CAMERA.defaultZoom,
})

/** World-space rectangle currently visible through the viewport. */
export const viewBounds = (camera: Camera): ViewBounds => {
  const halfWidth = VIEWPORT.width / camera.zoom / 2
  const halfHeight = VIEWPORT.height / camera.zoom / 2
  return {
    left: camera.x - halfWidth,
    right: camera.x + halfWidth,
    top: camera.y - halfHeight,
    bottom: camera.y + halfHeight,
  }
}

/** Clamp zoom to range and keep the view inside the world (centered if oversized). */
export const clampCamera = (camera: Camera): Camera => {
  const zoom = clamp(camera.zoom, CAMERA.minZoom, CAMERA.maxZoom)
  const halfWidth = VIEWPORT.width / zoom / 2
  const halfHeight = VIEWPORT.height / zoom / 2

  const x =
    halfWidth >= WORLD.width / 2
      ? WORLD.width / 2
      : clamp(camera.x, halfWidth, WORLD.width - halfWidth)
  const y =
    halfHeight >= WORLD.height / 2
      ? WORLD.height / 2
      : clamp(camera.y, halfHeight, WORLD.height - halfHeight)

  return { x, y, zoom }
}

/** Convert viewport pixels (origin top-left) to world coordinates. */
export const screenToWorld = (
  camera: Camera,
  screenX: number,
  screenY: number,
): { x: number; y: number } => {
  const bounds = viewBounds(camera)
  return {
    x: bounds.left + (screenX / VIEWPORT.width) * (bounds.right - bounds.left),
    y: bounds.top + (screenY / VIEWPORT.height) * (bounds.bottom - bounds.top),
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
    x: ((worldX - bounds.left) / (bounds.right - bounds.left)) * VIEWPORT.width,
    y: ((worldY - bounds.top) / (bounds.bottom - bounds.top)) * VIEWPORT.height,
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
  const zoom = clamp(camera.zoom * factor, CAMERA.minZoom, CAMERA.maxZoom)
  const after = screenToWorld({ ...camera, zoom }, screenX, screenY)
  return clampCamera({
    x: camera.x + (before.x - after.x),
    y: camera.y + (before.y - after.y),
    zoom,
  })
}
