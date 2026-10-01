/** Command-line parsing for the simulator: flags, validation, and job construction. */
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { DEFAULT_SEED, START_HUNTERS, START_PREY } from '@/sim/config'
import { STOP_ON, type Job, type StopOn } from '../types.ts'

export type Args = {
  seed: number | null
  seeds: number[] | null
  runs: number | null
  seconds: number
  prey: number
  hunters: number
  sample: number
  warmup: number
  epochs: number
  settle: number
  floorPrey: number | null
  floorHunter: number | null
  stopOn: StopOn
  checkEvery: number
  jobs: number
  out: string | null
  label: string | null
  config: string[]
  set: string[]
  baseline: string | null
  noCsv: boolean
  quiet: boolean
  help: boolean
}

export const HELP = `Headless eco-evo simulator

Options:
  --seed <n>            Single seed (default ${DEFAULT_SEED})
  --seeds <a,b,c>       Explicit seed list
  --runs <n>            N consecutive seeds starting at --seed (default base ${DEFAULT_SEED})
  --seconds <n>         Simulated seconds per run (default 600)
  --prey <n>            Starting prey (default ${START_PREY})
  --hunters <n>         Starting hunters (default ${START_HUNTERS})
  --sample <seconds>    Time-series sampling interval (default 2)
  --warmup <seconds>    Start-up period excluded from settled population stats (default 120,
                        clamped to 25% of the run)
  --epochs <n>          Equal time slices for epoch tables / birth cohorts (default 5)
  --settle <seconds>    Ignore births in the last N seconds for selection stats (default 60)
  --floor-prey <n>      Near-crash floor for prey (default 15% of starting prey)
  --floor-hunter <n>    Near-crash floor for hunters (default 40% of starting hunters)
  --stop-on <mode>      total | prey | hunter | either | none (default total)
  --check-every <steps> Extinction check interval in fixed steps (default 1)
  --jobs <n>            Parallel worker processes (default cpus-1)
  --out <dir>           Output directory (default runs/<timestamp>[-label])
  --label <name>        Label appended to the default output directory
  --config <file>       Config overlay; repeatable, applied left-to-right
  --set KEY=VALUE       Config override; repeatable, applied after overlays
  --baseline <path>     Run or sweep directory (or sweep.json / summary.json) to compare against
  --no-csv              Skip lineage.csv and timeseries.csv
  --quiet               Only print errors and the final table
  --help                Show this help
`

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

// Flag tables: each maps a flag to the `Args` field it fills.
const NUMBER_FLAGS = {
  '--seed': 'seed',
  '--runs': 'runs',
  '--seconds': 'seconds',
  '--prey': 'prey',
  '--hunters': 'hunters',
  '--sample': 'sample',
  '--warmup': 'warmup',
  '--epochs': 'epochs',
  '--settle': 'settle',
  '--floor-prey': 'floorPrey',
  '--floor-hunter': 'floorHunter',
  '--check-every': 'checkEvery',
  '--jobs': 'jobs',
} as const satisfies Record<string, keyof Args>

const STRING_FLAGS = {
  '--out': 'out',
  '--label': 'label',
  '--baseline': 'baseline',
} as const satisfies Record<string, keyof Args>

const LIST_FLAGS = {
  '--config': 'config',
  '--set': 'set',
} as const satisfies Record<string, keyof Args>

const BOOLEAN_FLAGS = {
  '--no-csv': 'noCsv',
  '--quiet': 'quiet',
  '--help': 'help',
  '-h': 'help',
} as const satisfies Record<string, keyof Args>

const defaultArgs = (): Args => ({
  seed: null,
  seeds: null,
  runs: null,
  seconds: 600,
  prey: START_PREY,
  hunters: START_HUNTERS,
  sample: 2,
  warmup: 120,
  epochs: 5,
  settle: 60,
  floorPrey: null,
  floorHunter: null,
  stopOn: 'total',
  checkEvery: 1,
  jobs: Math.max(1, availableParallelism() - 1),
  out: null,
  label: null,
  config: [],
  set: [],
  baseline: null,
  noCsv: false,
  quiet: false,
  help: false,
})

