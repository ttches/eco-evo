import { describe, expect, it } from 'vitest'
import { START_HUNTERS, START_PREY } from '@/sim/config'
import { spawnGlorp } from '@/sim/spawn'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step } from '@/sim/world'
import {
  analyzeWorld,
  countAlive,
  describe as describeDistribution,
  sampleWorld,
} from './analyze.ts'

describe('describeDistribution', () => {
  it('is empty-safe', () => {
    expect(describeDistribution([]).count).toBe(0)
    expect(describeDistribution([]).mean).toBe(0)
  })

  it('summarizes with nearest-rank percentiles', () => {
    const summary = describeDistribution([1, 2, 3, 4, 5])
    expect(summary.count).toBe(5)
    expect(summary.mean).toBe(3)
    expect(summary.median).toBe(3)
    expect(summary.min).toBe(1)
    expect(summary.max).toBe(5)
    expect(summary.p10).toBe(1)
    expect(summary.p90).toBe(4)
  })
})

describe('countAlive', () => {
  it('splits the starting population by type', () => {
    const world = createWorld(START_PREY + START_HUNTERS, 7)
    expect(countAlive(world)).toEqual({
      prey: START_PREY,
      hunter: START_HUNTERS,
      total: START_PREY + START_HUNTERS,
    })
  })
})

describe('sampleWorld', () => {
  it('reads live counts and lineage totals', () => {
    const world = createWorld(0, 5)
    spawnGlorp(world, GLORP_TYPE.prey, 50, 50)
    const row = sampleWorld(world)
    expect(row.time).toBe(0)
    expect(row.aliveTotal).toBe(1)
    expect(row.alivePrey).toBe(1)
    expect(row.everBorn).toBe(1)
  })
})

describe('analyzeWorld', () => {
  it('conserves the population across born, alive and dead', () => {
    const world = createWorld(64, 123)
    for (let tick = 0; tick < 600; tick += 1) step(world, 1 / 60)

    const analysis = analyzeWorld(world)
    for (const key of ['prey', 'hunter'] as const) {
      const { born, alive, deaths } = analysis.population
      expect(deaths[key].eaten + deaths[key].starved).toBe(deaths[key].total)
      expect(deaths[key].total + alive[key]).toBe(born[key])
    }
    expect(analysis.population.alive.total).toBe(world.count)
    expect(analysis.ageAtDeath.aliveCensored).toEqual(analysis.population.alive)
  })

  it('counts every kill exactly once', () => {
    const world = createWorld(64, 321)
    for (let tick = 0; tick < 1200; tick += 1) step(world, 1 / 60)
    const analysis = analyzeWorld(world)
    expect(analysis.predation.totalKills).toBe(
      analysis.population.deaths.prey.eaten,
    )
    expect(analysis.predation.huntersEverBorn).toBe(
      analysis.population.born.hunter,
    )
  })
})
