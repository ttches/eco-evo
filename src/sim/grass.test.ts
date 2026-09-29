import { describe, expect, it } from 'vitest'
import { GRASS_REGROW } from '@/sim/config'
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
