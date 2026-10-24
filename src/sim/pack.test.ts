import { describe, expect, it } from 'vitest'
import { XorShift32 } from '@/engine/math'
import { computeSteering } from '@/sim/behavior'
import {
  CANNIBAL_HUNGER,
  CATCH_PREY_RANGE,
  FED_MAX,
  GESTATION_SECONDS,
  HUNTER_KILL_FED,
  MATE_RANGE,
  PACK,
} from '@/sim/config'
import { applyDeath } from '@/sim/lifecycle'
import { isEligibleMate } from '@/sim/mate'
import {
  MUTATIONS,
  inheritMutations,
  rollBirthMutations,
  rollSpawnMutations,
} from '@/sim/mutations'
import { packKey, packSlotTarget, updatePacks } from '@/sim/pack'
import { cannibalize, huntPrey } from '@/sim/predation'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
} from '@/sim/reproduction'
import { rebuildSpatialGrid } from '@/sim/spatial'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, type World } from '@/sim/world'

const LEADER = MUTATIONS.packLeader.bit
const MEMBER = MUTATIONS.packAnimal.bit

/** A world of `count` well-fed, off-cooldown hunters, spread far apart. */
const huntersWorld = (count: number, seed = 7): World => {
  const world = createWorld(count, seed)
  world.mutations.fill(0)
  for (let index = 0; index < count; index += 1) {
    world.type[index] = GLORP_TYPE.hunter
    world.x[index] = 100 + index * 400
    world.y[index] = 100
    world.vx[index] = 0
    world.vy[index] = 0
    world.fed[index] = 60
    world.cooldown[index] = 0
  }
  return world
}

/** Make `leader` a pack leader and every index in `members` its pack animal. */
const formPack = (world: World, leader: number, members: number[]): void => {
  world.mutations[leader] = LEADER
  members.forEach((member, slot) => {
    world.mutations[member] = MEMBER
    world.pack[member] = world.id[leader] + 1
    world.packSlot[member] = slot
  })
  world.packSlot[leader] = members.length
}

describe('pack mutation rolls', () => {
  it('never rolls or inherits Pack Animal', () => {
    const random = new XorShift32(3)
    for (let i = 0; i < 20000; i += 1) {
      expect(rollSpawnMutations(random, GLORP_TYPE.hunter) & MEMBER).toBe(0)
      expect(
        rollBirthMutations(random, [MEMBER, MEMBER], GLORP_TYPE.hunter, 1) &
          MEMBER,
      ).toBe(0)
      expect(inheritMutations(random, [MEMBER], GLORP_TYPE.hunter)).toBe(0)
    }
  })

  it('can roll Pack Leader for hunters but never for prey', () => {
    const random = new XorShift32(5)
    let hunterLeaders = 0
    for (let i = 0; i < 20000; i += 1) {
      if (rollBirthMutations(random, [], GLORP_TYPE.hunter, 1) & LEADER)
        hunterLeaders += 1
      expect(rollBirthMutations(random, [], GLORP_TYPE.prey, 1) & LEADER).toBe(
        0,
      )
    }
    expect(hunterLeaders).toBeGreaterThan(0)
  })
})

describe('pack reproduction', () => {
  it('never lets a leader or a pack animal clone', () => {
    const world = huntersWorld(2)
    formPack(world, 0, [1])
    world.fed[0] = FED_MAX
    world.fed[1] = FED_MAX
    applyReproduction(world)
    expect(world.count).toBe(2)
  })

  it('never lets a pack animal mate', () => {
    const world = huntersWorld(2)
    formPack(world, 0, [1])
    expect(isEligibleMate(world, 0)).toBe(true)
    expect(isEligibleMate(world, 1)).toBe(false)
  })

  it('always makes the leader the mother, and its pups join the pack', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const world = huntersWorld(2, seed)
      world.x[1] = world.x[0] + MATE_RANGE / 4
      // Put the leader second, so a coin-flip mother would often be wrong.
      world.mutations[1] = LEADER
      applyPairReproduction(world)
      expect(world.pregnant[1]).toBeGreaterThan(0)
      expect(world.pregnant[0]).toBe(0)

      applyGestation(world, GESTATION_SECONDS)
      expect(world.count).toBe(3)
      expect(world.mutations[2]).toBe(MEMBER)
      expect(world.pack[2]).toBe(world.id[1] + 1)
      expect(world.packSlot[2]).toBe(0)
      expect(world.packSlot[1]).toBe(1)
    }
  })
})

