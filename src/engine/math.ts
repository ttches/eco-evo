export const TAU = Math.PI * 2

export const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.min(Math.max(value, minimum), maximum)

export const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount

/** Deterministic 32-bit hash of a number, mapped to [0, 1). */
export const hashUnit = (value: number): number => {
  let hash = (value + 0x9e3779b9) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0
  hash = (hash ^ (hash >>> 16)) >>> 0
  return hash / 4294967296
}

export class XorShift32 {
  private state: number

  public constructor(seed = 0x00c0ffee) {
    this.state = seed >>> 0 || 0x00c0ffee
  }

  public nextUint32(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  public unit(): number {
    return (this.nextUint32() & 0x00ffffff) / 0x01000000
  }

  public range(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.unit()
  }
}
