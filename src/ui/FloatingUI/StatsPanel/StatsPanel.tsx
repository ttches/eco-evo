import { memo, useMemo, useState } from 'react'
import { BarChart3, X } from 'lucide-react'
import {
  filterStats,
  isStatKey,
  sortStats,
  sortValue,
  summarizeStats,
  traitExtremesFromStats,
  type DietFilter,
  type GlorpStat,
  type SortKey,
  type StatKey,
  type StatusFilter,
} from '@/sim/leaderboard'
import type { TraitKey } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import GlorpTypeBadge from '@/ui/GlorpInspector/GlorpTypeBadge/GlorpTypeBadge'
import { formatTraitValue } from '@/ui/traitFormat'
import { useEscapeKey } from '@/ui/useEscapeKey'
import styles from './StatsPanel.module.css'

type StatsPanelProps = {
  open: boolean
  onClose: () => void
  stats: readonly GlorpStat[]
  onNavigate: (id: number) => void
}

/** Most rows to render; the all-time list can grow without bound. */
const MAX_ROWS = 100

type StatTab = {
  label: string
  format: (value: number) => string
}

/** Ranked columns, in display order. Every `StatKey` must have an entry. */
const TABS = {
  offspring: { label: 'Offspring', format: (v) => `${v}` },
  descendants: { label: 'Descendants', format: (v) => `${v}` },
  kills: { label: 'Kills', format: (v) => `${v}` },
  timeAlive: { label: 'Time alive', format: (v) => `${v.toFixed(1)}s` },
} satisfies Record<StatKey, StatTab>

const TAB_KEYS = Object.keys(TABS) as StatKey[]

const DIETS: readonly { value: DietFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: GLORP_TYPE.prey, label: 'Prey' },
  { value: GLORP_TYPE.hunter, label: 'Predator' },
]

const STATUSES: readonly { value: StatusFilter; label: string }[] = [
  { value: 'dead', label: 'Dead' },
  { value: 'both', label: 'Both' },
  { value: 'alive', label: 'Alive' },
]

const TRAIT_LABEL: Record<TraitKey, string> = {
  speed: 'Fastest',
  staminaMax: 'Most stamina',
  fertility: 'Most fertile',
  strength: 'Strongest',
  agility: 'Most agile',
}

const SummaryItem = ({ label, value }: { label: string; value: number }) => (
  <div className={styles.summaryItem}>
    <span className={styles.summaryValue}>{value}</span>
    <span className={styles.summaryLabel}>{label}</span>
  </div>
)

type StatRowProps = {
  entry: GlorpStat
  index: number
  value: number
  format: (value: number) => string
  onNavigate: (id: number) => void
}

/** One ranked row, memoized so App's selection refresh skips the whole list. */
const StatRow = memo(
  ({ entry, index, value, format, onNavigate }: StatRowProps) => (
    <li>
      <button
        type="button"
        className={`${styles.row} ${entry.alive ? '' : styles.rowDead}`}
        onClick={() => onNavigate(entry.id)}
      >
        <span className={styles.rank}>{index + 1}</span>
        <GlorpTypeBadge type={entry.type} size="small" />
        <span className={styles.name}>{entry.name}</span>
        <span className={styles.value}>{format(value)}</span>
      </button>
    </li>
  ),
)

/**
 * All-time leaderboard over the lineage log: population totals, the best glorp
 * per trait, and ranked lists. The diet and life-status toggles filter every
 * section at once, and any ranked column or trait card can sort the list. Rows
 * link to the inspector, so dead record-holders stay clickable.
 */
const StatsPanel = ({
  open,
  onClose,
  stats,
  onNavigate,
}: StatsPanelProps) => {
  const [active, setActive] = useState<SortKey>('offspring')
  const [diet, setDiet] = useState<DietFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('both')
  useEscapeKey(open, onClose)

  const pool = useMemo(
    () => filterStats(stats, diet, status),
    [stats, diet, status],
  )
  const summary = useMemo(() => summarizeStats(pool), [pool])
  const extremes = useMemo(() => traitExtremesFromStats(pool), [pool])
  const sorted = useMemo(() => sortStats(pool, active), [pool, active])
  const formatActive = useMemo(
    () =>
      isStatKey(active)
        ? TABS[active].format
        : formatTraitValue,
    [active],
  )
  const rows = sorted.slice(0, MAX_ROWS)

  if (!open) return null

  return (
    <aside className={styles.panel} aria-label="Glorp statistics">
      <header className={styles.header}>
        <span className={styles.titleGroup}>
          <BarChart3 aria-hidden="true" />
          <h2 className={styles.title}>Stats</h2>
        </span>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close stats"
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className={styles.filterRow}>
        <div className={styles.filter} role="group" aria-label="Filter by diet">
          {DIETS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={diet === option.value}
              className={`${styles.tab} ${
                diet === option.value ? styles.tabActive : ''
              }`}
              onClick={() => setDiet(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          className={styles.filter}
          role="group"
          aria-label="Filter by life status"
        >
          {STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              className={`${styles.tab} ${
                status === option.value ? styles.tabActive : ''
              }`}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.summary} aria-label="Population">
        <SummaryItem label="Alive" value={summary.alive} />
        <SummaryItem label="Born" value={summary.totalBorn} />
        <SummaryItem label="Deaths" value={summary.deaths} />
        <SummaryItem label="Prey" value={summary.prey} />
        <SummaryItem label="Hunters" value={summary.hunters} />
      </section>

      <section className={styles.extremes} aria-label="Trait leaders">
        {extremes.map((extreme) => (
          <button
            key={extreme.key}
            type="button"
            aria-pressed={active === extreme.key}
            className={`${styles.extreme} ${
              active === extreme.key ? styles.extremeActive : ''
            }`}
            onClick={() => setActive(extreme.key)}
          >
            <span className={styles.extremeLabel}>
              {TRAIT_LABEL[extreme.key]}
            </span>
            <span className={styles.extremeName}>{extreme.name}</span>
            <span className={styles.extremeValue}>
              {formatTraitValue(extreme.value)}
            </span>
          </button>
        ))}
      </section>

      <div className={styles.tabs} role="group" aria-label="Sort stats by">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === active}
            className={`${styles.tab} ${key === active ? styles.tabActive : ''}`}
            onClick={() => setActive(key)}
          >
            {TABS[key].label}
          </button>
        ))}
      </div>

      <ol className={styles.list}>
        {rows.map((entry, index) => (
          <StatRow
            key={entry.id}
            entry={entry}
            index={index}
            value={sortValue(entry, active)}
            format={formatActive}
            onNavigate={onNavigate}
          />
        ))}
      </ol>

      <p className={styles.footer}>
        Showing top {rows.length} of {pool.length}
      </p>
    </aside>
  )
}

export default StatsPanel
