/**
 * The mutated-glorp aura, as one GLSL function shared by the production aura
 * layer and the lab. The branch thresholds follow `AURA_VARIANTS` order, so
 * adding a variant there means adding a matching `else if` below.
 *
 * `t` is the local distance from the glorp centre in body radii: 0 at the
 * centre, ~1 at the silhouette, >1 in the halo. The body is drawn on top, so
 * the inner portion of an aura reads only through the soft edge.
 */
export const GLORP_AURA_GLSL = /* glsl */ `
  float auraHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec4 glorpAura(vec2 p, float t, float aura, float seed, float time, float strength) {
    vec3 color = vec3(0.0);
    float alpha = 0.0;

    if (aura < 0.5) {
      // Smoke: a dark haze that swirls and fades from the silhouette outward.
      float falloff = 1.0 - smoothstep(0.55, 1.8, t);
      float swirl = 0.5 + 0.5 * sin(atan(p.y, p.x) * 3.0 + time * 0.9 + seed);
      color = mix(vec3(0.02, 0.01, 0.04), vec3(0.12, 0.08, 0.18), swirl);
      alpha = 0.55 * falloff;
    } else if (aura < 1.5) {
      // Ember: additive sparks drifting up and out around the body.
      vec2 cell = floor(p * 8.0);
      float h = auraHash(cell + seed);
      float spark =
        1.0 - smoothstep(0.0, 0.35, length(fract(p * 8.0) - 0.5));
      float flutter = 0.5 + 0.5 * sin(time * 2.5 + h * 6.2831853);
      float falloff = 1.0 - smoothstep(0.4, 2.0, t);
      color = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.85, 0.4), h);
      alpha = step(0.8, h) * spark * flutter * falloff * 0.9;
    } else if (aura < 2.5) {
      // Chromatic: a caustic ring split into red/green/blue fringes, biased
      // outside the body so it never hides behind the silhouette.
      float radius = 1.45 + 0.35 * sin(time * 1.5 + seed);
      float d = t - radius;
      vec3 split = vec3(
        1.0 - smoothstep(0.0, 0.12, abs(d - 0.05)),
        1.0 - smoothstep(0.0, 0.12, abs(d)),
        1.0 - smoothstep(0.0, 0.12, abs(d + 0.05))
      );
      color = split;
      alpha = max(max(split.r, split.g), split.b) * 0.85;
    }

    return vec4(color, clamp(alpha * strength, 0.0, 1.0));
  }
`
