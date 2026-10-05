import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { TAU, hashUnit } from '@/engine/math'
import { glorpTypeAt } from '@/render/appearance'
import {
  GLORP_AURA_SCALE,
  GLORP_AURA_STRENGTH,
  auraIsAdditive,
} from '@/render/glorp-aura'
import { GLORP_AURA_GLSL } from '@/render/glorp-aura-shader'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { auraIndexForMutations } from '@/render/mutation-looks'
import { MAX_GLORPS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

/** Chooses the aura branch for the glorp at `index`; -1 means no aura. */
export type GlorpAuraPicker = (world: RenderableWorld, index: number) => number

const AURA_SEGMENTS = 32

/** Coverage disc, in body radii, reaching well past the silhouette. */
const SHAPE_RADIUS = GLORP_AURA_SCALE

/** The game look: each mutation with an aura wears its own. */
const auraByMutation: GlorpAuraPicker = (world, index) =>
  auraIndexForMutations(world.mutations[index], glorpTypeAt(world, index))

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aAura;

  varying vec2 vLocal;
  varying float vSeed;
  varying float vAura;

  void main() {
    vLocal = position.xy;
    vSeed = aSeed;
    vAura = aAura;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vLocal;
  varying float vSeed;
  varying float vAura;

  uniform float uStrength;
  uniform float uTime;

  ${GLORP_AURA_GLSL}

  void main() {
    vec4 aura = glorpAura(vLocal, length(vLocal), vAura, vSeed, uTime, uStrength);
    if (aura.a <= 0.0) discard;
    gl_FragColor = aura;
  }
`

/** One blend pass of auras: all shadow auras or all additive ones. */
class AuraPass {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly seeds = new Float32Array(MAX_GLORPS)
  private readonly auras = new Float32Array(MAX_GLORPS)
  private readonly seedAttr: THREE.InstancedBufferAttribute
  private readonly auraAttr: THREE.InstancedBufferAttribute
  private readonly matrix = new THREE.Matrix4()
  private count = 0

  public constructor(additive: boolean, renderOrder: number) {
    this.geometry = new THREE.CircleGeometry(SHAPE_RADIUS, AURA_SEGMENTS)

    this.seedAttr = new THREE.InstancedBufferAttribute(this.seeds, 1)
    this.auraAttr = new THREE.InstancedBufferAttribute(this.auras, 1)
    for (const attribute of [this.seedAttr, this.auraAttr]) {
      attribute.setUsage(THREE.DynamicDrawUsage)
    }
    this.geometry.setAttribute('aSeed', this.seedAttr)
    this.geometry.setAttribute('aAura', this.auraAttr)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uStrength: { value: GLORP_AURA_STRENGTH },
        uTime: { value: 0 },
      },
      toneMapped: false,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })

    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_GLORPS,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    // Above the opaque grass, below the transparent body sheen.
    this.mesh.renderOrder = renderOrder
  }

  public begin(time: number): void {
    this.material.uniforms.uTime.value = time
    this.count = 0
  }

  public write(
    world: RenderableWorld,
    index: number,
    radius: number,
    seed: number,
    aura: number,
  ): void {
    this.matrix.makeScale(radius, radius, 1)
    this.matrix.setPosition(world.x[index], world.y[index], 0)
    this.mesh.setMatrixAt(this.count, this.matrix)
    this.seeds[this.count] = seed
    this.auras[this.count] = aura
    this.count += 1
  }

  public end(): void {
    this.mesh.count = this.count
    this.mesh.instanceMatrix.needsUpdate = true
    this.seedAttr.needsUpdate = true
    this.auraAttr.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}

/**
 * Soft auras drawn around mutated glorps that carry one, only when zoomed in
 * enough to read them. Shadow auras use normal blending to darken the grass,
 * additive ones to glow; the split into two passes keeps both readable and the
 * body layer draws on top of either.
 */
export class GlorpAuraLayer {
  public readonly meshes: readonly THREE.InstancedMesh[]
  public readonly shadeMesh: THREE.InstancedMesh
  public readonly glowMesh: THREE.InstancedMesh
  private readonly shade: AuraPass
  private readonly glow: AuraPass
  private readonly pickAura: GlorpAuraPicker

  public constructor(pickAura: GlorpAuraPicker = auraByMutation) {
    this.pickAura = pickAura
    this.shade = new AuraPass(false, 1)
    this.glow = new AuraPass(true, 1)
    this.shadeMesh = this.shade.mesh
    this.glowMesh = this.glow.mesh
    this.meshes = [this.shadeMesh, this.glowMesh]
  }

  public update(
    world: RenderableWorld,
    bounds: ViewBounds,
    zoom: number,
    time: number,
  ): void {
    if (zoom < DETAIL_MIN_ZOOM) {
      this.shade.mesh.count = 0
      this.glow.mesh.count = 0
      return
    }

    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius
    const margin = radius * SHAPE_RADIUS + CAMERA.cullMargin
    this.shade.begin(time)
    this.glow.begin(time)

    for (let index = 0; index < count; index += 1) {
      const x = world.x[index]
      const y = world.y[index]
      if (x < bounds.left - margin || x > bounds.right + margin) continue
      if (y < bounds.top - margin || y > bounds.bottom + margin) continue

      const aura = this.pickAura(world, index)
      if (aura < 0) continue

      const seed = hashUnit(world.id[index]) * TAU
      const pass = auraIsAdditive(aura) ? this.glow : this.shade
      pass.write(world, index, radius, seed, aura)
    }

    this.shade.end()
    this.glow.end()
  }

  public dispose(): void {
    this.shade.dispose()
    this.glow.dispose()
  }
}
