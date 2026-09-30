import { useState } from 'react'
import { ArrowLeft, Pencil, X } from 'lucide-react'
import type { GlorpView } from '@/sim/inspect'
import GlorpTypeBadge from './GlorpTypeBadge'
import styles from './GlorpHeader.module.css'

type GlorpHeaderProps = {
  glorp: GlorpView
  canGoBack: boolean
  onBack: () => void
  onClose: () => void
  onRename: (id: number, name: string) => void
}

/**
 * Identity row: back navigation, type/deceased badges, the editable name and
 * the close button. Owns the transient rename input.
 */
const GlorpHeader = ({
  glorp,
  canGoBack,
  onBack,
  onClose,
  onRename,
}: GlorpHeaderProps) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startRename = (): void => {
    setDraft(glorp.name)
    setEditing(true)
  }

  const commitRename = (): void => {
    onRename(glorp.id, draft)
    setEditing(false)
  }

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.badgeRow}>
          {canGoBack ? (
            <button
              type="button"
              className={styles.back}
              onClick={onBack}
              aria-label="Back to previous glorp"
            >
              <ArrowLeft aria-hidden="true" />
            </button>
          ) : null}
          <GlorpTypeBadge type={glorp.type} />
          {glorp.alive ? null : (
            <span className={styles.deceased}>Deceased</span>
          )}
        </div>
        <div className={styles.nameRow}>
          {editing ? (
            <input
              className={styles.nameInput}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitRename()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setEditing(false)
                }
              }}
              // Blur cancels: only Enter saves.
              onBlur={() => setEditing(false)}
              aria-label="Glorp name"
            />
          ) : (
            <>
              <h2 className={styles.title}>{glorp.name}</h2>
              <button
                type="button"
                className={styles.rename}
                onClick={startRename}
                aria-label="Rename glorp"
              >
                <Pencil aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close inspector"
      >
        <X aria-hidden="true" />
      </button>
    </header>
  )
}

export default GlorpHeader
