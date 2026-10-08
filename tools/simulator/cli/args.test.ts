import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '@/sim/config'
import {
  buildJobs,
  buildOverrides,
  parseArgs,
  resolveSeeds,
  parseBuild,
  timestamp,
  validateOverrideKeys,
} from './args.ts'

describe('parseArgs', () => {
  it('fills numbers, strings, lists and booleans from their flag tables', () => {
    const args = parseArgs([
      '--seconds',
      '300',
      '--warmup',
      '30',
      '--out',
      'runs/x',
      '--config',
      'a.ts',
      '--config',
      'b.ts',
      '--set',
      'HUNGER=85',
      '--quiet',
      '--no-csv',
    ])
    expect(args).toMatchObject({
      seconds: 300,
      warmup: 30,
      out: 'runs/x',
      quiet: true,
      noCsv: true,
      config: ['a.ts', 'b.ts'],
      set: ['HUNGER=85'],
    })
  })

  it('validates stop-on and rejects unknown flags and missing values', () => {
    expect(parseArgs(['--stop-on', 'either']).stopOn).toBe('either')
    expect(() => parseArgs(['--stop-on', 'never'])).toThrow(/Invalid --stop-on/)
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown option/)
    expect(() => parseArgs(['--seconds'])).toThrow(/Missing value/)
    expect(() => parseArgs(['--seconds', 'abc'])).toThrow(/Invalid number/)
  })

  it('clamps epochs and jobs to sane minimums', () => {
    const args = parseArgs(['--epochs', '0', '--jobs', '0'])
    expect(args.epochs).toBe(1)
    expect(args.jobs).toBe(1)
  })
})

describe('resolveSeeds and buildJobs', () => {
  it('prefers an explicit list, then --runs from a base, then one seed', () => {
    expect(resolveSeeds(parseArgs(['--seeds', '3, 9'])).join()).toBe('3,9')
    expect(
      resolveSeeds(parseArgs(['--seed', '10', '--runs', '3'])).join(),
    ).toBe('10,11,12')
    expect(resolveSeeds(parseArgs([]))).toEqual([DEFAULT_SEED])
  })

  it('only pools individuals and nests output dirs for multi-seed runs', () => {
    const args = parseArgs([])
    const [single] = buildJobs(args, [1], '/out')
    expect(single.outDir).toBe('/out')
    expect(single.writeIndividuals).toBe(false)
    const multi = buildJobs(args, [1, 2], '/out')
    expect(multi.map((job) => job.outDir)).toEqual([
      '/out/seed-1',
      '/out/seed-2',
    ])
    expect(multi.every((job) => job.writeIndividuals)).toBe(true)
  })
})

describe('buildOverrides', () => {
  it('parses JSON values, falls back to strings, and rejects bad keys', () => {
    expect(
      buildOverrides(['HUNGER=85', 'MOVEMENT.walkFactor=0.6', 'NAME=abc']),
    ).toEqual({
      HUNGER: 85,
      'MOVEMENT.walkFactor': 0.6,
      NAME: 'abc',
    })
    expect(() => buildOverrides(['A.B.C=1'])).toThrow(/at most one/)
    expect(() => buildOverrides(['1bad=1'])).toThrow(/not an identifier/)
  })
})

describe('timestamp', () => {
  it('is a sortable local date-time', () => {
    expect(timestamp(new Date(2026, 8, 30, 4, 5, 6))).toBe('20260930-040506')
  })
})

describe('validateOverrideKeys', () => {
  const surface = {
    config: { HUNGER: 70, MOVEMENT: { walkFactor: 0.45 } },
    traits: { speed: {} },
  }

  it('accepts real top-level, nested and trait keys', () => {
    expect(() =>
      validateOverrideKeys(
        { HUNGER: 80, 'MOVEMENT.walkFactor': 0.5, 'TRAITS.speed': {} },
        surface,
      ),
    ).not.toThrow()
  })

  it('names every misspelled key instead of running the default config', () => {
    expect(() =>
      validateOverrideKeys(
        {
          HUNGRY: 80,
          'MOVEMENT.walkFactorr': 2,
          'HUNGER.x': 1,
          'TRAITS.sped': {},
        },
        surface,
      ),
    ).toThrow(/HUNGRY, MOVEMENT.walkFactorr, HUNGER.x, TRAITS.sped/)
  })
})

describe('benchmark and lab-control flags', () => {
  it('parses a chase benchmark with builds', () => {
    const args = parseArgs([
      '--bench',
      'chase',
      '--prey-build',
      '7-3-0-2',
      '--hunter-build',
      '5-3-1-3',
      '--trials',
      '50',
      '--hold-hunters',
      '20',
    ])
    expect(args).toMatchObject({
      bench: 'chase',
      preyBuild: [7, 3, 0, 2],
      hunterBuild: [5, 3, 1, 3],
      trials: 50,
      holdHunters: 20,
    })
    expect(() => parseArgs(['--bench', 'race'])).toThrow(/Invalid --bench/)
  })

  it('rejects builds with the wrong length or out-of-range levels', () => {
    expect(parseBuild('--prey-build', '1-2-3-4')).toEqual([1, 2, 3, 4])
    expect(() => parseBuild('--prey-build', '1-2-3')).toThrow(/expected 4/)
    expect(() => parseBuild('--prey-build', '9-2-3-4')).toThrow(/Invalid/)
  })
})
