import type { GlorpView } from '@/sim/inspect'
import GlorpHeader from './GlorpHeader'
import GlorpLineage from './GlorpLineage'
import GlorpStats from './GlorpStats'
import styles from './GlorpInspector.module.css'

type GlorpInspectorProps = {
  glorp: GlorpView | null
  onClose: () => void
  onBack: () => void
  canGoBack: boolean
  onNavigate: (id: number) => void
  onRename: (id: number, name: string) => void
}

/** Panel shown when a glorp is clicked: identity, stats and lineage. */
const GlorpInspector = ({
  glorp,
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
