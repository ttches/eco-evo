export type TraitSpec = {
  /** Spawn range, and the clamp applied to every mutation. */
  readonly min: number
  readonly max: number
  /** Global favorable direction, used to pick the better parent when mating. */
  readonly favorsHigher: boolean
}

/**
 * Every heritable trait. Adding an entry here gives each glorp a new column,
 * a directive bit, spawn rolling, inheritance and mutation. Order is fixed: it
 * sets directive bit positions and the order traits draw from the RNG.
 */
export const TRAITS = {
  speed: { min: 30, max: 70, favorsHigher: true },
  staminaMax: { min: 2, max: 8, favorsHigher: true },
  metabolism: { min: 1.5, max: 4.0, favorsHigher: false },
  reproCooldown: { min: 8, max: 25, favorsHigher: false },
  strength: { min: 1, max: 10, favorsHigher: true },
} as const satisfies Record<string, TraitSpec>

export type TraitKey = keyof typeof TRAITS

export const TRAIT_KEYS = Object.keys(TRAITS) as readonly TraitKey[]

/** Bit per trait inside a glorp's directive mask (1 = lineage prefers higher). */
export const TRAIT_BIT = Object.fromEntries(
  TRAIT_KEYS.map((key, position) => [key, 1 << position]),
) as Readonly<Record<TraitKey, number>>
