import { describe, expect, it } from 'vitest'
import { GESTATION_SECONDS, GLORP_RADIUS, MATE_RANGE } from '@/sim/config'
import {
  buildLeaderboard,
  filterStats,
  sortStats,
  summarizeStats,
  traitExtremesFromStats,
  type GlorpStat,
} from '@/sim/leaderboard'
import { applyDeath } from '@/sim/lifecycle'
import { applyEating } from '@/sim/predation'
import {
  applyGestation,
  applyPairReproduction,
  applyReproduction,
} from '@/sim/reproduction'
import { spawnRandom } from '@/sim/spawn'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld } from '@/sim/world'

describe('buildLeaderboard', () => {
  it('tallies direct offspring and whole-tree descendants', () => {
    const world = createWorld(1, 9)
    world.fed[0] = 100
    world.cooldown[0] = 0
    applyReproduction(world)

    // The clone (id 1) then produces a grandchild (id 2).
    world.fed[1] = 100
    world.cooldown[1] = 0
    applyReproduction(world)

    const stats = buildLeaderboard(world)
    expect(stats).toHaveLength(3)
    expect(stats[0]).toMatchObject({ offspring: 1, descendants: 2 })
    expect(stats[1]).toMatchObject({ offspring: 1, descendants: 1 })
    expect(stats[2]).toMatchObject({ offspring: 0, descendants: 0 })
  })

  it('credits kills and lifespan from the lineage log', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + GLORP_RADIUS
    world.y[1] = 100
    world.time = 5
    world.strength[0] = 6
    world.strength[1] = 3

    applyEating(world, 0.1)

    const stats = buildLeaderboard(world)
    expect(stats[0].kills).toBe(1)
    expect(stats[0].alive).toBe(true)
    expect(stats[1].alive).toBe(false)
    expect(stats[1].timeAlive).toBe(5)
  })

  it('credits both parents of a pair offspring', () => {
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
    applyGestation(world, GESTATION_SECONDS)

    const stats = buildLeaderboard(world)
    expect(stats[0]).toMatchObject({ offspring: 1, descendants: 1 })
    expect(stats[1]).toMatchObject({ offspring: 1, descendants: 1 })
    expect(stats[2]).toMatchObject({ offspring: 0, descendants: 0 })
  })

  it('keeps kills after the killer itself dies', () => {
    const world = createWorld(2, 11)
    world.type[0] = GLORP_TYPE.hunter
    world.type[1] = GLORP_TYPE.prey
    world.x[0] = 100
    world.y[0] = 100
    world.x[1] = 100 + GLORP_RADIUS
    world.y[1] = 100
    world.strength[0] = 6
    world.strength[1] = 3

    applyEating(world, 0.1)
    world.fed[0] = 0
    applyDeath(world)

    const stats = buildLeaderboard(world)
    expect(stats[0].kills).toBe(1)
    expect(stats[0].alive).toBe(false)
    expect(stats[1].alive).toBe(false)
  })

  it('returns an empty board for a world with no glorps', () => {
    const world = createWorld(0, 3)
    expect(buildLeaderboard(world)).toEqual([])
  })
})

describe('sortStats', () => {
  const stat = (
    id: number,
    value: number,
    overrides: Partial<GlorpStat> = {},
  ): GlorpStat => ({
    id,
    name: `Glorp #${id}`,
    type: GLORP_TYPE.prey,
    alive: true,
    timeAlive: value,
    kills: value,
    offspring: value,
    descendants: value,
    traits: {
      speed: value,
      staminaMax: value,
      metabolism: value,
      reproCooldown: value,
      strength: value,
    },
    ...overrides,
  })

  it('sorts descending and breaks ties by ascending id', () => {
    const sorted = sortStats([stat(0, 3), stat(1, 9), stat(2, 9)], 'kills')
    expect(sorted.map((entry) => entry.id)).toEqual([1, 2, 0])
  })

  it('sorts by any numeric stat', () => {
    const entries = [stat(0, 3), stat(1, 9), stat(2, 9)]
    expect(sortStats(entries, 'timeAlive').map((e) => e.id)).toEqual([1, 2, 0])
    expect(sortStats(entries, 'descendants').map((e) => e.id)).toEqual([1, 2, 0])
  })

  it('follows each trait favored direction', () => {
    const entries = [stat(0, 3), stat(1, 9), stat(2, 9)]
    // Speed favors higher, metabolism favors lower.
    expect(sortStats(entries, 'speed').map((e) => e.id)).toEqual([1, 2, 0])
    expect(sortStats(entries, 'metabolism').map((e) => e.id)).toEqual([0, 1, 2])
  })
})

describe('filterStats', () => {
  const stat = (id: number, type: GlorpStat['type'], alive: boolean): GlorpStat => ({
    id,
    name: `Glorp #${id}`,
    type,
    alive,
    timeAlive: 0,
    kills: 0,
    offspring: 0,
    descendants: 0,
    traits: {
      speed: 0,
      staminaMax: 0,
      metabolism: 0,
      reproCooldown: 0,
      strength: 0,
    },
  })

  const entries = [
    stat(0, GLORP_TYPE.prey, true),
    stat(1, GLORP_TYPE.prey, false),
    stat(2, GLORP_TYPE.hunter, true),
  ]

  it('filters by diet and life status together', () => {
    expect(filterStats(entries, 'all', 'both')).toHaveLength(3)
    expect(filterStats(entries, GLORP_TYPE.prey, 'both').map((e) => e.id)).toEqual([0, 1])
    expect(filterStats(entries, 'all', 'alive').map((e) => e.id)).toEqual([0, 2])
    expect(filterStats(entries, 'all', 'dead').map((e) => e.id)).toEqual([1])
    expect(filterStats(entries, GLORP_TYPE.hunter, 'dead')).toEqual([])
  })
})

describe('summarizeStats', () => {
  it('counts the living by diet and the dead overall', () => {
    const world = createWorld(3, 5)
    spawnRandom(world, GLORP_TYPE.hunter)
    world.fed[0] = 0
    world.time = 1
    applyDeath(world)

    const summary = summarizeStats(buildLeaderboard(world))
    expect(summary.totalBorn).toBe(4)
    expect(summary.alive).toBe(3)
    expect(summary.deaths).toBe(1)
    expect(summary.hunters).toBe(1)
    expect(summary.prey).toBe(2)
  })

  it('reports all zeros for an empty world', () => {
    const summary = summarizeStats(buildLeaderboard(createWorld(0, 3)))
    expect(summary).toEqual({
      alive: 0,
      totalBorn: 0,
      deaths: 0,
      prey: 0,
      hunters: 0,
    })
  })
})

describe('traitExtremesFromStats', () => {
  it('picks the highest or lowest value per the favored direction', () => {
    const world = createWorld(2, 7)
    world.lineage.traits.speed[0] = 30
    world.lineage.traits.speed[1] = 70
    world.lineage.traits.metabolism[0] = 2
    world.lineage.traits.metabolism[1] = 4

    const extremes = traitExtremesFromStats(buildLeaderboard(world))
    const byKey = Object.fromEntries(extremes.map((e) => [e.key, e]))
    expect(byKey.speed.id).toBe(1)
    expect(byKey.metabolism.id).toBe(0)
  })

  it('breaks trait ties toward the lower id', () => {
    const world = createWorld(2, 7)
    world.lineage.traits.speed[0] = 50
    world.lineage.traits.speed[1] = 50

    const byKey = Object.fromEntries(
      traitExtremesFromStats(buildLeaderboard(world)).map((e) => [e.key, e]),
    )
    expect(byKey.speed.id).toBe(0)
  })
})
