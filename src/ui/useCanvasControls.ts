import { useEffect, useRef, type RefObject } from 'react'
import { panBy, screenToWorld, zoomAt, type Camera } from '@/engine/camera'
import { CAMERA } from '@/engine/config'

/** Pointer travel (screen px) above which a press counts as a pan, not a click. */
const CLICK_DRAG_THRESHOLD_PX = 5

/** Two taps closer than this in time (ms) and space (screen px) are a double tap. */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DISTANCE_PX = 30

type Point = { x: number; y: number }

/** Last known cursor position in world coordinates, if it is over the canvas. */
export type Cursor = Point & { over: boolean }

type CanvasControlHandlers = {
  /** The camera was zoomed or panned. */
  onCameraChange: () => void
  /** A press released without dragging, in world coordinates. */
  onClick: (point: Point) => void
  /** A second quick touch tap in the same spot. The first tap still clicks. */
  onDoubleTap: (point: Point) => void
  /** The user dragged or pinched to pan the view. */
  onUserPan: () => void
}

/** Convert client coordinates to viewport pixels, or null if not laid out. */
const clientToViewport = (
  canvas: HTMLCanvasElement,
  camera: Camera,
  clientX: number,
  clientY: number,
): Point | null => {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return {
    x: ((clientX - rect.left) / rect.width) * camera.viewport.width,
    y: ((clientY - rect.top) / rect.height) * camera.viewport.height,
  }
}

/**
 * Wheel and pinch zoom, drag pan, click, double tap and hover tracking on the
 * simulation canvas. Mutates `cameraRef` in place and returns a ref to the
 * world-space cursor.
 */
export const useCanvasControls = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraRef: RefObject<Camera>,
  { onCameraChange, onClick, onDoubleTap, onUserPan }: CanvasControlHandlers,
): RefObject<Cursor> => {
  const cursorRef = useRef<Cursor>({ x: 0, y: 0, over: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /** Client position of every finger or button currently down. */
    const pointers = new Map<number, Point>()
    // Whether this press became a pan or pinch; if so it can't be a tap.
    let moved = false
    let downX = 0
    let downY = 0
    // Last pan position (one pointer) or pinch midpoint and spread (two).
    let lastX = 0
    let lastY = 0
    let lastSpread = 0
    let lastTapTime = -Infinity
    let lastTapX = 0
    let lastTapY = 0

    const toViewport = (clientX: number, clientY: number): Point | null =>
      clientToViewport(canvas, cameraRef.current, clientX, clientY)

    /** Render pixels per CSS pixel, per axis. */
    const cssScale = (): Point | null => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      const { viewport } = cameraRef.current
      return { x: viewport.width / rect.width, y: viewport.height / rect.height }
    }

    /** Midpoint and distance of the first two pointers, in client px. */
    const pinchState = (): { mid: Point; spread: number } => {
      const [a, b] = pointers.values()
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        spread: Math.hypot(a.x - b.x, a.y - b.y),
      }
    }

    /** Re-anchor the gesture after pointers are added or lifted. */
    const resetGesture = (): void => {
      if (pointers.size >= 2) {
        const { mid, spread } = pinchState()
        lastX = mid.x
        lastY = mid.y
        lastSpread = spread
      } else if (pointers.size === 1) {
        const [only] = pointers.values()
        lastX = only.x
        lastY = only.y
      }
    }

    const panClient = (deltaX: number, deltaY: number): void => {
      const scale = cssScale()
      if (!scale) return
      const { zoom } = cameraRef.current
      cameraRef.current = panBy(
        cameraRef.current,
        (deltaX * scale.x) / zoom,
        (deltaY * scale.y) / zoom,
      )
    }

    const handleTap = (event: PointerEvent): void => {
      const viewport = toViewport(event.clientX, event.clientY)
      if (!viewport) return
      const point = screenToWorld(cameraRef.current, viewport.x, viewport.y)

      const isDoubleTap =
        event.pointerType === 'touch' &&
        event.timeStamp - lastTapTime < DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) <
          DOUBLE_TAP_DISTANCE_PX
      if (isDoubleTap) {
        lastTapTime = -Infinity
        onDoubleTap(point)
        return
      }
      lastTapTime = event.timeStamp
      lastTapX = event.clientX
      lastTapY = event.clientY
      onClick(point)
    }

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const viewport = toViewport(event.clientX, event.clientY)
      if (!viewport) return
      const factor = Math.exp(-event.deltaY * CAMERA.wheelSensitivity)
      cameraRef.current = zoomAt(cameraRef.current, factor, viewport.x, viewport.y)
      onCameraChange()
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      canvas.setPointerCapture(event.pointerId)
      if (pointers.size === 1) {
        moved = false
        downX = event.clientX
        downY = event.clientY
      } else {
        // A second finger turns the press into a pinch, never a tap.
        moved = true
      }
      resetGesture()
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const viewport = toViewport(event.clientX, event.clientY)
      if (viewport) {
        const point = screenToWorld(cameraRef.current, viewport.x, viewport.y)
        cursorRef.current = { x: point.x, y: point.y, over: true }
      }

      const pointer = pointers.get(event.pointerId)
      if (!pointer) return
      pointer.x = event.clientX
      pointer.y = event.clientY

      if (pointers.size >= 2) {
        const { mid, spread } = pinchState()
        panClient(mid.x - lastX, mid.y - lastY)
        const anchor = toViewport(mid.x, mid.y)
        if (anchor && lastSpread > 0 && spread > 0) {
          cameraRef.current = zoomAt(
            cameraRef.current,
            spread / lastSpread,
            anchor.x,
            anchor.y,
          )
        }
        lastX = mid.x
        lastY = mid.y
        lastSpread = spread
        onUserPan()
        onCameraChange()
        return
      }

      if (
        !moved &&
        Math.hypot(event.clientX - downX, event.clientY - downY) >
          CLICK_DRAG_THRESHOLD_PX
      ) {
        moved = true
        onUserPan()
      }
      panClient(event.clientX - lastX, event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY
      onCameraChange()
    }

    const handlePointerUp = (event: PointerEvent): void => {
      if (!pointers.delete(event.pointerId)) return
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      if (pointers.size > 0) {
        resetGesture()
        return
      }
      if (!moved && event.type === 'pointerup') handleTap(event)
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
  }, [canvasRef, cameraRef, onCameraChange, onClick, onDoubleTap, onUserPan])

  return cursorRef
}
