/**
 * Picking the world seed. A `?seed=` query parameter pins a world for
 * reproducible or shared runs; otherwise each page load gets a fresh one. The
 * seed is a construction-time input: `createWorld` derives every runtime RNG
 * stream from it, so nothing else needs to share it.
 */
const UINT32_MAX = 0xffffffff

/**
 * Read a seed from a URL query string. Returns `null` when `seed` is missing or
 * is not a non-negative decimal integer, so the caller can fall back.
 */
export const parseSeed = (search: string): number | null => {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || !/^\d+$/.test(raw)) return null
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) return null
  return value >>> 0
}

/** A fresh 32-bit seed. */
const randomUint32 = (): number => {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0]
}

/**
 * The seed for a new world: an explicit `?seed=` wins, otherwise a random one.
 * Zero is nudged to one because `XorShift32` substitutes `DEFAULT_SEED` for a
 * zero state, which would otherwise make seed 0 and a rare random draw both
 * produce the fixed default world.
 */
export const resolveInitialSeed = (
  search: string,
  random: () => number = randomUint32,
): number => {
  const seed = parseSeed(search) ?? (random() >>> 0)
  return seed === 0 ? 1 : seed
}
