import { describe, expect, it } from 'vitest'
import { WORLD } from '@/engine/config'
import { XorShift32 } from '@/engine/math'
import { GRASS_MIN_VALUE, GRASS_REGROW } from '@/sim/config'
import {
  consumeGrass,
  createGrass,
  grassAt,
  nearestGrassTile,
  regrowGrass,
} from '@/sim/grass'

describe('regrowGrass', () => {
  it('increases values and never exceeds one', () => {
    const grass = createGrass(1)
    grass.values.fill(0.2)

    regrowGrass(grass, 1)
    expect(grassAt(grass, 5, 5)).toBeCloseTo(0.2 + GRASS_REGROW)

    for (let tick = 0; tick < 200; tick += 1) regrowGrass(grass, 1)
    for (const value of grass.values) {
      expect(value).toBeLessThanOrEqual(1)
      expect(value).toBeGreaterThan(0.2)
    }
  })
})

describe('consumeGrass', () => {
  it('reduces grass and returns the consumed amount', () => {
    const grass = createGrass(1)
    grass.values.fill(0.5)

    const consumed = consumeGrass(grass, 5, 5, 0.2)
    expect(consumed).toBeCloseTo(0.2)
    expect(grassAt(grass, 5, 5)).toBeCloseTo(0.3)
  })

  it('never consumes more than is available or goes negative', () => {
    const grass = createGrass(1)
    grass.values.fill(0.1)

    const consumed = consumeGrass(grass, 5, 5, 5)
    expect(consumed).toBeCloseTo(0.1)
    expect(grassAt(grass, 5, 5)).toBe(0)
    expect(consumeGrass(grass, 5, 5, 1)).toBe(0)
  })
})

describe('nearestGrassTile', () => {
  it('finds the closest tile with grass and ignores bare ground', () => {
    const grass = createGrass(1)
    grass.values.fill(0)

    expect(nearestGrassTile(grass, 100, 100)).toBeNull()

    grass.values[0] = 1
    const tile = nearestGrassTile(grass, 4, 4)
    expect(tile).not.toBeNull()
    expect(tile?.x).toBeCloseTo(grass.tileSize / 2)
    expect(tile?.y).toBeCloseTo(grass.tileSize / 2)
  })
})

describe('nearestGrassTile ring search', () => {
  /** The original full-grid scan the ring search must agree with exactly. */
  const bruteNearest = (
    grass: ReturnType<typeof createGrass>,
    x: number,
    y: number,
  ): { x: number; y: number } | null => {
    const half = grass.tileSize / 2
    let bestDistance = Infinity
    let best: { x: number; y: number } | null = null
    for (let row = 0; row < grass.rows; row += 1) {
      for (let col = 0; col < grass.cols; col += 1) {
        if (grass.values[row * grass.cols + col] <= GRASS_MIN_VALUE) continue
        const centerX = col * grass.tileSize + half
        const centerY = row * grass.tileSize + half
        const distance = (centerX - x) ** 2 + (centerY - y) ** 2
        if (distance < bestDistance) {
          bestDistance = distance
          best = { x: centerX, y: centerY }
        }
      }
    }
    return best
  }

  it('matches a full scan for sparse, dense and tied layouts', () => {
    const random = new XorShift32(5)
    for (const density of [0.002, 0.05, 0.5, 1]) {
      const grass = createGrass(9)
      for (let index = 0; index < grass.values.length; index += 1) {
        grass.values[index] = random.unit() < density ? 1 : 0
      }
      for (let sample = 0; sample < 300; sample += 1) {
        // Half the probes sit on tile centers or corners, where ties happen.
        const lattice = sample % 2 === 0
        const x = lattice
          ? Math.floor(random.range(0, WORLD.width) / 16) * 16
          : random.range(0, WORLD.width)
        const y = lattice
          ? Math.floor(random.range(0, WORLD.height) / 16) * 16
          : random.range(0, WORLD.height)
        expect(nearestGrassTile(grass, x, y)).toEqual(bruteNearest(grass, x, y))
      }
    }
  })
})