describe('pack meals', () => {
  /** Leader 0, members 1 and 2, outsider hunter 3, and prey 4 beside member 1. */
  const setupMeal = () => {
    const world = huntersWorld(5)
    formPack(world, 0, [1, 2])
    world.type[4] = GLORP_TYPE.prey
    world.x[4] = world.x[1] + CATCH_PREY_RANGE / 2
    world.y[4] = world.y[1]
    // No agility means no dodge, so the catch is certain.
    world.agility[4] = 0
    return world
  }

  it('gives the eater the full kill and every packmate a flat share', () => {
    const world = setupMeal()
    expect(huntPrey(world, CATCH_PREY_RANGE)).toBe(1)
    expect(world.fed[1]).toBeCloseTo(60 + HUNTER_KILL_FED)
    expect(world.fed[0]).toBeCloseTo(60 + PACK.shareEnergy)
    expect(world.fed[2]).toBeCloseTo(60 + PACK.shareEnergy)
    expect(world.fed[3]).toBeCloseTo(60)
  })

  it('clamps a packmate share at FED_MAX', () => {
    const world = setupMeal()
    world.fed[2] = FED_MAX - 1
    huntPrey(world, CATCH_PREY_RANGE)
    expect(world.fed[2]).toBe(FED_MAX)
  })

  it('stops packmates from cannibalizing each other', () => {
    const world = huntersWorld(2)
    formPack(world, 0, [1])
    world.x[1] = world.x[0] + world.radius
    world.fed[0] = CANNIBAL_HUNGER / 2
    world.fed[1] = CANNIBAL_HUNGER / 2
    rebuildSpatialGrid(world)
    cannibalize(world, 2 * world.radius, false)
    expect(world.count).toBe(2)
  })
})

describe('pack succession', () => {
  it('promotes the oldest member when the leader dies', () => {
    const world = huntersWorld(3)
    formPack(world, 0, [1, 2])
    world.lineage.bornAt[world.id[1]] = 20
    world.lineage.bornAt[world.id[2]] = 10
    const heirId = world.id[2]
    const otherId = world.id[1]

    world.fed[0] = 0
    applyDeath(world)
    updatePacks(world)

    const heir = Array.from(world.id.subarray(0, world.count)).indexOf(heirId)
    const other = Array.from(world.id.subarray(0, world.count)).indexOf(otherId)
    expect(world.mutations[heir]).toBe(LEADER)
    expect(world.lineage.mutations[heirId]).toBe(LEADER)
    expect(world.mutations[other]).toBe(MEMBER)
    expect(packKey(world, other)).toBe(heirId + 1)
    expect(world.packLeaders.get(heirId + 1)).toBe(heir)
    // New pups get slots after the highest one still held.
    expect(world.packSlot[heir]).toBe(world.packSlot[other] + 1)
    expect(isEligibleMate(world, heir)).toBe(true)
  })
})

describe('pack formation', () => {
  it('spreads slots apart and clear of the leader', () => {
    const world = huntersWorld(1)
    world.mutations[0] = LEADER
    world.x[0] = 1000
    world.y[0] = 1000
    const points: { x: number; y: number }[] = []
    for (let k = 0; k < 24; k += 1) {
      world.packSlot[0] = k
      // Measure the spiral itself: the member's drift is its own wobble.
      const target = packSlotTarget(world, 0, 0)
      points.push({ x: target.x, y: target.y })
    }
    for (const [i, a] of points.entries()) {
      const fromLeader = Math.hypot(a.x - 1000, a.y - 1000)
      expect(fromLeader).toBeGreaterThan(PACK.spacing - PACK.wobble - 1e-6)
      for (const b of points.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
          PACK.spacing / 2,
        )
      }
    }
  })

  it('regroups a straying member instead of hunting', () => {
    const world = huntersWorld(3)
    formPack(world, 0, [1])
    world.x[1] = world.x[0] + PACK.leash * 2
    world.fed[1] = 10
    // Hungry, with prey right beside it, but far outside the leash.
    world.type[2] = GLORP_TYPE.prey
    world.x[2] = world.x[1] + 40
    world.y[2] = world.y[1]
    updatePacks(world)
    rebuildSpatialGrid(world)
    const steering = computeSteering(world, 1, 1 / 60)
    expect(steering.x).toBeLessThan(0)
    expect(steering.sprint).toBe(false)
  })

  it('walks an idle member toward its slot', () => {
    const world = huntersWorld(2)
    formPack(world, 0, [1])
    world.fed[1] = FED_MAX
    world.x[1] = world.x[0] + 100
    updatePacks(world)
    rebuildSpatialGrid(world)
    const target = packSlotTarget(world, 1, 0)
    const steering = computeSteering(world, 1, 1 / 60)
    const toX = target.x - world.x[1]
    const toY = target.y - world.y[1]
    expect(steering.x * toX + steering.y * toY).toBeGreaterThan(0)
  })
})
