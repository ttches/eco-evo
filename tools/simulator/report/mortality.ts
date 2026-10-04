/** Deaths, lifespans and predation sections. Shared by run and pooled reports. */
import type { Distribution } from '../analysis/stats.ts'
import type { Overview } from '../analysis/overview.ts'
import type { PerformerReport } from '../analysis/performers.ts'
import { TYPE_NAMES } from '../analysis/types.ts'
import { num, pct, secs, table } from './format.ts'

const lifespanRow = (label: string, d: Distribution): string[] => [
  label,
  String(d.count),
  `${num(d.mean, 1)}s`,
  `${num(d.median, 1)}s`,
  `${num(d.p10, 1)}s`,
  `${num(d.p90, 1)}s`,
]

export const deathsSection = (overview: Overview): string => {
  const { timeToDeath: t } = overview
  const counts = TYPE_NAMES.map((type) => [
    type,
    String(overview.born[type]),
    String(overview.alive[type]),
    String(overview.deaths[type].starved),
    String(overview.deaths[type].eaten),
    pct(overview.eatenShare[type]),
  ])
  const lifespans = [
    lifespanRow('prey all', t.prey.all),
    lifespanRow('prey eaten', t.prey.eaten),
    lifespanRow('prey starved', t.prey.starved),
    lifespanRow('hunter all', t.hunter.all),
    lifespanRow('hunter starved', t.hunter.starved),
    lifespanRow('hunter eaten', t.hunter.eaten),
  ].filter((row) => row[1] !== '0')
  return [
    table(
      ['type', 'born', 'alive at end', 'starved', 'eaten', 'eaten share'],
      counts,
    ),
    '',
    'Lifespan of the dead (alive-at-end excluded):',
    '',
    table(['group', 'n', 'mean', 'median', 'p10', 'p90'], lifespans),
  ].join('\n')
}

const topKillersTable = (hunters: PerformerReport): string =>
  table(
    ['id', 'gen', 'build', 'kills', 'cannibal', 'lived', 'offspring', 'ended'],
    hunters.topKillers.map((killer) => [
      `#${killer.id}${killer.run > 0 ? `/s${killer.run}` : ''}`,
      String(killer.generation),
      killer.build,
      String(killer.kills),
      killer.cannibalKills > 0 ? String(killer.cannibalKills) : '-',
      secs(killer.age),
      String(killer.offspring),
      killer.cause,
    ]),
  )

export const predationSection = (
  overview: Overview,
  hunters: PerformerReport,
  firstKill?: { mean: number | null; median: number | null },
): string => {
  const p = overview.predation
  const firstKillNote = firstKill
    ? `; time to first kill mean ${num(firstKill.mean, 1)}s, median ${num(firstKill.median, 1)}s`
    : ''
  const lines = [
    `- prey kills ${p.preyKills}, cannibal kills ${p.cannibalKills} (${p.cannibalizedNewborns} were newborns eaten at birth); ` +
      `${p.huntersWithKills}/${p.huntersEverBorn} hunters ever killed (${pct(p.zeroKillShare)} never did)`,
    `- kills per hunter: mean ${num(p.meanKillsPerHunter)}, max ${p.maxKills}; ${num(p.killsPerHunterMinute, 2)} kills per hunter-minute alive`,
    `- concentration: top 10% of hunters made ${pct(p.top10Share)} of kills (gini ${num(p.gini)})${firstKillNote}`,
  ]
  if (hunters.topKillers.length === 0) return lines.join('\n')
  return [
    ...lines,
    '',
    'Top killers (they may not be the "best" by offspring, but they shaped the ecosystem):',
    '',
    topKillersTable(hunters),
  ].join('\n')
}
