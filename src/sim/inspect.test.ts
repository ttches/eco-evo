import { describe, expect, it } from 'vitest'
import { GLORP_RADIUS, MATE_RANGE } from '@/sim/config'
import { readGlorpView } from '@/sim/inspect'
import { applyDeath, applyEating } from '@/sim/lifecycle'
import { DEATH_CAUSE, setName } from '@/sim/lineage'
import {
  applyPairReproduction,
  applyReproduction,
} from '@/sim/reproduction'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('readGlorpView', () => {
  it('reads a living spawned glorp with no parents', () => {
    const world = createWorld(2, 5)
    const id = world.id[0]

    const view = readGlorpView(world, id)

    expect(view?.name).toBe(`Glorp #${id}`)
    expect(view?.alive).toBe(true)
    expect(view?.generation).toBe(0)
    expect(view?.parents).toEqual([])
    expect(view?.killer).toBeNull()
    expect(view?.live?.x).toBe(world.x[0])
    expect(view?.live?.fed).toBe(world.fed[0])
    expect(view?.traits.speed).toBe(world.speed[0])
  })

  it('keeps showing a glorp after it starves', () => {
    const world = createWorld(2, 5)
    const id = world.id[0]
    world.time = 12.5
    world.fed[0] = 0

    applyDeath(world)

    const view = readGlorpView(world, id)
    expect(view?.alive).toBe(false)
    expect(view?.live).toBeNull()
    expect(view?.diedAt).toBe(12.5)
    expect(view?.deathCause).toBe(DEATH_CAUSE.starved)
  })

  it('links a clone to its single parent', () => {
    const world = createWorld(1, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0
    applyReproduction(world)

    const parentId = world.id[0]
    const childId = world.id[1]
    const view = readGlorpView(world, childId)

    expect(view?.generation).toBe(1)
    expect(view?.parents).toHaveLength(1)
    expect(view?.parents[0]).toMatchObject({ id: parentId, alive: true })
    expect(view?.parents[0].name).toBe(`Glorp #${parentId}`)
  })

  it('links pair offspring to both parents', () => {
    const world = createWorld(2, 17)
    for (const index of [0, 1]) {
      world.type[index] = GLORP_TYPE.hunter
      world.fed[index] = 100
      world.cooldown[index] = 0
      world.y[index] = 100
    }
    world.x[0] = 100
    world.x[1] = 100 + MATE_RANGE / 2
    applyPairReproduction(world)

    const view = readGlorpView(world, world.id[2])
    expect(view?.parents.map((parent) => parent.id)).toEqual([
      world.id[0],
      world.id[1],
    ])
  })

  it('marks a dead parent as not alive', () => {
    const world = createWorld(1, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0
    applyReproduction(world)

    const parentId = world.id[0]
    world.fed[0] = 0
    applyDeath(world)

    const view = readGlorpView(world, world.id[1])
    expect(view?.parents[0]).toMatchObject({ id: parentId, alive: false })
  })

  it('reflects a renamed glorp', () => {
    const world = createWorld(2, 11)
    const id = world.id[0]
    setName(world.lineage, id, 'Gloria')
    expect(readGlorpView(world, id)?.name).toBe('Gloria')
  })

  it('names the killer of an eaten glorp', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + GLORP_RADIUS
    world.y[1] = 100
    const hunterId = world.id[0]
    const preyId = world.id[1]
    setName(world.lineage, hunterId, 'Hunter')

    applyEating(world, 0.1)

    expect(readGlorpView(world, preyId)?.killer).toMatchObject({
      id: hunterId,
      name: 'Hunter',
      alive: true,
    })
  })

  it('returns null for an id that was never born', () => {
    const world = createWorld(1, 3)
    expect(readGlorpView(world, 999)).toBeNull()
    expect(readGlorpView(world, -1)).toBeNull()
  })
})
