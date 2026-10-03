/**
 * Core predator-duplication experiment: hunters must mate (no asexual clones),
 * mating costs energy, and one random parent gestates for two minutes while
 * slowed. Nothing is allocated until the gestation timer expires.
 *
 * Explicitly disables the cannibalism wildcard so overlays chained on top of
 * this (asexual, high-bar, courtship, cannibalism, mild) test one change at a
 * time.
 */
export * from '@/sim/config.base'

export const HUNTER_ASEXUAL = false
export const GESTATION_SECONDS = 120
export const MATE_ENERGY_COST = 40
export const PREGNANT_SPEED_FACTOR = 0.5
export const PREGNANT_CAN_SPRINT = false
export const CANNIBALISM = false
