import { type ReactNode } from "react";
import {
  Activity,
  Clock,
  HeartPulse,
  Hourglass,
  Skull,
  Utensils,
  Wind,
  Zap,
} from "lucide-react";
import { clamp } from "@/engine/math";
import { FED_MAX } from "@/sim/config";
import type { GlorpLiveState, GlorpView } from "@/sim/inspect";
import { DEATH_CAUSE, type DeathCause } from "@/sim/lineage";
import { TRAIT_MAX, traitValue, type TraitKey } from "@/sim/traits";
import { formatDuration } from "@/ui/timeFormat";
import styles from "./GlorpStats.module.css";

type GlorpStatsProps = {
  glorp: GlorpView;
  /** Hide the repro/age/death rows, leaving meters and trait bars. */
  compact?: boolean;
};

type StatProps = {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
};

const Stat = ({ icon, label, value, valueClassName }: StatProps) => (
  <div className={styles.stat}>
    <span className={styles.statIcon} aria-hidden="true">
      {icon}
    </span>
    <span className={styles.statLabel}>{label}</span>
    <span className={`${styles.statValue} ${valueClassName ?? ""}`}>
      {value}
    </span>
  </div>
);

type MeterProps = {
  label: string;
  value: number;
  max: number;
  tone: "energy" | "stamina";
};

const Meter = ({ label, value, max, tone }: MeterProps) => {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
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
  );
};

/** Two-lobed ovaries glyph for the reproduction status row. */
const OvariesIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 7C9.5 5.6 6.8 8.2 7.6 11.4" />
    <path d="M12 7c2.5-1.4 5.2 1.2 4.4 4.4" />
    <ellipse cx="6.4" cy="15" rx="2.7" ry="3.6" />
    <ellipse cx="17.6" cy="15" rx="2.7" ry="3.6" />
  </svg>
);

/** A grooved track with a single fill run that stops on a notch. */
const TraitBar = ({ level }: { level: number }) => (
  <div
    className={styles.traitBar}
    role="img"
    aria-label={`Level ${level} of ${TRAIT_MAX}`}
  >
    <span
      className={styles.traitFill}
      style={{ width: `${(level / TRAIT_MAX) * 100}%` }}
    />
  </div>
);

type TraitDisplay = {
  icon: ReactNode;
  label: string;
};

/** How each trait is shown, in display order. Every trait must have an entry. */
const TRAIT_DISPLAY = {
  speed: { icon: <Zap />, label: "Speed" },
  endurance: { icon: <Activity />, label: "Endurance" },
  fertility: { icon: <HeartPulse />, label: "Fertility" },
  agility: { icon: <Wind />, label: "Agility" },
} satisfies Record<TraitKey, TraitDisplay>;

const TRAIT_ROWS = Object.entries(TRAIT_DISPLAY) as [TraitKey, TraitDisplay][];

const DEATH_LABEL: Record<DeathCause, string> = {
  [DEATH_CAUSE.alive]: "Alive",
  [DEATH_CAUSE.starved]: "Starved",
  [DEATH_CAUSE.eaten]: "Eaten",
};

type ReproState = {
  label: string;
  tone: "ready" | "recovering" | "pregnant";
};

/** One status for the whole reproductive cycle, rather than timers. */
const reproState = (live: GlorpLiveState): ReproState => {
  if (live.pregnant > 0) return { label: "Pregnant", tone: "pregnant" };
  if (live.cooldown > 0) return { label: "Recovering", tone: "recovering" };
  return { label: "Ready", tone: "ready" };
};

/**
 * Body of the inspector: energy/stamina meters plus the trait bars. Living
 * glorps show their reproductive status and age; dead ones show their lifespan,
 * cause of death and killer.
 */
const GlorpStats = ({ glorp, compact = false }: GlorpStatsProps) => {
  const repro = glorp.live ? reproState(glorp.live) : null;

  return (
    <div className={styles.root}>
      {glorp.live ? (
        <div className={styles.meters}>
          <Meter
            label="Life force"
            value={glorp.live.fed}
            max={FED_MAX}
            tone="energy"
          />
          <Meter
            label="Stamina"
            value={glorp.live.stamina}
            max={traitValue("endurance", glorp.traits.endurance)}
            tone="stamina"
          />
        </div>
      ) : null}

      <div className={styles.stats}>
        {TRAIT_ROWS.map(([key, display]) => (
          <div key={key} className={styles.stat}>
            <span className={styles.statIcon} aria-hidden="true">
              {display.icon}
            </span>
            <span className={styles.statLabel}>{display.label}</span>
            <TraitBar level={glorp.traits[key]} />
          </div>
        ))}

        {compact ? null : (
          <>
            {repro ? (
              <Stat
                icon={<OvariesIcon />}
                label="Repro"
                value={repro.label}
                valueClassName={styles[repro.tone]}
              />
            ) : null}

            {glorp.live ? (
              <Stat
                icon={<Clock />}
                label="Time alive"
                value={formatDuration(glorp.timeAlive)}
              />
            ) : (
              <>
                <Stat
                  icon={<Hourglass />}
                  label="Lived"
                  value={formatDuration(glorp.timeAlive)}
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
          </>
        )}
      </div>
    </div>
  );
};

export default GlorpStats;
