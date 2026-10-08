/**
 * Chase benchmark: one prey, one hunter, nothing else. For each prey trait it
 * sweeps the level 0..7 (the other prey traits held at the base build) and
 * reports how often the hunter catches it and how long that takes. It isolates
 * what a trait point buys in a single encounter, which the ecosystem runs can
 * only infer. Levels are set directly, so the trait budget does not apply.
 *
 * Spawned as a child of run.ts with `--import loader.mjs`, so `--set` and
 * `--config` reach the game exactly as they do for a normal run.
 */
import { FIXED_STEP } from '@/engine/config'
import { TRAIT_KEYS, TRAIT_MAX, TRAIT_MIN, traitValue } from '@/sim/traits'
import { GLORP_TYPE } from '@/sim/types'
import { createWorld, step, type World } from '@/sim/world'

export type ChaseOptions = {
  prey: number[]
  hunter: number[]
  trials: number
  /** Starting gap between the two, in world units. */
  distance: number
  /** Seconds before an uncaught prey counts as escaped. */
  seconds: number
}

/** Fed values pinned every step: a hungry hunter, a prey nowhere near starving. */
const HUNTER_FED = 50
const PREY_FED = 90

const place = (world: World, index: number, levels: number[]): void => {
  TRAIT_KEYS.forEach((key, i) => {
    world[key][index] = levels[i]
  })
  world.stamina[index] = traitValue('endurance', world.endurance[index])
  world.exhausted[index] = 0
  world.mutations[index] = 0
  // Nobody reproduces mid-benchmark.
  world.cooldown[index] = Number.MAX_SAFE_INTEGER
}

/** One encounter; returns the catch time in seconds, or null if it escaped. */
export const runChase = (
  prey: number[],
  hunter: number[],
  trial: number,
  options: Pick<ChaseOptions, 'distance' | 'seconds'>,
): number | null => {
  const world = createWorld(2, 0x5eed + trial * 7919)
  world.type[0] = GLORP_TYPE.prey
  world.type[1] = GLORP_TYPE.hunter
  place(world, 0, prey)
  place(world, 1, hunter)
  // Prey in the middle, hunter on a ring around it at an evenly spread angle.
  const angle = (trial * 2.399963) % (2 * Math.PI)
  world.x[0] = 1920
  world.y[0] = 1080
  world.x[1] = 1920 + Math.cos(angle) * options.distance
  world.y[1] = 1080 + Math.sin(angle) * options.distance
  world.grass.values.fill(0)

  for (let t = 0; t < options.seconds; t += FIXED_STEP) {
    for (let i = 0; i < world.count; i += 1) {
      world.fed[i] = world.type[i] === GLORP_TYPE.hunter ? HUNTER_FED : PREY_FED
    }
    step(world, FIXED_STEP)
    let preyLeft = 0
    for (let i = 0; i < world.count; i += 1) {
      if (world.type[i] === GLORP_TYPE.prey) preyLeft += 1
    }
    if (preyLeft === 0) return world.time
  }
  return null
}

const build = (levels: number[]): string => levels.join('-')

export const formatChaseBench = (options: ChaseOptions): string => {
  const levels = Array.from(
    { length: TRAIT_MAX - TRAIT_MIN + 1 },
    (_, i) => TRAIT_MIN + i,
  )
  const lines = [
    `Chase benchmark: prey base ${build(options.prey)} vs hunter ${build(options.hunter)} ` +
      `(${TRAIT_KEYS.join('-')}), ${options.trials} trials per cell, start ${options.distance} apart, ${options.seconds}s limit.`,
    'Each cell: % caught (mean seconds to catch). One prey trait varies per row; the rest stay at the base build.',
    '',
    `| prey trait | ${levels.map((level) => `L${level}`).join(' | ')} |`,
    `|---|${levels.map(() => '---:').join('|')}|`,
  ]
  for (const [traitIndex, key] of TRAIT_KEYS.entries()) {
    const cells = levels.map((level) => {
      const prey = options.prey.map((value, i) =>
        i === traitIndex ? level : value,
      )
      let caught = 0
      let time = 0
      for (let trial = 0; trial < options.trials; trial += 1) {
        const at = runChase(prey, options.hunter, trial, options)
        if (at === null) continue
        caught += 1
        time += at
      }
      const share = `${Math.round((100 * caught) / options.trials)}%`
      return caught === 0 ? share : `${share} (${(time / caught).toFixed(1)}s)`
    })
    lines.push(`| ${key} | ${cells.join(' | ')} |`)
  }
  return lines.join('\n')
}

const options = JSON.parse(process.argv[2] ?? '{}') as ChaseOptions
if (options.prey) console.log(formatChaseBench(options))
