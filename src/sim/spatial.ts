import { WORLD } from '@/engine/config'
import { MAX_GLORPS, SPATIAL_CELL } from '@/sim/config'
import type { World } from '@/sim/world'

/**
 * Uniform grid bucketing glorp indices by position, so range queries only
 * visit nearby cells. Rebuilt from scratch with a counting sort; it holds no
 * per-frame allocations. Indices in `items[cellStart[c]..cellStart[c + 1]]`
 * are the glorps inside cell `c`.
 */
export type SpatialGrid = {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  readonly cellStart: Int32Array
  readonly items: Int32Array
  /** Scratch: the cell each glorp landed in during the last rebuild. */
  readonly cellOf: Int32Array
}

export const createSpatialGrid = (): SpatialGrid => {
  const cols = Math.ceil(WORLD.width / SPATIAL_CELL)
  const rows = Math.ceil(WORLD.height / SPATIAL_CELL)
  return {
    cols,
    rows,
    cellSize: SPATIAL_CELL,
    cellStart: new Int32Array(cols * rows + 1),
    items: new Int32Array(MAX_GLORPS),
    cellOf: new Int32Array(MAX_GLORPS),
  }
}

/** Column or row of a world coordinate, clamped onto the grid. */
export const cellCoord = (
  value: number,
  cellSize: number,
  limit: number,
): number => {
  const cell = Math.floor(value / cellSize)
  return cell < 0 ? 0 : cell >= limit ? limit - 1 : cell
}

/**
 * Re-bucket every glorp by its current position. Call before querying once
 * glorps have moved, been added or been removed.
 */
export const rebuildSpatialGrid = (world: World): void => {
  const grid = world.neighbors
  const { cellStart, items, cellOf, cols, rows, cellSize } = grid
  cellStart.fill(0)

  for (let index = 0; index < world.count; index += 1) {
    const col = cellCoord(world.x[index], cellSize, cols)
    const row = cellCoord(world.y[index], cellSize, rows)
    const cell = row * cols + col
    cellOf[index] = cell
    cellStart[cell + 1] += 1
  }

  for (let cell = 0; cell < cols * rows; cell += 1) {
    cellStart[cell + 1] += cellStart[cell]
  }

  // Place each index at its cell's next free slot, then restore the offsets.
  for (let index = 0; index < world.count; index += 1) {
    const cell = cellOf[index]
    items[cellStart[cell]] = index
    cellStart[cell] += 1
  }
  for (let cell = cols * rows; cell > 0; cell -= 1) {
    cellStart[cell] = cellStart[cell - 1]
  }
  cellStart[0] = 0
}
