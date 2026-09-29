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
  width: 3840,
  height: 2160,
} as const

export const SIMULATION = {
  updatesPerSecond: 60,
} as const

export const FIXED_STEP = 1 / SIMULATION.updatesPerSecond

/** Minimum and starting zoom depend on the screen; see `fitZoom` / `startZoom`. */
export const CAMERA = {
  /**
   * World area the starting view covers, cropped to fill the screen. Smaller
   * than the world so there is room to zoom out.
   */
  startView: { width: WORLD.width / 2, height: WORLD.height / 2 },
  maxZoom: 4,
  wheelSensitivity: 0.0015,
  /** Extra world units rendered beyond the view edge, to avoid pop-in. */
  cullMargin: 32,
} as const
