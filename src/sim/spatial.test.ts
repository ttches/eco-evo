import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import { XorShift32 } from '@/engine/math'
import { MAX_GLORPS } from '@/sim/config'
import { nearestOfType } from '@/sim/query'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import { createWorld, type World } from '@/sim/world'

/** The original O(n) scan the grid query must agree with exactly. */
const bruteNearest = (
  world: World,
  index: number,
  type: GlorpType,
  maxDistance: number,
  isEligible?: (candidate: number) => boolean,
): number => {
  let bestDistance = maxDistance * maxDistance
  let best = -1
  for (let other = 0; other < world.count; other += 1) {
    if (other === index || world.type[other] !== type) continue
    if (isEligible && !isEligible(other)) continue
    const deltaX = world.x[other] - world.x[index]
    const deltaY = world.y[other] - world.y[index]
    const distance = deltaX * deltaX + deltaY * deltaY
    if (distance <= bestDistance) {
      bestDistance = distance
      best = other
    }
  }
  return best
}

describe('rebuildSpatialGrid', () => {
  it('buckets every glorp exactly once, in the cell holding it', () => {
    const world = createWorld(MAX_GLORPS, 3)
    rebuildSpatialGrid(world)
    const { cols, cellSize, cellStart, items } = world.neighbors

    expect(cellStart[cellStart.length - 1]).toBe(world.count)
    const seen = new Set<number>()
    for (let cell = 0; cell < cellStart.length - 1; cell += 1) {
      for (let slot = cellStart[cell]; slot < cellStart[cell + 1]; slot += 1) {
        const index = items[slot]
        seen.add(index)
        expect(Math.floor(world.x[index] / cellSize)).toBe(cell % cols)
        expect(Math.floor(world.y[index] / cellSize)).toBe(
          Math.floor(cell / cols),
        )
      }
    }
    expect(seen.size).toBe(world.count)
  })
})

describe('nearestOfType on the grid', () => {
  it('matches a linear scan across ranges, types and filters', () => {
    const random = new XorShift32(77)
    for (let trial = 0; trial < 20; trial += 1) {
      const world = createWorld(200, trial + 1)
      for (let index = 0; index < world.count; index += 1) {
        world.type[index] =
          random.unit() < 0.7 ? GLORP_TYPE.prey : GLORP_TYPE.hunter
        // Snap some positions to a coarse lattice so exact distance ties occur.
        if (random.unit() < 0.3) {
          world.x[index] = Math.round(world.x[index] / 40) * 40
          world.y[index] = Math.round(world.y[index] / 40) * 40
        }
      }
      world.x[0] = 0
      world.y[0] = WORLD.height
      rebuildSpatialGrid(world)

      const isEligible = (candidate: number): boolean => candidate % 3 !== 0
      for (const range of [24, 48, 120, 220, 5000]) {
        for (let index = 0; index < world.count; index += 7) {
          for (const type of [GLORP_TYPE.prey, GLORP_TYPE.hunter]) {
            expect(nearestOfType(world, index, type, range)).toBe(
              bruteNearest(world, index, type, range),
            )
            expect(nearestOfType(world, index, type, range, isEligible)).toBe(
              bruteNearest(world, index, type, range, isEligible),
            )
          }
        }
      }
    }
  })
})
