# Task: shared instanced-layer scaffold

## Context

eco-evo is a watch-only evolution sim (React 19 + Three.js, TypeScript strict,
Vite, vitest, oxlint). Four render layers build the world from `THREE.InstancedMesh`
and repeat the same bookkeeping: a typed-array backing store per instance
attribute, an `InstancedBufferAttribute` set to `DynamicDrawUsage`, a scratch
`Matrix4`, an AABB cull against the view bounds, and a per-frame `count` +
`needsUpdate` upload.

The layers:

- `src/render/glorp-layer.ts` — `GlorpLayer`: flat discs, `instanceColor`.
- `src/render/glorp-detail-layer.ts` — `GlorpDetailLayer`: `aColor`/`aSeed`/
  `aMutated`/`aHolo`/`aWarm` instanced attributes.
- `src/render/glorp-aura-layer.ts` — `AuraPass` (two of them) plus the cull loop
  in `GlorpAuraLayer.update`; `aSeed`/`aAura` attributes.
- `src/render/heart-layer.ts` — `HeartLayer`: `instanceMatrix` only, one glorp can
  emit several heart instances.

Each has its own copy of the same cull loop:
`if (x < bounds.left - margin || x > bounds.right + margin) continue` and the
same vertical test, followed by `matrix.makeScale(...)`, `setPosition(...)`,
`setMatrixAt(visible, ...)`, `needsUpdate = true`, `mesh.count = visible`.

This is a deliberate medium refactor, split out of
`prompts/holo-cleanup-and-avatar-decision.md` so it is not done opportunistically.
Do it on its own, with the existing tests kept green.

## Goal

Remove the duplication without changing any rendered output or per-frame cost.

Two shapes to weigh (pick one, or a small combination):

1. **`InstancedLayer` base class.** Owns the `InstancedMesh`, the scratch
   `Matrix4`, the `DynamicDrawUsage` setup, `dispose()`, and a `reserve()`/
   `commit()` pair around the attribute `needsUpdate` flags. Subclasses declare
   their typed arrays / `InstancedBufferAttribute`s and a `write(index)` hook.
2. **`cullInto(bounds, margin)` helper.** A pure-ish function or a small cursor
   object that walks `world.x/y`, applies the AABB test, and yields the visible
   indices so each layer keeps its own write body. Lower risk; removes only the
   copy-pasted loop.

Constraints on either shape:

- `GlorpLayer` instances at `zoom >= DETAIL_MIN_ZOOM`; `GlorpDetailLayer`,
  `GlorpAuraLayer`, and `HeartLayer` instances at `zoom < DETAIL_MIN_ZOOM`
  (opposite gates) — keep the gates in the layers, not in the shared code.
- `GlorpAuraLayer` splits writes into two passes (normal vs additive) and has a
  `begin`/`write`/`end` lifecycle; the scaffold must support multiple passes or
  leave that layer on the helper path.
- `HeartLayer` can emit `HEARTS_PER_BURST` instances per glorp, so its cursor
  count exceeds `world.count`; the shared code must not assume one instance per
  glorp.
- Do **not** introduce per-frame allocations on the update path.

## Optional (only if clean)

Use `BufferAttribute.addUpdateRange` / `updateRanges` and
`attribute.clearUpdateRanges()` to upload only the written prefix instead of the
whole `MAX_GLORPS` buffer each frame, when the buffer is large and the visible
count is small. Verify Three.js version support first (`three@0.186.x`); guard it
behind a measured win, not speculation.

## Constraints

- Preserve rendered output and the shader / variant lockstep tests
  (`glorp-holo.test.ts`, the aura equivalent).
- Keep GLSL ES 1.00; no new dependencies.
- Match existing style (const arrow functions, type aliases, small modules).
- The four layers already have tests; keep them green and add a focused test for
  the extracted cull helper (bounds in/out, margin, multi-instance-per-glorp).

## Verification

`npx oxlint`, `npx tsc -b`, `npx vitest run`, `npx vite build`; then eyeball the
world at several zooms (flat layer below the LOD threshold, detail + aura above
it, hearts on conception).