const parseNumber = (flag: string, raw: string): number => {
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid number for ${flag}: ${raw}`)
  return value
}

const parseStopOn = (raw: string): StopOn => {
  if (!(STOP_ON as readonly string[]).includes(raw)) {
    throw new Error(`Invalid --stop-on ${raw}; expected ${STOP_ON.join('|')}`)
  }
  return raw as StopOn
}

const isKeyOf = <T extends object>(table: T, key: string): key is Extract<keyof T, string> =>
  Object.hasOwn(table, key)

/** Clamp values that would make a run meaningless, rather than failing late. */
const normalize = (args: Args): Args => ({
  ...args,
  epochs: Math.max(1, Math.floor(args.epochs)),
  jobs: Math.max(1, args.jobs),
})

export const parseArgs = (argv: string[]): Args => {
  const args = defaultArgs()
  const fields = args as Record<string, unknown>

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = (): string => {
      index += 1
      const value = argv[index]
      if (value === undefined) throw new Error(`Missing value for ${flag}`)
      return value
    }

    if (isKeyOf(NUMBER_FLAGS, flag)) fields[NUMBER_FLAGS[flag]] = parseNumber(flag, next())
    else if (isKeyOf(STRING_FLAGS, flag)) fields[STRING_FLAGS[flag]] = next()
    else if (isKeyOf(LIST_FLAGS, flag)) (fields[LIST_FLAGS[flag]] as string[]).push(next())
    else if (isKeyOf(BOOLEAN_FLAGS, flag)) fields[BOOLEAN_FLAGS[flag]] = true
    else if (flag === '--seeds') {
      args.seeds = next()
        .split(',')
        .map((value) => parseNumber(flag, value.trim()))
    } else if (flag === '--stop-on') args.stopOn = parseStopOn(next())
    else throw new Error(`Unknown option ${flag}`)
  }
  return normalize(args)
}

export const resolveSeeds = (args: Args): number[] => {
  if (args.seeds && args.seeds.length > 0) return args.seeds
  const base = args.seed ?? DEFAULT_SEED
  if (args.runs && args.runs > 0) {
    return Array.from({ length: args.runs }, (_, index) => base + index)
  }
  return [base]
}

const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * Parse `--set KEY=VALUE` pairs. Keys are validated here for fail-fast feedback;
 * loader.mjs re-checks them because it is what generates the config module.
 */
export const buildOverrides = (pairs: string[]): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {}
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=')
    const parts = key.split('.')
    if (parts.length > 2) {
      throw new Error(
        `Invalid --set key "${key}": at most one "." is allowed, e.g. MOVEMENT.walkFactor`,
      )
    }
    for (const part of parts) {
      if (!IDENTIFIER.test(part)) {
        throw new Error(`Invalid --set key "${key}": "${part}" is not an identifier`)
      }
    }
    overrides[key] = parseValue(rest.join('='))
  }
  return overrides
}

/** Default output directory name: a sortable local timestamp. */
export const timestamp = (now = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

export const buildJobs = (args: Args, seeds: number[], baseOut: string): Job[] => {
  const single = seeds.length === 1
  return seeds.map((seed) => ({
    seed,
    startPrey: args.prey,
    startHunters: args.hunters,
    simSeconds: args.seconds,
    sampleSeconds: args.sample,
    warmupSeconds: args.warmup,
    epochs: args.epochs,
    settleSeconds: args.settle,
    floorPrey: args.floorPrey,
    floorHunter: args.floorHunter,
    stopOn: args.stopOn,
    checkEvery: args.checkEvery,
    outDir: single ? baseOut : path.join(baseOut, `seed-${seed}`),
    writeCsv: !args.noCsv,
    writeIndividuals: !single,
  }))
}
