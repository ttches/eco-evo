import { DEATH_CAUSE, recordDeath } from '@/sim/lineage'
import { removeGlorp } from '@/sim/store'
import { traitValue } from '@/sim/traits'
import type { World } from '@/sim/world'

/** Burning energy over time; starving glorps fall to zero and die. */
export const applyMetabolism = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    world.fed[index] -= traitValue('efficiency', world.efficiency[index]) * dt
  }
}

/** Remove every glorp that has run out of energy. */
export const applyDeath = (world: World): void => {
  for (let index = world.count - 1; index >= 0; index -= 1) {
    if (world.fed[index] > 0) continue
    recordDeath(world, index, DEATH_CAUSE.starved)
    removeGlorp(world, index)
  }
}
