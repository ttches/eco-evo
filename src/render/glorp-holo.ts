import { GLORP_TYPE, type GlorpType } from '@/sim/types'

/**
 * The holographic sheen candidates a mutated glorp can wear in the world. Each
 * name maps to a branch of `glorpHolo` in `glorp-holo-shader`, so this list and
 * the shader stay in lockstep. `HoloLab`'s World tab previews them all. The SVG
 * avatars have their own, richer variants in `holo.ts`.
 */
export const GLORP_HOLO_VARIANTS = [
  'iridescent',
  'rainbow-sweep',
  'prism',
  'gold',
  'aurora',
  'beam',
  'cosmos',
  'cosmos-color',
  'disco-green',
  'disco-orange',
  'tint',
  'dragon-scales',
  'frosted-opal',
  'abyssal-oil-slick',
  'beetle-shell',
  'slipstream-chrome',
  'ermine-foil',
  'peregrine-titanium',
  'leapfrog-chrome',
  'grasshopper-foil',
  'sahara-gold',
  'cuttlefish-hologram',
  'chameleon-prism',
  'lichen-patina',
  'predator-glint',
  'smoke-and-ember',
  'chromatic-veil',
  'hummingbird-gorget',
  'ore-vein',
  'fire-glimmer',
  'fish-scales',
  'bone-ribs',
  'hyena-pelt',
  'raccoon-bandit',
] as const

export type GlorpHoloVariant = (typeof GLORP_HOLO_VARIANTS)[number]

/** Display names for the World tab of the preview lab. */
export const GLORP_HOLO_LABELS: Record<GlorpHoloVariant, string> = {
  iridescent: 'Iridescent Rim',
  'rainbow-sweep': 'Rainbow Sweep',
  prism: 'Prism',
  gold: 'Gold Foil',
  aurora: 'Aurora Pulse',
  beam: 'Holo Beam',
  cosmos: 'Cosmos',
  'cosmos-color': 'Cosmos · Color',
  'disco-green': 'Disco · Green',
  'disco-orange': 'Disco · Orange',
  tint: 'Hue Tint',
  'dragon-scales': 'Dragon Scales',
  'frosted-opal': 'Frosted Opal',
  'abyssal-oil-slick': 'Abyssal Oil-Slick',
  'beetle-shell': 'Beetle Shell',
  'slipstream-chrome': 'Slipstream Chrome',
  'ermine-foil': 'Ermine Foil',
  'peregrine-titanium': 'Peregrine Titanium',
  'leapfrog-chrome': 'Leapfrog Chrome',
  'grasshopper-foil': 'Grasshopper Foil',
  'sahara-gold': 'Sahara Gold',
  'cuttlefish-hologram': 'Cuttlefish Hologram',
  'chameleon-prism': 'Chameleon Prism',
  'lichen-patina': 'Lichen Patina',
  'predator-glint': 'Predator Glint',
  'smoke-and-ember': 'Smoke & Ember',
  'chromatic-veil': 'Chromatic Veil',
  'hummingbird-gorget': "Anna's Hummingbird",
  'ore-vein': 'Ore Vein',
  'fire-glimmer': 'Fire Glimmer',
  'fish-scales': 'Fish Scales',
  'bone-ribs': 'Bone Ribs',
  'hyena-pelt': 'Hyena Pelt',
  'raccoon-bandit': 'Raccoon Bandit',
}

/** The sheen a mutated glorp of each type wears in the world. */
export const holoForType = (type: GlorpType): GlorpHoloVariant =>
  type === GLORP_TYPE.hunter ? 'disco-orange' : 'disco-green'

/** Global animation-rate multiplier for the world sheen. */
export const GLORP_HOLO_SPEED = 1

/** Global strength multiplier for the world sheen. */
export const GLORP_HOLO_STRENGTH = 1

/** Frozen sheen clock used when `prefers-reduced-motion` is set. */
export const GLORP_HOLO_STILL_TIME = 1.7

/** Screen pixels per `.35x` detail pixel in the World tab's magnified preview. */
export const GLORP_HOLO_PREVIEW_SCALE = 7

/** Position of every variant in the shader's branch chain, built once. */
const HOLO_INDEX = GLORP_HOLO_VARIANTS.reduce(
  (map, variant, index) => {
    map[variant] = index
    return map
  },
  {} as Record<GlorpHoloVariant, number>,
)

export const glorpHoloIndex = (variant: GlorpHoloVariant): number =>
  HOLO_INDEX[variant]
