import { describe, expect, it, vi } from 'vitest'
import {
  DODGE_CHANCE_MAX,
  DODGE_CHANCE_PER_LEVEL,
  DODGE_DISTANCE,
  DODGE_DURATION,
  DODGE_SPEED,
  GESTATION_SECONDS,
  GLORP_RADIUS,
  HUNTER_KILL_FED,
  PREGNANT_SPEED_FACTOR,
} from '@/sim/config'
import { computeSteering } from '@/sim/behavior'
import { applyEating, dodgeChance, tickDodges } from '@/sim/predation'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { TRAIT_KEYS } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step } from '@/sim/world'

const DT = 1 / 60

/** One hunter and one prey within eating reach, with chosen agility levels. */
const setupHunt = (
  hunterAgility: number,
  preyAgility: number,
  hunterStrength = 5,
  preyStrength = 5,
) => {
  const world = createWorld(2, 21)
  world.type[0] = GLORP_TYPE.hunter
  world.type[1] = GLORP_TYPE.prey
  world.x[0] = 100
  world.y[0] = 100
  world.x[1] = 100 + 2 * GLORP_RADIUS - 1
  world.y[1] = 100
  world.fed[0] = 50
  world.fed[1] = 50
  world.strength[0] = hunterStrength
  world.strength[1] = preyStrength
  world.agility[0] = hunterAgility
  world.agility[1] = preyAgility
  return world
}

/** Force the next dodge roll to succeed or fail, whatever the chance. */
const rollUnit = (world: ReturnType<typeof createWorld>, value: number) =>
  vi.spyOn(world.random, 'unit').mockReturnValue(value)

describe('agility trait', () => {
  it('is part of the heritable trait set', () => {
    expect(TRAIT_KEYS).toContain('agility')
  })
})

describe('dodgeChance', () => {
  it('is zero when the hunter is at least as agile', () => {
    expect(dodgeChance(setupHunt(5, 5), 0, 1)).toBe(0)
    expect(dodgeChance(setupHunt(6, 5), 0, 1)).toBe(0)
    expect(dodgeChance(setupHunt(7, 1), 0, 1)).toBe(0)
  })

  it('scales with each level of agility advantage', () => {
    expect(dodgeChance(setupHunt(4, 5), 0, 1)).toBeCloseTo(DODGE_CHANCE_PER_LEVEL)
    expect(dodgeChance(setupHunt(4, 6), 0, 1)).toBeCloseTo(
      DODGE_CHANCE_PER_LEVEL * 2,
    )
    expect(dodgeChance(setupHunt(4, 7), 0, 1)).toBeCloseTo(
      DODGE_CHANCE_PER_LEVEL * 3,
    )
  })

  it('caps at the configured maximum', () => {
    expect(dodgeChance(setupHunt(1, 7), 0, 1)).toBe(DODGE_CHANCE_MAX)
  })
})

describe('dodge resolution', () => {
  it('eats a prey of equal agility even when the roll would dodge', () => {
    const world = setupHunt(5, 5)
    rollUnit(world, 0)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
    expect(world.dodges).toBe(0)
  })

  it('eats a prey less agile than the hunter', () => {
    const world = setupHunt(6, 4)
    rollUnit(world, 0)
    applyEating(world, 0.1)
    expect(world.count).toBe(1)
  })

  it('lets a more agile prey escape on a successful roll', () => {
    const world = setupHunt(4, 5)
    rollUnit(world, 0)
    applyEating(world, 0.1)

    expect(world.count).toBe(2)
    expect(world.dodges).toBe(1)
    expect(world.dodgeTimer[1]).toBeCloseTo(DODGE_DURATION)
    // With no velocity the prey darts straight away from the hunter (to its left).
    expect(world.vx[1]).toBeGreaterThan(0)
    expect(Math.hypot(world.vx[1], world.vy[1])).toBeCloseTo(DODGE_SPEED)
  })

  it('darts a fixed distance independent of the prey speed trait', () => {
    const dartDistanceAt = (speedLevel: number): number => {
      const world = setupHunt(4, 5)
      world.speed[1] = speedLevel
      const roll = rollUnit(world, 0)
      applyEating(world, 0.1)
      // Let any later catch attempt fail so only this dart is measured.
      roll.mockReturnValue(0.99)
      const startX = world.x[1]
      const startY = world.y[1]
      while (world.dodgeTimer[1] > 0) step(world, DT)
      return Math.hypot(world.x[1] - startX, world.y[1] - startY)
    }

    const slow = dartDistanceAt(1)
    const fast = dartDistanceAt(7)
    // The whole point: distance no longer tracks the speed trait.
    expect(Math.abs(slow - fast)).toBeLessThan(0.5)
    expect(Math.abs(slow - DODGE_DISTANCE)).toBeLessThan(1)
    expect(Math.abs(fast - DODGE_DISTANCE)).toBeLessThan(1)
  })

  it('jukes perpendicular to the prey heading, not straight away', () => {
    const world = setupHunt(4, 5)
    // Prey is fleeing due east; a straight escape would also be east.
    world.vx[1] = 50
    world.vy[1] = 0
    rollUnit(world, 0)
    applyEating(world, 0.1)

    // The dart is a sidestep, so eastward speed is replaced by north/south.
    expect(Math.abs(world.vx[1])).toBeLessThan(1e-6)
    expect(Math.abs(world.vy[1])).toBeGreaterThan(0)
  })

  it('makes a dodging prey untargetable for the dart', () => {
    const world = setupHunt(4, 5)
    world.dodgeTimer[1] = DODGE_DURATION
    rollUnit(world, 0)
    applyEating(world, 0.1)

    expect(world.count).toBe(2)
    expect(world.dodges).toBe(0)
  })

  it('eats a more agile prey when the roll fails', () => {
    const world = setupHunt(4, 5)
    rollUnit(world, 0.99)
    applyEating(world, 0.1)

    expect(world.count).toBe(1)
    expect(world.dodges).toBe(0)
  })

  it('still awards the kill energy on a failed dodge', () => {
    const world = setupHunt(4, 5)
    rollUnit(world, 0.99)
    applyEating(world, 0.1)
    expect(world.fed[0]).toBeCloseTo(50 + HUNTER_KILL_FED)
  })
})

