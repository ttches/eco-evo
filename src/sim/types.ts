export const GLORP_TYPE = {
  prey: 0,
  hunter: 1,
} as const

export type GlorpType = (typeof GLORP_TYPE)[keyof typeof GLORP_TYPE]
