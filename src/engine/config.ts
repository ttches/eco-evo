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

export const MAX_GLORPS = 512

export const GLORP_RADIUS = 12

export const CAMERA = {
  /** Fits the whole world exactly (480/1920 = 270/1080 = 0.25). */
  minZoom: 0.25,
  maxZoom: 4,
  defaultZoom: 0.25,
  wheelSensitivity: 0.0015,
  /** Extra world units rendered beyond the view edge, to avoid pop-in. */
  cullMargin: 32,
} as const

/** Clear color outside the world. */
export const WORLD_BACKGROUND = 0x09090b

export const GROUND_COLOR = 0x0e1a14

export const GRID_COLOR = 0x1c3328

export const GRID_SPACING = 64
