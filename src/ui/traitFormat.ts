import type { TraitKey } from '@/sim/traits'

/** Display precision per trait. Every trait must have an entry. */
export const formatTraitValue = (key: TraitKey, value: number): string => {
  if (key === 'metabolism') return value.toFixed(2)
  if (key === 'reproCooldown') return `${value.toFixed(1)}s`
  return value.toFixed(1)
}
