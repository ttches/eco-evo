import { describe, expect, it } from 'vitest'
import { AURA_VARIANTS } from '@/render/glorp-aura'
import { GLORP_HOLO_VARIANTS } from '@/render/glorp-holo'
import {
  MUTATION_LOOKS,
  auraForMutations,
  holoForMutations,
} from '@/render/mutation-looks'
import { MUTATIONS, MUTATION_KEYS } from '@/sim/mutations'
import { GLORP_TYPE } from '@/sim/types'

describe('MUTATION_LOOKS', () => {
  it('uses only defined body and aura variants', () => {
    for (const key of MUTATION_KEYS) {
      const look = MUTATION_LOOKS[key]
      expect(GLORP_HOLO_VARIANTS).toContain(look.body)
      if (look.aura) expect(AURA_VARIANTS).toContain(look.aura)
    }
  })
})

describe('holoForMutations', () => {
  it('maps a held mutation to its wired body look', () => {
    expect(holoForMutations(MUTATIONS.coldBlooded.bit, GLORP_TYPE.prey)).toBe(
      'abyssal-oil-slick',
    )
    expect(holoForMutations(MUTATIONS.camouflage.bit, GLORP_TYPE.prey)).toBe(
      'cuttlefish-hologram',
    )
    expect(holoForMutations(MUTATIONS.stoat.bit, GLORP_TYPE.hunter)).toBe(
      'beetle-shell',
    )
    expect(holoForMutations(MUTATIONS.jumper.bit, GLORP_TYPE.prey)).toBe(
      'beetle-shell',
    )
    expect(holoForMutations(MUTATIONS.scavenger.bit, GLORP_TYPE.prey)).toBe(
      'fire-glimmer',
    )
    expect(holoForMutations(MUTATIONS.scavenger.bit, GLORP_TYPE.hunter)).toBe(
      'fire-glimmer',
    )
  })

  it('falls back to the type shimmer without a mutation', () => {
    expect(holoForMutations(0, GLORP_TYPE.prey)).toBe('disco-green')
    expect(holoForMutations(0, GLORP_TYPE.hunter)).toBe('disco-orange')
  })

  it('ignores a mutation exclusive to the other type', () => {
    // Stealth is hunter-only, so a prey glorp falls back to its type shimmer.
    expect(holoForMutations(MUTATIONS.stealth.bit, GLORP_TYPE.prey)).toBe(
      'disco-green',
    )
  })
})

describe('auraForMutations', () => {
  it('returns the aura only when the mutation carries one', () => {
    expect(auraForMutations(MUTATIONS.stealth.bit, GLORP_TYPE.hunter)).toBe(
      'smoke',
    )
    expect(auraForMutations(MUTATIONS.jumper.bit, GLORP_TYPE.prey)).toBeNull()
    expect(auraForMutations(0, GLORP_TYPE.hunter)).toBeNull()
  })
})
