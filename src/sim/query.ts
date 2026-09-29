import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** Index of the nearest glorp of a given type within `maxDistance`, or -1. */
export const nearestOfType = (
  world: World,
  index: number,
  type: GlorpType,
  maxDistance: number,
  isEligible?: (candidate: number) => boolean,
): number => {
  const x = world.x[index]
  const y = world.y[index]
  let bestDistance = maxDistance * maxDistance
  let best = -1

  for (let other = 0; other < world.count; other += 1) {
    if (other === index || world.type[other] !== type) continue
    if (isEligible && !isEligible(other)) continue
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

/** Index of the glorp nearest a world point within `maxDistance`, or -1. */
export const glorpAt = (
  world: World,
  worldX: number,
  worldY: number,
  maxDistance: number,
): number => {
  let bestDistance = maxDistance * maxDistance
  let best = -1

  for (let index = 0; index < world.count; index += 1) {
    const deltaX = world.x[index] - worldX
    const deltaY = world.y[index] - worldY
    const distance = deltaX * deltaX + deltaY * deltaY
    if (distance <= bestDistance) {
      bestDistance = distance
      best = index
    }
  }

  return best
}
