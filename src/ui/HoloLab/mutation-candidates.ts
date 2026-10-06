import type { GlorpAuraVariant } from '@/render/glorp-aura'
import type { GlorpHoloVariant } from '@/render/glorp-holo'
import type { MutationKey } from '@/sim/mutations'

/** One alternate design for a mutation, previewed side by side in the lab. */
export type MutationCandidate = {
  body: GlorpHoloVariant
  aura?: GlorpAuraVariant
}

/**
 * Every explored design per mutation, in declaration order. The first entry is
 * the wired winner in `MUTATION_LOOKS`, which a test guards. Rows are labelled
 * from `GLORP_HOLO_LABELS`, so candidates carry no duplicate name.
 */
export const MUTATION_CANDIDATES: Record<
  MutationKey,
  readonly MutationCandidate[]
> = {
  coldBlooded: [
    { body: 'abyssal-oil-slick' },
    { body: 'dragon-scales' },
    { body: 'frosted-opal' },
    { body: 'beetle-shell' },
  ],
  stoat: [
    { body: 'beetle-shell' },
    { body: 'slipstream-chrome' },
    { body: 'ermine-foil' },
    { body: 'peregrine-titanium' },
  ],
  jumper: [
    { body: 'beetle-shell' },
    { body: 'leapfrog-chrome' },
    { body: 'grasshopper-foil' },
    { body: 'sahara-gold' },
  ],
  camouflage: [
    { body: 'cuttlefish-hologram' },
    { body: 'chameleon-prism' },
    { body: 'lichen-patina' },
  ],
  stealth: [
    { body: 'predator-glint', aura: 'smoke' },
    { body: 'smoke-and-ember', aura: 'ember' },
    { body: 'chromatic-veil', aura: 'chromatic' },
  ],
  scavenger: [
    { body: 'hyena-pelt' },
    { body: 'raccoon-bandit' },
    { body: 'bone-ribs' },
  ],
}
