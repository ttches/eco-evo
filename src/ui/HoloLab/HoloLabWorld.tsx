import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GlorpDetailLayer } from '@/render/glorp-detail-layer'
import {
  GLORP_HOLO_LABELS,
  GLORP_HOLO_PREVIEW_SCALE,
  GLORP_HOLO_STILL_TIME,
  GLORP_HOLO_VARIANTS,
  glorpHoloIndex,
} from '@/render/glorp-holo'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { WORLD_BACKGROUND } from '@/render/palette'
import { GLORP_RADIUS } from '@/sim/config'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'
import styles from './HoloLab.module.css'

/** World-space layout of the sample grid. */
const COLUMN_SPACING = 34
const ROW_SPACING = 42
const MARGIN = 24

/** How many screen pixels one `.35x` detail pixel is blown up to. */
const MAGNIFY = GLORP_HOLO_PREVIEW_SCALE
const ZOOM = DETAIL_MIN_ZOOM * MAGNIFY

/** Same silhouette/color pairs in every row, mutated and control. */
const SAMPLES = [
  { id: 7, type: GLORP_TYPE.prey, fed: 85, mutated: false },
  { id: 7, type: GLORP_TYPE.prey, fed: 85, mutated: true },
  { id: 19, type: GLORP_TYPE.prey, fed: 35, mutated: true },
  { id: 42, type: GLORP_TYPE.hunter, fed: 100, mutated: false },
  { id: 42, type: GLORP_TYPE.hunter, fed: 100, mutated: true },
  { id: 91, type: GLORP_TYPE.hunter, fed: 45, mutated: true },
] as const

const COLUMNS = SAMPLES.length
const ROWS = GLORP_HOLO_VARIANTS.length
const CONTENT_WIDTH = (COLUMNS - 1) * COLUMN_SPACING + 2 * MARGIN
const CONTENT_HEIGHT = (ROWS - 1) * ROW_SPACING + 2 * MARGIN

/** Vertical centre of a row's samples, in canvas pixels. */
const rowTop = (row: number): number =>
  Math.round((row * ROW_SPACING + MARGIN) * ZOOM)

/**
 * The whole sample grid as one renderable world, laid out row-major so a glorp's
 * row is `floor(index / COLUMNS)`. Every row previews one `glorpHolo` variant.
 */
const makeWorld = (): RenderableWorld => {
  const count = ROWS * COLUMNS
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
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = row * COLUMNS + column
      const sample = SAMPLES[column]
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

/**
 * World-render tab of the lab: draws the production `GlorpDetailLayer` at the
 * `.35x` detail look, magnified with nearest-neighbour pixels so the designs are
 * readable. Each row overrides the sheen picker with one `glorpHolo` variant, so
 * the pixel grid, outline and sheen shown match the live game exactly.
 */
const HoloLabWorld = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
    })
    THREE.ColorManagement.enabled = false
    renderer.setPixelRatio(1)
    renderer.setSize(
      Math.round(CONTENT_WIDTH * ZOOM),
      Math.round(CONTENT_HEIGHT * ZOOM),
      false,
    )
    renderer.setClearColor(WORLD_BACKGROUND, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(
      0,
      CONTENT_WIDTH,
      0,
      CONTENT_HEIGHT,
      -10,
      10,
    )

    const bounds = {
      left: 0,
      top: 0,
      right: CONTENT_WIDTH,
      bottom: CONTENT_HEIGHT,
    }
    const world = makeWorld()
    const layer = new GlorpDetailLayer(
      (_world, index) =>
        glorpHoloIndex(GLORP_HOLO_VARIANTS[Math.floor(index / COLUMNS)]),
    )
    scene.add(layer.mesh)

    const still = prefersReducedMotion()
    const start = performance.now()
    let frame = 0

    const draw = () => {
      const time = still ? GLORP_HOLO_STILL_TIME : (performance.now() - start) / 1000
      layer.update(world, bounds, DETAIL_MIN_ZOOM, time)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      layer.dispose()
      // Drop the context explicitly; rapidly flipping tabs would otherwise
      // exhaust the browser's live WebGL context limit before GC runs.
      renderer.forceContextLoss()
      renderer.dispose()
    }
  }, [])

  return (
    <div className={styles.worldStage}>
      <div
        className={styles.worldLabels}
        style={{ height: Math.round(CONTENT_HEIGHT * ZOOM) }}
      >
        {GLORP_HOLO_VARIANTS.map((variant, row) => (
          <span
            key={variant}
            className={styles.worldLabel}
            style={{ top: rowTop(row) }}
          >
            {GLORP_HOLO_LABELS[variant]}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} className={styles.worldCanvas} />
    </div>
  )
}

export default HoloLabWorld
