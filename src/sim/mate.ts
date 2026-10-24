import { MATE_FED_MIN } from '@/sim/config'
import { isPackAnimal } from '@/sim/mutations'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'

/**
 * Whether a hunter may conceive this step. Lives here rather than in
 * `reproduction` so the steering layer can share it. Pack animals are sterile,
 * so they never mate, which also keeps a leader from mating with one.
 */
export const isEligibleMate = (world: World, candidate: number): boolean =>
  world.type[candidate] === GLORP_TYPE.hunter &&
  !isPackAnimal(world.mutations[candidate]) &&
  world.cooldown[candidate] <= 0 &&
  world.fed[candidate] > MATE_FED_MIN &&
  world.pregnant[candidate] <= 0
