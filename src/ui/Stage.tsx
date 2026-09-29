import type { ReactNode, RefObject } from 'react'
import styles from './Stage.module.css'

type StageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  overlay?: ReactNode
}

const Stage = ({ canvasRef, overlay }: StageProps) => (
  <main className={styles.stage}>
    <div className={styles.shell}>
      <div className={styles.display}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-label="Glorp simulation"
        />
        {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
      </div>
    </div>
  </main>
)

export default Stage
