/**
 * Runs exactly one simulation job and writes its artifacts. Spawned as a child
 * process by run.ts with `--import loader.mjs` so config overlays/overrides in
 * the environment take effect before the game code is loaded.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { FIXED_STEP } from '@/engine/config'
import { spawnRandom } from '@/sim/spawn'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step } from '@/sim/world'
import { countAlive, sampleWorld, type SampleRow } from './analysis/sampling.ts'
import { analyzeWorld, defaultFloors } from './analyze.ts'
import {
    writeLineageCsv,
  writePoolingData,
  writeReports,
  writeSummaryJson,
  writeTimeseriesCsv,
} from './artifacts.ts'
import type { Job, RunConfig, RunSettings, RunSummary, StopOn } from './types.ts'

const parseEnv = <T>(name: string, fallback: T): T => {
  const raw = process.env[name]
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new Error(`Invalid ${name}: ${(error as Error).message}`)
  }
}

/** Which population, if any, has collapsed this step. */
const stopHit = (
  world: ReturnType<typeof createWorld>,
  stopOn: StopOn,
): StopOn | null => {
  if (stopOn === 'none') return null
  if (stopOn === 'total') return world.count === 0 ? 'total' : null
  const counts = countAlive(world)
  if (stopOn === 'prey') return counts.prey === 0 ? 'prey' : null
  if (stopOn === 'hunter') return counts.hunter === 0 ? 'hunter' : null
  if (counts.prey === 0) return 'prey'
  if (counts.hunter === 0) return 'hunter'
  return null
}

/** Build the starting population explicitly, prey then hunters. */
const seedWorld = (settings: RunSettings) => {
  const world = createWorld(0, settings.seed)
  for (let index = 0; index < settings.startPrey; index += 1) {
    spawnRandom(world, GLORP_TYPE.prey)
  }
  for (let index = 0; index < settings.startHunters; index += 1) {
    spawnRandom(world, GLORP_TYPE.hunter)
  }
  return world
}

const advance = (
  world: ReturnType<typeof createWorld>,
  settings: RunSettings,
  checkEvery: number,
): { timeseries: SampleRow[]; stopReason: StopOn | null; steps: number } => {
  const dt = FIXED_STEP
  const totalSteps = Math.max(0, Math.round(settings.simSeconds / dt))
  const sampleEvery = Math.max(1, Math.round(settings.sampleSeconds / dt))
  const timeseries: SampleRow[] = [sampleWorld(world)]
  let stopReason: StopOn | null = null
  let steps = 0

  for (let index = 0; index < totalSteps; index += 1) {
    step(world, dt)
    steps += 1
    if (steps % sampleEvery === 0) timeseries.push(sampleWorld(world))
    if (steps % checkEvery === 0) {
      const hit = stopHit(world, settings.stopOn)
      if (hit) {
        stopReason = hit
        break
      }
    }
  }
  // Always end on a sample so "end" statistics describe the final state.
  if (timeseries[timeseries.length - 1].time < world.time) {
    timeseries.push(sampleWorld(world))
  }
  return { timeseries, stopReason, steps }
}

const run = (job: Job): void => {
  const { checkEvery, outDir, writeCsv, writeIndividuals, ...settings } = job
  const world = seedWorld(settings)
  const started = performance.now()
  const { timeseries, stopReason, steps } = advance(
    world,
    settings,
    Math.max(1, Math.floor(checkEvery)),
  )
  const wallMs = performance.now() - started

  const runConfig: RunConfig = {
    ...settings,
    endedAt: world.time,
    survived: stopReason === null,
    stopReason,
    configLayers: parseEnv<string[]>('SIM_CONFIG_LAYERS', []),
    overrides: parseEnv<Record<string, unknown>>('SIM_CONFIG_OVERRIDES', {}),
    wallMs,
    steps,
    lineageSize: world.lineage.size,
  }
  const defaults = defaultFloors(settings.startPrey, settings.startHunters)
  const analysis = analyzeWorld(world, timeseries, {
    seed: settings.seed,
    warmupSeconds: settings.warmupSeconds,
    epochs: settings.epochs,
    settleSeconds: settings.settleSeconds,
    floors: {
      prey: settings.floorPrey ?? defaults.prey,
      hunter: settings.floorHunter ?? defaults.hunter,
    },
  })
  const summary: RunSummary = { run: runConfig, analysis }

  mkdirSync(outDir, { recursive: true })
  writeSummaryJson(path.join(outDir, 'summary.json'), summary)
  writeReports(outDir, summary, timeseries)
  if (writeIndividuals) writePoolingData(outDir, world, summary, timeseries)
  if (writeCsv) {
    writeLineageCsv(path.join(outDir, 'lineage.csv'), world)
    writeTimeseriesCsv(path.join(outDir, 'timeseries.csv'), timeseries)
  }
}

const job = JSON.parse(process.argv[2] ?? '{}') as Job
run(job)