describe('target reprioritization', () => {
  it('skips a dodging prey and targets the next nearest', () => {
    const world = createWorld(3, 6)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.type[2] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    // The nearer prey is off-axis and dodging; the farther one is due east.
    world.x[1] = 120
    world.y[1] = 80
    world.x[2] = 150
    world.y[2] = 100
    world.fed[0] = 50
    world.strength[0] = 6
    world.strength[1] = 3
    world.strength[2] = 3
    world.agility[1] = 4
    world.agility[2] = 4
    world.dodgeTimer[1] = DODGE_DURATION
    rebuildSpatialGrid(world)

    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
  })
})

describe('dodge dart steering', () => {
  it('commits to the stored escape direction at dart speed', () => {
    const world = createWorld(1, 7)
    world.type[0] = GLORP_TYPE.prey
    world.dodgeTimer[0] = DODGE_DURATION
    world.dodgeDirX[0] = 1
    world.dodgeDirY[0] = 0
    world.stamina[0] = 5

    rebuildSpatialGrid(world)
    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThan(0)
    expect(Math.abs(steering.y)).toBeLessThan(1e-6)
    expect(steering.sprint).toBe(true)
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(DODGE_SPEED)
  })

  it('curves along a wall instead of darting out of the arena', () => {
    const world = createWorld(1, 8)
    world.type[0] = GLORP_TYPE.prey
    world.x[0] = world.radius
    world.y[0] = world.radius
    world.dodgeTimer[0] = DODGE_DURATION
    world.dodgeDirX[0] = -1
    world.dodgeDirY[0] = 0
    world.stamina[0] = 5

    rebuildSpatialGrid(world)
    const steering = computeSteering(world, 0, DT)

    expect(steering.x).toBeGreaterThanOrEqual(0)
    expect(steering.sprint).toBe(true)
  })

  it('keeps a pregnant dodge at the full fixed distance', () => {
    const world = createWorld(1, 10)
    world.type[0] = GLORP_TYPE.prey
    world.dodgeTimer[0] = DODGE_DURATION
    world.dodgeDirX[0] = 1
    world.dodgeDirY[0] = 0
    world.stamina[0] = 5
    world.pregnant[0] = GESTATION_SECONDS

    rebuildSpatialGrid(world)
    const steering = computeSteering(world, 0, DT)

    expect(steering.sprint).toBe(true)
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(DODGE_SPEED)
    expect(Math.hypot(steering.x, steering.y)).not.toBeCloseTo(
      DODGE_SPEED * PREGNANT_SPEED_FACTOR,
    )
  })
})

describe('tickDodges', () => {
  it('counts the dart down to zero and no further', () => {
    const world = createWorld(1, 9)
    world.dodgeTimer[0] = DODGE_DURATION

    tickDodges(world, DODGE_DURATION / 2)
    expect(world.dodgeTimer[0]).toBeCloseTo(DODGE_DURATION / 2)

    tickDodges(world, DODGE_DURATION)
    expect(world.dodgeTimer[0]).toBe(0)

    tickDodges(world, 1)
    expect(world.dodgeTimer[0]).toBe(0)
  })
})
