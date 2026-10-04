/**
 * The mutated-glorp sheen, as one GLSL function shared by the production detail
 * layer and the lab. The branch thresholds follow `GLORP_HOLO_VARIANTS` order,
 * so adding a variant there means adding a matching `else if` below.
 *
 * The caller has already snapped `p` to the pixel grid and confirmed it is
 * inside `boundary`; this only shades the body.
 */
export const GLORP_HOLO_GLSL = /* glsl */ `
  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // A 6x6 hashed star field: returns (cell hash, per-cell twinkle phase).
  vec2 starField(vec2 p, float seed, float time) {
    vec2 cell = floor(p * 6.0);
    float h = hash(cell + seed);
    return vec2(h, 0.5 + 0.5 * sin(time * 3.0 + h * 6.2831853));
  }

  vec3 glorpHolo(vec3 baseColor, vec2 p, float boundary, float r,
                 float holo, float seed, float time, float strength) {
    vec3 sheen = baseColor;
    float amount = 0.0;

    if (holo < 0.5) {
      // Iridescent rim with a cel highlight orbiting the body.
      float hue = fract(atan(p.y, p.x) / 6.2831853 + time * 0.1 + seed * 0.2);
      sheen = hsv2rgb(vec3(hue, 0.7, 1.0));
      float rim = smoothstep(0.15, 0.95, r / boundary);
      amount = 0.3 + 0.4 * rim;
      vec2 light = 0.45 * vec2(cos(time * 1.1 + seed), sin(time * 1.1 + seed));
      float spot = 1.0 - smoothstep(0.0, 0.5, distance(p, light));
      sheen = mix(sheen, vec3(1.0), spot);
      amount = max(amount, spot * 0.85);
    } else if (holo < 1.5) {
      // Diagonal rainbow band sweeping across the body.
      float band = fract((p.x + p.y) * 0.7 - time * 0.55);
      float mask = smoothstep(0.0, 0.12, band) * (1.0 - smoothstep(0.30, 0.46, band));
      sheen = hsv2rgb(vec3(fract(band * 1.6 + time * 0.2 + seed * 0.2), 0.85, 1.0));
      amount = mask;
    } else if (holo < 2.5) {
      // Conic prism whose hue rotates over time.
      float a = atan(p.y, p.x) / 6.2831853 + 0.5;
      sheen = hsv2rgb(vec3(fract(a + time * 0.12), 0.8, 1.0));
      amount = 0.5;
    } else if (holo < 3.5) {
      // Warm metallic band over a gold base.
      float sweep = fract(p.x * 0.6 - time * 0.45);
      float shine =
        smoothstep(0.42, 0.5, sweep) * (1.0 - smoothstep(0.5, 0.58, sweep));
      sheen = mix(vec3(0.85, 0.58, 0.08), vec3(1.0, 0.96, 0.72), shine);
      amount = 0.45 + 0.5 * shine;
    } else if (holo < 4.5) {
      // Teal-to-violet aurora that pulses and ripples.
      float wave = 0.5 + 0.5 * sin(p.y * 4.0 + time * 2.0 + seed);
      sheen = mix(vec3(0.2, 0.9, 0.6), vec3(0.62, 0.32, 1.0), wave);
      amount = 0.4 + 0.28 * sin(time * 2.0 + seed);
    } else if (holo < 5.5) {
      // Vertical diffraction bars over a drifting colour wash.
      float bars = 0.5 + 0.5 * sin(p.x * 14.0 - time * 3.0);
      vec3 wash = hsv2rgb(vec3(fract(time * 0.1 + seed * 0.2), 0.5, 1.0));
      sheen = mix(wash, vec3(1.0), bars * 0.6);
      amount = 0.42 + 0.28 * bars;
    } else if (holo < 6.5) {
      // Sparse white starfield speckles.
      vec2 field = starField(p, seed, time);
      float star = step(0.8, field.x) * field.y;
      sheen = mix(vec3(0.16, 0.1, 0.4), vec3(1.0), star);
      amount = 0.32 + 0.6 * star;
    } else if (holo < 7.5) {
      // Cosmos, but each lit cell gets a drifting rainbow hue.
      vec2 field = starField(p, seed, time);
      float star = step(0.8, field.x) * field.y;
      vec3 spark = hsv2rgb(vec3(fract(field.x * 1.7 + time * 0.05), 0.85, 1.0));
      sheen = mix(vec3(0.16, 0.1, 0.4), spark, star);
      amount = 0.32 + 0.6 * star;
    } else if (holo < 8.5) {
      // Disco: every cell flashes on its own beat, green facets.
      vec2 field = starField(p, seed, time);
      float flash = pow(field.y, 4.0);
      sheen = mix(vec3(0.08, 0.1, 0.09), vec3(0.25, 1.0, 0.35), flash);
      amount = 0.25 + 0.7 * flash;
    } else if (holo < 9.5) {
      // Disco: every cell flashes on its own beat, orange facets.
      vec2 field = starField(p, seed, time);
      float flash = pow(field.y, 4.0);
      sheen = mix(vec3(0.1, 0.08, 0.08), vec3(1.0, 0.55, 0.15), flash);
      amount = 0.25 + 0.7 * flash;
    } else if (holo < 10.5) {
      // Flat animated hue tint of the whole body.
      sheen = hsv2rgb(vec3(fract(seed * 0.2 + time * 0.08), 0.8, 1.0));
      amount = 0.55;
    }

    return mix(baseColor, sheen, clamp(amount * strength, 0.0, 1.0));
  }
`
