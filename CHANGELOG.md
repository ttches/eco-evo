# Changelog

Gameplay-affecting changes are listed under **Gameplay**. Recording a simulation
benchmark is opt-in per version; when one exists it is linked under **Benchmark**.
See [`benchmarks/`](benchmarks/) for how benchmarks are captured and compared.

## [Unreleased]

### Gameplay

- New heritable `agility` trait. A prey whose agility exceeds its attacker's
  can dodge a catch, with the chance rising 25% per level of advantage (capped
  at 75%). A dodge jukes the prey perpendicular to its heading and makes it
  untargetable for a fast 0.3s dart, so the hunter's normal prey search
  reprioritizes to the next victim on its own. Catches and dodges resolve at one
  glorp body diameter. Trait budget rises to 20 points across five traits.
- `TRAIT_BUDGET` moved to the config so the headless simulator can override the
  total trait points with `--set TRAIT_BUDGET=N`.
- A dodge is now a fixed distance (`DODGE_DISTANCE`, derived dart speed
  `DODGE_SPEED`), independent of the prey's `speed` trait, so speed no longer
  gets a second payoff. Pregnancy no longer shortens a dart.
- Traits can now be dropped to 0 points. Level 0 is the linear extrapolation of
  the old level 1..7 line, so existing levels are unchanged; level 0 is always
  the worst rung (e.g. agility 0, fertility's longest cooldown).

## [0.1.0] - 2026-10-01

### Gameplay

- Stamina now scales with `staminaMax`. Recovery is faster with more capacity,
  and an exhausted glorp's jog speed scales with it too (0.55x-0.85x top speed).
  Endurance is now a viable build; speed remains the strongest single trait.

### Fixed

- Cannibalism could swap-remove the wrong glorp and corrupt the lineage when two
  victims were taken in one step.

### Benchmark

- [`benchmarks/v0.1.0/`](benchmarks/v0.1.0) - 20 seeds x 5400s.

## [0.0.0] - 2026-09-30

### Gameplay

- Initial prototype: energy/metabolism, regrowing grass, four heritable traits
  (speed, stamina, strength, fertility), asexual and pair reproduction with
  mutation, strength-gated predation and cannibalism, pregnancy, exhaustion
  hysteresis/jog, leaderboard, headless simulator, and UI.
