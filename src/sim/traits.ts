/** Lowest and highest level a trait can hold. */
export const TRAIT_MIN = 1;
export const TRAIT_MAX = 7;

/** Level a glorp with no specialization holds in every trait. */
export const TRAIT_BASE = 3;

/**
 * Mechanical value a trait takes at its lowest and highest level. Levels in
 * between are linear. Every trait is higher-is-better, so the "worse" traits
 * (metabolism, cooldown) map level 1 to the larger number.
 */
type TraitSpec = {
  readonly atMin: number;
  readonly atMax: number;
};

/**
 * Every heritable trait, stored per glorp as an integer level in
 * `TRAIT_MIN..TRAIT_MAX`. Adding an entry gives each glorp a new column,
 * spawn rolling, inheritance and mutation, and raises `TRAIT_BUDGET`. Order is
 * fixed: it sets the order traits draw from the RNG.
 */
export const TRAITS = {
  speed: { atMin: 30, atMax: 70 },
  staminaMax: { atMin: 2, atMax: 8 },
  /** Level maps to reproduction cooldown in seconds: more is faster. */
  fertility: { atMin: 25, atMax: 8 },
  strength: { atMin: TRAIT_MIN, atMax: TRAIT_MAX },
  /**
   * Raw agility score, compared directly against an attacker's. Equal or lower
   * means the prey is caught; higher gives a chance to dodge.
   */
  agility: { atMin: TRAIT_MIN, atMax: TRAIT_MAX },
} as const satisfies Record<string, TraitSpec>;

export type TraitKey = keyof typeof TRAITS;

export const TRAIT_KEYS = Object.keys(TRAITS) as readonly TraitKey[];

/** One glorp's trait levels. */
export type TraitLevels = Record<TraitKey, number>;

/** Mechanical value of every trait at each level, indexed by level. */
const VALUES = Object.fromEntries(
  TRAIT_KEYS.map((key) => {
    const { atMin, atMax } = TRAITS[key];
    const table = new Float64Array(TRAIT_MAX + 1);
    for (let level = TRAIT_MIN; level <= TRAIT_MAX; level += 1) {
      table[level] =
        atMin +
        ((atMax - atMin) * (level - TRAIT_MIN)) / (TRAIT_MAX - TRAIT_MIN);
    }
    return [key, table];
  }),
) as Record<TraitKey, Float64Array>;

/** Mechanical value of a trait at an integer level. */
export const traitValue = (key: TraitKey, level: number): number =>
  VALUES[key][level];
