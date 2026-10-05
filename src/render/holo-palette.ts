/**
 * The glorp sheen colour rule, shared by every mutation look.
 *
 * The *dominant* surface of a glorp stays in its type's range: prey glow
 * between **yellow and blue** (through green/cyan), predators between **orange
 * and purple** (through magenta/red). Accents — sparkles, rim glints, eye glow,
 * secondary bands — are free to use any hue, including the opposite arc, which
 * keeps a predator from reading green overall while still allowing flare.
 *
 * The rule is expressed in GLSL: `glorp-holo-shader.ts` interpolates the window
 * constants below into its `typeHue`, making them the single source of truth.
 */

/** Prey window start/end as hue fractions (yellow → blue). */
export const PREY_HUE_FROM = 55 / 360
export const PREY_HUE_TO = 250 / 360

/** Predator window start/end as hue fractions (orange → purple, wrapping). */
export const PREDATOR_HUE_FROM = 280 / 360
export const PREDATOR_HUE_TO = 385 / 360
