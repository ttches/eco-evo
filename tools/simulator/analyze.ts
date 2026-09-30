/**
 * Pure analysis over a finished `World`. Reads the lineage log to summarize
 * population, time-to-death, predation and lineage evolution. No rendering and
 * no mutation of the world.
 */
import { DEATH_CAUSE } from '@/sim/lineage'
import { TRAIT_KEYS, type TraitKey } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { World } from '@/sim/world'

export type TypeCounts = { prey: number; hunter: number; total: number }

export type Distribution = {
  count: number
  mean: number
  median: number
  p10: number
  p90: number
  min: number
  max: number
}

export type TraitMeans = Record<TraitKey, number>

export type DeathBreakdown = { starved: number; eaten: number; total: number }

export type TimeToDeath = {
  all: Distribution
  eaten: Distribution
  starved: Distribution
}

export type AgeBucket = { seconds: number; count: number }

export type SampleRow = {
  time: number
  alivePrey: number
  aliveHunter: number
  aliveTotal: number
  everBorn: number
  meanSpeed: number
  meanStamina: number
  meanMetabolism: number
  meanReproCooldown: number
  meanGeneration: number
  grassMean: number
}

export type RunAnalysis = {
  population: {
    born: TypeCounts
    alive: TypeCounts
    deaths: { prey: DeathBreakdown; hunter: DeathBreakdown }
  }
  timeToDeath: { prey: TimeToDeath; hunter: TimeToDeath }
  predation: {
    totalKills: number
    huntersEverBorn: number
    huntersWithKills: number
    meanKillsPerHunter: number
    maxKills: number
    meanTimeToFirstKill: number | null
    medianTimeToFirstKill: number | null
  }
  lineage: {
    maxGeneration: number
    meanGenerationDead: number
    generationTimeMean: number | null
    /** Mean offspring produced per individual that ever reproduced. */
    offspringPerParentMean: number
  }
  traits: {
    overall: TraitMeans
    byGeneration: { generation: number; count: number; means: TraitMeans }[]
  }
  ageAtDeath: {
    bucketSeconds: number
    prey: AgeBucket[]
    hunter: AgeBucket[]
    aliveCensored: TypeCounts
  }
}

const AGE_BUCKET_SECONDS = 30

const emptyCounts = (): TypeCounts => ({ prey: 0, hunter: 0, total: 0 })

const emptyBreakdown = (): DeathBreakdown => ({
  starved: 0,
  eaten: 0,
  total: 0,
})

const zeroTraits = (): TraitMeans =>
  Object.fromEntries(TRAIT_KEYS.map((key) => [key, 0])) as TraitMeans

const typeKey = (type: GlorpType): 'prey' | 'hunter' =>
  type === GLORP_TYPE.hunter ? 'hunter' : 'prey'

