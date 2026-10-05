/**
 * The glorp sheen color rule, shared by every mutation look.
 *
 * The *dominant* surface of a glorp stays in its type's range: prey glow
 * between **yellow and blue** (through green/cyan), predators between **orange
 * and purple** (through magenta/red). Accents — sparkles, rim glints, eye glow,
 * secondary bands — are free to use any hue, including the opposite arc, which
 * keeps a predator from reading green overall while still allowing flare.
 *
 * `typeHue` maps a `[0, 1]` parameter into a type's window; `accentHue` is the
 * opposite-arc convenience and `flareHue` accepts any raw hue. The shader
 * interpolates the same window constants into its GLSL and picks free accent
 * hues directly; these helpers express the rule on the CPU side.
 */

/** Prey window start/end as hue fractions (yellow → blue). */
export const PREY_HUE_FROM = 55 / 360
export const PREY_HUE_TO = 250 / 360

/** Predator window start/end as hue fractions (orange → purple, wrapping). */
export const PREDATOR_HUE_FROM = 280 / 360
export const PREDATOR_HUE_TO = 385 / 360

const hueWindow = (warm: boolean): readonly [number, number] =>
  warm ? [PREDATOR_HUE_FROM, PREDATOR_HUE_TO] : [PREY_HUE_FROM, PREY_HUE_TO]

const wrap01 = (value: number): number => ((value % 1) + 1) % 1

/** Map a `[0, 1]` parameter into a glorp type's allowed hue window. */
export const typeHue = (t: number, warm: boolean): number => {
  const [from, to] = hueWindow(warm)
  return wrap01(from + (to - from) * t)
}

/** The opposite arc, a common choice for flares such as glitter and rim glints. */
export const accentHue = (t: number, warm: boolean): number =>
  wrap01(typeHue(t, warm) + 0.5)

/** A free accent hue: accents are not bound to a type's window. */
export const flareHue = (hue: number): number => wrap01(hue)

/** Whether a hue sits inside a glorp type's allowed window. */
export const hueInWindow = (hue: number, warm: boolean): boolean => {
  const [from, to] = hueWindow(warm)
  const x = wrap01(hue - from)
  // A hue just below `from` wraps to ~1; treat that as the window start.
  return x <= wrap01(to - from) + 1e-6 || x >= 1 - 1e-6
}
