/** Chart specs and the HTML page that hosts them. */
import { CHART_SCRIPT, PAGE_STYLE } from './chart-client.ts'

export type ChartSeries = {
  name: string
  /** A CSS color, normally one of the `var(--s1..s4)` palette slots. */
  color: string
  /** [x, y] pairs. */
  points: [number, number][]
  width?: number
  opacity?: number
}

export type ChartSpec = {
  title: string
  subtitle?: string
  series: ChartSeries[]
  /** Shade x in [0, warmup] as the excluded start-up period. */
  warmup?: number
  /** Dashed horizontal reference line (e.g. the near-crash floor). */
  floor?: number
  /** Legend entries are omitted when false (single-series charts). */
  legend?: boolean
}

/** Categorical slots 1-4 of the reference palette (defined in the page style). */
export const SLOT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'] as const

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const chartDiv = (spec: ChartSpec): string =>
  `<div class="chart" data-spec="${escapeAttr(JSON.stringify(spec))}"></div>`

export const htmlPage = (title: string, intro: string, charts: ChartSpec[]): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<style>${PAGE_STYLE}</style></head><body><main><h1>${title}</h1>${intro}` +
  `${charts.map(chartDiv).join('')}</main><script>${CHART_SCRIPT}</script></body></html>`
