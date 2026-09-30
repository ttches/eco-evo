/**
 * Disables the exhaustion hysteresis and jog tier to reproduce the old
 * sprint/walk flicker (sprint at any stamina, walk when empty). Useful as the
 * flicker reference for `sprintStartsPerGlorpSecond`. It does not revert the
 * drive-priority change where exhausted pursuers keep chasing, but both runs
 * share that, so the ratio still isolates the latch.
 */
export * from '@/sim/config.base'
import {
  MOVEMENT as BASE_MOVEMENT,
  STAMINA as BASE_STAMINA,
} from '@/sim/config.base'

export const MOVEMENT = {
  ...BASE_MOVEMENT,
  jogFactor: BASE_MOVEMENT.walkFactor,
}

export const STAMINA = {
  ...BASE_STAMINA,
  sprintReadyFraction: 0,
}
