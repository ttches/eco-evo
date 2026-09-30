import { MATE_FED_MIN } from '@/sim/config'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * Whether a hunter may conceive this step. Lives here rather than in
 * `reproduction` so the steering layer can share it without importing the
 * mutation modules.
 */
export const isEligibleMate = (world: World, candidate: number): boolean =>
  world.type[candidate] === GLORP_TYPE.hunter &&
  world.cooldown[candidate] <= 0 &&
  world.fed[candidate] > MATE_FED_MIN &&
  world.pregnant[candidate] <= 0
