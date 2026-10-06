import { describe, expect, it } from 'vitest'
import { computeSteering } from '@/sim/behavior'
import {
  CATCH_PREY_RANGE,
  CORPSE_SECONDS,
  FED_MAX,
  HUNGER,
  MOVEMENT,
  SCAVENGER,
  WALK_SPEED,
} from '@/sim/config'
import { grassAt } from '@/sim/grass'
import { MUTATIONS } from '@/sim/mutations'
import { scavengeCorpses } from '@/sim/predation'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { scaleTrait, traitValue } from '@/sim/traits'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import { createWorld, step } from '@/sim/world'

const DT = 1 / 60
const SCAVENGER_BIT = MUTATIONS.scavenger.bit

/** Drop a corpse directly, the way `spawnCorpse` would from a dead glorp. */
const addCorpse = (
  world: ReturnType<typeof createWorld>,
  x: number,
  y: number,
  type: GlorpType = GLORP_TYPE.prey,
): void => {
  const corpses = world.corpses
  const index = corpses.count
  corpses.x[index] = x
  corpses.y[index] = y
  corpses.type[index] = type
  corpses.id[index] = 0
  corpses.remaining[index] = CORPSE_SECONDS
  corpses.count += 1
}

const jogSpeed = (
  world: ReturnType<typeof createWorld>,
  index: number,
): number =>
  traitValue('speed', world.speed[index]) *
  scaleTrait(
    'endurance',
    world.endurance[index],
    MOVEMENT.jogFactorMin,
    MOVEMENT.jogFactorMax,
  )

describe('scavenge drive', () => {
  /** A hungry scavenger at (100,100) with all grass stripped so only corpses steer it. */
  const setupScavenger = () => {
    const world = createWorld(1, 20)
    world.mutations.fill(0)
    world.grass.values.fill(0)
    world.type[0] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.fed[0] = 50
    world.mutations[0] = SCAVENGER_BIT
    return world
  }

  it('jogs toward a corpse in sight', () => {
    const world = setupScavenger()
    addCorpse(world, 150, 100)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
    expect(steering.sprint).toBe(false)
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      jogSpeed(world, 0),
      5,
    )
  })

  it('picks the nearest corpse when several are in sight', () => {
    const world = setupScavenger()
    addCorpse(world, 60, 100)
    addCorpse(world, 130, 100)
    rebuildSpatialGrid(world)

    expect(computeSteering(world, 0, DT).x).toBeGreaterThan(0)
  })

  it('ignores a corpse beyond SCAVENGER.sight and wanders', () => {
    const world = setupScavenger()
    addCorpse(world, 100 + SCAVENGER.sight + 10, 100)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      WALK_SPEED * MOVEMENT.walkFactor,
      5,
    )
  })

  it('does not seek a corpse when well fed', () => {
    const world = setupScavenger()
    world.fed[0] = HUNGER
    addCorpse(world, 150, 100)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      WALK_SPEED * MOVEMENT.walkFactor,
      5,
    )
  })

  it('does not seek a corpse without the mutation', () => {
    const world = setupScavenger()
    world.mutations[0] = 0
    addCorpse(world, 150, 100)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      WALK_SPEED * MOVEMENT.walkFactor,
      5,
    )
  })

  it('lets prey flee a hunter ahead of scavenging', () => {
    const world = createWorld(2, 20)
    world.mutations.fill(0)
    world.grass.values.fill(0)
    world.type[0] = GLORP_TYPE.prey
    world.type[1] = GLORP_TYPE.hunter
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 140
    world.y[1] = 100
    world.fed[0] = 50
    world.fed[1] = 100
    world.mutations[0] = SCAVENGER_BIT
    // Corpse sits north, so a scavenge would steer up; flee steers west.
    addCorpse(world, 100, 40)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeLessThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
  })

  it('lets a hunter prefer a corpse over live prey', () => {
    const world = createWorld(2, 21)
    world.mutations.fill(0)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 150
    world.y[1] = 100
    world.fed[0] = 50
    world.mutations[0] = SCAVENGER_BIT
    addCorpse(world, 60, 100)
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeLessThan(0)
    expect(steering.sprint).toBe(false)
  })
})

describe('scavengeCorpses', () => {
  const setupEater = (fed = 50, mutation: number = SCAVENGER_BIT) => {
    const world = createWorld(1, 22)
    world.mutations.fill(0)
    world.x[0] = 100
    world.y[0] = 100
    world.fed[0] = fed
    world.mutations[0] = mutation
    return world
  }

  it('eats a touched corpse for its energy and fills the tile with grass', () => {
    const world = setupEater()
    addCorpse(world, 100, 100)

    scavengeCorpses(world)

    expect(world.fed[0]).toBe(50 + SCAVENGER.energy)
    expect(world.corpses.count).toBe(0)
    expect(world.scavenges).toBe(1)
    expect(grassAt(world.grass, 100, 100)).toBe(1)
  })

  it('caps gained energy at FED_MAX', () => {
    const world = setupEater(FED_MAX - 5)
    addCorpse(world, 100, 100)

    scavengeCorpses(world)

    expect(world.fed[0]).toBe(FED_MAX)
  })

  it('eats corpses of either glorp type', () => {
    for (const type of [GLORP_TYPE.prey, GLORP_TYPE.hunter]) {
      const world = setupEater()
      addCorpse(world, 100, 100, type)
      scavengeCorpses(world)
      expect(world.corpses.count).toBe(0)
    }
  })

  it('leaves a corpse it cannot reach', () => {
    const world = setupEater()
    addCorpse(world, 100 + CATCH_PREY_RANGE + 5, 100)

    scavengeCorpses(world)

    expect(world.corpses.count).toBe(1)
    expect(world.scavenges).toBe(0)
  })

  it('does not eat without the mutation or when full', () => {
    const noMutation = setupEater(50, 0)
    addCorpse(noMutation, 100, 100)
    scavengeCorpses(noMutation)
    expect(noMutation.corpses.count).toBe(1)

    const full = setupEater(FED_MAX)
    addCorpse(full, 100, 100)
    scavengeCorpses(full)
    expect(full.corpses.count).toBe(1)
  })

  it('spends no randomness, leaving the simulation stream untouched', () => {
    const eating = setupEater()
    addCorpse(eating, 100, 100)
    const control = setupEater()
    addCorpse(control, 100, 100)

    scavengeCorpses(eating)

    expect(eating.random.unit()).toBe(control.random.unit())
  })
})

describe('scavenging in the running simulation', () => {
  it('eats corpses before they expire', () => {
    const world = createWorld(60, 77)
    // Everyone clusters and scavenges; half start starving so they die within
    // the first second, leaving corpses the survivors are standing on. The run
    // is shorter than CORPSE_SECONDS, so clearing them is attributable to
    // eating rather than to expiry.
    for (let index = 0; index < world.count; index += 1) {
      world.x[index] = 100
      world.y[index] = 100
      world.mutations[index] = SCAVENGER_BIT
      world.fed[index] = index < 30 ? 1 : 100
    }
    const ticks = Math.floor((CORPSE_SECONDS * 2) / 3 / DT)
    for (let tick = 0; tick < ticks; tick += 1) step(world, DT)

    expect(world.scavenges).toBeGreaterThan(0)
    expect(world.corpses.count).toBe(0)
  })
})
