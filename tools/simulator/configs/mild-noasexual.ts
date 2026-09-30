/**
 * Mild no-asexual variant: hunters must mate, but gestation is short, the cost
 * is small, and pregnant hunters keep most of their speed.
 */
export * from '@/sim/config.base'

export const HUNTER_ASEXUAL = false
export const GESTATION_SECONDS = 45
export const MATE_ENERGY_COST = 15
export const PREGNANT_SPEED_FACTOR = 0.7
export const PREGNANT_CAN_SPRINT = true
