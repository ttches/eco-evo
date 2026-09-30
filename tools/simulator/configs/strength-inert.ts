/**
 * Strength control: the trait exists and is inherited, but neither predation
 * nor cannibalism uses it. Isolates the RNG shift from the mechanic.
 */
export * from '@/sim/config.base'

export const STRENGTH_GATES_PREDATION = false
export const CANNIBALISM = false
