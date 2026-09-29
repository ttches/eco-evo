import { clamp, lerp } from '@/engine/math'
import { FED_MAX } from '@/sim/config'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

type Rgb = readonly [number, number, number]

const PREY_BRIGHT: Rgb = [0.32, 0.8, 0.44]
const PREY_DIM: Rgb = [0.16, 0.26, 0.2]
const HUNTER_BRIGHT: Rgb = [0.92, 0.42, 0.2]
const HUNTER_DIM: Rgb = [0.34, 0.2, 0.16]

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

  const offset = targetIndex * 3
  target[offset] = lerp(dim[0], bright[0], amount)
  target[offset + 1] = lerp(dim[1], bright[1], amount)
  target[offset + 2] = lerp(dim[2], bright[2], amount)
}

/** Fill an interleaved rgb buffer for every glorp in the world. */
export const fillInstanceColors = (
  world: RenderableWorld,
  target: Float32Array,
): void => {
  for (let index = 0; index < world.count; index += 1) {
    writeGlorpColor(world, index, target, index)
  }
}
