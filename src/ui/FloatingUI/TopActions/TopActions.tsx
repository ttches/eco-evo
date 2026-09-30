import { BarChart3, Settings2 } from 'lucide-react'
import styles from './TopActions.module.css'

type TopActionsProps = {
  onOpenStats: () => void
  onOpenSettings: () => void
}

/** Floating action group in the top-right corner. */
const TopActions = ({ onOpenStats, onOpenSettings }: TopActionsProps) => (
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
      onClick={onOpenSettings}
      aria-label="Open settings"
    >
      <Settings2 aria-hidden="true" />
      <span>Settings</span>
    </button>
  </div>
)

export default TopActions
