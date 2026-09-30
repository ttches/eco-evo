import { Settings2 } from 'lucide-react'
import styles from './TopActions.module.css'

type TopActionsProps = {
  onOpenSettings: () => void
}

/** Floating action group in the top-right corner. */
const TopActions = ({ onOpenSettings }: TopActionsProps) => (
  <div className={styles.topActions}>
    <button
      type="button"
      className={styles.settingsTrigger}
      onClick={onOpenSettings}
      aria-label="Open settings"
    >
      <Settings2 aria-hidden="true" />
      <span>Settings</span>
    </button>
  </div>
)

export default TopActions
