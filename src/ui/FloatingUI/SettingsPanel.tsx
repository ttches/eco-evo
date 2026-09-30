import { useEffect } from 'react'
import { X } from 'lucide-react'
import styles from './SettingsPanel.module.css'

type SettingsPanelProps = {
  open: boolean
  onClose: () => void
}

const SettingsPanel = ({ open, onClose }: SettingsPanelProps) => {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <aside className={styles.panel} aria-label="Settings">
      <header className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close settings"
        >
          <X aria-hidden="true" />
        </button>
      </header>
      <p className={styles.placeholder}>
        Simulation settings will appear here.
      </p>
    </aside>
  )
}

export default SettingsPanel
