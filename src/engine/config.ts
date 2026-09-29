export const CANVAS = {
  width: 480,
  height: 270,
} as const

export const SIMULATION = {
  updatesPerSecond: 60,
} as const

export const FIXED_STEP = 1 / SIMULATION.updatesPerSecond

export const MAX_GLORPS = 512

export const GLORP_RADIUS = 12

export const WORLD_BACKGROUND = 0x0e1a14
