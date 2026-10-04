/** Sampling the live world into time-series rows, split by glorp type. */
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import type { World } from '@/sim/world'
import { perType, type TypeCounts, type TypeName } from './types.ts'

/** Mean trait level of one type's living glorps (0 when none are alive). */
export type TraitMeans = Record<TraitKey, number>

export type SampleRow = {
  time: number
  alivePrey: number
  aliveHunter: number
  aliveTotal: number
  everBorn: number
  preyFed: number
  hunterFed: number
  hunterPregnant: number
  meanGenerationPrey: number
  meanGenerationHunter: number
  sprintDutyCycle: number
  exhaustedFraction: number
  grassMean: number
  traits: Record<TypeName, TraitMeans>
}

const zeroTraits = (): TraitMeans =>
  Object.fromEntries(TRAIT_KEYS.map((key) => [key, 0])) as TraitMeans

const typeOf = (world: World, index: number): TypeName =>
  world.type[index] === GLORP_TYPE.hunter ? 'hunter' : 'prey'

export const countAlive = (world: World): TypeCounts => {
  const counts: TypeCounts = { prey: 0, hunter: 0, total: world.count }
  for (let index = 0; index < world.count; index += 1) {
    counts[typeOf(world, index)] += 1
  }
  return counts
}

const meanGrass = (world: World): number => {
  const { values } = world.grass
  let sum = 0
  for (let index = 0; index < values.length; index += 1) sum += values[index]
  return values.length === 0 ? 0 : sum / values.length
}

/** One time-series sample of the live world. */
export const sampleWorld = (world: World): SampleRow => {
  const n = { prey: 0, hunter: 0 }
  const fed = { prey: 0, hunter: 0 }
  const generation = { prey: 0, hunter: 0 }
  const traitSums = perType(zeroTraits)
  let pregnant = 0
  let sprinting = 0
  let exhausted = 0

  for (let index = 0; index < world.count; index += 1) {
    const type = typeOf(world, index)
    n[type] += 1
    fed[type] += world.fed[index]
    generation[type] += world.lineage.generation[world.id[index]]
    if (type === 'hunter' && world.pregnant[index] > 0) pregnant += 1
    sprinting += world.sprinting[index]
    exhausted += world.exhausted[index]
    for (const key of TRAIT_KEYS) traitSums[type][key] += world[key][index]
  }

  const average = (sum: number, type: TypeName): number =>
    n[type] === 0 ? 0 : sum / n[type]
  const traits = perType((type) => {
    const means = zeroTraits()
    for (const key of TRAIT_KEYS)
      means[key] = average(traitSums[type][key], type)
    return means
  })

  return {
    time: world.time,
    alivePrey: n.prey,
    aliveHunter: n.hunter,
    aliveTotal: world.count,
    everBorn: world.lineage.size,
    preyFed: average(fed.prey, 'prey'),
    hunterFed: average(fed.hunter, 'hunter'),
    hunterPregnant: pregnant,
    meanGenerationPrey: average(generation.prey, 'prey'),
    meanGenerationHunter: average(generation.hunter, 'hunter'),
    sprintDutyCycle: world.count === 0 ? 0 : sprinting / world.count,
    exhaustedFraction: world.count === 0 ? 0 : exhausted / world.count,
    grassMean: meanGrass(world),
    traits,
  }
}

export const countOf = (row: SampleRow, type: TypeName): number =>
  type === 'prey' ? row.alivePrey : row.aliveHunter
