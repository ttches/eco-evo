import { clamp } from '@/engine/math'
import { DETAIL_SPRITE_ZOOM } from '@/render/lod'
import { GLORP_RADIUS } from '@/sim/config'

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

/**
 * One harmonic of the silhouette wobble. A term contributes
 * `weight * sin(frequency * angle + phaseScale * seed)`; `angle` is the polar
 * angle around the body and `seed` the glorp's phase.
 */
export type GlorpHarmonic = {
  frequency: number
  weight: number
  phaseScale: number
}

/**
 * The harmonics behind a glorp's lumpy outline, shared by the GLSL silhouette
 * and the SVG avatar so the two cannot drift. Weights sum to 1, and
 * `GLORP_BLOB_AMPLITUDE` scales their total.
 */
export const GLORP_SILHOUETTE_HARMONICS: readonly GlorpHarmonic[] = [
  { frequency: 3, weight: 0.6, phaseScale: 1 },
  { frequency: 5, weight: 0.4, phaseScale: -1.3 },
]

/** CPU twin of the GLSL wobble: the fraction a boundary strays from a circle. */
export const glorpWobble = (angle: number, seed: number): number =>
  GLORP_SILHOUETTE_HARMONICS.reduce(
    (sum, { frequency, weight, phaseScale }) =>
      sum + weight * Math.sin(frequency * angle + phaseScale * seed),
    0,
  )

/** The wobble sum as GLSL, generated from the shared harmonics. */
const silhouetteWobbleGlsl = (): string =>
  GLORP_SILHOUETTE_HARMONICS.map(({ frequency, weight, phaseScale }) => {
    const phase = phaseScale === 1 ? 'seed' : `seed * (${phaseScale})`
    return `sin(angle * ${frequency}.0 + ${phase}) * ${weight}`
  }).join('\n      + ')

/**
 * The blob silhouette, shared by the production detail shader and the lab's
 * holo shader so both agree on exactly where a glorp's edge is. `vLocal` is the
 * unit-disc position and `cellSize` the snap grid's cell size in local units
 * (render-pixel sized for the body, sprite-pixel sized for the flare).
 */
export const GLORP_SILHOUETTE_GLSL = /* glsl */ `
  // Snap a local point to the cell grid so the silhouette reads as pixel art.
  vec2 glorpSnap(vec2 local, float cellSize) {
    return floor(local / cellSize + 0.5) * cellSize;
  }

  // Harmonics give each glorp a stable, slightly lumpy outline. seed is the
  // glorp's phase and amplitude its maximum stray from a circle.
  float glorpBoundary(vec2 p, float seed, float amplitude) {
    float angle = atan(p.y, p.x);
    float wobble = amplitude * (
      ${silhouetteWobbleGlsl()}
    );
    return 1.0 + wobble;
  }
`

/** Local units per render pixel for a glorp of `radius` at `zoom`. */
export const pixelSize = (radius: number, zoom: number): number => {
  const screenRadius = radius * zoom
  return screenRadius > 0 ? 1 / screenRadius : 0
}

/**
 * Width of the outline band in local units, so it stays a constant `pixels`
 * render-pixels wide on screen whatever the zoom. Clamped to 1 so it can never
 * exceed the glorp.
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

/** Segments in the coverage disc; enough that it never clips the silhouette. */
export const GLORP_BLOB_SEGMENTS = 32

/** Furthest a sample can sit from the grid cell it snaps to, in cells. */
export const GLORP_SNAP_OVERSHOOT = Math.SQRT1_2

/**
 * Radius of the coverage disc the detail shader draws into: it must reach past
 * the lumpiest, pixel-snapped silhouette or it would clip it. The snap is worst
 * at the lowest detail zoom, so size the margin from there and account for the
 * polygon's inscribed radius. The body grid only gets finer as the camera zooms
 * in, so the sprite zoom stays the worst case.
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
 * The fixed parts of the glorp sprite, derived from one sprite zoom so they
 * cannot drift: the mutation flare's snap grid and the coverage disc radius.
 * The body silhouette and outline are *not* here — they scale with the camera
 * zoom (see `detailBodyMetrics`); only the flare keeps this authored grid.
 */
export const detailSpriteMetrics = (
  radius = GLORP_RADIUS,
  spriteZoom = DETAIL_SPRITE_ZOOM,
): { pixel: number; shapeRadius: number } => ({
  pixel: pixelSize(radius, spriteZoom),
  shapeRadius: glorpShapeRadius(radius, spriteZoom),
})

/**
 * The zoom-dependent body metrics: the silhouette's snap grid and the outline.
 * Both sharpen as the camera zooms in; the flare stays on the fixed sprite grid.
 */
export const detailBodyMetrics = (
  radius = GLORP_RADIUS,
  zoom = DETAIL_SPRITE_ZOOM,
): { pixel: number; outline: number } => ({
  pixel: pixelSize(radius, zoom),
  outline: outlineWidth(radius, zoom),
})
