/**
 * Node module hooks for the headless simulator.
 *
 * Runs via `node --import ./tools/simulator/loader.mjs`. It teaches Node the
 * project's `@/` alias (so the game's TypeScript loads unmodified) and lets a
 * run swap `@/sim/config` for a composed virtual module built from optional
 * overlay files and `--set` overrides.
 *
 * Environment (set by run.ts before spawning a worker):
 *   SIM_CONFIG_LAYERS    JSON array of overlay file paths, applied left-to-right.
 *   SIM_CONFIG_OVERRIDES JSON object; dotted keys (MOVEMENT.walkFactor) merge
 *                        into nested config objects, plain keys replace scalars.
 *
 * The real `src/sim/config.ts` is never modified. With no layers and no
 * overrides, `@/sim/config` resolves straight to it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const srcDir = path.join(root, 'src')
const realConfig = path.join(srcDir, 'sim', 'config.ts')

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

const readJsonEnv = (name, fallback) => {
  const raw = process.env[name]
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid ${name}: ${error.message}`)
  }
}

const layers = readJsonEnv('SIM_CONFIG_LAYERS', []).map((file) =>
  path.isAbsolute(file) ? file : path.resolve(root, file),
)
const rawOverrides = readJsonEnv('SIM_CONFIG_OVERRIDES', {})

const assertValidOverrides = (overrides) => {
  for (const key of Object.keys(overrides)) {
    const parts = key.split('.')
    if (parts.length > 2) {
      throw new Error(
        `Invalid --set key "${key}": at most one "." is allowed, e.g. MOVEMENT.walkFactor`,
      )
    }
    for (const part of parts) {
      if (!IDENTIFIER.test(part)) {
        throw new Error(`Invalid --set key "${key}": "${part}" is not an identifier`)
      }
    }
  }
}
assertValidOverrides(rawOverrides)

/**
 * Config constants can be defined in terms of each other (e.g.
 * `MATE_FED_MIN = HUNGER` or `DODGE_SPEED = DODGE_DISTANCE / DODGE_DURATION`).
 * Overriding the source must drag the dependent along, otherwise an experiment
 * silently mixes an overridden and a stale value. Bare aliases are copied;
 * simple arithmetic over numeric constants is re-evaluated; anything we can't
 * resolve (imports, function calls, property access) gets a warning.
 */
const propagateDerivedConstants = (overrides) => {
  let source = ''
  try {
    source = readFileSync(realConfig, 'utf8')
  } catch {
    return { overrides, warnings: [] }
  }

  const aliases = new Map()
  const numeric = new Map()
  const expressions = new Map()
  const expressionDeps = new Map()
  const declaration = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g
  let match
  while ((match = declaration.exec(source))) {
    const name = match[1]
    const expression = match[2].trim()
    const bare = expression.match(/^([A-Za-z_$][\w$]*)$/)
    if (bare) {
      aliases.set(name, bare[1])
      continue
    }
    if (/^-?\d+(?:\.\d+)?$/.test(expression)) {
      numeric.set(name, Number(expression))
      continue
    }
    expressions.set(name, expression)
    for (const word of expression.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (word[0] === name) continue
      if (!expressionDeps.has(word[0])) expressionDeps.set(word[0], new Set())
      expressionDeps.get(word[0]).add(name)
    }
  }

  const resolved = { ...overrides }

  // Arithmetic-only expressions over identifiers that are numeric literals or
  // already-resolved overrides can be recomputed safely. Everything else (e.g.
  // `traitValue("staminaMax", TRAIT_BASE)`) is left to warn below.
  const evaluate = (expression) => {
    if (!/^[\s\dA-Za-z_$+\-*/().eE]+$/.test(expression)) return undefined
    const names = [...expression.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0])
    const values = names.map((name) =>
      resolved[name] !== undefined ? resolved[name] : numeric.get(name),
    )
    if (values.some((value) => typeof value !== 'number')) return undefined
    try {
      const value = new Function(...names, `return (${expression});`)(...values)
      return Number.isFinite(value) ? value : undefined
    } catch {
      return undefined
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const [alias, target] of aliases) {
      if (resolved[target] !== undefined && resolved[alias] === undefined) {
        resolved[alias] = resolved[target]
        changed = true
      }
    }
    for (const [name, expression] of expressions) {
      if (resolved[name] !== undefined) continue
      const value = evaluate(expression)
      if (value !== undefined) {
        resolved[name] = value
        changed = true
      }
    }
  }

  const warnings = []
  for (const key of Object.keys(overrides)) {
    for (const dependent of expressionDeps.get(key) ?? []) {
      if (resolved[dependent] === undefined) {
        warnings.push(`${dependent} (derived from ${key})`)
      }
    }
  }
  return { overrides: resolved, warnings }
}

