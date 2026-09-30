import { useCallback, useEffect, useRef, useState } from 'react'
import {
  centerCamera,
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
import {
  findGlorpById,
  readGlorpView,
  type GlorpView,
} from '@/sim/inspect'
import { setName } from '@/sim/lineage'
import { glorpAt } from '@/sim/query'
import { spawnGlorp, spawnRandom } from '@/sim/spawn'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import { createWorld, step, type World } from '@/sim/world'
import Brand from '@/ui/FloatingUI/Brand/Brand'
import ControlDock from '@/ui/FloatingUI/ControlDock/ControlDock'
import SettingsPanel from '@/ui/FloatingUI/SettingsPanel/SettingsPanel'
import TopActions from '@/ui/FloatingUI/TopActions/TopActions'
import GlorpInspector from '@/ui/GlorpInspector/GlorpInspector'
import Stage from '@/ui/Stage/Stage'
import { useCanvasControls } from '@/ui/useCanvasControls'

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
  /** Ids visited before the current one, so the inspector can go back. */
  const historyRef = useRef<number[]>([])
  /** Set when the view or selection changed; steps redraw on their own. */
  const needsDrawRef = useRef(true)
  const [world] = useState<World>(() => createWorld())
  const [zoom, setZoom] = useState<number>(() => createCamera().zoom)
  const [showInterface, setShowInterface] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selected, setSelected] = useState<GlorpView | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)

  const handleCameraChange = useCallback(() => {
    needsDrawRef.current = true
    setZoom(cameraRef.current.zoom)
  }, [])

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null
    historyRef.current = []
    needsDrawRef.current = true
    setCanGoBack(false)
    setSelected(null)
  }, [])

  /**
   * Show a glorp. `center` is set only when following a lineage link, so a
   * direct click on the world never yanks the camera.
   */
  const showGlorp = useCallback(
    (id: number, center: boolean) => {
      selectedIdRef.current = id
      needsDrawRef.current = true
      setSelected(readGlorpView(world, id))

      if (!center) return
      const index = findGlorpById(world, id)
      if (index < 0) return
      cameraRef.current = centerCamera(
        cameraRef.current,
        world.x[index],
        world.y[index],
      )
      handleCameraChange()
    },
    [world, handleCameraChange],
  )

  /** A fresh world click resets the history and leaves the camera alone. */
  const selectGlorp = useCallback(
    (id: number) => {
      historyRef.current = []
      setCanGoBack(false)
      showGlorp(id, false)
    },
    [showGlorp],
  )

  const navigateTo = useCallback(
    (id: number) => {
      const current = selectedIdRef.current
      if (current === id) return
      if (current !== null) historyRef.current.push(current)
      setCanGoBack(historyRef.current.length > 0)
      showGlorp(id, true)
    },
    [showGlorp],
  )

  const goBack = useCallback(() => {
    const previous = historyRef.current.pop()
    if (previous === undefined) return
    setCanGoBack(historyRef.current.length > 0)
    showGlorp(previous, true)
  }, [showGlorp])

  const renameGlorp = useCallback(
    (id: number, name: string) => {
      setName(world.lineage, id, name)
      if (selectedIdRef.current === id) setSelected(readGlorpView(world, id))
    },
    [world],
  )

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
      selectGlorp(world.id[index])
    },
    [world, pickAt, clearSelection, selectGlorp],
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
    onCameraChange: handleCameraChange,
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
    handleCameraChange()
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
      handleCameraChange()
    })
    resizeObserver.observe(canvas)

    const loop = createLoop(FIXED_STEP, {
      step: (deltaSeconds) => step(world, deltaSeconds),
      frame: (steps) => {
        // Frames with no step and no view change would draw the same image.
        if (steps === 0 && !needsDrawRef.current) return
        needsDrawRef.current = false

        const id = selectedIdRef.current
        const selectedIndex = id === null ? -1 : findGlorpById(world, id)
        renderer.draw(world, cameraRef.current, selectedIndex)

        if (id === null) return
        const now = performance.now()
        if (now - lastInspectorUpdate < INSPECTOR_INTERVAL_MS) return
        lastInspectorUpdate = now
        // Dead glorps are still shown, read from their lineage record.
        setSelected(readGlorpView(world, id))
      },
    })
    loop.start()

    return () => {
      loop.stop()
      resizeObserver.disconnect()
      renderer.dispose()
    }
  }, [world, handleCameraChange])

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
    handleCameraChange()
  }

  const zoomBy = (factor: number): void => {
    const { viewport } = cameraRef.current
    cameraRef.current = zoomAt(
      cameraRef.current,
      factor,
      viewport.width / 2,
      viewport.height / 2,
    )
    handleCameraChange()
  }

  const overlay = (
    <>
      <GlorpInspector
        key={selected?.id ?? 'none'}
        glorp={selected}
        onClose={clearSelection}
        onBack={goBack}
        canGoBack={canGoBack}
        onNavigate={navigateTo}
        onRename={renameGlorp}
      />
      {showInterface && (
        <>
          <Brand />
          <TopActions onOpenSettings={() => setSettingsOpen(true)} />
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
      )}
    </>
  )

  return <Stage canvasRef={canvasRef} overlay={overlay} />
}

export default App
