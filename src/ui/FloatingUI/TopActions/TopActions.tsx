import { BarChart3, EyeOff } from 'lucide-react'
import styles from './TopActions.module.css'

type TopActionsProps = {
  onOpenStats: () => void
  onHideInterface: () => void
}

/** Floating action group in the top-right corner. */
const TopActions = ({ onOpenStats, onHideInterface }: TopActionsProps) => (
  <div className={styles.topActions}>
    <button
      type="button"
      className={styles.actionTrigger}
      onClick={onOpenStats}
      aria-label="Open stats"
    >
      <BarChart3 aria-hidden="true" />
      <span>Stats</span>
    </button>
    <button
      type="button"
      className={styles.actionTrigger}
      onClick={onHideInterface}
      aria-label="Hide interface"
      aria-keyshortcuts="H"
    >
      <EyeOff aria-hidden="true" />
      <span>Hide UI</span>
    </button>
  </div>
)

export default TopActions
