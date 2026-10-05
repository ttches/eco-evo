import {
  PREDATOR_HUE_FROM,
  PREDATOR_HUE_TO,
  PREY_HUE_FROM,
  PREY_HUE_TO,
} from '@/render/holo-palette'

/**
 * The mutated-glorp sheen, as one GLSL function shared by the production detail
 * layer and the lab. The branch thresholds follow `GLORP_HOLO_VARIANTS` order,
 * so adding a variant there means adding a matching `else if` below.
 *
 * The material helpers below build the premium vocabulary — foil glitter,
 * chrome, thin-film opal, oil slick, beetle chitin, dragon scales, gold leaf,
 * brushed titanium, nacre and ember. Every hue is routed through `typeHue`, so
 * prey stay yellow→blue and predators stay orange→purple (see `holo-palette`).
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

  // --- Palette: keep hues inside the type's window (see holo-palette.ts). ---
  float typeHue(float t, float warm) {
    float from = mix(${PREY_HUE_FROM}, ${PREDATOR_HUE_FROM}, warm);
    float to = mix(${PREY_HUE_TO}, ${PREDATOR_HUE_TO}, warm);
    return fract(from + (to - from) * t);
  }

  vec3 typeMetal(float t, float warm, float value) {
    return hsv2rgb(vec3(typeHue(t, warm), 0.65, value));
  }

  // A warm-aware gold: yellow for prey (window start), amber for predators.
  float goldT(float warm) {
    return mix(0.05, 0.92, warm);
  }

  // --- Premium material vocabulary. ---

  // Sharp per-cell specular sparkles, like foil/car-paint flakes.
  float foilFlakes(vec2 p, float seed, float time, float scale) {
    vec2 cell = floor(p * scale);
    float h = hash(cell + seed);
    float glint = 1.0 - smoothstep(0.0, 0.35, length(fract(p * scale) - 0.5));
    float phase = 0.5 + 0.5 * sin(time * (2.0 + 4.0 * h) + h * 40.0);
    return step(0.72, h) * glint * (0.35 + 0.65 * phase);
  }

  // A directional metallic highlight band sweeping across the body.
  float anisoBand(vec2 p, float angle, float time, float speed) {
    vec2 dir = vec2(cos(angle), sin(angle));
    float s = fract(dot(p, dir) - time * speed);
    return smoothstep(0.35, 0.5, s) * (1.0 - smoothstep(0.5, 0.65, s));
  }

  // Opal-style interference, constrained to the type's hue window.
  vec3 thinFilmTyped(float phase, float warm) {
    float t = 0.5 + 0.5 * cos(6.2831853 * phase);
    return hsv2rgb(vec3(typeHue(t, warm), 0.5 + 0.3 * t, 0.7 + 0.3 * t));
  }

  // Liquid metal: a moving fake environment plus a fixed specular blob.
  vec3 chrome(vec2 p, float warm, float time) {
    float band = 0.5 + 0.5 * sin((p.y + 0.15 * sin(time * 0.7)) * 3.0 + time * 0.5);
    float horizon = smoothstep(0.35, 0.65, band);
    vec3 dark = hsv2rgb(vec3(typeHue(0.15, warm), 0.7, 0.32));
    vec3 lit = hsv2rgb(vec3(typeHue(0.8, warm), 0.5, 0.85));
    float spec = 1.0 - smoothstep(0.0, 0.35, distance(p, vec2(-0.3, 0.35)));
    return mix(dark, lit, horizon) + vec3(spec * 0.7);
  }

  // A dark body with an oil-slick thin-film bloom.
  vec3 oilSlick(vec2 p, float warm, float time, float seed) {
    float phase =
      p.x * 1.1 + p.y * 0.8 + seed * 0.11 + 0.1 * sin(time + p.y * 3.0);
    float wash = 0.4 + 0.45 * (0.5 + 0.5 * sin(p.x * 4.0 - p.y * 3.0 + time * 0.7));
    return mix(vec3(0.02, 0.02, 0.03), thinFilmTyped(phase, warm), wash);
  }

  // Overlapping metal scales with a sweeping sheen; reports edge sparkle.
  vec3 dragonScale(vec2 p, float warm, float time, float seed, out float sparkle) {
    vec2 cell = p * 3.5;
    vec2 g = fract(cell) - 0.5;
    float h = hash(floor(cell) + seed);
    float scale = 1.0 - smoothstep(0.30, 0.5, abs(g.x) + abs(g.y));
    float sheen = anisoBand(p, 0.9, time + h, 0.7);
    vec3 base = typeMetal(0.30 + 0.6 * h, warm, 0.35 + 0.4 * scale);
    sparkle = scale * foilFlakes(p, seed, time, 9.0);
    return base + base * sheen * 1.2;
  }

  // Brushed anodized metal with fine vertical grain and a broad sweep.
  vec3 titanium(vec2 p, float warm, float time) {
    float brush = 0.5 + 0.5 * sin(p.y * 26.0 + sin(p.x * 6.0) * 2.0);
    float sweep = anisoBand(p, 0.6, time, 0.8);
    vec3 base = hsv2rgb(vec3(typeHue(0.65, warm), 0.35, 0.35 + 0.2 * brush));
    return base + base * sweep * 1.5;
  }

  // Mother-of-pearl: soft layered pastel bands.
  vec3 nacre(vec2 p, float warm, float time, float seed) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float f = float(i);
      float band =
        0.5 + 0.5 * sin(p.x * (3.0 + f) + p.y * (2.0 + f) + time * 0.5 + seed + f);
      col += hsv2rgb(vec3(typeHue(0.2 + 0.5 * band, warm), 0.35, 0.8)) * (0.5 + 0.5 * band);
    }
    return col / 3.0;
  }

  // Cracked gold leaf with dark crevices.
  vec3 goldLeaf(vec2 p, float warm, float time, float seed) {
    vec2 g = fract(p * 5.0) - 0.5;
    float crack = smoothstep(0.28, 0.5, abs(g.x) + abs(g.y) * 0.6);
    vec3 gold = typeMetal(goldT(warm), warm, 0.55 + 0.35 * (1.0 - crack));
    float flake = foilFlakes(p, seed, time, 11.0);
    return mix(gold + gold * flake, vec3(0.10, 0.07, 0.02), crack * 0.8);
  }

  // Near-black body with a glowing, pulsing ember crack.
  vec3 emberGlow(vec2 p, float boundary, float warm, float time, float seed) {
    float glow = smoothstep(0.0, 1.0, 1.0 - length(p) / boundary);
    float pulse = 0.5 + 0.5 * sin(time * 3.0 + seed);
    float crack = 0.5 + 0.5 * sin(atan(p.y, p.x) * 7.0 + time * 2.0);
    vec3 hot = hsv2rgb(vec3(typeHue(0.9, warm), 0.9, 1.0));
    return mix(vec3(0.02), hot, glow * crack * pulse);
  }

  // Distance-to-edge of a Voronoi cell, for glowing ore veins. Returns a thin
  // vein mask and a per-vein hash: the sum of the two nearest cell hashes, so
  // it stays continuous across the seam either hash alone would step at.
  float oreVeinMask(vec2 p, float seed, out float veinHash) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    float f1 = 8.0;
    float f2 = 8.0;
    float h1 = 0.0;
    float h2 = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        float h = hash(cell + g + seed);
        float d = length(g + vec2(h, hash(cell + g + seed + 3.7)) - f);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          h2 = h1;
          h1 = h;
        } else if (d < f2) {
          f2 = d;
          h2 = h;
        }
      }
    }
    veinHash = h1 + h2;
    return 1.0 - smoothstep(0.0, 0.12, f2 - f1);
  }

  // Upward-licking flame intensity, brightest low on the body.
  float flame(vec2 p, float time, float seed) {
    float col = p.y + 0.35 * sin(p.x * 4.0 + time * 2.0 + seed);
    float n = 0.5 + 0.5 * sin(col * 6.0 - time * 3.0 + seed);
    float tongue = smoothstep(0.3, 1.0, n) * smoothstep(-1.0, 0.6, p.y);
    float flick = 0.6 + 0.4 * sin(time * 19.0 + seed * 50.0) * sin(time * 7.0);
    return clamp(tongue * flick, 0.0, 1.0);
  }

  // Wet, offset fish scales with a nacre sheen; reports a per-scale glint.
  vec3 fishScale(vec2 p, float warm, float time, float seed, out float glint) {
    vec2 s = p * 4.0;
    float row = floor(s.y);
    s.x += mod(row, 2.0) * 0.5;
    vec2 cell = floor(s);
    vec2 g = fract(s) - 0.5;
    float h = hash(cell + seed);
    float d = abs(g.x) * 1.1 + abs(g.y);
    float scale = 1.0 - smoothstep(0.35, 0.55, d);
    glint = (1.0 - smoothstep(0.0, 0.28, length(g + vec2(0.12, 0.18)))) * scale;
    float phase = 0.5 + 0.5 * sin(time * 2.0 + h * 6.2831853 + p.x * 2.0);
    vec3 base = hsv2rgb(vec3(typeHue(0.2 + 0.5 * h, warm), 0.35, 0.45 + 0.3 * scale));
    vec3 pearl = thinFilmTyped(p.x * 0.4 + p.y * 0.2 + time * 0.05 + phase * 0.3, warm);
    return mix(base, pearl, 0.5 * scale) * (0.7 + 0.3 * phase) + vec3(glint * 0.6);
  }

  // Anna's hummingbird: dark plumage with a structural gorget patch that flips
  // from near-black to magenta/green/gold as the glare angle sweeps.
  vec3 gorget(vec2 p, float warm, float time, float seed) {
    vec3 plumage = hsv2rgb(vec3(typeHue(0.4 + 0.2 * sin(p.x * 3.0 + seed), warm), 0.45, 0.22));
    vec2 c = p - vec2(0.0, 0.15);
    float mask = 1.0 - smoothstep(0.5, 0.95, length(vec2(c.x * 1.5, c.y * 1.05)));
    float glare = 0.5 + 0.5 * cos(atan(c.y, c.x) * 2.0 + c.x * 8.0 + seed * 6.2831853 + time * 0.6);
    vec3 hot = mix(vec3(0.95, 0.10, 0.45), vec3(0.15, 0.95, 0.45), 0.5 + 0.5 * cos(glare * 6.2831853));
    vec3 irid = mix(hot, vec3(0.95, 0.7, 0.2), smoothstep(0.6, 1.0, glare));
    vec3 gorgetCol = mix(vec3(0.02, 0.02, 0.03), irid, smoothstep(0.15, 0.85, glare));
    gorgetCol += irid * foilFlakes(p, seed, time, 16.0) * 0.8;
    return mix(plumage, gorgetCol, mask);
  }

  vec3 glorpHolo(vec3 baseColor, vec2 p, float boundary, float r,
                 float holo, float seed, float time, float strength, float warm) {
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
    } else if (holo < 11.5) {
      // Dragon Scales — overlapping metal scales, slow sheen.
      float sparkle = 0.0;
      sheen = dragonScale(p, warm, time, seed, sparkle);
      amount = 0.7 + 0.3 * sparkle;
    } else if (holo < 12.5) {
      // Frosted Opal — interference with rim ice-crystal glitter.
      float phase = r * 0.6 + 0.1 * sin(p.x * 5.0 + time) + seed * 0.1;
      vec3 opal = mix(vec3(0.8, 0.9, 1.0), thinFilmTyped(phase, warm), 0.6);
      float ice = foilFlakes(p, seed, time, 12.0) * smoothstep(0.3, 1.0, r / boundary);
      sheen = opal + vec3(ice);
      amount = 0.65 + 0.3 * ice;
    } else if (holo < 13.5) {
      // Abyssal Oil-Slick — black, slick film, rare bio dots.
      vec2 cell = floor(p * 5.0);
      float h = hash(cell + seed);
      float bio = step(0.93, h) * (0.5 + 0.5 * sin(time * 0.7 + h * 6.2831853));
      sheen = oilSlick(p, warm, time, seed) + hsv2rgb(vec3(typeHue(0.5, warm), 0.7, 1.0)) * bio;
      amount = 0.85;
    } else if (holo < 14.5) {
      // Beetle Shell — dark chitin shifting structural colour.
      float t = 0.5 + 0.5 * sin(atan(p.y, p.x) + time * 0.4 + seed);
      sheen = hsv2rgb(vec3(typeHue(t, warm), 0.6, 0.3 + 0.35 * (0.5 + 0.5 * sin(p.x * 6.0 + p.y * 4.0))));
      float glint = anisoBand(p, 0.7, time, 0.6);
      sheen += sheen * glint * 1.2;
      sheen += hsv2rgb(vec3(0.76, 0.7, 1.0)) * glint * 0.35;
      amount = 0.8;
    } else if (holo < 15.5) {
      // Slipstream Chrome — warm liquid metal, fast streaks, glints.
      float streak = anisoBand(p, 0.0, time, 2.2);
      sheen = chrome(p, warm, time);
      sheen += hsv2rgb(vec3(typeHue(0.6, warm), 0.55, 1.0)) * streak * 1.4;
      sheen += hsv2rgb(vec3(0.52, 0.8, 1.0)) * foilFlakes(p, seed, time, 10.0) * 0.5;
      amount = 0.85;
    } else if (holo < 16.5) {
      // Ermine Foil — pearl foil with a black tail-tip streak.
      float streak = fract(p.x * 0.5 - time * 1.3);
      float tip = smoothstep(0.0, 0.08, streak) * (1.0 - smoothstep(0.10, 0.20, streak));
      sheen = mix(nacre(p, warm, time, seed), vec3(0.06), tip);
      sheen += hsv2rgb(vec3(0.55, 0.6, 1.0)) * foilFlakes(p, seed, time, 9.0) * 0.6;
      amount = 0.85;
    } else if (holo < 17.5) {
      // Peregrine Titanium — brushed bands with a gold rim.
      float rim = smoothstep(0.7, 1.0, r / boundary);
      sheen = titanium(p, warm, time);
      sheen += typeMetal(goldT(warm), warm, 1.0) * rim * 0.4;
      sheen += hsv2rgb(vec3(0.55, 0.6, 1.0)) * foilFlakes(p, seed, time, 12.0) * 0.25;
      amount = 0.8;
    } else if (holo < 18.5) {
      // Leapfrog Chrome — glossy metal, orbiting wet highlight.
      sheen = chrome(p, warm, time);
      vec2 light = 0.4 * vec2(cos(time * 1.3 + seed), sin(time * 1.3 + seed));
      float wet = 1.0 - smoothstep(0.0, 0.35, distance(p, light));
      sheen = mix(sheen, vec3(0.85, 1.0, 0.95), wet * 0.8);
      sheen += hsv2rgb(vec3(0.5, 0.7, 1.0)) * foilFlakes(p, seed, time, 11.0) * 0.45;
      amount = 0.85;
    } else if (holo < 19.5) {
      // Grasshopper Foil — banded metal with a springy sheen.
      float band = 0.5 + 0.5 * sin(p.x * 10.0 + seed);
      float spring = 0.5 + 0.5 * sin(time * 4.0 + seed * 2.0);
      vec3 metal = hsv2rgb(vec3(typeHue(0.3 + 0.4 * band, warm), 0.6, 0.45 + 0.4 * band * spring));
      sheen = metal + metal * anisoBand(p, 0.5, time, 1.0) * 0.9;
      sheen += hsv2rgb(vec3(0.58, 0.7, 1.0)) * foilFlakes(p, seed, time, 10.0) * 0.35;
      amount = 0.82;
    } else if (holo < 20.5) {
      // Sahara Gold — cracked gold leaf with a dust puff.
      float puff = smoothstep(0.7, 1.0, r / boundary) * (0.5 + 0.5 * sin(time * 2.5 + seed));
      sheen = goldLeaf(p, warm, time, seed) + vec3(1.0, 0.95, 0.7) * puff * 0.5;
      sheen += hsv2rgb(vec3(0.5, 0.6, 1.0)) * foilFlakes(p, seed, time, 12.0) * 0.35;
      amount = 0.8;
    } else if (holo < 21.5) {
      // Cuttlefish Hologram — chromatophore waves, iridescent edge,
      // and a violet accent that breathes between bright and near-transparent.
      float wave = 0.5 + 0.5 * sin(p.x * 5.0 + p.y * 3.0 - time * 2.0 + seed);
      vec3 chroma = hsv2rgb(vec3(typeHue(0.35 + 0.4 * wave, warm), 0.6, 0.5 + 0.3 * wave));
      float crest = smoothstep(0.55, 1.0, wave);
      float breathe = 0.3 + 0.7 * (0.5 + 0.5 * sin(time * 1.3 + seed * 6.2831853));
      float edge = smoothstep(0.75, 0.98, r / boundary);
      vec3 edgeShine = hsv2rgb(vec3(typeHue(0.7, warm), 0.5, 1.0));
      sheen = mix(chroma, hsv2rgb(vec3(0.78, 0.7, 1.0)), crest * breathe * 0.8);
      sheen = mix(sheen, edgeShine, edge);
      sheen += foilFlakes(p, seed, time, 8.0) * 0.4;
      amount = 0.8;
    } else if (holo < 22.5) {
      // Chameleon Prism — plates shifting between type tones.
      vec2 warp = p * 3.0 + vec2(sin(time * 0.3), cos(time * 0.25)) * 0.6;
      float h = hash(floor(warp) + seed);
      float t = 0.5 + 0.5 * sin(time * 0.4 + h * 6.2831853);
      vec3 plate = hsv2rgb(vec3(typeHue(0.15 + 0.7 * h, warm), 0.55, 0.5 + 0.35 * t));
      sheen = plate + plate * anisoBand(p, 0.8, time, 0.7) * 0.8;
      sheen += hsv2rgb(vec3(0.8, 0.7, 1.0)) * anisoBand(p, 1.4, time, 0.5) * 0.3;
      amount = 0.8;
    } else if (holo < 23.5) {
      // Lichen Patina — matte patina with a faint shimmer.
      vec2 cell = floor(p * 8.0);
      float h = hash(cell + seed);
      float t = 0.5 + 0.5 * sin(time * 0.3 + seed);
      vec3 patina = hsv2rgb(vec3(typeHue(0.55 + 0.1 * h, warm), 0.35, 0.35 + 0.2 * h));
      sheen = mix(patina, vec3(0.45, 0.55, 0.45), 0.2 * t);
      amount = 0.6 + 0.05 * t;
    } else if (holo < 24.5) {
      // Predator Glint — dark cloak, amber eyes, ember rim.
      float eye = 0.0;
      eye += 1.0 - smoothstep(0.05, 0.10, distance(p, vec2(-0.22, 0.18)));
      eye += 1.0 - smoothstep(0.05, 0.10, distance(p, vec2(0.22, 0.18)));
      float blink = smoothstep(0.15, 0.25, abs(sin(time * 0.9 + seed)));
      float rim = smoothstep(0.75, 1.0, r / boundary);
      sheen = mix(vec3(0.05, 0.04, 0.06), hsv2rgb(vec3(typeHue(0.95, warm), 0.9, 1.0)),
                  clamp(eye, 0.0, 1.0) * blink);
      sheen += hsv2rgb(vec3(typeHue(0.9, warm), 0.8, 1.0)) * rim * 0.25;
      amount = 0.92;
    } else if (holo < 25.5) {
      // Smoke & Ember — black slick body with an ember crack.
      sheen = mix(vec3(0.03), emberGlow(p, boundary, warm, time, seed), 0.7);
      amount = 0.9;
    } else if (holo < 26.5) {
      // Chromatic Veil — near-invisible, faint type-hued film.
      float shimmer = 0.5 + 0.5 * sin(p.x * 6.0 + p.y * 6.0 + time * 1.5 + seed);
      sheen = mix(baseColor, thinFilmTyped(shimmer, warm), 0.35);
      amount = 0.5;
    } else if (holo < 27.5) {
      // Anna's Hummingbird — structural gorget flashing on the dark plumage.
      sheen = gorget(p, warm, time, seed);
      amount = 0.95;
    } else if (holo < 28.5) {
      // Ore Vein — glowing mineral veins through dark rock; icy for prey,
      // molten for predators, with a slow heat pulse and crystal sparks.
      float veinHash = 0.0;
      float vein = oreVeinMask(p * 3.2 + seed, seed, veinHash);
      float pulse = 0.5 + 0.5 * sin(time * 1.4 + veinHash * 6.2831853);
      vec3 glow = mix(
        hsv2rgb(vec3(typeHue(0.5, warm), 0.75, 0.7 + 0.3 * pulse)),
        mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.9, 0.4), pulse),
        warm
      );
      float spark = foilFlakes(p, seed, time, 7.0) * (0.4 + 0.6 * warm);
      sheen = vec3(0.05, 0.05, 0.06) + glow * vein * (0.7 + 0.5 * pulse)
        + glow * spark * 0.5;
      amount = 0.9;
    } else if (holo < 29.5) {
      // Fire Glimmer — a flickering flame up the body with drifting sparks.
      // Golden fire for prey (yellow range), red/orange for predators.
      float f = flame(p, time, seed);
      vec3 fire = mix(
        mix(vec3(0.95, 0.80, 0.10), vec3(0.85, 0.10, 0.02), warm),
        mix(vec3(1.0, 0.95, 0.55), vec3(1.0, 0.45, 0.05), warm),
        pow(f, 0.6)
      );
      float bloom =
        smoothstep(0.85, 1.0, f) * (0.5 + 0.5 * sin(time * 23.0 + seed));
      sheen = vec3(0.05, 0.02, 0.02) + fire * f + vec3(1.0, 0.95, 0.7) * bloom
        + vec3(1.0, 0.8, 0.4) * foilFlakes(p, seed, time, 9.0) * 0.5;
      amount = 0.9;
    } else if (holo < 30.5) {
      // Fish Scales — wet offset scales with a nacre sheen and per-scale glints.
      float glint = 0.0;
      sheen = fishScale(p, warm, time, seed, glint);
      amount = 0.8 + 0.2 * glint;
    }

    return mix(baseColor, sheen, clamp(amount * strength, 0.0, 1.0));
  }
`