/** Nearest-rank distribution summary (p10/p50/p90, no interpolation). */
export const describe = (values: number[]): Distribution => {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, p10: 0, p90: 0, min: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number): number =>
    sorted[
      Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))
    ]
  let sum = 0
  for (const value of sorted) sum += value
  return {
    count: sorted.length,
    mean: sum / sorted.length,
    median: at(0.5),
    p10: at(0.1),
    p90: at(0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

/** Count living glorps by type. */
export const countAlive = (world: World): TypeCounts => {
  const counts = emptyCounts()
  for (let index = 0; index < world.count; index += 1) {
    counts[typeKey(world.type[index] as GlorpType)] += 1
  }
  counts.total = world.count
  return counts
}

/** Mean of one numeric column over the living population. */
const columnMean = (column: Float32Array, count: number): number => {
  if (count === 0) return 0
  let sum = 0
  for (let index = 0; index < count; index += 1) sum += column[index]
  return sum / count
}

/** One time-series sample of the live world. */
export const sampleWorld = (world: World): SampleRow => {
  const alive = countAlive(world)
  const count = world.count
  let generationSum = 0
  for (let index = 0; index < count; index += 1) {
    generationSum += world.lineage.generation[world.id[index]]
  }
  let grassSum = 0
  const grass = world.grass.values
  for (let index = 0; index < grass.length; index += 1) grassSum += grass[index]

  return {
    time: world.time,
    alivePrey: alive.prey,
    aliveHunter: alive.hunter,
    aliveTotal: alive.total,
    everBorn: world.lineage.size,
    meanSpeed: columnMean(world.speed, count),
    meanStamina: columnMean(world.staminaMax, count),
    meanMetabolism: columnMean(world.metabolism, count),
    meanReproCooldown: columnMean(world.reproCooldown, count),
    meanGeneration: count === 0 ? 0 : generationSum / count,
    grassMean: grass.length === 0 ? 0 : grassSum / grass.length,
  }
}

type GenerationTraits = { count: number; sums: TraitMeans }

type TraitAccumulator = {
  sums: TraitMeans
  byGeneration: Map<number, GenerationTraits>
}

type LineageAccumulator = {
  maxGeneration: number
  generationSumDead: number
  generationCountDead: number
  generationTimeSum: number
  generationTimeCount: number
  parents: Set<number>
}

const summarizeTraits = (
  accumulator: TraitAccumulator,
  size: number,
): RunAnalysis['traits'] => {
  const overall = zeroTraits()
  for (const key of TRAIT_KEYS) {
    overall[key] = size === 0 ? 0 : accumulator.sums[key] / size
  }
  const byGeneration = [...accumulator.byGeneration.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, { count, sums }]) => {
      const means = zeroTraits()
      for (const key of TRAIT_KEYS) means[key] = count === 0 ? 0 : sums[key] / count
      return { generation, count, means }
    })
  return { overall, byGeneration }
}

const summarizeLineage = (
  accumulator: LineageAccumulator,
): RunAnalysis['lineage'] => ({
  maxGeneration: accumulator.maxGeneration,
  meanGenerationDead:
    accumulator.generationCountDead === 0
      ? 0
      : accumulator.generationSumDead / accumulator.generationCountDead,
  generationTimeMean:
    accumulator.generationTimeCount === 0
      ? null
      : accumulator.generationTimeSum / accumulator.generationTimeCount,
  offspringPerParentMean:
    accumulator.parents.size === 0
      ? 0
      : accumulator.generationTimeCount / accumulator.parents.size,
})

const summarizePredation = (
  killsByHunter: Map<number, number>,
  firstKillAt: Map<number, number>,
  bornAt: Float64Array,
  size: number,
  huntersEverBorn: number,
): RunAnalysis['predation'] => {
  let totalKills = 0
  let maxKills = 0
  for (const kills of killsByHunter.values()) {
    totalKills += kills
    if (kills > maxKills) maxKills = kills
  }
  const firstKillDurations: number[] = []
  for (const [hunter, at] of firstKillAt) {
    if (hunter >= 0 && hunter < size) firstKillDurations.push(at - bornAt[hunter])
  }
  const firstKill = describe(firstKillDurations)
  return {
    totalKills,
    huntersEverBorn,
    huntersWithKills: killsByHunter.size,
    meanKillsPerHunter: huntersEverBorn === 0 ? 0 : totalKills / huntersEverBorn,
    maxKills,
    meanTimeToFirstKill: firstKill.count === 0 ? null : firstKill.mean,
    medianTimeToFirstKill: firstKill.count === 0 ? null : firstKill.median,
  }
}

/** Expand a sparse bucket map into a dense, gap-filled list. */
const toBuckets = (
  buckets: Map<number, number>,
  bucketSeconds: number,
): AgeBucket[] => {
  if (buckets.size === 0) return []
  let last = -1
  for (const index of buckets.keys()) {
    if (index > last) last = index
  }
  const result: AgeBucket[] = []
  for (let index = 0; index <= last; index += 1) {
    result.push({ seconds: index * bucketSeconds, count: buckets.get(index) ?? 0 })
  }
  return result
}

