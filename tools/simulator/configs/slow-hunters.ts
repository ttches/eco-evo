/**
 * Example overlay: cripple hunters so they can never catch fleeing prey.
 * Demonstrates chaining — when passed after another `--config`, its
 * `@/sim/config.base` is the previous layer, not the raw game config.
 */
export * from '@/sim/config.base'

export const HUNTER_SPRINT_MULTIPLIER = 1.0
export const HUNTER_SIGHT = 150
