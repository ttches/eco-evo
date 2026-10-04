import { describe, expect, it } from 'vitest'
import { TRAIT_KEYS } from '@/sim/traits'
import { spawnGlorp } from '@/sim/spawn'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'
import { recordDeath, DEATH_CAUSE } from '@/sim/lineage'
import { analyzeDiversity } from './diversity.ts'
import { findCycles } from './cycles.ts'
import { analyzeDynamics } from './dynamics.ts'
import type { SampleRow } from './sampling.ts'
import {
  buildTable,
  concatTables,
  parseTable,
  serializeTable,
  type Individual,
  type IndividualTable,
} from './individuals.ts'
import { checkIntegrity } from './integrity.ts'
import { analyzeSelection } from './selection.ts'
import { gini, pearson, ridgeSlopes, spearman } from './stats.ts'
import { aggregateHeadlines } from '../sweep/aggregate.ts'
import { formatComparison } from '../sweep/compare.ts'

describe('stats', () => {
  it('computes gini for equal and concentrated lists', () => {
    expect(gini([3, 3, 3, 3])).toBeCloseTo(0, 6)
    expect(gini([0, 0, 0, 10])).toBeCloseTo(0.75, 6)
  })

  it('correlates monotone data perfectly with spearman', () => {
    const xs = [1, 2, 3, 4, 5, 6]
    expect(spearman(xs, xs.map((x) => x ** 3))).toBeCloseTo(1, 6)
    expect(pearson(xs, xs.map(() => 1))).toBeNull()
  })

  it('recovers budget-relative slopes despite collinear traits', () => {
    // Four traits that always sum to 16, outcome driven by trait 0 only.
    const rows: number[][] = []
    const y: number[] = []
    let seed = 1
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 400; i += 1) {
      const row = [4, 4, 4, 4]
      for (let k = 0; k < 6; k += 1) {
        const from = Math.floor(rand() * 4)
        const to = Math.floor(rand() * 4)
        if (from !== to && row[from] > 1 && row[to] < 7) {
          row[from] -= 1
          row[to] += 1
        }
      }
      rows.push(row)
      y.push(2 * row[0])
    }
    const slopes = ridgeSlopes(rows, y)!
    expect(slopes.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 3)
    expect(slopes[0]).toBeGreaterThan(slopes[1] + 1)
    expect(slopes[0]).toBeGreaterThan(slopes[2] + 1)
  })
})

const sample = (time: number, prey: number, hunter: number): SampleRow => ({
  time,
  alivePrey: prey,
  aliveHunter: hunter,
  aliveTotal: prey + hunter,
  everBorn: 0,
  preyFed: 50,
  hunterFed: 50,
  hunterPregnant: 0,
  meanGenerationPrey: 0,
  meanGenerationHunter: 0,
  sprintDutyCycle: 0,
  exhaustedFraction: 0,
  grassMean: 0.2,
  traits: {
    prey: Object.fromEntries(TRAIT_KEYS.map((k) => [k, 4])) as SampleRow['traits']['prey'],
    hunter: Object.fromEntries(TRAIT_KEYS.map((k) => [k, 4])) as SampleRow['traits']['hunter'],
  },
})

const options = (extinctAt: { prey: number | null; hunter: number | null }) => ({
  warmupSeconds: 20,
  floors: { prey: 10, hunter: 3 },
  extinctAt,
  windows: 4,
})

describe('dynamics', () => {
  it('ignores warmup dips but flags later floor breaches', () => {
    const series: SampleRow[] = []
    for (let t = 0; t <= 100; t += 1) {
      const hunter = t < 10 ? 2 : t >= 60 && t < 70 ? 2 : 12
      series.push(sample(t, 100, hunter))
    }
    const d = analyzeDynamics(series, options({ prey: null, hunter: null }))
    expect(d.hunter.belowFloor.firstAt).toBe(60)
    expect(d.hunter.belowFloor.seconds).toBeCloseTo(10, 6)
    expect(d.hunter.settled.min).toBe(2)
    expect(d.hunter.status).toBe('near-crash')
    expect(d.prey.status).toBe('ok')

    const early = series.map((row) => ({ ...row, aliveHunter: row.time < 10 ? 2 : 12 }))
    expect(analyzeDynamics(early, options({ prey: null, hunter: null })).hunter.status).toBe('early-dip')
  })

  it('reports extinction and a full drawdown', () => {
    const series: SampleRow[] = []
    for (let t = 0; t <= 100; t += 1) series.push(sample(t, 50, t < 50 ? 10 : 0))
    const d = analyzeDynamics(series, options({ prey: null, hunter: 49 }))
    expect(d.hunter.status).toBe('extinct')
    expect(d.hunter.extinctAt).toBe(49)
    expect(d.hunter.drawdown.fraction).toBe(1)
  })

  it('finds cycles in an oscillation and none in noise', () => {
    const times = Array.from({ length: 400 }, (_, i) => i)
    const wave = times.map((t) => 100 + 80 * Math.sin((2 * Math.PI * t) / 100))
    const cycles = findCycles(wave, times, 40)
    expect(cycles.peaks).toBeGreaterThanOrEqual(3)
    expect(cycles.meanPeriod).toBeCloseTo(100, -1)
    expect(findCycles(times.map((t) => 100 + (t % 2)), times, 40).peaks).toBe(0)
  })
})

