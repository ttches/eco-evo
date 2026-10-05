import { clamp } from '@/engine/math'
import { DETAIL_SPRITE_ZOOM } from '@/render/lod'
import { GLORP_RADIUS } from '@/sim/config'

/**
 * Pure tuning for the detailed glorp, kept free of Three.js so the sizing math
 * is testable on its own. The detail shader reads these through uniforms, so
 * the look lives in one place.
 */

/** Width of the glorp outline, in sprite pixels (the snap grid below). */
export const GLORP_OUTLINE_PIXELS = 1.5

/** How dark the outline is relative to the body color. */
export const GLORP_OUTLINE_SHADE = 0.2

/**
 * How far the blob silhouette strays from a circle, as a fraction of the
 * radius. The shader sums two harmonics that never exceed this, so the outline
 * stays inside `1 + GLORP_BLOB_AMPLITUDE`.
 */
export const GLORP_BLOB_AMPLITUDE = 0.12

/**
 * The blob silhouette, shared by the production detail shader and the lab's
 * holo shader so both agree on exactly where a glorp's edge is. `vLocal` is the
 * unit-disc position and `pixel` the render-pixel size in local units.
 */
export const GLORP_SILHOUETTE_GLSL = /* glsl */ `
  // Snap a local point to the render-pixel grid so the silhouette reads as
  // pixel art.
  vec2 glorpSnap(vec2 local, float pixel) {
    return floor(local / pixel + 0.5) * pixel;
  }

  // Two harmonics give each glorp a stable, slightly lumpy outline. seed is
  // the glorp's phase and amplitude its maximum stray from a circle.
  float glorpBoundary(vec2 p, float seed, float amplitude) {
    float angle = atan(p.y, p.x);
    float wobble = amplitude * (
      sin(angle * 3.0 + seed) * 0.6 +
      sin(angle * 5.0 - seed * 1.3) * 0.4
    );
    return 1.0 + wobble;
  }
`

/** Local units per sprite pixel for a glorp of `radius` at `spriteZoom`. */
export const pixelSize = (radius: number, spriteZoom: number): number => {
  const screenRadius = radius * spriteZoom
  return screenRadius > 0 ? 1 / screenRadius : 0
}

/**
 * Width of the outline band in local units, so it stays a constant `pixels`
 * sprite-pixels wide whatever the zoom. Clamped to 1 so it can never exceed the
 * glorp.
 */
export const outlineWidth = (
  radius: number,
  spriteZoom: number,
  pixels = GLORP_OUTLINE_PIXELS,
): number => {
  const screenRadius = radius * spriteZoom
  if (screenRadius <= 0) return 0
  return clamp(pixels / screenRadius, 0, 1)
}

/** Segments in the coverage disc; enough that it never clips the silhouette. */
export const GLORP_BLOB_SEGMENTS = 32

/** Furthest a sample can sit from the pixel it snaps to, in sprite pixels. */
export const GLORP_SNAP_OVERSHOOT = Math.SQRT1_2

/**
 * Radius of the coverage disc the detail shader draws into: it must reach past
 * the lumpiest, pixel-snapped silhouette or it would clip it. The snap is worst
 * at the sprite zoom, so size the margin from there and account for the
 * polygon's inscribed radius.
 */
export const glorpShapeRadius = (
  radius = GLORP_RADIUS,
  spriteZoom = DETAIL_SPRITE_ZOOM,
): number =>
  (1 +
    GLORP_BLOB_AMPLITUDE +
    GLORP_SNAP_OVERSHOOT * pixelSize(radius, spriteZoom)) /
  Math.cos(Math.PI / GLORP_BLOB_SEGMENTS)

/**
 * The three coupled metrics of the glorp sprite, all derived from one sprite
 * zoom so they cannot drift: the snap grid, the outline width, and the coverage
 * disc radius. The layer computes this once and feeds the first two as uniforms.
 */
export const detailSpriteMetrics = (
  radius = GLORP_RADIUS,
  spriteZoom = DETAIL_SPRITE_ZOOM,
): { pixel: number; outline: number; shapeRadius: number } => ({
  pixel: pixelSize(radius, spriteZoom),
  outline: outlineWidth(radius, spriteZoom),
  shapeRadius: glorpShapeRadius(radius, spriteZoom),
})
