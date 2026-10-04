import { describe, expect, it } from 'vitest'
import {
  HEARTS_PER_BURST,
  HEART_LIFE,
  HEART_STAGGER,
  burstProgress,
} from '@/render/heart-burst'

const GESTATION = 10

describe('burstProgress', () => {
  it('shows nothing when not pregnant', () => {
    expect(burstProgress(0, 0, GESTATION)).toBeNull()
  })

  it('shows nothing without a gestation window', () => {
    expect(burstProgress(0, 0, 0)).toBeNull()
  })

  it('shows nothing once the burst has passed', () => {
    const elapsed = HEART_LIFE + HEART_STAGGER * HEARTS_PER_BURST
    expect(burstProgress(GESTATION - elapsed, 0, GESTATION)).toBeNull()
  })

  it('starts the first heart at conception and fades it out', () => {
    expect(burstProgress(GESTATION, 0, GESTATION)).toBeCloseTo(0)
    expect(burstProgress(GESTATION - HEART_LIFE / 2, 0, GESTATION)).toBeCloseTo(
      0.5,
    )
    expect(
      burstProgress(GESTATION - HEART_LIFE - 0.01, 0, GESTATION),
    ).toBeNull()
  })

  it('staggeres later hearts behind the first', () => {
    expect(burstProgress(GESTATION, 1, GESTATION)).toBeNull()

    const afterStagger = burstProgress(GESTATION - HEART_STAGGER, 1, GESTATION)
    expect(afterStagger).toBeCloseTo(0)
  })
})
