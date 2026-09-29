/**
 * The narrow, read-only view of the simulation that the renderer consumes.
 * Simulation internals can change freely as long as a world still satisfies this.
 */
export type RenderableWorld = {
  readonly count: number
  readonly x: Float32Array
  readonly y: Float32Array
  /** Interleaved rgb, one triple per glorp, values in 0..1. */
  readonly colors: Float32Array
  readonly radius: number
}
