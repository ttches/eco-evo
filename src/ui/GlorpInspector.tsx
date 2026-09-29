import type { ReactNode } from 'react'
import {
  Activity,
  Gauge,
  HeartPulse,
  MapPin,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import { clamp } from '@/engine/math'
import { FED_MAX } from '@/sim/config'
import type { GlorpSnapshot } from '@/sim/inspect'
import { GLORP_TYPE } from '@/sim/types'
import styles from './GlorpInspector.module.css'

type GlorpInspectorProps = {
  glorp: GlorpSnapshot | null
  onClose: () => void
}

type StatProps = {
  icon: ReactNode
  label: string
  value: string
}

const Stat = ({ icon, label, value }: StatProps) => (
  <div className={styles.stat}>
    <span className={styles.statIcon} aria-hidden="true">
      {icon}
    </span>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
  </div>
)

type MeterProps = {
  label: string
  value: number
  max: number
  tone: 'energy' | 'stamina'
}

const Meter = ({ label, value, max, tone }: MeterProps) => {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0
  return (
    <div className={styles.meter}>
      <div className={styles.meterHeader}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterValue}>{Math.round(ratio * 100)}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}

const GlorpInspector = ({ glorp, onClose }: GlorpInspectorProps) => {
  if (!glorp) return null

  const isHunter = glorp.type === GLORP_TYPE.hunter

  return (
    <aside className={styles.panel} aria-label="Glorp inspector">
      <header className={styles.header}>
        <div className={styles.identity}>
          <span
            className={`${styles.badge} ${isHunter ? styles.hunter : styles.prey}`}
          >
            {isHunter ? 'Predator' : 'Prey'}
          </span>
          <h2 className={styles.title}>Glorp #{glorp.id}</h2>
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

      <div className={styles.meters}>
        <Meter label="Energy" value={glorp.fed} max={FED_MAX} tone="energy" />
        <Meter
          label="Stamina"
          value={glorp.stamina}
          max={glorp.staminaMax}
          tone="stamina"
        />
      </div>

      <div className={styles.stats}>
        <Stat
          icon={<Zap />}
          label="Speed"
          value={glorp.speed.toFixed(1)}
        />
        <Stat
          icon={<Gauge />}
          label="Metabolism"
          value={glorp.metabolism.toFixed(2)}
        />
        <Stat
          icon={<Activity />}
          label="Stamina max"
          value={glorp.staminaMax.toFixed(1)}
        />
        <Stat
          icon={<HeartPulse />}
          label="Repro cooldown"
          value={`${glorp.reproCooldown.toFixed(1)}s`}
        />
        <Stat
          icon={<Utensils />}
          label="Repro status"
          value={glorp.cooldown > 0 ? `${glorp.cooldown.toFixed(1)}s` : 'Ready'}
        />
        <Stat
          icon={<MapPin />}
          label="Position"
          value={`${Math.round(glorp.x)}, ${Math.round(glorp.y)}`}
        />
      </div>
    </aside>
  )
}

export default GlorpInspector
