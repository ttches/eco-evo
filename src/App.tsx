import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { FIXED_STEP } from '@/engine/config'
import { createLoop } from '@/engine/loop'
import { Renderer } from '@/engine/renderer'
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
  const [showInterface, setShowInterface] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const world = createWorld()
    const renderer = new Renderer(canvas)
    const loop = createLoop(FIXED_STEP, {
      step: (deltaSeconds) => step(world, deltaSeconds),
      frame: () => renderer.draw(world),
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
      <ControlDock onHideInterface={() => setShowInterface(false)} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  ) : null

  return <Stage canvasRef={canvasRef} overlay={overlay} />
}

export default App
