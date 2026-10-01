/** Pure text-formatting helpers shared by every report section. */
import type { Flag } from '../analysis/health.ts'

type Maybe = number | null | undefined

const finite = (value: Maybe): value is number =>
  value !== null && value !== undefined && Number.isFinite(value)

const NA = 'n/a'

export const num = (value: Maybe, digits = 2): string =>
  finite(value) ? value.toFixed(digits) : NA

export const pct = (value: Maybe, digits = 0): string =>
  finite(value) ? `${(value * 100).toFixed(digits)}%` : NA

export const signed = (value: Maybe, digits = 2): string =>
  finite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(digits)}` : NA

export const signedPct = (value: Maybe, digits = 0): string =>
  finite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%` : NA

/** A time in whole seconds, e.g. `186s`, or `n/a`. */
export const secs = (value: Maybe): string => (finite(value) ? `${value.toFixed(0)}s` : NA)

/** Numeric-looking cells right-align so columns of numbers read cleanly. */
const NUMERIC_CELL = /^[-+~]?[\d.,]+[%sx]?( .*)?$|^n\/a$|^-$/

/** Aligned markdown table. */
export const table = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)),
  )
  const isNumeric = headers.map(
    (_, column) =>
      rows.length > 0 && rows.every((row) => NUMERIC_CELL.test(row[column] ?? '')),
  )
  const render = (cells: string[]): string =>
    `| ${cells
      .map((cell, column) =>
        isNumeric[column] ? cell.padStart(widths[column]) : cell.padEnd(widths[column]),
      )
      .join(' | ')} |`
  const rule = `|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`
  return [render(headers), rule, ...rows.map(render)].join('\n')
}

const FLAG_ICON: Record<Flag['level'], string> = { crash: '✖', warn: '⚠', info: '·' }

export const flagIcon = (level: Flag['level']): string => FLAG_ICON[level]

export const flagLines = (flags: Flag[]): string =>
  flags.length === 0
    ? '- none'
    : flags.map((flag) => `- ${flagIcon(flag.level)} ${flag.message}`).join('\n')

export const capitalize = (text: string): string => text[0].toUpperCase() + text.slice(1)
