import { Dna } from 'lucide-react'
import type { ReactNode } from 'react'
import type { GlorpView } from '@/sim/inspect'
import { MUTATIONS, mutationKeys, type MutationKey } from '@/sim/mutations'
import styles from './GlorpMutations.module.css'

type GlorpMutationsProps = {
  glorp: GlorpView
}

/**
 * Six-armed snowflake with a chevron barb on each arm tip, precomputed so the
 * icon stays a pure render. Reads as "cold" without a bitmap asset.
 */
const SNOWFLAKE_PATHS = (() => {
  const paths: string[] = []
  const tip = 9
  const barb = 4
  const spread = Math.PI / 5
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3
    const x = 12 + Math.cos(angle) * tip
    const y = 12 + Math.sin(angle) * tip
    paths.push(`M12 12L${x.toFixed(2)} ${y.toFixed(2)}`)
    for (const sign of [-1, 1]) {
      const back = angle + Math.PI + sign * spread
      paths.push(
        `M${x.toFixed(2)} ${y.toFixed(2)}L${(x + Math.cos(back) * barb).toFixed(2)} ${(y + Math.sin(back) * barb).toFixed(2)}`,
      )
    }
  }
  return paths
})()

const ColdBloodedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {SNOWFLAKE_PATHS.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
)

/** Single lightning bolt, reading as "fast", for the stoat mutation. */
const StoatIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
)

/** Icon for each mutation, in registry order. Every mutation must have an entry. */
const MUTATION_ICONS = {
  coldBlooded: <ColdBloodedIcon />,
  stoat: <StoatIcon />,
} satisfies Record<MutationKey, ReactNode>

/** The mutations a glorp holds, as a row of icons with hover descriptions. */
const GlorpMutations = ({ glorp }: GlorpMutationsProps) => {
  const keys = mutationKeys(glorp.mutations)
  if (keys.length === 0) return null

  return (
    <div className={styles.mutations}>
      <div className={styles.mutationsHeader}>
        <Dna aria-hidden="true" />
        <span className={styles.mutationsTitle}>Mutations</span>
      </div>
      <div className={styles.icons}>
        {keys.map((key) => (
          <span
            key={key}
            className={styles.chip}
            role="img"
            aria-label={`${MUTATIONS[key].name}: ${MUTATIONS[key].description}`}
            title={MUTATIONS[key].description}
          >
            {MUTATION_ICONS[key]}
          </span>
        ))}
      </div>
    </div>
  )
}

export default GlorpMutations
