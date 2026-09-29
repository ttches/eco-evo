import { useEffect, useRef, type RefObject } from 'react'
import { panBy, screenToWorld, zoomAt, type Camera } from '@/engine/camera'
import { CAMERA, VIEWPORT } from '@/engine/config'

/** Pointer travel (screen px) above which a press counts as a pan, not a click. */
const CLICK_DRAG_THRESHOLD_PX = 5

type Point = { x: number; y: number }

/** Last known cursor position in world coordinates, if it is over the canvas. */
export type Cursor = Point & { over: boolean }

type CanvasControlHandlers = {
  /** The camera was zoomed or panned. */
  onCameraChange: () => void
  /** A press released without dragging, in world coordinates. */
  onClick: (point: Point) => void
}

/** Convert client coordinates to viewport pixels, or null if not laid out. */
const clientToViewport = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point | null => {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return {
    x: ((clientX - rect.left) / rect.width) * VIEWPORT.width,
    y: ((clientY - rect.top) / rect.height) * VIEWPORT.height,
  }
}

/**
 * Wheel zoom, drag pan, click and hover tracking on the simulation canvas.
 * Mutates `cameraRef` in place and returns a ref to the world-space cursor.
 */
export const useCanvasControls = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraRef: RefObject<Camera>,
  { onCameraChange, onClick }: CanvasControlHandlers,
): RefObject<Cursor> => {
  const cursorRef = useRef<Cursor>({ x: 0, y: 0, over: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let moved = false
    let downX = 0
    let downY = 0
    let lastX = 0
    let lastY = 0

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const viewport = clientToViewport(canvas, event.clientX, event.clientY)
      if (!viewport) return
      const factor = Math.exp(-event.deltaY * CAMERA.wheelSensitivity)
      cameraRef.current = zoomAt(cameraRef.current, factor, viewport.x, viewport.y)
      onCameraChange()
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
      const viewport = clientToViewport(canvas, event.clientX, event.clientY)
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
      onCameraChange()
    }

    const handlePointerUp = (event: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      if (moved) return

      const viewport = clientToViewport(canvas, event.clientX, event.clientY)
      if (!viewport) return
      onClick(screenToWorld(cameraRef.current, viewport.x, viewport.y))
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
  }, [canvasRef, cameraRef, onCameraChange, onClick])

  return cursorRef
}
