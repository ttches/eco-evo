/**
 * The holographic sheen variants a mutated glorp avatar can wear. Each name maps
 * to a `[data-holo='…']` rule in `GlorpAvatar.module.css`, so the variant list
 * here and the styling stay in lockstep. `HoloLab` previews them all side by
 * side; the chosen one becomes `DEFAULT_HOLO`.
 */
export const HOLO_VARIANTS = [
  'iridescent',
  'gold',
  'rainbow',
  'rainbow-glow',
  'strip',
  'strip-glow',
  'strip-flat',
  'strip-tint',
  'strip-soft',
  'cosmos',
  'beam',
  'prism',
] as const

export type HoloVariant = (typeof HOLO_VARIANTS)[number]

/** Display names for the preview lab. */
export const HOLO_LABELS: Record<HoloVariant, string> = {
  iridescent: 'Iridescent',
  gold: 'Gold Foil',
  rainbow: 'Rainbow Foil',
  'rainbow-glow': 'Rainbow Foil · Saturated',
  strip: 'Rainbow Strip',
  'strip-glow': 'Strip · Saturated Glow',
  'strip-flat': 'Strip · Flat Vivid',
  'strip-tint': 'Strip · Hue Tint',
  'strip-soft': 'Strip · Soft Pastel',
  cosmos: 'Cosmos',
  beam: 'Holo Beam',
  prism: 'Prism',
}

/** The variant a mutated avatar wears in the app. */
export const DEFAULT_HOLO: HoloVariant = 'strip-tint'
