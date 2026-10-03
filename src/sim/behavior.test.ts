import { describe, expect, it } from "vitest";
import {
  GESTATION_SECONDS,
  MOVEMENT,
  PREGNANT_SPEED_FACTOR_MIN,
} from "@/sim/config";
import { computeSteering } from "@/sim/behavior";
import { rebuildSpatialGrid } from "@/sim/spatial";
import { TRAIT_MAX, TRAIT_MIN, traitValue } from "@/sim/traits";
import { GLORP_TYPE } from "@/sim/types";
import { createWorld } from "@/sim/world";

const DT = 1 / 60;

describe("prey steering", () => {
  it("points away from a nearby hunter", () => {
    const world = createWorld(2, 3);
    world.type[0] = GLORP_TYPE.prey;
    world.type[1] = GLORP_TYPE.hunter;
    world.x[0] = 100;
    world.y[0] = 100;
    world.x[1] = 140;
    world.y[1] = 100;
    world.fed[0] = 50;
    world.stamina[0] = 5;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.x).toBeLessThan(0);
    expect(Math.abs(steering.y)).toBeLessThan(1e-6);
    expect(steering.sprint).toBe(true);
  });

  it("escapes a corner instead of pressing into it", () => {
    const world = createWorld(2, 3);
    world.type[0] = GLORP_TYPE.prey;
    world.type[1] = GLORP_TYPE.hunter;
    world.x[0] = world.radius;
    world.y[0] = world.radius;
    world.x[1] = world.radius + 80;
    world.y[1] = world.radius + 80;
    world.fed[0] = 50;
    world.stamina[0] = 5;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.x).toBeGreaterThanOrEqual(0);
    expect(steering.y).toBeGreaterThanOrEqual(0);
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(traitValue('speed', world.speed[0]));
    expect(steering.sprint).toBe(true);
  });

  it("scales prey jog speed with stamina", () => {
    const jogFactorAt = (staminaLevel: number): number => {
      const world = createWorld(2, 3);
      world.type[0] = GLORP_TYPE.prey;
      world.type[1] = GLORP_TYPE.hunter;
      world.x[0] = 100;
      world.y[0] = 100;
      world.x[1] = 140;
      world.y[1] = 100;
      world.fed[0] = 50;
      world.stamina[0] = 0;
      world.exhausted[0] = 1;
      world.endurance[0] = staminaLevel;

      rebuildSpatialGrid(world);
      const steering = computeSteering(world, 0, DT);

      expect(steering.sprint).toBe(false);
      return Math.hypot(steering.x, steering.y) / traitValue('speed', world.speed[0]);
    };

    expect(jogFactorAt(TRAIT_MIN)).toBeCloseTo(MOVEMENT.jogFactorMin);
    expect(jogFactorAt(1)).toBeCloseTo(0.55);
    expect(jogFactorAt(7)).toBeCloseTo(MOVEMENT.jogFactorMax);
  });
});

describe("hunter steering", () => {
  it("moves toward a nearby prey when hungry", () => {
    const world = createWorld(2, 4);
    world.type[0] = GLORP_TYPE.hunter;
    world.type[1] = GLORP_TYPE.prey;
    world.x[0] = 100;
    world.y[0] = 100;
    world.x[1] = 150;
    world.y[1] = 100;
    world.fed[0] = 50;
    world.stamina[0] = 5;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.x).toBeGreaterThan(0);
    expect(Math.abs(steering.y)).toBeLessThan(1e-6);
    expect(steering.sprint).toBe(true);
  });

  it("ignores prey when well fed", () => {
    const world = createWorld(2, 4);
    world.type[0] = GLORP_TYPE.hunter;
    world.type[1] = GLORP_TYPE.prey;
    world.x[0] = 100;
    world.y[0] = 100;
    world.x[1] = 150;
    world.y[1] = 100;
    world.fed[0] = 100;
    world.stamina[0] = 5;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.sprint).toBe(false);
  });

  it("jogs toward prey when exhausted instead of giving up the chase", () => {
    const world = createWorld(2, 4);
    world.type[0] = GLORP_TYPE.hunter;
    world.type[1] = GLORP_TYPE.prey;
    world.x[0] = 100;
    world.y[0] = 100;
    world.x[1] = 150;
    world.y[1] = 100;
    world.fed[0] = 50;
    world.stamina[0] = 0;
    world.exhausted[0] = 1;
    world.endurance[0] = 7;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.x).toBeGreaterThan(0);
    expect(steering.sprint).toBe(false);
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      traitValue('speed', world.speed[0]) * MOVEMENT.jogFactorMax,
    );
  });

  it("jogs slower when its stamina is low", () => {
    const world = createWorld(2, 4);
    world.type[0] = GLORP_TYPE.hunter;
    world.type[1] = GLORP_TYPE.prey;
    world.x[0] = 100;
    world.y[0] = 100;
    world.x[1] = 150;
    world.y[1] = 100;
    world.fed[0] = 50;
    world.stamina[0] = 0;
    world.exhausted[0] = 1;
    world.endurance[0] = TRAIT_MIN;

    rebuildSpatialGrid(world);
    const steering = computeSteering(world, 0, DT);

    expect(steering.sprint).toBe(false);
    expect(Math.hypot(steering.x, steering.y)).toBeCloseTo(
      traitValue('speed', world.speed[0]) * MOVEMENT.jogFactorMin,
    );
  });
});

describe("pregnancy", () => {
  it("slows a pregnant glorp at minimum fertility", () => {
    const world = createWorld(1, 5);
    world.type[0] = GLORP_TYPE.hunter;
    world.fed[0] = 100;
    world.fertility[0] = TRAIT_MIN;
    rebuildSpatialGrid(world);
    const normal = computeSteering(world, 0, DT);

    world.pregnant[0] = GESTATION_SECONDS;
    const pregnant = computeSteering(world, 0, DT);

    expect(Math.hypot(pregnant.x, pregnant.y)).toBeCloseTo(
      Math.hypot(normal.x, normal.y) * PREGNANT_SPEED_FACTOR_MIN,
    );
  });

  it("does not slow a pregnant glorp at maximum fertility", () => {
    const world = createWorld(1, 5);
    world.type[0] = GLORP_TYPE.hunter;
    world.fed[0] = 100;
    world.fertility[0] = TRAIT_MAX;
    rebuildSpatialGrid(world);
    const normal = computeSteering(world, 0, DT);

    world.pregnant[0] = GESTATION_SECONDS;
    const pregnant = computeSteering(world, 0, DT);

    expect(Math.hypot(pregnant.x, pregnant.y)).toBeCloseTo(
      Math.hypot(normal.x, normal.y),
    );
  });
});
