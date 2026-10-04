import type { CSSProperties } from 'react'
import type { GlorpView } from '@/sim/inspect'
import GlorpAvatar from '../GlorpAvatar/GlorpAvatar'
import GlorpMutations from '../GlorpMutations/GlorpMutations'
import GlorpTypeBadge from '../GlorpTypeBadge/GlorpTypeBadge'
import GlorpStats from '../GlorpStats/GlorpStats'
import styles from './GlorpPreview.module.css'

/** Screen-space box of the row the preview is anchored to. */
export type PreviewAnchor = {
  readonly top: number
  readonly bottom: number
  readonly left: number
}

type GlorpPreviewProps = {
  glorp: GlorpView
  anchor: PreviewAnchor
}

/** Gap (px) between the hovered row and the floating preview. */
const GAP_PX = 8

/** Sit beside the row, anchoring to the bottom when the row is low on screen. */
const place = (anchor: PreviewAnchor): CSSProperties => {
  const alignBottom = anchor.top > window.innerHeight / 2
  return {
    top: alignBottom ? undefined : anchor.top,
    bottom: alignBottom ? window.innerHeight - anchor.bottom : undefined,
    right: window.innerWidth - anchor.left + GAP_PX,
  }
}

/**
 * Read-only summary of a glorp shown while hovering a leaderboard row. Purely
 * visual: it never captures the pointer, so clicking the row still opens the
 * real inspector.
 */
const GlorpPreview = ({ glorp, anchor }: GlorpPreviewProps) => (
  <aside className={styles.panel} style={place(anchor)} aria-hidden="true">
    <header className={styles.header}>
      <GlorpAvatar
        id={glorp.id}
        type={glorp.type}
        alive={glorp.alive}
        fed={glorp.live?.fed}
        pregnant={glorp.live ? glorp.live.pregnant > 0 : false}
        mutated={glorp.mutations !== 0}
        size={20}
      />
      <div className={styles.identity}>
        <div className={styles.badgeRow}>
          <GlorpTypeBadge type={glorp.type} />
          {glorp.alive ? null : (
            <span className={styles.deceased}>Deceased</span>
          )}
        </div>
        <span className={styles.name}>{glorp.name}</span>
      </div>
    </header>
    <GlorpStats glorp={glorp} compact />
    <GlorpMutations glorp={glorp} />
  </aside>
)

export default GlorpPreview
