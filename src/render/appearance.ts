import { clamp, lerp } from '@/engine/math'
import { FED_MAX } from '@/sim/config'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

type Rgb = readonly [number, number, number]

const PREY_BRIGHT: Rgb = [0.32, 0.8, 0.44]
const PREY_DIM: Rgb = [0.16, 0.26, 0.2]
const HUNTER_BRIGHT: Rgb = [0.92, 0.42, 0.2]
const HUNTER_DIM: Rgb = [0.34, 0.2, 0.16]
const PREGNANT_TINT: Rgb = [0.95, 0.55, 0.85]

/** How strongly a pregnant glorp is shifted toward the pregnancy tint. */
const PREGNANT_MIX = 0.55

/** Write one glorp's color into an interleaved rgb buffer at `targetIndex`. */
export const writeGlorpColor = (
  world: RenderableWorld,
  source: number,
  target: Float32Array,
  targetIndex: number,
): void => {
  const hunter = world.type[source] === GLORP_TYPE.hunter
  const bright = hunter ? HUNTER_BRIGHT : PREY_BRIGHT
  const dim = hunter ? HUNTER_DIM : PREY_DIM
  const amount = clamp(world.fed[source] / FED_MAX, 0, 1)
  const pregnant = world.pregnant[source] > 0
  const mix = pregnant ? PREGNANT_MIX : 0

  const offset = targetIndex * 3
  target[offset] = lerp(lerp(dim[0], bright[0], amount), PREGNANT_TINT[0], mix)
  target[offset + 1] = lerp(
    lerp(dim[1], bright[1], amount),
    PREGNANT_TINT[1],
    mix,
  )
  target[offset + 2] = lerp(
    lerp(dim[2], bright[2], amount),
    PREGNANT_TINT[2],
    mix,
  )
}
