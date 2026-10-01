/**
 * Headless simulator CLI. Parses options, fans runs out to worker processes
 * (each loading the game through loader.mjs), then reports and aggregates.
 *
 * Usage:
 *   node --import ./tools/simulator/loader.mjs tools/simulator/run.ts [options]
 *   npm run test:simulator -- [options]
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  buildJobs,
  buildOverrides,
  HELP,
  parseArgs,
  resolveSeeds,
  timestamp,
} from './cli/args.ts'
import { aggregateHeadlines, buildSweepFile } from './sweep/aggregate.ts'
import { formatComparison, readBaseline } from './sweep/compare.ts'
import { formatCompactHeader, formatCompactRow } from './sweep/progress.ts'
import { formatSweepReport, writeSweepReport } from './sweep/sweep-report.ts'
import type { Job, RunSummary } from './types.ts'

const root = path.resolve(import.meta.dirname, '../..')
const loaderPath = pathToFileURL(path.join(import.meta.dirname, 'loader.mjs')).href
const workerPath = path.join(import.meta.dirname, 'worker.ts')

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
        if (!quiet) console.log(`\n${readFileSync(path.join(job.outDir, 'report.md'), 'utf8')}`)
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

const finishSweep = (
  baseOut: string,
  configLayers: string[],
  overrides: Record<string, unknown>,
  summaries: RunSummary[],
  single: boolean,
  quiet: boolean,
): void => {
  mkdirSync(baseOut, { recursive: true })
  const dirOf = (summary: RunSummary): string =>
    single ? baseOut : path.join(baseOut, `seed-${summary.run.seed}`)
  const sweep = buildSweepFile(summaries, dirOf, configLayers, overrides)
  writeFileSync(path.join(baseOut, 'sweep.json'), `${JSON.stringify(sweep, null, 2)}\n`)
  if (single || summaries.length === 0) return
  const { markdown, html } = formatSweepReport(
    sweep,
    summaries.map((summary) => ({ dir: dirOf(summary), summary })),
  )
  writeSweepReport(baseOut, markdown, html)
  if (!quiet) console.log(`\n${markdown}`)
}

const diffAgainstBaseline = (baselineArg: string, summaries: RunSummary[]): void => {
  const baseline = readBaseline(root, baselineArg)
  const current = aggregateHeadlines(summaries.map((summary) => summary.analysis.headline))
  console.log(`\n${formatComparison(baseline, current)}`)
}

const describeConfig = (layers: string[]): string =>
  layers.length > 0 ? layers.join(' + ') : 'game default'

const compareToBaseline = (baselineArg: string, summaries: RunSummary[]): void => {
  try {
    diffAgainstBaseline(baselineArg, summaries)
  } catch (error) {
    console.error(`\n${(error as Error).message}`)
    process.exitCode = 1
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
  const baseOut = path.resolve(
    root,
    args.out ?? path.join('runs', `${timestamp()}${args.label ? `-${args.label}` : ''}`),
  )
  const single = seeds.length === 1
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SIM_CONFIG_LAYERS: JSON.stringify(args.config),
    SIM_CONFIG_OVERRIDES: JSON.stringify(overrides),
  }

  const jobs = buildJobs(args, seeds, baseOut)
  if (!args.quiet) {
    const extra = args.set.length > 0 ? ` + ${args.set.length} override(s)` : ''
    console.log(
      `simulating ${jobs.length} run(s) · ${args.seconds}s each · config: ${describeConfig(args.config)}${extra}`,
    )
  }
  if (!single) console.log(formatCompactHeader)

  const { summaries, failures } = await runPool(jobs, env, args.jobs, single, args.quiet)
  summaries.sort((a, b) => a.run.seed - b.run.seed)
  finishSweep(baseOut, args.config, overrides, summaries, single, args.quiet)
  if (args.baseline) compareToBaseline(args.baseline, summaries)

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
