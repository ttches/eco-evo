import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { followCamera, type Camera } from '@/engine/camera'
import { findGlorpById } from '@/sim/inspect'
import type { World } from '@/sim/world'
import { isEditableTarget, isSpaceActivatingTarget } from '@/ui/keyboard'

type UseCameraLockOptions = {
  cameraRef: RefObject<Camera>
  world: World
  selectedIdRef: RefObject<number | null>
  /** Center the camera on the selected glorp, e.g. a stats/lineage link or lock. */
  onCenter: () => void
}

type CameraLock = {
  locked: boolean
  toggleLock: () => void
  unlock: () => void
  /** Recenter on the locked glorp; returns true when the camera moved. */
  follow: () => boolean
}

/**
 * Keeps the camera centered on the selected glorp while locked. The lock
 * releases on a second toggle, a drag-pan or pinch, clearing the selection, or
 * the glorp's death. Space toggles it while the inspector is open.
 */
export const useCameraLock = ({
  cameraRef,
  world,
  selectedIdRef,
  onCenter,
}: UseCameraLockOptions): CameraLock => {
  const [locked, setLockedState] = useState(false)
  // Read by the render-loop closure, which is created once and cannot see state.
  const lockedRef = useRef(false)

  const setLocked = useCallback((next: boolean): void => {
    if (lockedRef.current === next) return
    lockedRef.current = next
    setLockedState(next)
  }, [])

  const unlock = useCallback((): void => setLocked(false), [setLocked])

  /** Index of the currently selected glorp, or -1 if it is gone. */
  const selectedIndex = useCallback((): number => {
    const id = selectedIdRef.current
    return id === null ? -1 : findGlorpById(world, id)
  }, [world, selectedIdRef])

  const toggleLock = useCallback((): void => {
    const next = !lockedRef.current
    // Only a glorp that exists in the world can be followed.
    if (next && selectedIndex() < 0) return
    setLocked(next)
    if (next) onCenter()
  }, [setLocked, onCenter, selectedIndex])

  const follow = useCallback((): boolean => {
    if (!lockedRef.current) return false
    const index = selectedIndex()
    // The glorp died or the selection cleared; a lock has nothing to follow.
    if (index < 0) {
      setLocked(false)
      return false
    }

    const current = cameraRef.current
    const next = followCamera(current, world.x[index], world.y[index])
    cameraRef.current = next
    return next.x !== current.x || next.y !== current.y
  }, [cameraRef, world, selectedIndex, setLocked])

  // Space toggles the lock, but only with an inspector open and not while a
  // control has focus (where Space should activate that control instead).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat) return
      if (
        selectedIdRef.current === null ||
        isEditableTarget(event.target) ||
        isSpaceActivatingTarget(event.target)
      ) {
        return
      }
      event.preventDefault()
      toggleLock()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIdRef, toggleLock])

  return { locked, toggleLock, unlock, follow }
}
