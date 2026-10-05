import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { glorpAuraIndex, type GlorpAuraVariant } from '@/render/glorp-aura'
import { GlorpAuraLayer } from '@/render/glorp-aura-layer'
import { GlorpDetailLayer } from '@/render/glorp-detail-layer'
import {
  GLORP_HOLO_LABELS,
  GLORP_HOLO_PREVIEW_SCALE,
  GLORP_HOLO_STILL_TIME,
  GLORP_HOLO_VARIANTS,
  glorpHoloIndex,
  type GlorpHoloVariant,
} from '@/render/glorp-holo'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { MUTATION_LOOKS } from '@/render/mutation-looks'
import { WORLD_BACKGROUND } from '@/render/palette'
import { GLORP_RADIUS } from '@/sim/config'
import { MUTATIONS, MUTATION_KEYS, type MutationKey } from '@/sim/mutations'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'
import styles from './HoloLab.module.css'

/** Which gallery the world tab is showing. */
export type WorldMode = 'mutations' | 'variants'

/** World-space layout of the sample grid. */
const COLUMN_SPACING = 40
const ROW_SPACING = 52
const MARGIN = 24

/** How many screen pixels one `.35x` detail pixel is blown up to. */
const MAGNIFY = GLORP_HOLO_PREVIEW_SCALE
const ZOOM = DETAIL_MIN_ZOOM * MAGNIFY

type Sample = {
  id: number
  type: GlorpType
  fed: number
  mutated: boolean
}

/** One previewed row: a body sheen, an optional aura, and its sample columns. */
type LabRow = {
  label: string
  body: GlorpHoloVariant
  aura: GlorpAuraVariant | null
  samples: readonly Sample[]
}

const PREY = GLORP_TYPE.prey
const HUNTER = GLORP_TYPE.hunter

/** Silhouette/color pairs for the all-variants gallery, controls included. */
const VARIANT_SAMPLES: readonly Sample[] = [
  { id: 7, type: PREY, fed: 85, mutated: false },
  { id: 7, type: PREY, fed: 85, mutated: true },
  { id: 19, type: PREY, fed: 35, mutated: true },
  { id: 42, type: HUNTER, fed: 100, mutated: false },
  { id: 42, type: HUNTER, fed: 100, mutated: true },
  { id: 91, type: HUNTER, fed: 45, mutated: true },
]

/** Bright and fed samples of one type, always mutated, for the mutation rows. */
const PREY_SAMPLES: readonly Sample[] = [
  { id: 7, type: PREY, fed: 85, mutated: true },
  { id: 19, type: PREY, fed: 35, mutated: true },
]
const HUNTER_SAMPLES: readonly Sample[] = [
  { id: 42, type: HUNTER, fed: 100, mutated: true },
  { id: 91, type: HUNTER, fed: 45, mutated: true },
]
/** Cross-type mutation: show both so the type-aware hue shift is visible. */
const BOTH_SAMPLES: readonly Sample[] = [
  { id: 7, type: PREY, fed: 85, mutated: true },
  { id: 42, type: HUNTER, fed: 100, mutated: true },
]

/** The samples suited to a mutation's allowed type. */
const samplesFor = (key: MutationKey): readonly Sample[] => {
  const exclusive = MUTATIONS[key].exclusive
  if (exclusive === HUNTER) return HUNTER_SAMPLES
  if (exclusive === PREY) return PREY_SAMPLES
  return BOTH_SAMPLES
}

/** Every existing sheen as its own row. */
const VARIANT_ROWS: readonly LabRow[] = GLORP_HOLO_VARIANTS.map((body) => ({
  label: GLORP_HOLO_LABELS[body],
  body,
  aura: null,
  samples: VARIANT_SAMPLES,
}))

/** Every mutation's candidate looks, grouped in declaration order. */
const MUTATION_ROWS: readonly LabRow[] = MUTATION_KEYS.flatMap((key) => {
  const samples = samplesFor(key)
  return MUTATION_LOOKS[key].candidates.map((candidate) => ({
    label: `${MUTATIONS[key].name} · ${candidate.name}`,
    body: candidate.body,
    aura: candidate.aura ?? null,
    samples,
  }))
})

/**
 * The whole sample grid as one renderable world, laid out row-major so a
 * glorp's row is `floor(index / columns)`. Every row in a mode shares the same
 * column count.
 */
