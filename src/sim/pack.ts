/**
 * Packs: a Pack Leader and the sterile Pack Animals it bears. A pack is named
 * by its key, the leader's id + 1 (so 0 means "no pack"). Members store that
 * key in `world.pack`; a leader's own key is derived from its id.
 *
 * Members hold slots on a sunflower (Vogel) spiral around the leader. The
 * golden-angle spacing never lines up into rows, so a pack reads as organic
 * rather than a grid, and each slot drifts inside its own small cell (the
 * animated feature point of a Voronoi field) so the pack keeps breathing.
 */
import { TAU } from '@/engine/math'
import { FED_MAX, PACK } from '@/sim/config'
import { MUTATIONS, isPackAnimal, isPackLeader } from '@/sim/mutations'
import type { Steering } from '@/sim/steering/steering'
import type { World } from '@/sim/world'

/** The angle between consecutive sunflower seeds: pi * (3 - sqrt(5)). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** The pack a glorp belongs to, or 0 when it has none. */
export const packKey = (world: World, index: number): number =>
  isPackLeader(world.mutations[index]) ? world.id[index] + 1 : world.pack[index]

/** Scratch maps reused every step so pack upkeep never allocates. */
const orphanHeirs = new Map<number, number>()
const promotedKeys = new Map<number, number>()

/** Whether glorp `a` was born before `b` (lower id breaks a tie). */
const olderThan = (world: World, a: number, b: number): boolean => {
  const bornA = world.lineage.bornAt[world.id[a]]
  const bornB = world.lineage.bornAt[world.id[b]]
  return bornA !== bornB ? bornA < bornB : world.id[a] < world.id[b]
}

/** Turn a pack animal into a leader, live and in the lineage log. */
const promote = (world: World, heir: number): void => {
  const mask =
    (world.mutations[heir] & ~MUTATIONS.packAnimal.bit) |
    MUTATIONS.packLeader.bit
  world.mutations[heir] = mask
  world.lineage.mutations[world.id[heir]] = mask
  world.pack[heir] = 0
  world.packSlot[heir] = 0
}

/**
 * Rebuild the leader lookup (`world.packLeaders`, pack key -> live index) and
 * run succession: a pack whose leader has died is taken over by its oldest
 * member, which becomes a Pack Leader and can mate. Runs once per step before
 * behavior, so every death path is covered without hooking each one. Indices
 * stay valid until the next removal, so only read the lookup before eating.
 */
export const updatePacks = (world: World): void => {
  const leaders = world.packLeaders
  leaders.clear()
  for (let index = 0; index < world.count; index += 1) {
    if (isPackLeader(world.mutations[index]))
      leaders.set(world.id[index] + 1, index)
  }

  orphanHeirs.clear()
  for (let index = 0; index < world.count; index += 1) {
    const key = world.pack[index]
    if (key === 0 || leaders.has(key)) continue
    const heir = orphanHeirs.get(key)
    if (heir === undefined || olderThan(world, index, heir))
      orphanHeirs.set(key, index)
  }
  if (orphanHeirs.size === 0) return

  promotedKeys.clear()
  for (const [key, heir] of orphanHeirs) {
    promote(world, heir)
    const next = world.id[heir] + 1
    leaders.set(next, heir)
    promotedKeys.set(key, next)
  }
  // Re-point the orphans at their new leader, which hands out slots after the
  // highest one still held.
  for (let index = 0; index < world.count; index += 1) {
    const next = promotedKeys.get(world.pack[index])
    if (next === undefined) continue
    world.pack[index] = next
    const leader = leaders.get(next) as number
    if (world.packSlot[index] >= world.packSlot[leader])
      world.packSlot[leader] = world.packSlot[index] + 1
  }
}

/** Live index of a pack animal's leader, or -1 when it has none. */
export const packLeaderOf = (world: World, index: number): number => {
  if (!isPackAnimal(world.mutations[index])) return -1
  return world.packLeaders.get(world.pack[index]) ?? -1
}

/** Enroll a newborn as a pack animal in its mother's (a leader's) pack. */
export const joinPack = (world: World, child: number, leader: number): void => {
  world.mutations[child] = MUTATIONS.packAnimal.bit
  world.pack[child] = world.id[leader] + 1
  world.packSlot[child] = world.packSlot[leader]
  world.packSlot[leader] += 1
}

/**
 * Give every other member of the eater's pack `PACK.shareEnergy`, on top of the
 * eater's own full meal. A flat scan: meals are rare next to steps.
 */
export const sharePackMeal = (world: World, eater: number): void => {
  const key = packKey(world, eater)
  if (key === 0) return
  for (let index = 0; index < world.count; index += 1) {
    if (index === eater || packKey(world, index) !== key) continue
    const next = world.fed[index] + PACK.shareEnergy
    world.fed[index] = next < FED_MAX ? next : FED_MAX
  }
}

/** Scratch target written by `packSlotTarget`, so steering never allocates. */
const slot = { x: 0, y: 0 }

/**
 * World position of a member's formation slot. The spiral is centered on the
 * leader and turns with its heading, starting behind it, so a small pack trails
 * in a loose wedge and a big one surrounds the leader. Radii start at
 * `PACK.spacing`, which keeps every slot clear of the leader's body.
 */
export const packSlotTarget = (
  world: World,
  member: number,
  leader: number,
): { readonly x: number; readonly y: number } => {
  const vx = world.vx[leader]
  const vy = world.vy[leader]
  const speed = Math.hypot(vx, vy)
  const heading =
    speed < 1e-4 ? world.wanderSeed[leader] * TAU : Math.atan2(vy, vx)
  const k = world.packSlot[member]
  const angle = heading + Math.PI + k * GOLDEN_ANGLE
  const radius = PACK.spacing * Math.sqrt(k + 1)
  const phase = world.wanderSeed[member] * TAU
  const drift = world.time * PACK.wobbleRate
  slot.x =
    world.x[leader] +
    Math.cos(angle) * radius +
    Math.sin(drift + phase) * PACK.wobble
  slot.y =
    world.y[leader] +
    Math.sin(angle) * radius +
    Math.cos(drift * 0.83 + phase * 1.7) * PACK.wobble
  return slot
}

/**
 * Spring a member toward its slot: match the leader's velocity, plus a pull
 * proportional to how far off the slot it is, capped at `maxSpeed`. Tracking
 * the leader's velocity keeps it in formation without lagging or overshooting.
 */
export const steerToSlot = (
  world: World,
  member: number,
  leader: number,
  maxSpeed: number,
): Steering => {
  const target = packSlotTarget(world, member, leader)
  let x = world.vx[leader] + (target.x - world.x[member]) * PACK.stiffness
  let y = world.vy[leader] + (target.y - world.y[member]) * PACK.stiffness
  const speed = Math.hypot(x, y)
  if (speed > maxSpeed) {
    x = (x / speed) * maxSpeed
    y = (y / speed) * maxSpeed
  }
  return { x, y, sprint: false }
}
