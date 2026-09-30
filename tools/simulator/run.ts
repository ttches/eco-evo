/**
 * Headless simulator CLI. Parses options, fans runs out to worker processes
 * (each loading the game through loader.mjs), then reports and aggregates.
 *
 * Usage:
 *   node --import ./tools/simulator/loader.mjs tools/simulator/run.ts [options]
 *   npm run test:simulator -- [options]
 */
import { spawn, type ChildProcess } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_SEED, START_HUNTERS, START_PREY } from '@/sim/config'
import {
  formatCompactHeader,
  formatCompactRow,
  formatDiff,
  formatSummary,
} from './format.ts'
import { STOP_ON, type Job, type RunSummary, type StopOn } from './types.ts'

const root = path.resolve(import.meta.dirname, '../..')
const loaderPath = pathToFileURL(path.join(import.meta.dirname, 'loader.mjs')).href
const workerPath = path.join(import.meta.dirname, 'worker.ts')

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

type Args = {
  seed: number | null
  seeds: number[] | null
  runs: number | null
  seconds: number
  prey: number
  hunters: number
  sample: number
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

const HELP = `Headless eco-evo simulator

Options:
  --seed <n>            Single seed (default ${DEFAULT_SEED})
  --seeds <a,b,c>       Explicit seed list
  --runs <n>            N consecutive seeds starting at --seed (default base ${DEFAULT_SEED})
  --seconds <n>         Simulated seconds per run (default 600)
  --prey <n>            Starting prey (default ${START_PREY})
  --hunters <n>         Starting hunters (default ${START_HUNTERS})
  --sample <seconds>    Time-series sampling interval (default 5)
  --stop-on <mode>      total | prey | hunter | either | none (default total)
  --check-every <steps> Extinction check interval in fixed steps (default 1)
  --jobs <n>            Parallel worker processes (default cpus-1)
  --out <dir>           Output directory (default runs/<timestamp>[-label])
  --label <name>        Label appended to the default output directory
  --config <file>       Config overlay; repeatable, applied left-to-right
  --set KEY=VALUE       Config override; repeatable, applied after overlays
  --baseline <path>     summary.json (or its directory) to diff against
  --no-csv              Skip lineage.csv and timeseries.csv
  --quiet               Only print errors and the final table
  --help                Show this help
`

const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const parseNumber = (flag: string, raw: string): number => {
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid number for ${flag}: ${raw}`)
  return value
}

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    seed: null,
    seeds: null,
    runs: null,
    seconds: 600,
    prey: START_PREY,
    hunters: START_HUNTERS,
    sample: 5,
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
  }

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = (): string => {
      index += 1
      const value = argv[index]
      if (value === undefined) throw new Error(`Missing value for ${flag}`)
      return value
    }
    switch (flag) {
      case '--seed':
        args.seed = parseNumber(flag, next())
        break
      case '--seeds':
        args.seeds = next()
          .split(',')
          .map((value) => parseNumber(flag, value.trim()))
        break
      case '--runs':
        args.runs = parseNumber(flag, next())
        break
      case '--seconds':
        args.seconds = parseNumber(flag, next())
        break
      case '--prey':
        args.prey = parseNumber(flag, next())
        break
      case '--hunters':
        args.hunters = parseNumber(flag, next())
        break
      case '--sample':
        args.sample = parseNumber(flag, next())
        break
      case '--stop-on': {
        const value = next() as StopOn
        if (!STOP_ON.includes(value)) {
          throw new Error(`Invalid --stop-on ${value}; expected ${STOP_ON.join('|')}`)
        }
        args.stopOn = value
        break
      }
      case '--check-every':
        args.checkEvery = parseNumber(flag, next())
        break
      case '--jobs':
        args.jobs = Math.max(1, parseNumber(flag, next()))
        break
      case '--out':
        args.out = next()
        break
      case '--label':
        args.label = next()
        break
      case '--config':
        args.config.push(next())
        break
      case '--set':
        args.set.push(next())
        break
      case '--baseline':
        args.baseline = next()
        break
      case '--no-csv':
        args.noCsv = true
        break
      case '--quiet':
        args.quiet = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new Error(`Unknown option ${flag}`)
    }
  }
  return args
}

const resolveSeeds = (args: Args): number[] => {
  if (args.seeds && args.seeds.length > 0) return args.seeds
  if (args.runs && args.runs > 0) {
    const base = args.seed ?? DEFAULT_SEED
    return Array.from({ length: args.runs }, (_, index) => base + index)
  }
  return [args.seed ?? DEFAULT_SEED]
}

const timestamp = (): string => {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

/**
 * Parse `--set KEY=VALUE` pairs. Keys are validated here for fail-fast feedback;
 * loader.mjs re-checks them because it is what generates the config module.
 */
const buildOverrides = (pairs: string[]): Record<string, unknown> => {
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

const buildJobs = (args: Args, seeds: number[], baseOut: string): Job[] => {
  const single = seeds.length === 1
  return seeds.map((seed) => ({
    seed,
    startPrey: args.prey,
    startHunters: args.hunters,
    simSeconds: args.seconds,
    sampleSeconds: args.sample,
    stopOn: args.stopOn,
    checkEvery: args.checkEvery,
    outDir: single ? baseOut : path.join(baseOut, `seed-${seed}`),
    writeCsv: !args.noCsv,
  }))
}

const children = new Set<ChildProcess>()

const runJob = (job: Job, env: NodeJS.ProcessEnv): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '--disable-warning=ExperimentalWarning',
        '--import',
        loaderPath,
        workerPath,
        JSON.stringify(job),
      ],
      { cwd: root, env, stdio: 'inherit' },
    )
    children.add(child)
    const finish = (code: number): void => {
      children.delete(child)
      resolve(code)
    }
    child.on('exit', (code) => finish(code ?? 1))
    child.on('error', (error) => {
      console.error(error)
      finish(1)
    })
  })

type PoolResult = { summaries: RunSummary[]; failures: number[] }

const runPool = async (
  jobs: Job[],
  env: NodeJS.ProcessEnv,
  concurrency: number,
  single: boolean,
  quiet: boolean,
): Promise<PoolResult> => {
  const summaries: RunSummary[] = []
  const failures: number[] = []
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= jobs.length) return
      const job = jobs[index]
      const code = await runJob(job, env)
      if (code !== 0) {
        failures.push(job.seed)
        console.error(`run seed ${job.seed} failed (exit ${code})`)
        continue
      }
      const summary = JSON.parse(
        readFileSync(path.join(job.outDir, 'summary.json'), 'utf8'),
      ) as RunSummary
      summaries.push(summary)
      if (single) {
        if (!quiet) console.log(`\n${formatSummary(summary)}`)
      } else {
        console.log(formatCompactRow(summary))
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker),
  )
  return { summaries, failures }
}

const writeSweep = (
  baseOut: string,
  configLayers: string[],
  overrides: Record<string, unknown>,
  summaries: RunSummary[],
  single: boolean,
): void => {
  mkdirSync(baseOut, { recursive: true })
  writeFileSync(
    path.join(baseOut, 'sweep.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        configLayers,
        overrides,
        runs: summaries.map((summary) => ({
          seed: summary.run.seed,
          dir: single ? baseOut : path.join(baseOut, `seed-${summary.run.seed}`),
          run: summary.run,
          metrics: {
            aliveTotal: summary.analysis.population.alive.total,
            bornTotal: summary.analysis.population.born.total,
            preyLifespanMean: summary.analysis.timeToDeath.prey.all.mean,
            preyTimeToKillMean: summary.analysis.timeToDeath.prey.eaten.mean,
            hunterLifespanMean: summary.analysis.timeToDeath.hunter.all.mean,
            totalKills: summary.analysis.predation.totalKills,
            maxGeneration: summary.analysis.lineage.maxGeneration,
          },
        })),
      },
      null,
      2,
    )}\n`,
  )
}

