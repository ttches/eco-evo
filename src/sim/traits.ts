import { lerp } from '@/engine/math';

/** Lowest and highest level a trait can hold. */
export const TRAIT_MIN = 0;
export const TRAIT_MAX = 7;

/** Level a glorp with no specialization holds in every trait. */
export const TRAIT_BASE = 3;

/**
 * Mechanical value a trait takes at its lowest and highest level. Levels in
 * between are linear. Every trait is higher-is-better, so the "worse" traits
 * (fertility's cooldown) map level 0 to the larger number.
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
 *
 * Level 0 is a linear extrapolation of the level 1..7 line, so introducing it
 * left every existing level's value untouched. Only `agility` (whose value is
 * the level itself) hits a hard zero; the rest stay above it.
 */
export const TRAITS = {
  speed: { atMin: 70 / 3, atMax: 70 },
  /** Stamina capacity and recovery, and how slowly hunger drains. */
  endurance: { atMin: 1, atMax: 8 },
  /** Level maps to reproduction cooldown in seconds: more is faster. */
  fertility: { atMin: 167 / 6, atMax: 8 },
  /**
   * Raw agility score. Compared directly against an attacker's: equal or lower
   * means the prey is caught, higher gives a chance to dodge. It also decides
   * hunter-vs-hunter cannibalism contests, where higher wins.
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

/**
 * Interpolate `atWorst`..`atBest` across a trait's levels, from its worst value
 * (level 0) to its best (level 7). The fraction comes from the spec's
 * `atMin`/`atMax` rather than the level bounds, so it stays correct for a trait
 * whose spec maps level 0 to the larger value (fertility's cooldown).
 */
export const scaleTrait = (
  key: TraitKey,
  level: number,
  atWorst: number,
  atBest: number,
): number => {
  const { atMin, atMax } = TRAITS[key];
  const t = (traitValue(key, level) - atMin) / (atMax - atMin);
  return lerp(atWorst, atBest, t);
};
