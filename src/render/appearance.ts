import { clamp, lerp } from '@/engine/math'
import { FED_MAX } from '@/sim/config'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

export type Rgb = readonly [number, number, number]

const PREY_BRIGHT: Rgb = [0.32, 0.8, 0.44]
const PREY_DIM: Rgb = [0.16, 0.26, 0.2]
const HUNTER_BRIGHT: Rgb = [0.92, 0.42, 0.2]
const HUNTER_DIM: Rgb = [0.34, 0.2, 0.16]
const PREGNANT_TINT: Rgb = [0.95, 0.55, 0.85]

/** How strongly a pregnant glorp is shifted toward the pregnancy tint. */
const PREGNANT_MIX = 0.55

/** A writable numeric-index sink: a typed column or a plain tuple. */
type ColorSink = { [index: number]: number }

/** Write a glorp's color into `sink` at `offset`, allocating nothing. */
const glorpColorInto = (
  sink: ColorSink,
  offset: number,
  type: GlorpType,
  fed: number,
  pregnant: boolean,
): void => {
  const hunter = type === GLORP_TYPE.hunter
  const bright = hunter ? HUNTER_BRIGHT : PREY_BRIGHT
  const dim = hunter ? HUNTER_DIM : PREY_DIM
  const amount = clamp(fed / FED_MAX, 0, 1)
  const mix = pregnant ? PREGNANT_MIX : 0

  sink[offset] = lerp(lerp(dim[0], bright[0], amount), PREGNANT_TINT[0], mix)
  sink[offset + 1] = lerp(lerp(dim[1], bright[1], amount), PREGNANT_TINT[1], mix)
  sink[offset + 2] = lerp(lerp(dim[2], bright[2], amount), PREGNANT_TINT[2], mix)
}

/**
 * A glorp's body color from its type, satiation and pregnancy, shared by the
 * world layers and the inspector's avatar.
 */
export const glorpColor = (
  type: GlorpType,
  fed: number,
  pregnant: boolean,
): Rgb => {
  const rgb: [number, number, number] = [0, 0, 0]
  glorpColorInto(rgb, 0, type, fed, pregnant)
  return rgb
}

/** Write one glorp's color into an interleaved rgb buffer at `targetIndex`. */
export const writeGlorpColor = (
  world: RenderableWorld,
  source: number,
  target: Float32Array,
  targetIndex: number,
): void => {
  const type =
    world.type[source] === GLORP_TYPE.hunter
      ? GLORP_TYPE.hunter
      : GLORP_TYPE.prey
  glorpColorInto(
    target,
    targetIndex * 3,
    type,
    world.fed[source],
    world.pregnant[source] > 0,
  )
}
