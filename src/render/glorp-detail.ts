import { clamp } from '@/engine/math'

/**
 * Pure tuning for the detailed glorp, kept free of Three.js so the sizing math
 * is testable on its own. The detail shader reads these through uniforms, so
 * the look lives in one place.
 */

/** Width of the glorp outline, in render pixels. */
export const GLORP_OUTLINE_PIXELS = 1.5

/** How dark the outline is relative to the body color. */
export const GLORP_OUTLINE_SHADE = 0.2

/**
 * How far the blob silhouette strays from a circle, as a fraction of the
 * radius. The shader sums two harmonics that never exceed this, so the outline
 * stays inside `1 + GLORP_BLOB_AMPLITUDE`.
 */
export const GLORP_BLOB_AMPLITUDE = 0.12

/** Local units per render pixel for a glorp of `radius` at `zoom`. */
export const pixelSize = (radius: number, zoom: number): number => {
  const screenRadius = radius * zoom
  return screenRadius > 0 ? 1 / screenRadius : 0
}

/**
 * Width of the outline band in local units, so it stays a constant `pixels`
 * wide on screen whatever the zoom. Clamped to 1 so it can never exceed the
 * glorp.
 */
export const outlineWidth = (
  radius: number,
  zoom: number,
  pixels = GLORP_OUTLINE_PIXELS,
): number => {
  const screenRadius = radius * zoom
  if (screenRadius <= 0) return 0
  return clamp(pixels / screenRadius, 0, 1)
}
