import { cellCoord } from '@/sim/spatial'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * Index of the nearest glorp of a given type within `maxDistance`, or -1.
 * Reads the spatial grid, so it must have been rebuilt since glorps last moved.
 * Equal distances resolve to the higher index, matching a plain linear scan.
 */
export const nearestOfType = (
  world: World,
  index: number,
  type: GlorpType,
  maxDistance: number,
  isEligible?: (candidate: number) => boolean,
): number => {
  const { cols, rows, cellSize, cellStart, items } = world.neighbors
  const x = world.x[index]
  const y = world.y[index]
  const minCol = cellCoord(x - maxDistance, cellSize, cols)
  const maxCol = cellCoord(x + maxDistance, cellSize, cols)
  const minRow = cellCoord(y - maxDistance, cellSize, rows)
  const maxRow = cellCoord(y + maxDistance, cellSize, rows)
  let bestDistance = maxDistance * maxDistance
  let best = -1

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cell = row * cols + col
      for (let slot = cellStart[cell]; slot < cellStart[cell + 1]; slot += 1) {
        const other = items[slot]
        if (other === index || world.type[other] !== type) continue
        const deltaX = world.x[other] - x
        const deltaY = world.y[other] - y
        const distance = deltaX * deltaX + deltaY * deltaY
        if (distance > bestDistance) continue
        if (distance === bestDistance && other < best) continue
        if (isEligible && !isEligible(other)) continue
        bestDistance = distance
        best = other
      }
    }
  }

  return best
}

/** Index of the glorp nearest a world point within `maxDistance`, or -1. */
export const glorpAt = (
  world: World,
  worldX: number,
  worldY: number,
  maxDistance: number,
): number => {
  let bestDistance = maxDistance * maxDistance
  let best = -1

  for (let index = 0; index < world.count; index += 1) {
    const deltaX = world.x[index] - worldX
    const deltaY = world.y[index] - worldY
    const distance = deltaX * deltaX + deltaY * deltaY
    if (distance <= bestDistance) {
      bestDistance = distance
      best = index
    }
  }

  return best
}
