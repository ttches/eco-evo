/**
 * Per-glorp encounter bookkeeping for analysis: how often a prey runs from a
 * hunter, how often it gets away, and how many dodges each side saw. Counts
 * live in the lineage log so they survive death; nothing here steers anyone.
 */
import type { World } from '@/sim/world'

/**
 * Seconds a prey must go without fleeing before its flight counts as an
 * escape. Bridges the flicker at the edge of `PREY_FLEE` and the dodge dart, so
 * one chase is one flight rather than several.
 */
export const FLIGHT_SETTLE_SECONDS = 1

/** A prey fled a hunter this step; opens a flight if it was not in one. */
export const noteFlight = (world: World, index: number): void => {
  if (world.flightCalm[index] <= 0) world.lineage.flights[world.id[index]] += 1
  world.flightCalm[index] = FLIGHT_SETTLE_SECONDS
}

/** A prey dodged a hunter's catch. */
export const noteDodge = (world: World, hunter: number, prey: number): void => {
  world.lineage.dodges[world.id[prey]] += 1
  world.lineage.whiffs[world.id[hunter]] += 1
}

/** Settle flights: one that stays calm long enough is an escape. */
export const tickFlights = (world: World, dt: number): void => {
  for (let index = 0; index < world.count; index += 1) {
    if (world.flightCalm[index] <= 0) continue
    const next = world.flightCalm[index] - dt
    if (next > 0) {
      world.flightCalm[index] = next
    } else {
      world.flightCalm[index] = 0
      world.lineage.escapes[world.id[index]] += 1
    }
  }
}