const person = (over: Partial<Individual>): Individual => ({
  run: 0, id: 0, type: 'prey', generation: 1, founder: false, bornAt: 10, endAt: 110,
  age: 100, alive: false, cause: 'starved', offspring: 0, kills: 0, cannibalKills: 0,
  eligible: true, epoch: 0, traits: [4, 4, 4, 4], ...over,
})

const tableOf = (rows: Individual[]): IndividualTable => ({
  traitKeys: TRAIT_KEYS,
  epochs: 2,
  runs: [{ seed: 1, endedAt: 200 }],
  rows,
})

describe('selection and diversity', () => {
  it('labels a trait that drives offspring as an advantage', () => {
    const rows: Individual[] = []
    for (let i = 0; i < 200; i += 1) {
      const speed = 1 + (i % 7)
      const rest = 16 - speed
      const a = Math.min(7, Math.max(1, Math.floor(rest / 3)))
      const b = Math.min(7, Math.max(1, Math.floor((rest - a) / 2)))
      const c = Math.min(7, Math.max(1, Math.round(rest - a - b - 0)))
      rows.push(person({ id: i, offspring: speed, age: 50 + speed * 5, traits: [speed, a, b, c] }))
    }
    const selection = analyzeSelection(tableOf(rows), 'prey')
    const speed = selection.traits.find((trait) => trait.trait === 'speed')!
    expect(speed.effect.offspring!).toBeGreaterThan(0.25)
    expect(speed.verdict).toBe('strong advantage')
  })

  it('measures zero variance for clones and positive for a mix', () => {
    const clones = Array.from({ length: 20 }, (_, id) => person({ id }))
    const mix = Array.from({ length: 20 }, (_, id) =>
      person({ id, traits: id % 2 === 0 ? [4, 4, 4, 4] : [6, 2, 4, 4] }),
    )
    const bounds = [{ from: 0, to: 100 }, { from: 100, to: 200 }]
    expect(analyzeDiversity(tableOf(clones), 'prey', bounds).rows[0].pairwiseDistance).toBe(0)
    const mixed = analyzeDiversity(tableOf(mix), 'prey', bounds).rows[0]
    expect(mixed.pairwiseDistance).toBeGreaterThan(0)
    expect(mixed.distinctBuilds).toBe(2)
  })

  it('detects converging builds against founders', () => {
    const founders = Array.from({ length: 20 }, (_, id) =>
      person({ id, founder: true, epoch: -1, traits: id % 2 === 0 ? [4, 4, 4, 4] : [7, 1, 4, 4] }),
    )
    const later = Array.from({ length: 20 }, (_, id) => person({ id: 100 + id, epoch: 1 }))
    const report = analyzeDiversity(tableOf([...founders, ...later]), 'prey', [])
    expect(report.trend.verdict).toBe('converging')
  })
})

describe('individual table', () => {
  it('builds offspring and kills from the lineage and round-trips through JSON', () => {
    const world = createWorld(0, 9)
    const prey = spawnGlorp(world, GLORP_TYPE.prey, 100, 100)
    const hunter = spawnGlorp(world, GLORP_TYPE.hunter, 110, 100)
    world.time = 5
    recordDeath(world, prey, DEATH_CAUSE.eaten, hunter)
    const table = buildTable(world, { epochs: 2, settleSeconds: 1, seed: 9 })
    expect(table.rows[hunter].kills).toBe(1)
    expect(table.rows[prey].cause).toBe('eaten')
    const back = parseTable(serializeTable(concatTables([table])))
    expect(back.rows).toEqual(table.rows)
  })

  it('flags corrupted lineage in the integrity check', () => {
    const world = createWorld(0, 4)
    const prey = spawnGlorp(world, GLORP_TYPE.prey, 100, 100)
    expect(checkIntegrity(world).failures).toEqual([])
    world.lineage.traits.speed[world.id[prey]] = 7
    expect(checkIntegrity(world).failures.join()).toContain('trait budget')
  })

  it('flags a mutation bit outside the registry', () => {
    const world = createWorld(0, 4)
    const prey = spawnGlorp(world, GLORP_TYPE.prey, 100, 100)
    world.lineage.mutations[world.id[prey]] = 0x80000000
    expect(checkIntegrity(world).failures.join()).toContain('unknown mutation bits')
  })
})

describe('sweep comparison', () => {
  it('marks only changes that exceed seed noise', () => {
    const make = (base: number) =>
      [0, 1, 2, 3, 4, 5].map((i) => ({
        'prey.pop.min': base + (i % 3),
        'prey.pop.mean': 400 + (i % 2 === 0 ? 30 : -30),
      }))
    const before = aggregateHeadlines(make(100))
    const after = aggregateHeadlines(make(150))
    const text = formatComparison(before, after)
    const minRow = text.split('\n').find((line) => line.includes('settled min') && line.includes('prey') === false)
    expect(text).toContain('sig ↑')
    expect(minRow).toBeDefined()
    const meanRow = text.split('\n').find((line) => line.includes('settled mean'))
    expect(meanRow).not.toContain('sig')
  })
})
