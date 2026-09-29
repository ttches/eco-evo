import type { GrassField } from '@/sim/grass'

/**
 * The narrow, read-only view of the simulation that the renderer consumes.
 * Simulation internals can change freely as long as a world still satisfies this.
 */
export type RenderableWorld = {
  readonly count: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly radius: number
  readonly type: Uint8Array
  readonly fed: Float32Array
  readonly grass: GrassField
}
