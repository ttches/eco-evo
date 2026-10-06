import { describe, expect, it } from 'vitest'
import { GLORP_AURA_GLSL } from '@/render/glorp-aura-shader'
import { GLORP_HOLO_GLSL } from '@/render/glorp-holo-shader'

/**
 * A literal `smoothstep(edge0, edge1, x)` with `edge0 >= edge1` is undefined in
 * GLSL ES 1.00; it happens to reverse-ramp on many desktop drivers but can
 * render the opposite ramp or garbage under strict compilers (e.g. ANGLE).
 * Lint, typecheck and build cannot see inside the shader strings, so this test
 * is the guard. Only literal edge pairs are checked; variable edges are left
 * alone.
 */
const DESCENDING_SMOOTHSTEP =
  /smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/g

const descendingEdges = (source: string): string[] => {
  const offenders: string[] = []
  for (const match of source.matchAll(DESCENDING_SMOOTHSTEP)) {
    if (Number(match[1]) >= Number(match[2])) offenders.push(match[0])
  }
  return offenders
}

describe('shader smoothstep edge ordering', () => {
  it('never passes a descending literal edge pair', () => {
    expect(descendingEdges(GLORP_HOLO_GLSL)).toEqual([])
    expect(descendingEdges(GLORP_AURA_GLSL)).toEqual([])
  })
})
