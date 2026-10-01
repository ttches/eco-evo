import type { GlorpView } from '@/sim/inspect'
import GlorpHeader from './GlorpHeader/GlorpHeader'
import GlorpLineage from './GlorpLineage/GlorpLineage'
import GlorpStats from './GlorpStats/GlorpStats'
import styles from './GlorpInspector.module.css'

type GlorpInspectorProps = {
  glorp: GlorpView | null
  locked: boolean
  onToggleLock: () => void
  onClose: () => void
  onBack: () => void
  canGoBack: boolean
  onNavigate: (id: number) => void
  onRename: (id: number, name: string) => void
}

/** Panel shown when a glorp is clicked: identity, stats and lineage. */
const GlorpInspector = ({
  glorp,
  locked,
  onToggleLock,
  onClose,
  onBack,
  canGoBack,
  onNavigate,
  onRename,
}: GlorpInspectorProps) => {
  if (!glorp) return null

  return (
    <aside className={styles.panel} aria-label="Glorp inspector">
      <GlorpHeader
        glorp={glorp}
        locked={locked}
        onToggleLock={onToggleLock}
        canGoBack={canGoBack}
        onBack={onBack}
        onClose={onClose}
        onRename={onRename}
      />
      <GlorpStats glorp={glorp} />
      <GlorpLineage glorp={glorp} onNavigate={onNavigate} />
    </aside>
  )
}

export default GlorpInspector
