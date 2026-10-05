/**
 * The aura candidates a mutated glorp can wear *outside* its silhouette in the
 * world. Each name maps to a branch of `glorpAura` in `glorp-aura-shader`, so
 * this list and the shader stay in lockstep. Auras are drawn by `GlorpAuraLayer`
 * on their own pass under the body; the body sheen list lives in `glorp-holo.ts`.
 */
export const AURA_VARIANTS = ['smoke', 'ember', 'chromatic'] as const

export type GlorpAuraVariant = (typeof AURA_VARIANTS)[number]

/**
 * How far an aura disc reaches past the body, as a multiple of its radius. It
 * must clear the furthest reach of every variant: the chromatic ring's red
 * fringe peaks at ~1.97 and ember's falloff only ends at 2.0 (smoke fades by
 * 1.8), so the disc is sized past those with a hair of padding. Drives both the
 * aura geometry and the aura layer's cull margin.
 */
export const GLORP_AURA_SCALE = 2.05

/** Global opacity multiplier for auras. */
export const GLORP_AURA_STRENGTH = 1

/** Position of every aura in the shader's branch chain, built once. */
const AURA_INDEX = AURA_VARIANTS.reduce(
  (map, variant, index) => {
    map[variant] = index
    return map
  },
  {} as Record<GlorpAuraVariant, number>,
)

export const glorpAuraIndex = (variant: GlorpAuraVariant): number =>
  AURA_INDEX[variant]

/**
 * Which blend pass an aura belongs to: `ember` sparks and the `chromatic` ring
 * glow additively over the dark ground, `smoke` darkens the grass with normal
 * alpha blending.
 */
export const auraIsAdditive = (index: number): boolean =>
  index !== AURA_INDEX.smoke
