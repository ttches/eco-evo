import { GitBranch } from 'lucide-react'
import type { GlorpView } from '@/sim/inspect'
import GlorpTypeBadge from '../GlorpTypeBadge/GlorpTypeBadge'
import styles from './GlorpLineage.module.css'

type GlorpLineageProps = {
  glorp: GlorpView
  onNavigate: (id: number) => void
}

/**
 * Family section: generation plus a button per parent. Parents are clickable
 * whether alive or dead, so the panel can walk the whole tree.
 */
const GlorpLineage = ({ glorp, onNavigate }: GlorpLineageProps) => (
  <div className={styles.lineage}>
    <div className={styles.lineageHeader}>
      <GitBranch aria-hidden="true" />
      <span className={styles.lineageTitle}>Lineage</span>
      <span className={styles.generation}>Gen {glorp.generation}</span>
    </div>
    {glorp.parents.length === 0 ? (
      <p className={styles.empty}>No parents — spawned into the world.</p>
    ) : (
      <div className={styles.parents}>
        {glorp.parents.map((parent, index) => (
          <button
            key={parent.id}
            type="button"
            className={`${styles.parentButton} ${
              parent.alive ? '' : styles.parentDead
            }`}
            onClick={() => onNavigate(parent.id)}
          >
            <span className={styles.parentRole}>Parent {index + 1}</span>
            <GlorpTypeBadge type={parent.type} size="small" />
            <span className={styles.parentName}>{parent.name}</span>
          </button>
        ))}
      </div>
    )}
  </div>
)

export default GlorpLineage
