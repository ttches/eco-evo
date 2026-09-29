export const TAU = Math.PI * 2

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

export const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount

export class XorShift32 {
  private state: number

  public constructor(seed = 0x00c0ffee) {
    this.state = (seed >>> 0) || 0x00c0ffee
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
