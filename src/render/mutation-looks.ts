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
 * The look a mutation wears in the world: `body` is the world-sheen branch;
 * `aura` adds a halo outside the silhouette. The lab's alternate designs live
 * in `src/ui/HoloLab/mutation-candidates.ts`.
 */
export type MutationLook = {
  body: GlorpHoloVariant
  aura?: GlorpAuraVariant
}

export const MUTATION_LOOKS: Record<MutationKey, MutationLook> = {
  coldBlooded: { body: 'abyssal-oil-slick' },
  stoat: { body: 'beetle-shell' },
  jumper: { body: 'beetle-shell' },
  camouflage: { body: 'cuttlefish-hologram' },
  stealth: { body: 'predator-glint', aura: 'smoke' },
  scavenger: { body: 'hyena-pelt' },
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
