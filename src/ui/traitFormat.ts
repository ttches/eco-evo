import { TRAIT_MAX } from '@/sim/traits'

/** Display text for a trait level, shared by every trait. */
export const formatTraitValue = (level: number): string =>
  `${level} / ${TRAIT_MAX}`
