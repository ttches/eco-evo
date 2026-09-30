export type LoopCallbacks = {
  /** Run one fixed-timestep simulation update. */
  step: (deltaSeconds: number) => void
  /** Called once per display frame with how many steps ran since the last. */
  frame: (steps: number) => void
}

export type Loop = {
  start: () => void
  stop: () => void
}

const MAX_FRAME_SECONDS = 0.1

/**
 * Fixed-timestep animation loop decoupled from the display refresh rate.
 * Simulation advances in `fixedStep` increments; `frame` runs once per display
 * frame and decides whether anything needs drawing.
 */
export const createLoop = (
  fixedStep: number,
  callbacks: LoopCallbacks,
): Loop => {
  let animationFrame = 0
  let accumulator = 0
  let previousTime = 0

  const tick = (now: number): void => {
    accumulator += Math.min((now - previousTime) / 1000, MAX_FRAME_SECONDS)
    previousTime = now
    let steps = 0
    while (accumulator >= fixedStep) {
      callbacks.step(fixedStep)
      accumulator -= fixedStep
      steps += 1
    }
    callbacks.frame(steps)
    animationFrame = requestAnimationFrame(tick)
  }

  return {
    start: () => {
      previousTime = performance.now()
      accumulator = 0
      animationFrame = requestAnimationFrame(tick)
    },
    stop: () => {
      cancelAnimationFrame(animationFrame)
    },
  }
}
