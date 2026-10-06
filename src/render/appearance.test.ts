import { describe, expect, it } from 'vitest'
import { glorpColor, writeGlorpColor } from '@/render/appearance'
import type { RenderableWorld } from '@/sim/view'
import { GLORP_TYPE, glorpTypeFrom } from '@/sim/types'

describe('glorpTypeFrom', () => {
  it('keeps known kinds and clamps anything else to prey', () => {
    expect(glorpTypeFrom(GLORP_TYPE.prey)).toBe(GLORP_TYPE.prey)
    expect(glorpTypeFrom(GLORP_TYPE.hunter)).toBe(GLORP_TYPE.hunter)
    expect(glorpTypeFrom(99)).toBe(GLORP_TYPE.prey)
  })
})

describe('glorpColor dodge flash', () => {
  it('brightens a dodging prey toward the flash color', () => {
    const normal = glorpColor(GLORP_TYPE.prey, 50, false, false)
    const dodging = glorpColor(GLORP_TYPE.prey, 50, false, true)

    expect(dodging[0]).toBeGreaterThan(normal[0])
    expect(dodging[1]).toBeGreaterThan(normal[1])
  })

  it('defaults to no flash', () => {
    expect(glorpColor(GLORP_TYPE.prey, 50, false)).toEqual(
      glorpColor(GLORP_TYPE.prey, 50, false, false),
    )
  })
})

describe('writeGlorpColor', () => {
  const makeWorld = (dodgeTimer: number): RenderableWorld =>
    ({
      count: 1,
      x: Float32Array.of(0),
      y: Float32Array.of(0),
      radius: 12,
      id: new Uint32Array(1),
      type: Uint8Array.of(GLORP_TYPE.prey),
      fed: Float32Array.of(50),
      pregnant: Float32Array.of(0),
      dodgeTimer: Float32Array.of(dodgeTimer),
      mutations: new Uint32Array(1),
      grass: {} as never,
      corpses: {} as never,
    }) as RenderableWorld

  it('reads the live dodge timer from the world', () => {
    const buffer = new Float32Array(3)

    writeGlorpColor(makeWorld(0), 0, buffer, 0)
    const idle = buffer[0]

    writeGlorpColor(makeWorld(0.1), 0, buffer, 0)
    expect(buffer[0]).toBeGreaterThan(idle)
  })
})
