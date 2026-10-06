export const GLORP_TYPE = {
  prey: 0,
  hunter: 1,
} as const

export type GlorpType = (typeof GLORP_TYPE)[keyof typeof GLORP_TYPE]

/** Clamp a raw type byte to the two known kinds. */
export const glorpTypeFrom = (value: number): GlorpType =>
  value === GLORP_TYPE.hunter ? GLORP_TYPE.hunter : GLORP_TYPE.prey
