# Task: HoloLab / render cleanup + avatar art-system decision

## Context

eco-evo is a watch-only evolution sim (React 19 + Three.js, TypeScript strict,
Vite, vitest, oxlint). The world "detail glorp" is a procedural sprite drawn by
`GlorpDetailLayer` from shared GLSL (`glorp-holo-shader.ts`), with a per-mutation
look registry (`mutation-looks.ts`), a colour rule (`holo-palette.ts`), and an
aura layer (`glorp-aura*.ts`). The HoloLab (`src/ui/HoloLab/*`, reached at
`?holo`) previews the looks. The sprite's pixel-snap resolution is now fixed to
the `DETAIL_SPRITE_ZOOM` grid, so a glorp keeps one sprite look at every zoom.

An independent code review produced findings. This task covers a subset and opens
with a design decision.

## Step 0 — DECIDE BEFORE CODING (confirm with the user, then wait)

**Do we keep the hand-authored SVG avatars (`src/ui/GlorpInspector/GlorpAvatar/*`),
or switch avatars to the world's sprite glorp?**

The user's stated lean: the world **sprite** look is preferred for avatars. Switch
to a sprite avatar **only if** it is performant and efficient everywhere avatars
are drawn. So before coding, assess and report:

- Where avatars render: GlorpInspector (header, preview, lineage, mutations),
  StatsPanel, leaderboard, and anywhere else (`grep -rn "GlorpAvatar"`).
- How many avatars can be on screen at once, and whether a cached raster sprite
  (rendering the `GlorpDetailLayer` look once to an offscreen canvas / atlas and
  reusing it) is cheap enough: no per-avatar WebGL context, shared texture, no
  per-frame redraw.
- Quality at the sizes avatars actually render (the lab shows 16-96px), and
  whether the sprite upscales acceptably with nearest-neighbour pixel art.
- The SVG alternative: crisp at any size, CSS-only, already has CSS holo
  variants; but it is a SECOND art system that has already drifted from the world
  shader (the silhouette harmonics are duplicated).

Decision outcomes:
- **Sprite (preferred if performant):** scope a follow-up to build a sprite-avatar
  generator/cache and retire the SVG path. Keep the world `GlorpDetailLayer` as the
  single source of the look.
- **SVG:** keep it and do the SVG-parity task below so it cannot drift again.

Do not start the cleanup tasks until this is answered.

## Task 1 — delete dead CPU helpers in `holo-palette.ts`

`typeHue`, `accentHue`, `flareHue`, `hueInWindow` are referenced only by
`holo-palette.test.ts`; production inlines the four `*_HUE_*` constants into GLSL.
Keep the constants, delete the functions and their tests, and rewrite the header to
state the window rule is expressed in GLSL with these constants as its single
source of truth.

## Task 3 — move lab-only candidate data out of production

`mutation-looks.ts` stores lab-only `candidates[]` whose `name` duplicates
`GLORP_HOLO_LABELS`, and re-lists each wired winner as `candidates[0]` with nothing
enforcing a match.

Decision: keep production lean — reduce `mutation-looks.ts` to
`Record<MutationKey, { body: GlorpHoloVariant; aura?: GlorpAuraVariant }>`; move the
candidate groupings into the HoloLab and label rows via `GLORP_HOLO_LABELS[body]`
(drop the duplicate `name`). Update `mutation-looks.test.ts` and `HoloLabWorld.tsx`.

## Task 4 — fix the chromatic aura disc margin

`GLORP_AURA_SCALE = 1.8` exactly equals the ring's max radius, but the red fringe
peaks at `t = radius + 0.05 = 1.85`, so it is clipped by the disc geometry. Size the
disc from ring-max plus fringe (or add margin) and comment the relationship. Keep it
consistent with the aura layer's cull margin.

## Task 9 — trim a misleading shader header

`glorp-holo-shader.ts`'s header claims "Every hue is routed through `typeHue`…",
contradicted by the legacy / `disco` / violet-accent branches. Reword to "dominant
surfaces via `typeHue`; accents free."

## SVG-avatar parity (only if Step 0 keeps SVG)

`GlorpAvatar.tsx` copies the silhouette harmonics from `glorp-detail.ts`. Export the
harmonic spec (frequencies / weights / amplitude) as shared constants used by both
the GLSL silhouette and the SVG path so they cannot drift.

## Broader (queue after the above): shared instanced-layer scaffold

`GlorpLayer`, `GlorpDetailLayer`, `AuraPass`, and `HeartLayer` repeat the same
typed-array + `InstancedBufferAttribute` + `DynamicDrawUsage` + matrix + AABB-cull +
`count` / `needsUpdate` sequence, and the cull loop is copy-pasted. Extract a small
`InstancedLayer` base or a `cullInto(bounds, margin)` helper; optionally fold in
`addUpdateRange` partial uploads. Medium refactor — do it deliberately, not
opportunistically.

## Constraints

- Preserve the shader / variant lockstep tests (`glorp-holo.test.ts` branch count and
  threshold order; the aura equivalent).
- Keep GLSL ES 1.00; no new dependencies.
- Match existing style (const arrow functions, type aliases, small modules).

## Verification

`npx oxlint`, `npx tsc -b`, `npx vitest run`, `npx vite build`; then check `?holo`
(By Mutation + All Variants) and the in-game avatar / inspector visually.
