import { WORLD } from '@/engine/config'
import { XorShift32 } from '@/engine/math'
import {
  DEFAULT_SEED,
  FED_START,
  GLORP_RADIUS,
  MAX_GLORPS,
  START_HUNTERS,
  START_PREY,
  TRAIT,
} from '@/sim/config'
import {
  integrateMotion,
  updateBehavior,
  updateStamina,
} from '@/sim/behavior'
import { createGrass, regrowGrass } from '@/sim/grass'
import {
  applyDeath,
  applyEating,
  applyMetabolism,
  applyPairReproduction,
  applyReproduction,
  tickCooldowns,
} from '@/sim/lifecycle'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

export type World = RenderableWorld & {
  count: number
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly stamina: Float32Array
  readonly sprinting: Uint8Array
  readonly cooldown: Float32Array
  readonly wanderSeed: Float32Array
  readonly speed: Float32Array
  readonly staminaMax: Float32Array
  readonly metabolism: Float32Array
  readonly reproCooldown: Float32Array
  /** Stable per-glorp identity, unaffected by swap-removal compaction. */
  readonly id: Uint32Array
  /** Next id handed out to a newborn or spawned glorp. */
  nextId: number
  /** Seeded source of runtime randomness (spawns, offspring scatter). */
  readonly random: XorShift32
}

const DEFAULT_COUNT = START_PREY + START_HUNTERS

export const createWorld = (
  count = DEFAULT_COUNT,
  seed = DEFAULT_SEED,
): World => {
  const random = new XorShift32(seed)
  const active = Math.max(0, Math.min(count, MAX_GLORPS))

  const x = new Float32Array(MAX_GLORPS)
  const y = new Float32Array(MAX_GLORPS)
  const vx = new Float32Array(MAX_GLORPS)
  const vy = new Float32Array(MAX_GLORPS)
  const type = new Uint8Array(MAX_GLORPS)
  const fed = new Float32Array(MAX_GLORPS)
  const stamina = new Float32Array(MAX_GLORPS)
  const sprinting = new Uint8Array(MAX_GLORPS)
  const cooldown = new Float32Array(MAX_GLORPS)
  const wanderSeed = new Float32Array(MAX_GLORPS)
  const speed = new Float32Array(MAX_GLORPS)
  const staminaMax = new Float32Array(MAX_GLORPS)
  const metabolism = new Float32Array(MAX_GLORPS)
  const reproCooldown = new Float32Array(MAX_GLORPS)
  const id = new Uint32Array(MAX_GLORPS)

  for (let index = 0; index < active; index += 1) {
    x[index] = random.range(GLORP_RADIUS, WORLD.width - GLORP_RADIUS)
    y[index] = random.range(GLORP_RADIUS, WORLD.height - GLORP_RADIUS)
    type[index] =
      index < START_PREY ? GLORP_TYPE.prey : GLORP_TYPE.hunter
    fed[index] = FED_START
    speed[index] = random.range(TRAIT.speedMin, TRAIT.speedMax)
    staminaMax[index] = random.range(
      TRAIT.staminaMaxMin,
      TRAIT.staminaMaxMax,
    )
    stamina[index] = staminaMax[index]
    metabolism[index] = random.range(
      TRAIT.metabolismMin,
      TRAIT.metabolismMax,
    )
    reproCooldown[index] = random.range(
      TRAIT.reproCooldownMin,
      TRAIT.reproCooldownMax,
    )
    wanderSeed[index] = random.unit()
    id[index] = index
  }

  return {
    count: active,
    x,
    y,
    vx,
    vy,
    type,
    fed,
    stamina,
    sprinting,
    cooldown,
    wanderSeed,
    speed,
    staminaMax,
    metabolism,
    reproCooldown,
    id,
    nextId: active,
    random,
    grass: createGrass(seed),
    radius: GLORP_RADIUS,
  }
}

/** Advance the whole simulation one fixed step. */
export const step = (world: World, deltaSeconds: number): void => {
  updateBehavior(world, deltaSeconds)
  integrateMotion(world, deltaSeconds)
  applyEating(world, deltaSeconds)
  // Cooldowns tick once per step, then both reproduction paths read them.
  tickCooldowns(world, deltaSeconds)
  // Reproduction must run before metabolism: eating tops `fed` up to exactly
  // FED_MAX, and metabolism would immediately drain it below the threshold.
  applyReproduction(world)
  applyPairReproduction(world)
  applyMetabolism(world, deltaSeconds)
  updateStamina(world, deltaSeconds)
  applyDeath(world)
  regrowGrass(world.grass, deltaSeconds)
}
