import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  createCamera,
  fitCamera,
  resizeCamera,
  viewportFor,
  zoomAt,
  type Camera,
} from '@/engine/camera'
import { FIXED_STEP } from '@/engine/config'
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
import { useCanvasControls } from '@/ui/useCanvasControls'
import styles from './App.module.css'

/** How often the inspector refreshes from the live simulation, in ms. */
const INSPECTOR_INTERVAL_MS = 100

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
  const selectedIdRef = useRef<number | null>(null)
  const [world] = useState<World>(() => createWorld())
  const [zoom, setZoom] = useState<number>(() => createCamera().zoom)
  const [showInterface, setShowInterface] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selected, setSelected] = useState<GlorpSnapshot | null>(null)

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null
    setSelected(null)
  }, [])

  const syncZoom = useCallback(() => setZoom(cameraRef.current.zoom), [])

  /** Index of the glorp under a world point, with a little touch slack. */
  const pickAt = useCallback(
    (point: { x: number; y: number }) => {
      const pickRadius = Math.max(
        world.radius,
        PICK_TOLERANCE_PX / cameraRef.current.zoom,
      )
      return glorpAt(world, point.x, point.y, pickRadius)
    },
    [world],
  )

  const selectAt = useCallback(
    (point: { x: number; y: number }) => {
      const index = pickAt(point)
      if (index < 0) {
        clearSelection()
        return
      }
      selectedIdRef.current = world.id[index]
      setSelected(readGlorp(world, index))
    },
    [world, pickAt, clearSelection],
  )

  // Double tap on open ground toggles the interface; on a glorp it only
  // selects, which the first tap already did.
  const handleDoubleTap = useCallback(
    (point: { x: number; y: number }) => {
      if (pickAt(point) >= 0) return
      setShowInterface((current) => !current)
    },
    [pickAt],
  )

  const cursorRef = useCanvasControls(canvasRef, cameraRef, {
    onCameraChange: syncZoom,
    onClick: selectAt,
    onDoubleTap: handleDoubleTap,
  })

  const spawn = useCallback(
    (type: GlorpType) => {
      const cursor = cursorRef.current
      if (cursor.over) {
        spawnGlorp(world, type, cursor.x, cursor.y)
      } else {
        spawnRandom(world, type)
      }
    },
    [world, cursorRef],
  )

  const spawnPrey = useCallback(() => spawn(GLORP_TYPE.prey), [spawn])
  const spawnPredator = useCallback(() => spawn(GLORP_TYPE.hunter), [spawn])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      return viewportFor(rect.width, rect.height)
    }
    const initial = measure()
    cameraRef.current = createCamera(initial)
    syncZoom()
    const renderer = new Renderer(canvas, initial)
    let lastInspectorUpdate = 0

    // Rotations and window resizes reshape the view, never the world.
    const resizeObserver = new ResizeObserver(() => {
      const viewport = measure()
      const current = cameraRef.current.viewport
      if (
        viewport.width === current.width &&
        viewport.height === current.height
      ) {
        return
      }
      renderer.resize(viewport)
      cameraRef.current = resizeCamera(cameraRef.current, viewport)
      syncZoom()
    })
    resizeObserver.observe(canvas)

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

    return () => {
      loop.stop()
      resizeObserver.disconnect()
      renderer.dispose()
    }
  }, [world, clearSelection, syncZoom])

  useEffect(() => {
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spawnPrey, spawnPredator])

  const fitView = (): void => {
    cameraRef.current = fitCamera(cameraRef.current.viewport)
    syncZoom()
  }

  const zoomBy = (factor: number): void => {
    const { viewport } = cameraRef.current
    cameraRef.current = zoomAt(
      cameraRef.current,
      factor,
      viewport.width / 2,
      viewport.height / 2,
    )
    syncZoom()
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
        onFitView={fitView}
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
