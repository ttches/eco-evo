/**
 * Markdown report for one run. Plain aligned tables and sparklines, because the
 * primary reader is often an LLM pasted into a terminal: every number carries
 * its unit or context, and each section answers one design question.
 */
import type { SampleRow } from '../analysis/sampling.ts'
import type { RunSummary } from '../types.ts'
import { flagLines, num } from './format.ts'
import { deathsSection, predationSection } from './mortality.ts'
import { epochSection, populationSection } from './population.ts'
import { individualSections } from './traits.ts'

const TRAIT_BUDGET_NOTE = (keys: string[]): string =>
  `Build order: ${keys.join('-')}  (levels 0-7, budget-constrained)`

const headerLines = (summary: RunSummary): string[] => {
  const { run, analysis } = summary
  const o = analysis.options
  const keys = Object.keys(analysis.diversity.prey.rows[0]?.traitMean ?? {})
  const config = run.configLayers.length > 0 ? run.configLayers.join(' + ') : 'game default'
  const overrides = Object.keys(run.overrides).length > 0 ? ` + ${JSON.stringify(run.overrides)}` : ''
  return [
    `${run.endedAt.toFixed(1)}s of ${run.simSeconds}s simulated (${run.survived ? 'ran to the end' : `stopped: ${run.stopReason}`}), ` +
      `start ${run.startPrey} prey / ${run.startHunters} hunters, config: ${config}${overrides}`,
    `warmup ${o.effectiveWarmup.toFixed(0)}s · ${o.epochs} epochs · floors prey ${o.floors.prey} / hunter ${o.floors.hunter} · ` +
      `selection excludes births in the last ${o.settleSeconds}s · sim wall time ${(run.wallMs / 1000).toFixed(1)}s`,
    TRAIT_BUDGET_NOTE(keys),
  ]
}

const footerLines = (summary: RunSummary): string[] => {
  const { lineage, stamina, integrity } = summary.analysis
  const integrityNote =
    integrity.failures.length === 0
      ? `all ${integrity.checks} invariant checks passed`
      : `${integrity.failures.length} FAILED`
  return [
    `- max generation ${lineage.maxGeneration}, mean generation at death ${num(lineage.meanGenerationDead)}, ` +
      `generation time ${num(lineage.generationTimeMean, 1)}s, offspring per parent ${num(lineage.offspringPerParentMean)}`,
    `- sprint starts ${stamina.sprintStarts}, exhaustions ${stamina.exhaustionEvents}, ` +
      `sprint starts per glorp-second ${num(stamina.sprintStartsPerGlorpSecond, 3)}`,
    `- integrity: ${integrityNote}`,
  ]
}

export const formatReport = (summary: RunSummary, samples: SampleRow[]): string => {
  const { run, analysis } = summary
  return [
    `# eco-evo run report: seed ${run.seed}`,
    '',
    ...headerLines(summary),
    '',
    `## Verdict: ${analysis.health.status}`,
    '',
    flagLines(analysis.health.flags),
    '',
    '## Population',
    '',
    populationSection(analysis.dynamics, samples),
    '',
    '## Epochs',
    '',
    epochSection(analysis.dynamics.windows, analysis.flows),
    '',
    '## Deaths and lifespans',
    '',
    deathsSection(analysis.overview),
    '',
    '## Predation',
    '',
    predationSection(analysis.overview, analysis.performers.hunter, analysis.lineage.timeToFirstKill),
    '',
    '## Traits, selection, performers, builds',
    '',
    individualSections(analysis),
    '',
    '## Lineage, stamina, integrity',
    '',
    ...footerLines(summary),
  ].join('\n')
}
