import { describe, expect, it } from 'vitest'
import { TRAIT_KEYS } from '@/sim/traits'
import type { Individual, IndividualTable } from './individuals.ts'
import { analyzeMatched, withinGroupOls } from './matched.ts'

const person = (over: Partial<Individual>): Individual => ({
  run: 0,
  id: 0,
  type: 'prey',
  generation: 1,
  founder: false,
  bornAt: 10,
  endAt: 110,
  age: 100,
  alive: false,
  cause: 'starved',
  offspring: 0,
  kills: 0,
  cannibalKills: 0,
  eligible: true,
  epoch: 0,
  traits: [3, 3, 3, 3],
  mutations: 0,
  flights: 0,
  escapes: 0,
  dodges: 0,
  whiffs: 0,
  ...over,
})

describe('withinGroupOls', () => {
  it('recovers a slope and ignores per-group offsets', () => {
    const samples = []
    for (let group = 0; group < 4; group += 1) {
      for (let x = 0; x < 6; x += 1) {
        samples.push({ group: String(group), x: [x], y: 100 * group + 2 * x })
      }
    }
    const [fit] = withinGroupOls(samples) ?? []
    expect(fit?.perPoint).toBeCloseTo(2, 6)
    expect(fit?.se).toBeCloseTo(0, 6)
  })
})

describe('analyzeMatched', () => {
  it('compares peers born together, not early births with late ones', () => {
    // Late births face a harsher world (fewer offspring) and happen to carry
    // more speed. Pooled, speed looks harmful; within each window it helps.
    const rows: Individual[] = []
    let id = 0
    for (const [bornAt, base, speeds] of [
      [5, 4, [1, 2, 3]],
      [65, 0, [5, 6, 7]],
    ] as const) {
      for (const speed of speeds) {
        for (let copy = 0; copy < 3; copy += 1) {
          rows.push(
            person({
              id: id++,
              bornAt,
              // Points come out of fertility (index 2) as speed rises.
              traits: [speed, 3, 9 - speed, 0],
              offspring: base + 0.5 * speed + (copy - 1) * 0.1,
            }),
          )
        }
      }
    }
    const table: IndividualTable = {
      traitKeys: TRAIT_KEYS,
      epochs: 1,
      runs: [{ seed: 1, endedAt: 200 }],
      rows,
    }
    const report = analyzeMatched(table, 'prey')
    expect(report.reference).toBe('fertility')
    const speed = report.traits.find((trait) => trait.trait === 'speed')
    expect(speed?.estimates.offspring?.perPoint).toBeCloseTo(0.5, 1)
    expect(speed?.verdict).toBe('beats')
  })
})
