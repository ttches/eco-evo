import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  createCamera,
  panBy,
  screenToWorld,
  viewBounds,
  zoomAt,
  type Camera,
} from '@/engine/camera'
import { CAMERA, FIXED_STEP, VIEWPORT } from '@/engine/config'
import { createLoop } from '@/engine/loop'
import { Renderer } from '@/render/renderer'
import { findGlorpById, readGlorp, type GlorpSnapshot } from '@/sim/inspect'
import { glorpAt } from '@/sim/query'
import { spawnGlorp, spawnRandom } from '@/sim/spawn'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import { createWorld, step, type World } from '@/sim/world'
import ControlDock from '@/ui/ControlDock'
import GlorpInspector from '@/ui/GlorpInspector'
import SettingsPanel from '@/ui/SettingsPanel'
import Stage from '@/ui/Stage'
import styles from './App.module.css'

/** How often the inspector refreshes from the live simulation, in ms. */
const INSPECTOR_INTERVAL_MS = 100

/** Pointer travel (screen px) above which a press counts as a pan, not a click. */
const CLICK_DRAG_THRESHOLD_PX = 5

/** Extra screen-space tolerance (px) for clicking a small glorp. */
const PICK_TOLERANCE_PX = 8

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera>(createCamera())
  const cursorRef = useRef({ x: 0, y: 0, over: false })
  const selectedIdRef = useRef<number | null>(null)
  const [world] = useState<World>(() => createWorld())
  const [zoom, setZoom] = useState<number>(CAMERA.defaultZoom)
  const [showInterface, setShowInterface] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selected, setSelected] = useState<GlorpSnapshot | null>(null)

  const spawn = useCallback(
    (type: GlorpType) => {
      const cursor = cursorRef.current
      if (cursor.over) {
        spawnGlorp(world, type, cursor.x, cursor.y)
      } else {
        spawnRandom(world, type)
      }
    },
    [world],
  )

  const spawnPrey = useCallback(() => spawn(GLORP_TYPE.prey), [spawn])
  const spawnPredator = useCallback(() => spawn(GLORP_TYPE.hunter), [spawn])

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null
    setSelected(null)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new Renderer(canvas)
    let lastInspectorUpdate = 0

    const loop = createLoop(FIXED_STEP, {
      step: (deltaSeconds) => step(world, deltaSeconds),
      frame: () => {
        const id = selectedIdRef.current
        const selectedIndex = id === null ? -1 : findGlorpById(world, id)
        renderer.draw(world, cameraRef.current, selectedIndex)

        if (id === null) return
        const now = performance.now()
        if (now - lastInspectorUpdate < INSPECTOR_INTERVAL_MS) return
        lastInspectorUpdate = now
        if (selectedIndex < 0) {
          clearSelection()
        } else {
          setSelected(readGlorp(world, selectedIndex))
        }
      },
    })
    loop.start()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || isEditableTarget(event.target)) return
      if (event.code === 'KeyH') {
        setShowInterface((current) => !current)
      } else if (event.code === 'Digit1') {
        spawnPrey()
      } else if (event.code === 'Digit2') {
        spawnPredator()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      loop.stop()
      window.removeEventListener('keydown', handleKeyDown)
      renderer.dispose()
    }
  }, [world, spawnPrey, spawnPredator, clearSelection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let moved = false
    let downX = 0
    let downY = 0
    let lastX = 0
    let lastY = 0

    const syncZoom = (): void => setZoom(cameraRef.current.zoom)

    const toViewport = (
      event: PointerEvent,
    ): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return {
        x: ((event.clientX - rect.left) / rect.width) * VIEWPORT.width,
        y: ((event.clientY - rect.top) / rect.height) * VIEWPORT.height,
      }
    }

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const screenX = ((event.clientX - rect.left) / rect.width) * VIEWPORT.width
      const screenY = ((event.clientY - rect.top) / rect.height) * VIEWPORT.height
      const factor = Math.exp(-event.deltaY * CAMERA.wheelSensitivity)
      cameraRef.current = zoomAt(cameraRef.current, factor, screenX, screenY)
      syncZoom()
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      dragging = true
      moved = false
      downX = event.clientX
      downY = event.clientY
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const viewport = toViewport(event)
      if (viewport) {
        const point = screenToWorld(cameraRef.current, viewport.x, viewport.y)
        cursorRef.current = { x: point.x, y: point.y, over: true }
      }
      if (!dragging) return

      if (
        Math.hypot(event.clientX - downX, event.clientY - downY) >
        CLICK_DRAG_THRESHOLD_PX
      ) {
        moved = true
      }

      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const scaleX = VIEWPORT.width / rect.width / cameraRef.current.zoom
      const scaleY = VIEWPORT.height / rect.height / cameraRef.current.zoom
      const deltaX = (event.clientX - lastX) * scaleX
      const deltaY = (event.clientY - lastY) * scaleY
      lastX = event.clientX
      lastY = event.clientY
      cameraRef.current = panBy(cameraRef.current, deltaX, deltaY)
      syncZoom()
    }

    const handlePointerUp = (event: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      if (moved) return

      const viewport = toViewport(event)
      if (!viewport) return
      const point = screenToWorld(cameraRef.current, viewport.x, viewport.y)
      const bounds = viewBounds(cameraRef.current)
      const worldPerPixel = (bounds.right - bounds.left) / VIEWPORT.width
      const pickRadius = Math.max(
        world.radius,
        PICK_TOLERANCE_PX * worldPerPixel,
      )
      const index = glorpAt(world, point.x, point.y, pickRadius)
      if (index < 0) {
        clearSelection()
        return
      }
      const id = world.id[index]
      selectedIdRef.current = id
      setSelected(readGlorp(world, index))
    }

    const handlePointerLeave = (): void => {
      cursorRef.current = { ...cursorRef.current, over: false }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [world, clearSelection])

  const resetView = (): void => {
    cameraRef.current = createCamera()
    setZoom(cameraRef.current.zoom)
  }

  const zoomBy = (factor: number): void => {
    cameraRef.current = zoomAt(
      cameraRef.current,
      factor,
      VIEWPORT.width / 2,
      VIEWPORT.height / 2,
    )
    setZoom(cameraRef.current.zoom)
  }

  const overlay = showInterface ? (
    <>
      <header className={styles.brand}>
        <h1 className={styles.wordmark}>eco-evo</h1>
      </header>
      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.settingsTrigger}
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <Settings2 aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
      <GlorpInspector glorp={selected} onClose={clearSelection} />
      <ControlDock
        zoom={zoom}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onResetView={resetView}
        onHideInterface={() => setShowInterface(false)}
        onSpawnPrey={spawnPrey}
        onSpawnPredator={spawnPredator}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  ) : null

  return <Stage canvasRef={canvasRef} overlay={overlay} />
}

export default App