/** Resolve a baseline argument to a run summary, or explain why it cannot. */
const readBaseline = (baselineArg: string): RunSummary => {
  let file = path.resolve(root, baselineArg)
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = path.join(file, 'summary.json')
  }
  if (!existsSync(file)) {
    throw new Error(
      `Baseline not found: ${baselineArg} (point at a summary.json or a single-run output directory)`,
    )
  }
  if (path.basename(file) === 'sweep.json') {
    throw new Error(
      `Baseline is a sweep, not a single run: ${baselineArg} (use a seed-<n>/summary.json)`,
    )
  }
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<RunSummary>
  if (!parsed.run || !parsed.analysis) {
    throw new Error(`Baseline is not a run summary: ${file}`)
  }
  return parsed as RunSummary
}

const diffAgainstBaseline = (baselineArg: string, summaries: RunSummary[]): void => {
  const baseline = readBaseline(baselineArg)
  for (const summary of summaries) {
    console.log(`\n${formatDiff(baseline, summary)}`)
  }
}

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP)
    return
  }

  const seeds = resolveSeeds(args)
  const overrides = buildOverrides(args.set)
  const configLayers = args.config
  const baseOut = path.resolve(
    root,
    args.out ?? path.join('runs', `${timestamp()}${args.label ? `-${args.label}` : ''}`),
  )
  const single = seeds.length === 1

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SIM_CONFIG_LAYERS: JSON.stringify(configLayers),
    SIM_CONFIG_OVERRIDES: JSON.stringify(overrides),
  }

  const jobs = buildJobs(args, seeds, baseOut)
  if (!args.quiet) {
    console.log(
      `simulating ${jobs.length} run(s) · ${args.seconds}s each · ` +
        `config: ${configLayers.length > 0 ? configLayers.join(' + ') : 'game default'}` +
        (args.set.length > 0 ? ` + ${args.set.length} override(s)` : ''),
    )
  }
  if (!single) console.log(formatCompactHeader)

  const { summaries, failures } = await runPool(
    jobs,
    env,
    args.jobs,
    single,
    args.quiet,
  )
  summaries.sort((a, b) => a.run.seed - b.run.seed)
  writeSweep(baseOut, configLayers, overrides, summaries, single)

  if (args.baseline) {
    try {
      diffAgainstBaseline(args.baseline, summaries)
    } catch (error) {
      console.error(`\n${(error as Error).message}`)
      process.exitCode = 1
    }
  }

  if (!args.quiet) console.log(`\nwrote ${path.relative(root, baseOut)}/`)
  if (failures.length > 0) process.exitCode = 1
}

const handleSignal = (): void => {
  for (const child of children) child.kill('SIGTERM')
  process.exit(130)
}
process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

await main()
