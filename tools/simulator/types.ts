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
  /** Start-up seconds excluded from "settled" population statistics. */
  warmupSeconds: number
  /** Equal time slices for epoch tables and birth-cohort rows. */
  epochs: number
  /** Births in the final seconds are too young to judge and skipped in selection. */
  settleSeconds: number
  /** Near-crash floors; null derives them from the starting population. */
  floorPrey: number | null
  floorHunter: number | null
}

/** One simulation run requested by the CLI. */
export type Job = RunSettings & {
  checkEvery: number
  outDir: string
  writeCsv: boolean
  /** Write `individuals.json` so a sweep can pool selection data across seeds. */
  writeIndividuals: boolean
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
