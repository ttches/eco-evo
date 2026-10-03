import { useId, useState } from 'react'
import { Baby, GitBranch, Users } from 'lucide-react'
import { FED_MAX } from '@/sim/config'
import type { GlorpRef, GlorpView } from '@/sim/inspect'
import { formatDuration } from '@/ui/timeFormat'
import GlorpAvatar from '../GlorpAvatar/GlorpAvatar'
import styles from './GlorpLineage.module.css'

type GlorpLineageProps = {
  glorp: GlorpView
  onNavigate: (id: number) => void
}

type Drawer = 'parents' | 'children'

type FamilyRowProps = {
  glorp: GlorpRef
  onNavigate: (id: number) => void
}

/** One clickable ancestor or child, summarized and dimmed once dead. */
const FamilyRow = ({ glorp, onNavigate }: FamilyRowProps) => (
  <button
    type="button"
    className={`${styles.row} ${glorp.alive ? '' : styles.rowDead}`}
    onClick={() => onNavigate(glorp.id)}
  >
    <GlorpAvatar
      id={glorp.id}
      type={glorp.type}
      alive={glorp.alive}
      fed={glorp.alive ? FED_MAX : 0}
      size={18}
    />
    <span className={styles.rowBody}>
      <span className={styles.rowTop}>
        <span className={styles.rowName}>{glorp.name}</span>
        {glorp.named ? <span className={styles.rowId}>#{glorp.id}</span> : null}
      </span>
      <span className={styles.rowMeta}>
        Gen {glorp.generation} · {formatDuration(glorp.timeAlive)}
        {glorp.alive ? '' : ' · Dead'}
      </span>
    </span>
  </button>
)

/**
 * Family section: a pair of totals for parents and children, each opening a
 * drawer of clickable glorp summaries. Drawers open upward, above the buttons.
 */
const GlorpLineage = ({ glorp, onNavigate }: GlorpLineageProps) => {
  const [open, setOpen] = useState<Drawer | null>(null)
  const drawerId = useId()

  const toggle = (drawer: Drawer): void =>
    setOpen((current) => (current === drawer ? null : drawer))

  const rows = open === 'parents' ? glorp.parents : glorp.children

  return (
    <div className={styles.lineage}>
      <div className={styles.lineageHeader}>
        <GitBranch aria-hidden="true" />
        <span className={styles.lineageTitle}>Lineage</span>
        <span className={styles.generation}>Gen {glorp.generation}</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.familyButton} ${
            open === 'parents' ? styles.familyActive : ''
          }`}
          disabled={glorp.parents.length === 0}
          aria-label={`Parents (${glorp.parents.length})`}
          title={`Parents (${glorp.parents.length})`}
          aria-expanded={open === 'parents'}
          aria-controls={open === 'parents' ? drawerId : undefined}
          onClick={() => toggle('parents')}
        >
          <Users aria-hidden="true" />
          <span className={styles.familyCount}>{glorp.parents.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.familyButton} ${
            open === 'children' ? styles.familyActive : ''
          }`}
          disabled={glorp.children.length === 0}
          aria-label={`Children (${glorp.children.length})`}
          title={`Children (${glorp.children.length})`}
          aria-expanded={open === 'children'}
          aria-controls={open === 'children' ? drawerId : undefined}
          onClick={() => toggle('children')}
        >
          <Baby aria-hidden="true" />
          <span className={styles.familyCount}>{glorp.children.length}</span>
        </button>
      </div>

      {open ? (
        <div
          id={drawerId}
          className={styles.drawer}
          role="group"
          aria-label={open === 'parents' ? 'Parents' : 'Children'}
        >
          {rows.length === 0 ? (
            <p className={styles.empty}>None.</p>
          ) : (
            rows.map((relative) => (
              <FamilyRow
                key={relative.id}
                glorp={relative}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default GlorpLineage
