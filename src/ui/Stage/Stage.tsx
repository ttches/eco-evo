import type { ReactNode, RefObject } from 'react'
import styles from './Stage.module.css'

type StageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  overlay?: ReactNode
  /** Panel that reserves layout space beside the map instead of covering it. */
  sidePanel?: ReactNode
}

const Stage = ({ canvasRef, overlay, sidePanel }: StageProps) => (
  <main className={styles.stage}>
    <div className={styles.display}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Glorp simulation"
      />
      {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
    </div>
    {sidePanel ? <div className={styles.side}>{sidePanel}</div> : null}
  </main>
)

export default Stage
