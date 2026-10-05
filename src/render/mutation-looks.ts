import { glorpAuraIndex, type GlorpAuraVariant } from '@/render/glorp-aura'
import {
  glorpHoloIndex,
  holoForType,
  type GlorpHoloVariant,
} from '@/render/glorp-holo'
import {
  MUTATIONS,
  MUTATION_KEYS,
  mutationAllowedForType,
  type MutationKey,
} from '@/sim/mutations'
import type { GlorpType } from '@/sim/types'

/**
 * One candidate look for a mutation, previewed side by side in the Holo Lab.
 * `body` is the world-sheen branch; `aura` adds a halo outside the silhouette.
 */
export type MutationLookCandidate = {
  name: string
  body: GlorpHoloVariant
  aura?: GlorpAuraVariant
}

/**
 * The look a mutation wears, plus its alternates for the lab. `body`/`aura` are
 * the wired winners; `candidates` keeps every explored design so the lab can
 * compare them and nothing is lost when a winner changes.
 */
export type MutationLook = {
  body: GlorpHoloVariant
  aura?: GlorpAuraVariant
  candidates: readonly MutationLookCandidate[]
}

export const MUTATION_LOOKS: Record<MutationKey, MutationLook> = {
  coldBlooded: {
    body: 'abyssal-oil-slick',
    candidates: [
      { name: 'Abyssal Oil-Slick', body: 'abyssal-oil-slick' },
      { name: 'Dragon Scales', body: 'dragon-scales' },
      { name: 'Frosted Opal', body: 'frosted-opal' },
      { name: 'Beetle Shell', body: 'beetle-shell' },
    ],
  },
  stoat: {
    body: 'beetle-shell',
    candidates: [
      { name: 'Beetle Shell', body: 'beetle-shell' },
      { name: 'Slipstream Chrome', body: 'slipstream-chrome' },
      { name: 'Ermine Foil', body: 'ermine-foil' },
      { name: 'Peregrine Titanium', body: 'peregrine-titanium' },
    ],
  },
  jumper: {
    body: 'beetle-shell',
    candidates: [
      { name: 'Beetle Shell', body: 'beetle-shell' },
      { name: 'Leapfrog Chrome', body: 'leapfrog-chrome' },
      { name: 'Grasshopper Foil', body: 'grasshopper-foil' },
      { name: 'Sahara Gold', body: 'sahara-gold' },
    ],
  },
  camouflage: {
    body: 'cuttlefish-hologram',
    candidates: [
      { name: 'Cuttlefish Hologram', body: 'cuttlefish-hologram' },
      { name: 'Chameleon Prism', body: 'chameleon-prism' },
      { name: 'Lichen Patina', body: 'lichen-patina' },
    ],
  },
  stealth: {
    body: 'predator-glint',
    aura: 'smoke',
    candidates: [
      { name: 'Predator Glint', body: 'predator-glint', aura: 'smoke' },
      { name: 'Smoke & Ember', body: 'smoke-and-ember', aura: 'ember' },
      { name: 'Chromatic Veil', body: 'chromatic-veil', aura: 'chromatic' },
    ],
  },
}

/** The first mutation a glorp holds, respecting its type's exclusivity. */
const firstHeldMutation = (
  mask: number,
  type: GlorpType,
): MutationKey | undefined => {
  if (mask === 0) return undefined
  for (let index = 0; index < MUTATION_KEYS.length; index += 1) {
    const key = MUTATION_KEYS[index]
    if (
      (mask & MUTATIONS[key].bit) !== 0 &&
      mutationAllowedForType(key, type)
    ) {
      return key
    }
  }
  return undefined
}

/**
 * The world sheen a glorp's mutations select, falling back to the plain
 * type shimmer when it carries none (the body layer gates the sheen anyway).
 */
export const holoForMutations = (
  mask: number,
  type: GlorpType,
): GlorpHoloVariant => {
  const key = firstHeldMutation(mask, type)
  return key ? MUTATION_LOOKS[key].body : holoForType(type)
}

/** The aura a glorp's mutations select, or null when it has none. */
export const auraForMutations = (
  mask: number,
  type: GlorpType,
): GlorpAuraVariant | null => {
  const key = firstHeldMutation(mask, type)
  return key ? (MUTATION_LOOKS[key].aura ?? null) : null
}

/** Production body-sheen picker: mutation look, indexed for the shader. */
export const holoIndexForMutations = (mask: number, type: GlorpType): number =>
  glorpHoloIndex(holoForMutations(mask, type))

/** Production aura picker: aura index, or -1 when the glorp has none. */
export const auraIndexForMutations = (
  mask: number,
  type: GlorpType,
): number => {
  const aura = auraForMutations(mask, type)
  return aura ? glorpAuraIndex(aura) : -1
}
