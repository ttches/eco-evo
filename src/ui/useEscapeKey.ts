import { useEffect, useRef } from 'react'

/**
 * Call `onEscape` when Escape is pressed, but only while `active`. The latest
 * handler is kept in a ref so an unstable callback never re-subscribes.
 */
export const useEscapeKey = (active: boolean, onEscape: () => void): void => {
  const handler = useRef(onEscape)

  useEffect(() => {
    handler.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') handler.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active])
}
