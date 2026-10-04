import { describe, expect, it } from 'vitest'
import {
  GLORP_HOLO_VARIANTS,
  glorpHoloIndex,
  holoForType,
} from '@/render/glorp-holo'
import { GLORP_HOLO_GLSL } from '@/render/glorp-holo-shader'
import { GLORP_TYPE } from '@/sim/types'

describe('holoForType', () => {
  it('shimmers prey green and hunters orange', () => {
    expect(holoForType(GLORP_TYPE.prey)).toBe('disco-green')
    expect(holoForType(GLORP_TYPE.hunter)).toBe('disco-orange')
  })
})

describe('glorpHoloIndex', () => {
  it('gives every variant a distinct index', () => {
    const indices = GLORP_HOLO_VARIANTS.map(glorpHoloIndex)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('keeps one shader branch per variant', () => {
    const branches = GLORP_HOLO_GLSL.match(/holo < /g) ?? []
    expect(branches.length).toBe(GLORP_HOLO_VARIANTS.length)
  })
})
