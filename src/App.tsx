import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  createCamera,
  panBy,
  zoomAt,
  type Camera,
} from '@/engine/camera'
import { CAMERA, FIXED_STEP, VIEWPORT } from '@/engine/config'
import { createLoop } from '@/engine/loop'
import { Renderer } from '@/render/renderer'
import { createWorld, step } from '@/sim/world'
import ControlDock from '@/ui/ControlDock'
import SettingsPanel from '@/ui/SettingsPanel'
import Stage from '@/ui/Stage'
import styles from './App.module.css'

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera>(createCamera())
  const [zoom, setZoom] = useState<number>(CAMERA.defaultZoom)
  const [showInterface, setShowInterface] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const world = createWorld()
    const renderer = new Renderer(canvas)
    const loop = createLoop(FIXED_STEP, {
      step: (deltaSeconds) => step(world, deltaSeconds),
      frame: () => renderer.draw(world, cameraRef.current),
    })
    loop.start()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || isEditableTarget(event.target)) return
      if (event.code === 'KeyH') {
        setShowInterface((current) => !current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      loop.stop()
      window.removeEventListener('keydown', handleKeyDown)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let lastX = 0
    let lastY = 0

    const syncZoom = (): void => setZoom(cameraRef.current.zoom)

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
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent): void => {
      if (!dragging) return
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
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

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
      <ControlDock
        zoom={zoom}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onResetView={resetView}
        onHideInterface={() => setShowInterface(false)}
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
