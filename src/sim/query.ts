import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** Index of the nearest glorp of a given type within `maxDistance`, or -1. */
export const nearestOfType = (
  world: World,
  index: number,
  type: GlorpType,
  maxDistance: number,
): number => {
  const x = world.x[index]
  const y = world.y[index]
  let bestDistance = maxDistance * maxDistance
  let best = -1

  for (let other = 0; other < world.count; other += 1) {
    if (other === index || world.type[other] !== type) continue
    const deltaX = world.x[other] - x
    const deltaY = world.y[other] - y
    const distance = deltaX * deltaX + deltaY * deltaY
    if (distance <= bestDistance) {
      bestDistance = distance
      best = other
    }
  }

  return best
}
