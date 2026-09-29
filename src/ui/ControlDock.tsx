import { EyeOff } from 'lucide-react'
import styles from './ControlDock.module.css'

type ControlDockProps = {
  onHideInterface: () => void
}

const ControlDock = ({ onHideInterface }: ControlDockProps) => (
  <nav className={styles.dock} aria-label="Simulation controls">
    <button
      type="button"
      className={styles.button}
      onClick={onHideInterface}
      aria-label="Hide interface"
      aria-keyshortcuts="H"
    >
      <EyeOff aria-hidden="true" />
      <span className={styles.label}>Hide UI</span>
      <kbd className={styles.kbd}>H</kbd>
    </button>
  </nav>
)

export default ControlDock
