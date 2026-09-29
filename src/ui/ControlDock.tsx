import {
  Cat,
  EyeOff,
  Maximize2,
  Rabbit,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import styles from './ControlDock.module.css'

type ControlDockProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onHideInterface: () => void
  onSpawnPrey: () => void
  onSpawnPredator: () => void
}

const ControlDock = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onHideInterface,
  onSpawnPrey,
  onSpawnPredator,
}: ControlDockProps) => (
  <nav className={styles.dock} aria-label="Simulation controls">
    <div className={styles.group}>
      <button
        type="button"
        className={styles.button}
        onClick={onSpawnPrey}
        aria-label="Spawn prey"
        aria-keyshortcuts="1"
      >
        <Rabbit aria-hidden="true" />
        <span className={styles.label}>Prey</span>
        <kbd className={styles.kbd}>1</kbd>
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={onSpawnPredator}
        aria-label="Spawn predator"
        aria-keyshortcuts="2"
      >
        <Cat aria-hidden="true" />
        <span className={styles.label}>Predator</span>
        <kbd className={styles.kbd}>2</kbd>
      </button>
    </div>

    <span className={styles.divider} aria-hidden="true" />

    <div className={styles.group}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onZoomOut}
        aria-label="Zoom out"
      >
        <ZoomOut aria-hidden="true" />
      </button>
      <span className={styles.zoom} aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <ZoomIn aria-hidden="true" />
      </button>
    </div>

    <span className={styles.divider} aria-hidden="true" />

    <button
      type="button"
      className={styles.button}
      onClick={onResetView}
      aria-label="Fit world"
    >
      <Maximize2 aria-hidden="true" />
      <span className={styles.label}>Fit</span>
    </button>

    <span className={styles.divider} aria-hidden="true" />

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
