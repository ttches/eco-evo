import { GLORP_TYPE } from '@/sim/types'
import GlorpAvatar from '@/ui/GlorpInspector/GlorpAvatar/GlorpAvatar'
import {
  HOLO_LABELS,
  HOLO_VARIANTS,
} from '@/ui/GlorpInspector/GlorpAvatar/holo'
import styles from './HoloLab.module.css'

const SIZES = [16, 20, 32, 64, 96]

/** A couple of distinct silhouettes/colors to judge each variant against. */
const SAMPLES = [
  { id: 7, type: GLORP_TYPE.prey, fed: 80 },
  { id: 42, type: GLORP_TYPE.hunter, fed: 100 },
] as const

/**
 * Preview gallery for the mutation holographic sheen, reached at `?holo`.
 * Shows every variant at the sizes avatars actually render at, plus a
 * non-mutated control, so the best-looking one can be chosen as `DEFAULT_HOLO`.
 */
const HoloLab = () => (
  <main className={styles.lab}>
    <h1 className={styles.title}>Holo Lab</h1>
    <p className={styles.note}>
      Mutated glorp avatars, always animating. Compare variants and sizes.
    </p>

    {HOLO_VARIANTS.map((variant) => (
      <section key={variant} className={styles.variant}>
        <h2 className={styles.variantName}>{HOLO_LABELS[variant]}</h2>
        <div className={styles.row}>
          {SAMPLES.map((sample) => (
            <div key={sample.id} className={styles.sample}>
              {SIZES.map((size) => (
                <div key={size} className={styles.cell}>
                  <GlorpAvatar
                    id={sample.id}
                    type={sample.type}
                    alive
                    fed={sample.fed}
                    mutated
                    holo={variant}
                    size={size}
                  />
                  <span className={styles.size}>{size}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    ))}

    <section className={styles.variant}>
      <h2 className={styles.variantName}>Control (no mutation)</h2>
      <div className={styles.row}>
        {SAMPLES.map((sample) => (
          <GlorpAvatar
            key={sample.id}
            id={sample.id}
            type={sample.type}
            alive
            fed={sample.fed}
            size={48}
          />
        ))}
      </div>
    </section>
  </main>
)

export default HoloLab
