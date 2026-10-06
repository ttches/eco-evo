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

/** Coiled spring under an up arrow, reading as a longer jump. */
const JumperIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 21c0-2 10-2 10-4s-10-2-10-4 10-2 10-4" />
    <path d="M12 7V3m0 0-3 3m3-3 3 3" />
  </svg>
)

/** Eye with a slash through it, reading as hidden from sight. */
const CamouflageIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="m4 4 16 16" />
  </svg>
)

/** Sheet ghost, reading as silent and unseen. */
const StealthIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.33-1.8-2.34 1.8-2.33-1.8L9.67 21 7.33 19.2 5 21Z" />
    <path d="M9.5 11h.01M14.5 11h.01" />
  </svg>
)

/** Bandit mask with eye patches and a snout, reading as a raccoon scavenger. */
const ScavengerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 11c2.2-2.6 5.2-3.6 8.2-2.6l1.3.5 1.3-.5c3-1 6 0 8.2 2.6-1.4 2.6-4.4 4.2-9.5 4.2S3.9 13.6 2.5 11Z" />
    <circle cx="8.2" cy="11.5" r="1.1" />
    <circle cx="15.8" cy="11.5" r="1.1" />
    <path d="M12 15.2v2.3" />
  </svg>
)

/** Icon for each mutation, in registry order. Every mutation must have an entry. */
const MUTATION_ICONS = {
  coldBlooded: <ColdBloodedIcon />,
  stoat: <StoatIcon />,
  jumper: <JumperIcon />,
  camouflage: <CamouflageIcon />,
  stealth: <StealthIcon />,
  scavenger: <ScavengerIcon />,
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
