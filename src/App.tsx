import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCamera,
  focusCamera,
  resizeCamera,
  viewportFor,
  type Camera,
} from '@/engine/camera'
import { CAMERA, FIXED_STEP } from '@/engine/config'
import { createLoop } from '@/engine/loop'
import { Renderer } from '@/render/renderer'
import {
  findGlorpById,
  readGlorpView,
  type GlorpView,
} from '@/sim/inspect'
import { setName } from '@/sim/lineage'
import {
  buildLeaderboard,
  type GlorpStat,
} from '@/sim/leaderboard'
import { glorpAt } from '@/sim/query'
import { spawnGlorp, spawnRandom } from '@/sim/spawn'
import { resolveInitialSeed } from '@/sim/seed'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import { createWorld, step } from '@/sim/world'
import Brand from '@/ui/FloatingUI/Brand/Brand'
import StatsPanel from '@/ui/FloatingUI/StatsPanel/StatsPanel'
import TopActions from '@/ui/FloatingUI/TopActions/TopActions'
import GlorpInspector from '@/ui/GlorpInspector/GlorpInspector'
import Stage from '@/ui/Stage/Stage'
import { isEditableTarget } from '@/ui/keyboard'
import { useCameraLock } from '@/ui/useCameraLock'
import { useCanvasControls } from '@/ui/useCanvasControls'

/** How often the floating UI refreshes from the live simulation, in ms. */
const UI_REFRESH_MS = 100

/** How often the open stats panel rebuilds its leaderboard, in ms. */
const STATS_INTERVAL_MS = 500

/** Extra screen-space tolerance (px) for clicking a small glorp. */
const PICK_TOLERANCE_PX = 8

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera>(createCamera())
  const selectedIdRef = useRef<number | null>(null)
  /** Ids visited before the current one, so the inspector can go back. */
  const historyRef = useRef<number[]>([])
  /** Set when the view or selection changed; steps redraw on their own. */
  const needsDrawRef = useRef(true)
  // Created once and mutated in place by the sim loop, never replaced.
  const [world] = useState(() =>
    createWorld(undefined, resolveInitialSeed(window.location.search)),
  )
  const [showInterface, setShowInterface] = useState(true)
  const [selected, setSelected] = useState<GlorpView | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats, setStats] = useState<readonly GlorpStat[]>([])
  const statsOpenRef = useRef(false)

  const handleCameraChange = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  /** Center on the selected glorp, if it is still alive in the world. */
  const centerOnSelected = useCallback(() => {
    const id = selectedIdRef.current
    if (id === null) return
    const index = findGlorpById(world, id)
    if (index < 0) return
    cameraRef.current = focusCamera(
      cameraRef.current,
      world.x[index],
      world.y[index],
      CAMERA.focusZoom,
    )
    handleCameraChange()
  }, [world, handleCameraChange])

  const {
    locked,
    toggleLock,
    unlock: unlockCamera,
    follow: followLocked,
  } = useCameraLock({
    cameraRef,
    world,
    selectedIdRef,
    onCenter: centerOnSelected,
  })

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null
    historyRef.current = []
    needsDrawRef.current = true
    setCanGoBack(false)
    setSelected(null)
    unlockCamera()
  }, [unlockCamera])

  /**
   * Show a glorp. `center` is set only when following a lineage or stats link,
   * so a direct click on the world never yanks the camera.
   */
  const showGlorp = useCallback(
    (id: number, center: boolean) => {
      selectedIdRef.current = id
      needsDrawRef.current = true
      setSelected(readGlorpView(world, id))
      if (center) centerOnSelected()
    },
    [world, centerOnSelected],
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
      // Re-focusing the current glorp still re-centers the camera, but a
      // repeat click should not stack duplicate history entries.
      if (current !== null && current !== id) historyRef.current.push(current)
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
    onUserPan: unlockCamera,
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

  /** Stable accessor so the brand clock can poll sim time without App churn. */
  const getSimTime = useCallback(() => world.time, [world])

  /** Read a full inspector view by stable id, for the stats hover preview. */
  const getGlorpView = useCallback(
    (id: number) => readGlorpView(world, id),
    [world],
  )

  const refreshStats = useCallback(() => {
    setStats(buildLeaderboard(world))
  }, [world])

  const toggleStats = useCallback(() => {
    const next = !statsOpenRef.current
    statsOpenRef.current = next
    if (next) refreshStats()
    setStatsOpen(next)
  }, [refreshStats])

  const closeStats = useCallback(() => {
    statsOpenRef.current = false
    setStatsOpen(false)
  }, [])

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
    let lastUiUpdate = 0
    let lastStatsUpdate = 0

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
        if (followLocked()) needsDrawRef.current = true
        // Frames with no step and no view change would draw the same image.
        if (steps === 0 && !needsDrawRef.current) return
        needsDrawRef.current = false

        const id = selectedIdRef.current
        const selectedIndex = id === null ? -1 : findGlorpById(world, id)
        renderer.draw(world, cameraRef.current, selectedIndex)

        if (id === null && !statsOpenRef.current) return
        const now = performance.now()
        if (now - lastUiUpdate < UI_REFRESH_MS) return
        lastUiUpdate = now
        // Dead glorps are still shown, read from their lineage record.
        if (id !== null) setSelected(readGlorpView(world, id))
        // The all-time board scans the whole lineage log, so throttle it.
        if (
          statsOpenRef.current &&
          now - lastStatsUpdate >= STATS_INTERVAL_MS
        ) {
          lastStatsUpdate = now
          refreshStats()
        }
      },
    })
    loop.start()

    return () => {
      loop.stop()
      resizeObserver.disconnect()
      renderer.dispose()
    }
  }, [world, handleCameraChange, refreshStats, followLocked])

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

  const overlay = (
    <>
      <GlorpInspector
        key={selected?.id ?? 'none'}
        glorp={selected}
        locked={locked}
        onToggleLock={toggleLock}
        onClose={clearSelection}
        onBack={goBack}
        canGoBack={canGoBack}
        onNavigate={navigateTo}
        onRename={renameGlorp}
      />
      {showInterface && (
        <>
          <Brand getTime={getSimTime} seed={world.seed} />
          <TopActions
            onOpenStats={toggleStats}
            onHideInterface={() => setShowInterface(false)}
          />
        </>
      )}
    </>
  )

  return (
    <Stage
      canvasRef={canvasRef}
      overlay={overlay}
      sidePanel={
        showInterface && statsOpen ? (
          <StatsPanel
            onClose={closeStats}
            stats={stats}
            onNavigate={navigateTo}
            getGlorpView={getGlorpView}
          />
        ) : null
      }
    />
  )
}

export default App
