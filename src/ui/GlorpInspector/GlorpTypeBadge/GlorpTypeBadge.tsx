import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import styles from './GlorpTypeBadge.module.css'

type GlorpTypeBadgeProps = {
  type: GlorpType
}

/** Colored Prey / Predator pill, shared by the header and lineage rows. */
const GlorpTypeBadge = ({ type }: GlorpTypeBadgeProps) => {
  const isHunter = type === GLORP_TYPE.hunter
  return (
    <span
      className={`${styles.badge} ${isHunter ? styles.hunter : styles.prey}`}
    >
      {isHunter ? 'Predator' : 'Prey'}
    </span>
  )
}

export default GlorpTypeBadge
