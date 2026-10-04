import { useMemo, type CSSProperties } from 'react'
import { TAU, hashUnit } from '@/engine/math'
import { glorpColor } from '@/render/appearance'
import {
  GLORP_BLOB_AMPLITUDE,
  GLORP_OUTLINE_SHADE,
} from '@/render/glorp-detail'
import type { GlorpType } from '@/sim/types'
import { DEFAULT_HOLO, type HoloVariant } from './holo'
import styles from './GlorpAvatar.module.css'

type GlorpAvatarProps = {
  id: number
  type: GlorpType
  alive: boolean
  fed?: number
  pregnant?: boolean
  mutated?: boolean
  /** Holographic sheen variant; only shown when `mutated`. */
  holo?: HoloVariant
  size?: number
}

const SEGMENTS = 28
const BASE_RADIUS = 40
const CENTER = 50

/**
 * Blob silhouette matching the world shader's two-harmonic wobble, so the
 * inspector avatar is recognizably the same glorp.
 */
const buildPath = (id: number): string => {
  const seed = hashUnit(id) * TAU
  const points: string[] = []
  for (let i = 0; i < SEGMENTS; i += 1) {
    const angle = (i / SEGMENTS) * TAU
    const wobble =
      GLORP_BLOB_AMPLITUDE *
      (Math.sin(angle * 3 + seed) * 0.6 +
        Math.sin(angle * 5 - seed * 1.3) * 0.4)
    const radius = BASE_RADIUS * (1 + wobble)
    const x = CENTER + Math.cos(angle) * radius
    const y = CENTER + Math.sin(angle) * radius
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

/** Linear RGB to sRGB, the transfer the flat world layer is output-encoded with. */
const toSrgb = (value: number): number =>
  value <= 0.0031308 ? value * 12.92 : Math.pow(value, 1 / 2.4) * 1.055 - 0.055

/**
 * Halfway between the raw linear value and the world's encoded color. The
 * avatar reads too dark raw and too bright fully encoded against the UI.
 */
const softSrgb = (value: number): number =>
  value + (toSrgb(value) - value) * 0.5

const rgb = (r: number, g: number, b: number): string =>
  `rgb(${Math.round(softSrgb(r) * 255)} ${Math.round(softSrgb(g) * 255)} ${Math.round(softSrgb(b) * 255)})`

/**
 * A tiny glorp sprite, drawn with the same color and outline as the world. A
 * mutated glorp gets a holographic sheen clipped to its silhouette; the sheen
 * is a scaled 100x100 layer so its `path()` clip shares the SVG's coordinates.
 */
const GlorpAvatar = ({
  id,
  type,
  alive,
  fed = 0,
  pregnant = false,
  mutated = false,
  holo = DEFAULT_HOLO,
  size = 18,
}: GlorpAvatarProps) => {
  const path = useMemo(() => buildPath(id), [id])
  const [r, g, b] = glorpColor(type, alive ? fed : 0, alive && pregnant)
  const fill = rgb(r, g, b)
  const stroke = rgb(
    r * GLORP_OUTLINE_SHADE,
    g * GLORP_OUTLINE_SHADE,
    b * GLORP_OUTLINE_SHADE,
  )

  const holoStyle = useMemo(() => {
    const clip = `path('${path}')`
    return {
      clipPath: clip,
      WebkitClipPath: clip,
      // The layer is authored at 100x100; scale it down to the avatar size.
      '--holo-scale': String(size / 100),
    } as CSSProperties
  }, [path, size])

  return (
    <span
      className={`${styles.frame} ${alive ? '' : styles.dead}`}
      data-holo={holo}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        className={styles.avatar}
        width={size}
        height={size}
        viewBox="0 0 100 100"
      >
        <path
          d={path}
          fill={fill}
          stroke={stroke}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      </svg>
      {mutated ? <span className={styles.holo} style={holoStyle} /> : null}
    </span>
  )
}

export default GlorpAvatar
