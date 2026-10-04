import { WORLD } from '@/engine/config'
import { TAU } from '@/engine/math'
import { STEER_LOOKAHEAD } from '@/sim/config'
import { steerWander, type Steering } from '@/sim/steering/steering'
import type { World } from '@/sim/world'

/**
 * Fixed ring of unit headings sampled when the desired one would leave the
 * arena. Precomputed so context steering costs only a dot product and a bounds
 * test per candidate.
 */
const CANDIDATE_HEADINGS: readonly { x: number; y: number }[] = Array.from(
  { length: 16 },
  (_, i) => {
    const angle = (i / 16) * TAU
    return { x: Math.cos(angle), y: Math.sin(angle) }
  },
)

/** Whether a point keeps a glorp's center inside the arena. */
const insideArena = (world: World, x: number, y: number): boolean =>
  x >= world.radius &&
  x <= WORLD.width - world.radius &&
  y >= world.radius &&
  y <= WORLD.height - world.radius

/**
 * Context steering: head along a desired direction, but when that direction
 * would carry the glorp out of the arena, score the sampled candidate headings
 * by how well they align with it and pick the best allowed one. Keeps fleeing
 * agents off walls and out of corners instead of pressing into them;
 * deterministic and allocation-free.
 */
export const steerSampled = (
  world: World,
  index: number,
  desiredX: number,
  desiredY: number,
  speed: number,
  sprint: boolean,
  dt: number,
  lookahead = STEER_LOOKAHEAD,
): Steering => {
  const magnitude = Math.hypot(desiredX, desiredY)
  if (magnitude < 1e-4) return steerWander(world, index, speed, dt)

  const directionX = desiredX / magnitude
  const directionY = desiredY / magnitude
  const x = world.x[index]
  const y = world.y[index]

  if (
    insideArena(world, x + directionX * lookahead, y + directionY * lookahead)
  ) {
    return { x: directionX * speed, y: directionY * speed, sprint }
  }

  let bestX = 0
  let bestY = 0
  let bestDot = -Infinity
  let found = false
  for (const heading of CANDIDATE_HEADINGS) {
    if (
      !insideArena(world, x + heading.x * lookahead, y + heading.y * lookahead)
    ) {
      continue
    }
    const dot = heading.x * directionX + heading.y * directionY
    if (dot > bestDot) {
      bestDot = dot
      bestX = heading.x
      bestY = heading.y
      found = true
    }
  }

  if (!found) return steerWander(world, index, speed, dt)
  return { x: bestX * speed, y: bestY * speed, sprint }
}

/** Flee a threat, curving along arena walls rather than pressing into them. */
export const steerFlee = (
  world: World,
  index: number,
  threatX: number,
  threatY: number,
  speed: number,
  sprint: boolean,
  dt: number,
): Steering =>
  steerSampled(
    world,
    index,
    world.x[index] - threatX,
    world.y[index] - threatY,
    speed,
    sprint,
    dt,
  )