/** Analyze the full lineage of a finished (or early-stopped) world. */
export const analyzeWorld = (world: World): RunAnalysis => {
  const log = world.lineage
  const born = emptyCounts()
  const alive = emptyCounts()
  const deaths = { prey: emptyBreakdown(), hunter: emptyBreakdown() }
  const lifespan: Record<'prey' | 'hunter', number[]> = { prey: [], hunter: [] }
  const lifespanEaten: Record<'prey' | 'hunter', number[]> = { prey: [], hunter: [] }
  const lifespanStarved: Record<'prey' | 'hunter', number[]> = { prey: [], hunter: [] }

  const traits: TraitAccumulator = { sums: zeroTraits(), byGeneration: new Map() }
  const lineage: LineageAccumulator = {
    maxGeneration: 0,
    generationSumDead: 0,
    generationCountDead: 0,
    generationTimeSum: 0,
    generationTimeCount: 0,
    parents: new Set<number>(),
  }
  const killsByHunter = new Map<number, number>()
  const firstKillAt = new Map<number, number>()
  const ageBuckets = {
    prey: new Map<number, number>(),
    hunter: new Map<number, number>(),
  }

  for (let id = 0; id < log.size; id += 1) {
    const type = log.type[id] as GlorpType
    const key = typeKey(type)
    born[key] += 1
    born.total += 1
    if (log.generation[id] > lineage.maxGeneration) {
      lineage.maxGeneration = log.generation[id]
    }

    for (const trait of TRAIT_KEYS) traits.sums[trait] += log.traits[trait][id]

    const generation = log.generation[id]
    let bucket = traits.byGeneration.get(generation)
    if (!bucket) {
      bucket = { count: 0, sums: zeroTraits() }
      traits.byGeneration.set(generation, bucket)
    }
    bucket.count += 1
    for (const trait of TRAIT_KEYS) bucket.sums[trait] += log.traits[trait][id]

    if (log.parentA[id] >= 0) {
      lineage.parents.add(log.parentA[id])
      lineage.generationTimeSum += log.bornAt[id] - log.bornAt[log.parentA[id]]
      lineage.generationTimeCount += 1
    }
    if (log.parentB[id] >= 0) {
      lineage.parents.add(log.parentB[id])
      lineage.generationTimeSum += log.bornAt[id] - log.bornAt[log.parentB[id]]
      lineage.generationTimeCount += 1
    }

    if (log.deathCause[id] === DEATH_CAUSE.alive) {
      alive[key] += 1
      alive.total += 1
      continue
    }

    const life = log.diedAt[id] - log.bornAt[id]
    lifespan[key].push(life)
    lineage.generationSumDead += generation
    lineage.generationCountDead += 1

    const bucketIndex = Math.floor(life / AGE_BUCKET_SECONDS)
    ageBuckets[key].set(bucketIndex, (ageBuckets[key].get(bucketIndex) ?? 0) + 1)

    if (log.deathCause[id] === DEATH_CAUSE.eaten) {
      deaths[key].eaten += 1
      lifespanEaten[key].push(life)
      const killer = log.killer[id]
      if (killer >= 0) {
        killsByHunter.set(killer, (killsByHunter.get(killer) ?? 0) + 1)
        const previous = firstKillAt.get(killer)
        if (previous === undefined || log.diedAt[id] < previous) {
          firstKillAt.set(killer, log.diedAt[id])
        }
      }
    } else {
      deaths[key].starved += 1
      lifespanStarved[key].push(life)
    }
    deaths[key].total += 1
  }

  return {
    population: { born, alive, deaths },
    timeToDeath: {
      prey: {
        all: describe(lifespan.prey),
        eaten: describe(lifespanEaten.prey),
        starved: describe(lifespanStarved.prey),
      },
      hunter: {
        all: describe(lifespan.hunter),
        eaten: describe(lifespanEaten.hunter),
        starved: describe(lifespanStarved.hunter),
      },
    },
    predation: summarizePredation(
      killsByHunter,
      firstKillAt,
      log.bornAt,
      log.size,
      born.hunter,
    ),
    lineage: summarizeLineage(lineage),
    traits: summarizeTraits(traits, log.size),
    ageAtDeath: {
      bucketSeconds: AGE_BUCKET_SECONDS,
      prey: toBuckets(ageBuckets.prey, AGE_BUCKET_SECONDS),
      hunter: toBuckets(ageBuckets.hunter, AGE_BUCKET_SECONDS),
      aliveCensored: alive,
    },
  }
}
