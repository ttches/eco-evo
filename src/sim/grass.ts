import { WORLD } from '@/engine/config'
import { XorShift32, clamp } from '@/engine/math'
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

/**
 * Center of the closest tile holding meaningful grass, or null if none.
 * Searches outward in square rings of tiles around the point and stops once
 * no farther ring could hold anything closer. Equal distances resolve to the
 * lower tile index, matching a row-major scan.
 */
export const nearestGrassTile = (
  grass: GrassField,
  x: number,
  y: number,
): { x: number; y: number } | null => {
  const { cols, rows, tileSize, values } = grass
  const half = tileSize / 2
  const originCol = clamp(Math.floor(x / tileSize), 0, cols - 1)
  const originRow = clamp(Math.floor(y / tileSize), 0, rows - 1)
  // How far the point sits from its origin tile's center, per axis at most.
  const offset = Math.max(
    Math.abs(x - (originCol * tileSize + half)),
    Math.abs(y - (originRow * tileSize + half)),
  )
  const lastRing = Math.max(
    originCol,
    cols - 1 - originCol,
    originRow,
    rows - 1 - originRow,
  )
  let bestDistance = Infinity
  let best = -1

  for (let ring = 0; ring <= lastRing; ring += 1) {
    // Every tile center in this ring is at least this far from the point.
    const reach = Math.max(0, ring * tileSize - offset)
    if (reach * reach > bestDistance) break

    for (let row = originRow - ring; row <= originRow + ring; row += 1) {
      if (row < 0 || row >= rows) continue
      const edgeRow = row === originRow - ring || row === originRow + ring
      // Edge rows are walked fully; middle rows only touch the ring's two sides.
      const stride = edgeRow || ring === 0 ? 1 : 2 * ring
      const centerY = row * tileSize + half
      for (let col = originCol - ring; col <= originCol + ring; col += stride) {
        if (col < 0 || col >= cols) continue
        const index = row * cols + col
        if (values[index] <= GRASS_MIN_VALUE) continue

        const deltaX = col * tileSize + half - x
        const deltaY = centerY - y
        const distance = deltaX * deltaX + deltaY * deltaY
        if (
          distance < bestDistance ||
          (distance === bestDistance && index < best)
        ) {
          bestDistance = distance
          best = index
        }
      }
    }
  }

  if (best < 0) return null
  return {
    x: (best % cols) * tileSize + half,
    y: Math.floor(best / cols) * tileSize + half,
  }
}
