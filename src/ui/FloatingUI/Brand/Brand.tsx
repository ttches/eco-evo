import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatElapsed } from './formatElapsed'
import styles from './Brand.module.css'

/** How often the elapsed readout refreshes while open, in ms. */
const REFRESH_MS = 250

type BrandProps = {
  /** Current simulation time in seconds; polled while the readout is open. */
  getTime: () => number
  /** Seed the current world was generated from, for sharing a run. */
  seed: number
}

/** Floating wordmark in the top-left corner; click to reveal sim time and seed. */
const Brand = ({ getTime, seed }: BrandProps) => {
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) return
    const update = (): void => setElapsed(getTime())
    update()
    const id = window.setInterval(update, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [open, getTime])

  return (
    <header className={styles.brand}>
      <h1 className={styles.wordmark}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="brand-readout"
        >
          eco-evo
        </button>
      </h1>
      {open ? (
        <div id="brand-readout" className={styles.readout}>
          <p className={styles.elapsed}>
            <Timer aria-hidden="true" />
            {formatElapsed(elapsed)}
          </p>
          <p className={styles.seed}>seed {seed}</p>
        </div>
      ) : null}
    </header>
  )
}

export default Brand
