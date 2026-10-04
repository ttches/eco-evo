import { useState } from 'react'
import { GLORP_HOLO_PREVIEW_SCALE } from '@/render/glorp-holo'
import HoloLabSvg from './HoloLabSvg'
import HoloLabWorld from './HoloLabWorld'
import styles from './HoloLab.module.css'

const TABS = [
  { id: 'svg', label: 'SVG Avatars' },
  { id: 'world', label: 'World Shader' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * Preview gallery for glorp mutation looks, reached at `?holo`. Two tabs: the
 * SVG avatars the inspector draws, and the WebGL detail shader the world draws
 * at `.35x`. Compare variants and pick the ones worth wiring in.
 */
const HoloLab = () => {
  const [tab, setTab] = useState<TabId>('world')

  return (
    <main className={styles.lab}>
      <h1 className={styles.title}>Holo Lab</h1>
      <p className={styles.note}>
        Mutated glorp sheens, always animating. Compare variants, then pick one.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Holo lab view">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`${styles.tab} ${tab === entry.id ? styles.active : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'svg' ? (
        <HoloLabSvg />
      ) : (
        <>
          <p className={styles.tabNote}>
            World detail shader at the .35x look, magnified{' '}
            {GLORP_HOLO_PREVIEW_SCALE}× so the pixels are readable. Each row is
            one candidate; the left side of each pair is the unmutated control.
          </p>
          <HoloLabWorld />
        </>
      )}
    </main>
  )
}

export default HoloLab
