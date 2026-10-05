import { describe, expect, it } from 'vitest'
import { AURA_VARIANTS } from '@/render/glorp-aura'
import { GLORP_HOLO_VARIANTS } from '@/render/glorp-holo'
import { MUTATION_LOOKS } from '@/render/mutation-looks'
import { MUTATION_KEYS } from '@/sim/mutations'
import { MUTATION_CANDIDATES } from '@/ui/HoloLab/mutation-candidates'

describe('MUTATION_CANDIDATES', () => {
  it('gives every mutation at least three candidate designs', () => {
    for (const key of MUTATION_KEYS) {
      expect(MUTATION_CANDIDATES[key].length).toBeGreaterThanOrEqual(3)
    }
  })

  it('uses only defined body and aura variants', () => {
    for (const key of MUTATION_KEYS) {
      for (const candidate of MUTATION_CANDIDATES[key]) {
        expect(GLORP_HOLO_VARIANTS).toContain(candidate.body)
        if (candidate.aura) expect(AURA_VARIANTS).toContain(candidate.aura)
      }
    }
  })

  it('lists the wired winner first so the lab cannot drift', () => {
    for (const key of MUTATION_KEYS) {
      const winner = MUTATION_LOOKS[key]
      const first = MUTATION_CANDIDATES[key][0]
      expect(first.body).toBe(winner.body)
      expect(first.aura).toBe(winner.aura)
    }
  })
})
