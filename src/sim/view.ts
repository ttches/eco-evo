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
  /** Stable per-glorp identity, used to vary the blob silhouette. */
  readonly id: Uint32Array
  readonly type: Uint8Array
  readonly fed: Float32Array
  /** Gestation seconds remaining; 0 when not pregnant. */
  readonly pregnant: Float32Array
  readonly grass: GrassField
}
