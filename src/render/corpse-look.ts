import { clamp, lerp } from '@/engine/math'
import { glorpColor, type Rgb } from '@/render/appearance'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'

/**
 * Pure tuning for corpses, kept free of Three.js and of the simulation config
 * so the look math is testable on its own. `CorpseLayer` reads these, so the
 * look lives in one place.
 */

/** How much darker a corpse is than the dimmest, "max hunger" live color. */
export const CORPSE_SHADE = 0.45

/** Smallest a corpse deflates to, as a fraction of a glorp's radius. */
export const CORPSE_MIN_SCALE = 0.55

/** The flat, darkened body color a corpse wears, below max-hunger hunger. */
export const corpseColor = (type: GlorpType): Rgb => {
  const dim = glorpColor(type, 0, false)
  return [dim[0] * CORPSE_SHADE, dim[1] * CORPSE_SHADE, dim[2] * CORPSE_SHADE]
}

/**
 * Corpse colors keyed by type, computed once. The render loop indexes this
 * rather than rebuilding a color every corpse every frame, and the `Record`
 * makes a new `GlorpType` a compile error until it gets a corpse shade.
 */
export const CORPSE_COLORS: Record<GlorpType, Rgb> = {
  [GLORP_TYPE.prey]: corpseColor(GLORP_TYPE.prey),
  [GLORP_TYPE.hunter]: corpseColor(GLORP_TYPE.hunter),
}

/**
 * Deflate factor (a fraction of the glorp radius) for a corpse with
 * `remaining` seconds left. Shrinks linearly from full size to
 * `CORPSE_MIN_SCALE` across its whole `corpseSeconds` lifetime.
 */
export const corpseDeflate = (
  remaining: number,
  corpseSeconds: number,
): number => {
  if (corpseSeconds <= 0) return CORPSE_MIN_SCALE
  const age = 1 - clamp(remaining / corpseSeconds, 0, 1)
  return lerp(1, CORPSE_MIN_SCALE, age)
}