const { overrides, warnings } = propagateDerivedConstants(rawOverrides)
for (const warning of warnings) {
  console.error(`simulator: config override may be incomplete: ${warning}`)
}

const toUrl = (file) => pathToFileURL(file).href

/** Resolve an extensionless source specifier to a real file on disk. */
const resolveSource = (base) => {
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.json']) {
    if (existsSync(base + ext)) return base + ext
  }
  return base
}

const activeConfigUrl = () =>
  toUrl(layers.length > 0 ? layers[layers.length - 1] : realConfig)

/**
 * `@/sim/config.base` points at the layer below the importing one, so overlays
 * chain: each does `export * from '@/sim/config.base'` and the loader feeds it
 * the previous layer (or the real config for the first layer). Imports from
 * anywhere else get the real config.
 */
const baseFor = (parentURL) => {
  if (parentURL) {
    const parentFile = fileURLToPath(parentURL)
    const index = layers.indexOf(parentFile)
    if (index >= 0) return toUrl(index === 0 ? realConfig : layers[index - 1])
  }
  return toUrl(realConfig)
}

const splitOverrides = () => {
  const scalars = {}
  const nested = {}
  for (const [key, value] of Object.entries(overrides)) {
    if (key.includes('.')) {
      const [head, ...rest] = key.split('.')
      nested[head] ??= {}
      nested[head][rest.join('.')] = value
    } else {
      scalars[key] = value
    }
  }
  return { scalars, nested }
}

/** Build the generated module that composes layers plus overrides. */
const buildVirtualConfig = () => {
  const active = activeConfigUrl()
  const { scalars, nested } = splitOverrides()
  const lines = [`export * from ${JSON.stringify(active)};`]

  for (const head of Object.keys(nested)) {
    lines.push(
      `import { ${head} as __base_${head} } from ${JSON.stringify(active)};`,
    )
  }
  for (const [key, value] of Object.entries(scalars)) {
    lines.push(`export const ${key} = ${JSON.stringify(value)};`)
  }
  for (const [head, props] of Object.entries(nested)) {
    lines.push(
      `export const ${head} = { ...__base_${head}, ...${JSON.stringify(props)} };`,
    )
  }
  return `${lines.join('\n')}\n`
}

const VIRTUAL_CONFIG = 'virtual:sim-config'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/sim/config.base') {
      return { url: baseFor(context.parentURL), shortCircuit: true }
    }
    if (specifier === '@/sim/config') {
      if (layers.length === 0 && Object.keys(overrides).length === 0) {
        return { url: toUrl(realConfig), shortCircuit: true }
      }
      return { url: VIRTUAL_CONFIG, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      return {
        url: toUrl(resolveSource(path.join(srcDir, specifier.slice(2)))),
        shortCircuit: true,
      }
    }
    return nextResolve(specifier, context)
  },

  load(url, context, nextLoad) {
    if (url === VIRTUAL_CONFIG) {
      return {
        format: 'module',
        source: buildVirtualConfig(),
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})
