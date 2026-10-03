/**
 * Mild variant: keep hunter asexual duplication, shorten gestation, drop the
 * energy cost, and let pregnant hunters keep most of their speed.
 */
export * from '@/sim/config.base'

export const HUNTER_ASEXUAL = true
export const GESTATION_SECONDS = 45
export const MATE_ENERGY_COST = 0
export const PREGNANT_SPEED_FACTOR_MIN = 0.7
export const PREGNANT_CAN_SPRINT = true
