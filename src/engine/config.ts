/** Pixel backing store of the canvas. The renderer always draws at this size. */
export const VIEWPORT = {
  width: 480,
  height: 270,
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

/** Zoom at which the whole world fits inside the viewport. */
const FIT_ZOOM = Math.min(
  VIEWPORT.width / WORLD.width,
  VIEWPORT.height / WORLD.height,
)

export const CAMERA = {
  minZoom: FIT_ZOOM,
  maxZoom: 4,
  defaultZoom: FIT_ZOOM,
  wheelSensitivity: 0.0015,
  /** Extra world units rendered beyond the view edge, to avoid pop-in. */
  cullMargin: 32,
} as const