const makeWorld = (rows: readonly LabRow[]): RenderableWorld => {
  const columnCount = rows[0].samples.length
  const count = rows.length * columnCount
  const world = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    radius: GLORP_RADIUS,
    id: new Uint32Array(count),
    type: new Uint8Array(count),
    fed: new Float32Array(count),
    pregnant: new Float32Array(count),
    dodgeTimer: new Float32Array(count),
    mutations: new Uint32Array(count),
    grass: {} as never,
  }
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const index = row * columnCount + column
      const sample = rows[row].samples[column]
      world.x[index] = column * COLUMN_SPACING + MARGIN
      world.y[index] = row * ROW_SPACING + MARGIN
      world.id[index] = sample.id
      world.type[index] = sample.type
      world.fed[index] = sample.fed
      world.mutations[index] = sample.mutated ? 1 : 0
    }
  }
  return world as RenderableWorld
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vertical centre of a row's samples, in canvas pixels. */
const rowTop = (row: number): number =>
  Math.round((row * ROW_SPACING + MARGIN) * ZOOM)

/**
 * World-render gallery: draws the production `GlorpDetailLayer` (and the aura
 * layer) at the `.35x` detail look, magnified with nearest-neighbour pixels so
 * the designs are readable. In `mutations` mode each row previews one candidate
 * for a mutation on type-appropriate samples; in `variants` mode every sheen
 * branch is shown on its own.
 */
const HoloLabWorld = ({ mode }: { mode: WorldMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** Pending context release, cancelled when StrictMode remounts us. */
  const releaseRef = useRef<(() => void) | null>(null)

  const rows = mode === 'mutations' ? MUTATION_ROWS : VARIANT_ROWS
  const columnCount = rows[0].samples.length
  const contentWidth = (columnCount - 1) * COLUMN_SPACING + 2 * MARGIN
  const contentHeight = (rows.length - 1) * ROW_SPACING + 2 * MARGIN

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // StrictMode remounts on the same canvas; cancel any pending context loss
    // from the previous pass so the context stays usable.
    releaseRef.current = null

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
    })
    THREE.ColorManagement.enabled = false
    renderer.setPixelRatio(1)
    renderer.setSize(
      Math.round(contentWidth * ZOOM),
      Math.round(contentHeight * ZOOM),
      false,
    )
    renderer.setClearColor(WORLD_BACKGROUND, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(
      0,
      contentWidth,
      0,
      contentHeight,
      -10,
      10,
    )

    const bounds = {
      left: 0,
      top: 0,
      right: contentWidth,
      bottom: contentHeight,
    }
    const world = makeWorld(rows)
    const rowOf = (index: number): number => Math.floor(index / columnCount)

    const layer = new GlorpDetailLayer((_world, index) =>
      glorpHoloIndex(rows[rowOf(index)].body),
    )
    const auraLayer = new GlorpAuraLayer((_world, index) => {
      const aura = rows[rowOf(index)].aura
      return aura ? glorpAuraIndex(aura) : -1
    })
    scene.add(layer.mesh, ...auraLayer.meshes)

    const still = prefersReducedMotion()
    const start = performance.now()
    let frame = 0

    const draw = () => {
      const time = still
        ? GLORP_HOLO_STILL_TIME
        : (performance.now() - start) / 1000
      layer.update(world, bounds, DETAIL_MIN_ZOOM, time)
      auraLayer.update(world, bounds, DETAIL_MIN_ZOOM, time)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      layer.dispose()
      auraLayer.dispose()
      renderer.dispose()
      // Free the context so rapidly flipping tabs cannot exhaust the browser's
      // live WebGL context limit. Deferred: StrictMode immediately remounts on
      // the same canvas, and losing the context here would make it unusable.
      const release = () => renderer.forceContextLoss()
      releaseRef.current = release
      queueMicrotask(() => {
        if (releaseRef.current === release) release()
      })
    }
  }, [mode, rows, columnCount, contentWidth, contentHeight])

  return (
    <div className={styles.worldStage}>
      <div
        className={styles.worldLabels}
        style={{ height: Math.round(contentHeight * ZOOM) }}
      >
        {rows.map((row, index) => (
          <span
            key={row.label}
            className={styles.worldLabel}
            style={{ top: rowTop(index) }}
          >
            {row.label}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} className={styles.worldCanvas} />
    </div>
  )
}

export default HoloLabWorld
