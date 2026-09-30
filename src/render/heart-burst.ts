/**
 * Pure timing for the conception heart burst. Kept free of Three.js and of the
 * simulation config so the window math is testable on its own.
 *
 * Pregnancy is the trigger, and `pregnant` counts down from the gestation
 * duration to zero, so the burst is derived from the seconds remaining rather
 * than any extra simulation state.
 */

/** Hearts in one burst. */
export const HEARTS_PER_BURST = 3

/** Seconds a single heart is visible for. */
export const HEART_LIFE = 0.6

/** Delay before each successive heart in the burst, in seconds. */
export const HEART_STAGGER = 0.15

/** World-unit size of one heart; a glorp is 24 units across. */
export const HEART_SIZE = 8

/** World units a heart drifts upward over its life. */
export const HEART_RISE = 10

/**
 * Below this zoom hearts are too small to read, so the layer is skipped. Kept
 * at or below the camera's focus zoom so a focused glorp always shows them.
 */
export const HEART_MIN_ZOOM = 0.5

/**
 * Fraction (0..1) through one heart's life, or null when that heart is not on
 * screen yet or has already faded. `heartIndex` is its position in the burst.
 */
export const burstProgress = (
  pregnantRemaining: number,
  heartIndex: number,
  gestationSeconds: number,
): number | null => {
  if (gestationSeconds <= 0) return null
  const elapsed = gestationSeconds - pregnantRemaining
  const age = elapsed - heartIndex * HEART_STAGGER
  if (age < 0 || age >= HEART_LIFE) return null
  return age / HEART_LIFE
}
