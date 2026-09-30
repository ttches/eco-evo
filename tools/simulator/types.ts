import type { RunAnalysis } from './analyze.ts'

export const STOP_ON = ['total', 'prey', 'hunter', 'either', 'none'] as const
export type StopOn = (typeof STOP_ON)[number]

/** Everything needed to seed and advance one simulation. */
export type RunSettings = {
  seed: number
  startPrey: number
  startHunters: number
  simSeconds: number
  sampleSeconds: number
  stopOn: StopOn
}

/** One simulation run requested by the CLI. */
export type Job = RunSettings & {
  checkEvery: number
  outDir: string
  writeCsv: boolean
}

export type RunConfig = RunSettings & {
  endedAt: number
  survived: boolean
  stopReason: StopOn | null
  configLayers: string[]
  overrides: Record<string, unknown>
  wallMs: number
  steps: number
  lineageSize: number
}

export type RunSummary = {
  run: RunConfig
  analysis: RunAnalysis
}
