/** Command-line parsing for the simulator: flags, validation, and job construction. */
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { DEFAULT_SEED, START_HUNTERS, START_PREY } from '@/sim/config'
import { TRAIT_BASE, TRAIT_KEYS, TRAIT_MAX, TRAIT_MIN } from '@/sim/traits'
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
  /** Keep at least this many hunters alive (lab control); 0 is off. */
  holdHunters: number
  /** Run a benchmark instead of ecosystem runs. */
  bench: 'chase' | null
  preyBuild: number[]
  hunterBuild: number[]
  trials: number
  benchSeconds: number
  benchDistance: number
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
  --hold-hunters <n>     Lab control: spawn a fresh founder hunter whenever fewer than n are
                        alive, to measure selection under steady predator pressure
  --no-csv              Skip lineage.csv and timeseries.csv
  --quiet               Only print errors and the final table
  --help                Show this help

Chase benchmark (one prey vs one hunter, no ecosystem):
  --bench chase         Sweep each prey trait 0..7 and report % caught and time to catch
  --prey-build <b>      Prey base build, ${TRAIT_KEYS.join('-')} (default all ${TRAIT_BASE})
  --hunter-build <b>    Hunter build (default 6-3-1-2, a typical evolved hunter)
  --trials <n>          Encounters per cell (default 200)
  --bench-seconds <n>   Seconds before an uncaught prey counts as escaped (default 30)
  --bench-distance <n>  Starting distance in world units (default 200)
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
  '--hold-hunters': 'holdHunters',
  '--trials': 'trials',
  '--bench-seconds': 'benchSeconds',
  '--bench-distance': 'benchDistance',
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
  holdHunters: 0,
  bench: null,
  preyBuild: TRAIT_KEYS.map(() => TRAIT_BASE),
  hunterBuild: [6, 3, 1, 2],
  trials: 200,
  benchSeconds: 30,
  benchDistance: 200,
})

const parseNumber = (flag: string, raw: string): number => {
  const value = Number(raw)
  if (!Number.isFinite(value))
    throw new Error(`Invalid number for ${flag}: ${raw}`)
  return value
}

const parseStopOn = (raw: string): StopOn => {
  if (!(STOP_ON as readonly string[]).includes(raw)) {
    throw new Error(`Invalid --stop-on ${raw}; expected ${STOP_ON.join('|')}`)
  }
  return raw as StopOn
}

/** A build like `6-3-1-2`: one level per trait, in `TRAIT_KEYS` order. */
export const parseBuild = (flag: string, raw: string): number[] => {
  const levels = raw.split('-').map((value) => Number(value))
  if (
    levels.length !== TRAIT_KEYS.length ||
    levels.some(
      (level) =>
        !Number.isInteger(level) || level < TRAIT_MIN || level > TRAIT_MAX,
    )
  ) {
    throw new Error(
      `Invalid ${flag} ${raw}: expected ${TRAIT_KEYS.length} levels ${TRAIT_MIN}..${TRAIT_MAX} like ${TRAIT_KEYS.map(() => TRAIT_BASE).join('-')} (${TRAIT_KEYS.join('-')})`,
    )
  }
  return levels
}

const isKeyOf = <T extends object>(
  table: T,
  key: string,
): key is Extract<keyof T, string> => Object.hasOwn(table, key)

/** Clamp values that would make a run meaningless, rather than failing late. */
const normalize = (args: Args): Args => ({
  ...args,
  epochs: Math.max(1, Math.floor(args.epochs)),
  holdHunters: Math.max(0, Math.floor(args.holdHunters)),
  trials: Math.max(1, Math.floor(args.trials)),
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

    if (isKeyOf(NUMBER_FLAGS, flag))
      fields[NUMBER_FLAGS[flag]] = parseNumber(flag, next())
    else if (isKeyOf(STRING_FLAGS, flag)) fields[STRING_FLAGS[flag]] = next()
    else if (isKeyOf(LIST_FLAGS, flag))
      (fields[LIST_FLAGS[flag]] as string[]).push(next())
    else if (isKeyOf(BOOLEAN_FLAGS, flag)) fields[BOOLEAN_FLAGS[flag]] = true
    else if (flag === '--seeds') {
      args.seeds = next()
        .split(',')
        .map((value) => parseNumber(flag, value.trim()))
    } else if (flag === '--stop-on') args.stopOn = parseStopOn(next())
    else if (flag === '--bench') {
      const kind = next()
      if (kind !== 'chase')
        throw new Error(`Invalid --bench ${kind}; expected chase`)
      args.bench = kind
    } else if (flag === '--prey-build')
      args.preyBuild = parseBuild(flag, next())
    else if (flag === '--hunter-build')
      args.hunterBuild = parseBuild(flag, next())
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
        throw new Error(
          `Invalid --set key "${key}": "${part}" is not an identifier`,
        )
      }
    }
    overrides[key] = parseValue(rest.join('='))
  }
  return overrides
}

/** The export surface `--set` keys are checked against. */
export type ConfigSurface = {
  config: Readonly<Record<string, unknown>>
  traits: Readonly<Record<string, unknown>>
}

/**
 * Reject `--set` keys that name nothing. The loader happily emits an export for
 * any identifier, so a typo would otherwise run the default config silently.
 * Top-level keys must be config exports; `HEAD.prop` needs `HEAD` to be an
 * object export holding `prop`; `TRAITS.<key>` must name an existing trait.
 */
export const validateOverrideKeys = (
  overrides: Readonly<Record<string, unknown>>,
  surface: ConfigSurface,
): void => {
  const unknown: string[] = []
  for (const key of Object.keys(overrides)) {
    const [head, prop] = key.split('.')
    if (head === 'TRAITS') {
      if (prop !== undefined && !Object.hasOwn(surface.traits, prop))
        unknown.push(key)
      continue
    }
    if (!Object.hasOwn(surface.config, head)) {
      unknown.push(key)
      continue
    }
    if (prop === undefined) continue
    const value = surface.config[head]
    if (
      typeof value !== 'object' ||
      value === null ||
      !Object.hasOwn(value, prop)
    )
      unknown.push(key)
  }
  if (unknown.length > 0) {
    throw new Error(
      `Unknown --set key(s): ${unknown.join(', ')}. Check the spelling against src/sim/config.ts.`,
    )
  }
}

/** Default output directory name: a sortable local timestamp. */
export const timestamp = (now = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

export const buildJobs = (
  args: Args,
  seeds: number[],
  baseOut: string,
): Job[] => {
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
    holdHunters: args.holdHunters,
    outDir: single ? baseOut : path.join(baseOut, `seed-${seed}`),
    writeCsv: !args.noCsv,
    writeIndividuals: !single,
  }))
}
