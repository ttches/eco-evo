import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** A point-in-time copy of one glorp, safe to hand to React. */
export type GlorpSnapshot = {
  readonly id: number
  readonly type: GlorpType
  readonly fed: number
  readonly stamina: number
  readonly staminaMax: number
  readonly metabolism: number
  readonly speed: number
  readonly reproCooldown: number
  readonly cooldown: number
  readonly x: number
  readonly y: number
}

/** Index of the glorp carrying a given stable id, or -1 if it is gone. */
export const findGlorpById = (world: World, id: number): number => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.id[index] === id) return index
  }
  return -1
}

/** Read one glorp out of the parallel arrays into a plain snapshot. */
export const readGlorp = (world: World, index: number): GlorpSnapshot => ({
  id: world.id[index],
  type: world.type[index] as GlorpType,
  fed: world.fed[index],
  stamina: world.stamina[index],
  staminaMax: world.staminaMax[index],
  metabolism: world.metabolism[index],
  speed: world.speed[index],
  reproCooldown: world.reproCooldown[index],
  cooldown: world.cooldown[index],
  x: world.x[index],
  y: world.y[index],
})
