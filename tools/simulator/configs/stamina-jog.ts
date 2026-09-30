/**
 * Recommended tuning: exhaustion hysteresis plus the jog tier. Mirrors the game
 * config. Stable across seeds, removes the sprint/walk flicker, and gives
 * exhausted pursuers a readable jog.
 */
export * from '@/sim/config.base'
import {
  MOVEMENT as BASE_MOVEMENT,
  STAMINA as BASE_STAMINA,
} from '@/sim/config.base'

export const MOVEMENT = {
  ...BASE_MOVEMENT,
  jogFactor: 0.7,
}

export const STAMINA = {
  ...BASE_STAMINA,
  sprintReadyFraction: 0.5,
}
