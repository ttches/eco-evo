import { CANVAS, GLORP_RADIUS, MAX_GLORPS } from '@/engine/config'
import type { RenderableWorld } from '@/engine/contracts'
import { XorShift32 } from '@/engine/math'

export type World = RenderableWorld & {
  readonly vx: Float32Array
  readonly vy: Float32Array
}

const DEFAULT_COUNT = 24
const DEFAULT_SEED = 0x00c0ffee

const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.3, 0.72, 0.62],
  [0.9, 0.65, 0.3],
  [0.85, 0.4, 0.52],
  [0.58, 0.48, 0.85],
  [0.6, 0.8, 0.35],
  [0.4, 0.68, 0.88],
]

export const createWorld = (
  count = DEFAULT_COUNT,
  seed = DEFAULT_SEED,
): World => {
  const random = new XorShift32(seed)
  const active = Math.max(0, Math.min(count, MAX_GLORPS))

  const x = new Float32Array(MAX_GLORPS)
  const y = new Float32Array(MAX_GLORPS)
  const vx = new Float32Array(MAX_GLORPS)
  const vy = new Float32Array(MAX_GLORPS)
  const colors = new Float32Array(MAX_GLORPS * 3)

  for (let index = 0; index < active; index += 1) {
    x[index] = random.range(0, CANVAS.width)
    y[index] = random.range(0, CANVAS.height)
    vx[index] = random.range(-20, 20)
    vy[index] = random.range(-20, 20)

    const color = PALETTE[index % PALETTE.length]
    const offset = index * 3
    colors[offset] = color[0]
    colors[offset + 1] = color[1]
    colors[offset + 2] = color[2]
  }

  return { count: active, x, y, vx, vy, colors, radius: GLORP_RADIUS }
}

export const step = (world: World, deltaSeconds: number): void => {
  const { count, x, y, vx, vy, radius } = world
  const left = -radius
  const right = CANVAS.width + radius
  const top = -radius
  const bottom = CANVAS.height + radius

  for (let index = 0; index < count; index += 1) {
    let nextX = x[index] + vx[index] * deltaSeconds
    let nextY = y[index] + vy[index] * deltaSeconds

    if (nextX < left) nextX = right
    else if (nextX > right) nextX = left
    if (nextY < top) nextY = bottom
    else if (nextY > bottom) nextY = top

    x[index] = nextX
    y[index] = nextY
  }
}
