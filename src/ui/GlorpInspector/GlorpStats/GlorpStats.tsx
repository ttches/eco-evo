import { type ReactNode } from 'react'
import {
  Activity,
  CalendarClock,
  Gauge,
  HeartPulse,
  MapPin,
  Skull,
  Utensils,
  Zap,
} from 'lucide-react'
import { clamp } from '@/engine/math'
import { FED_MAX } from '@/sim/config'
import type { GlorpView } from '@/sim/inspect'
import { DEATH_CAUSE, type DeathCause } from '@/sim/lineage'
import type { TraitKey } from '@/sim/traits'
import styles from './GlorpStats.module.css'

type GlorpStatsProps = {
  glorp: GlorpView
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

type TraitDisplay = {
  icon: ReactNode
  label: string
  format: (value: number) => string
}

/** How each trait is shown, in display order. Every trait must have an entry. */
const TRAIT_DISPLAY = {
  speed: { icon: <Zap />, label: 'Speed', format: (v) => v.toFixed(1) },
  metabolism: {
    icon: <Gauge />,
    label: 'Metabolism',
    format: (v) => v.toFixed(2),
  },
  staminaMax: {
    icon: <Activity />,
    label: 'Stamina max',
    format: (v) => v.toFixed(1),
  },
  reproCooldown: {
    icon: <HeartPulse />,
    label: 'Repro cooldown',
    format: (v) => `${v.toFixed(1)}s`,
  },
} satisfies Record<TraitKey, TraitDisplay>

const TRAIT_ROWS = Object.entries(TRAIT_DISPLAY) as [TraitKey, TraitDisplay][]

const DEATH_LABEL: Record<DeathCause, string> = {
  [DEATH_CAUSE.alive]: 'Alive',
  [DEATH_CAUSE.starved]: 'Starved',
  [DEATH_CAUSE.eaten]: 'Eaten',
}

/**
 * Body of the inspector: energy/stamina meters plus the trait list. Living
 * glorps show their current status; dead ones show birth, death and killer.
 */
const GlorpStats = ({ glorp }: GlorpStatsProps) => (
  <div className={styles.root}>
    {glorp.live ? (
      <div className={styles.meters}>
        <Meter
          label="Energy"
          value={glorp.live.fed}
          max={FED_MAX}
          tone="energy"
        />
        <Meter
          label="Stamina"
          value={glorp.live.stamina}
          max={glorp.traits.staminaMax}
          tone="stamina"
        />
      </div>
    ) : null}

    <div className={styles.stats}>
      {TRAIT_ROWS.map(([key, display]) => (
        <Stat
          key={key}
          icon={display.icon}
          label={display.label}
          value={display.format(glorp.traits[key])}
        />
      ))}
      {glorp.live ? (
        <>
          <Stat
            icon={<Utensils />}
            label="Repro status"
            value={
              glorp.live.cooldown > 0
                ? `${glorp.live.cooldown.toFixed(1)}s`
                : 'Ready'
            }
          />
          <Stat
            icon={<MapPin />}
            label="Position"
            value={`${Math.round(glorp.live.x)}, ${Math.round(glorp.live.y)}`}
          />
        </>
      ) : (
        <>
          <Stat
            icon={<CalendarClock />}
            label="Born"
            value={`${glorp.bornAt.toFixed(1)}s`}
          />
          <Stat
            icon={<Skull />}
            label="Died"
            value={`${glorp.diedAt.toFixed(1)}s`}
          />
          <Stat
            icon={<Skull />}
            label="Cause"
            value={DEATH_LABEL[glorp.deathCause]}
          />
          {glorp.killer ? (
            <Stat
              icon={<Utensils />}
              label="Killed by"
              value={glorp.killer.name}
            />
          ) : null}
        </>
      )}
    </div>
  </div>
)

export default GlorpStats
