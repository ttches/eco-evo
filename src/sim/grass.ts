import { WORLD } from '@/engine/config'
import { XorShift32 } from '@/engine/math'
import {
  DEFAULT_SEED,
  GRASS_INITIAL_MAX,
  GRASS_INITIAL_MIN,
  GRASS_MIN_VALUE,
  GRASS_REGROW,
  GRASS_TILE,
} from '@/sim/config'

/** Uniform grid of grass density values in the range 0..1. */
export type GrassField = {
  readonly cols: number
  readonly rows: number
  readonly tileSize: number
  readonly values: Float32Array
}

export const grassCols = (): number => Math.ceil(WORLD.width / GRASS_TILE)

export const grassRows = (): number => Math.ceil(WORLD.height / GRASS_TILE)

export const createGrass = (seed = DEFAULT_SEED): GrassField => {
  const random = new XorShift32(seed)
  const cols = grassCols()
  const rows = grassRows()
  const values = new Float32Array(cols * rows)

  for (let index = 0; index < values.length; index += 1) {
    values[index] = random.range(GRASS_INITIAL_MIN, GRASS_INITIAL_MAX)
  }

  return { cols, rows, tileSize: GRASS_TILE, values }
}

const tileIndex = (grass: GrassField, x: number, y: number): number => {
  const col = Math.floor(x / grass.tileSize)
  const row = Math.floor(y / grass.tileSize)
  if (col < 0 || col >= grass.cols || row < 0 || row >= grass.rows) return -1
  return row * grass.cols + col
}

export const regrowGrass = (grass: GrassField, deltaSeconds: number): void => {
  const amount = GRASS_REGROW * deltaSeconds
  const { values } = grass
  for (let index = 0; index < values.length; index += 1) {
    const next = values[index] + amount
    values[index] = next > 1 ? 1 : next
  }
}

export const grassAt = (grass: GrassField, x: number, y: number): number => {
  const index = tileIndex(grass, x, y)
  return index < 0 ? 0 : grass.values[index]
}

/** Remove up to `amount` grass at a point, returning how much was consumed. */
export const consumeGrass = (
  grass: GrassField,
  x: number,
  y: number,
  amount: number,
): number => {
  const index = tileIndex(grass, x, y)
  if (index < 0 || amount <= 0) return 0

  const available = grass.values[index]
  const consumed = available < amount ? available : amount
  grass.values[index] = available - consumed
  return consumed
}

/** Center of the closest tile holding meaningful grass, or null if none. */
export const nearestGrassTile = (
  grass: GrassField,
  x: number,
  y: number,
): { x: number; y: number } | null => {
  const half = grass.tileSize / 2
  let bestDistance = Infinity
  let bestX = 0
  let bestY = 0

  for (let row = 0; row < grass.rows; row += 1) {
    const centerY = row * grass.tileSize + half
    for (let col = 0; col < grass.cols; col += 1) {
      const index = row * grass.cols + col
      if (grass.values[index] <= GRASS_MIN_VALUE) continue

      const centerX = col * grass.tileSize + half
      const deltaX = centerX - x
      const deltaY = centerY - y
      const distance = deltaX * deltaX + deltaY * deltaY
      if (distance < bestDistance) {
        bestDistance = distance
        bestX = centerX
        bestY = centerY
      }
    }
  }

  return bestDistance === Infinity ? null : { x: bestX, y: bestY }
}
