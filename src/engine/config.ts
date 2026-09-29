export const VIEWPORT = {
  /**
   * Render pixels along the canvas's shorter side; the longer side follows
   * the screen's aspect ratio. A 16:9 screen renders at 480x270.
   */
  shortSide: 270,
  /** Used before the canvas has been measured. */
  fallback: { width: 480, height: 270 },
} as const

/** Simulation domain, larger than the viewport. */
export const WORLD = {
  width: 1920,
  height: 1080,
} as const

export const SIMULATION = {
  updatesPerSecond: 60,
} as const

export const FIXED_STEP = 1 / SIMULATION.updatesPerSecond

/** Minimum and starting zoom depend on the screen; see `fitZoom` / `coverZoom`. */
export const CAMERA = {
  maxZoom: 4,
  wheelSensitivity: 0.0015,
  /** Extra world units rendered beyond the view edge, to avoid pop-in. */
  cullMargin: 32,
} as const
