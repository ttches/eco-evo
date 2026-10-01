# Changelog

Gameplay-affecting changes are listed under **Gameplay**. Recording a simulation
benchmark is opt-in per version; when one exists it is linked under **Benchmark**.
See [`benchmarks/`](benchmarks/) for how benchmarks are captured and compared.

## [Unreleased]

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
