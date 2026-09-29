import { displayName } from '@/sim/lineage'
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import type { GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

/** A point-in-time copy of one glorp, safe to hand to React. */
export type GlorpSnapshot = {
  readonly id: number
  /** User-given name, or `Glorp #id` when unnamed. */
  readonly name: string
  readonly type: GlorpType
  readonly fed: number
  readonly stamina: number
  readonly cooldown: number
  readonly x: number
  readonly y: number
  readonly traits: Readonly<Record<TraitKey, number>>
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
  name: displayName(world.lineage, world.id[index]),
  type: world.type[index] as GlorpType,
  fed: world.fed[index],
  stamina: world.stamina[index],
  cooldown: world.cooldown[index],
  x: world.x[index],
  y: world.y[index],
  traits: Object.fromEntries(
    TRAIT_KEYS.map((key) => [key, world[key][index]]),
  ) as Record<TraitKey, number>,
})
