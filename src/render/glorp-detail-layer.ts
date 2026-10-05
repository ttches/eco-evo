import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { TAU, hashUnit } from '@/engine/math'
import { glorpTypeAt, writeGlorpColor } from '@/render/appearance'
import {
  GLORP_BLOB_AMPLITUDE,
  GLORP_BLOB_SEGMENTS,
  GLORP_OUTLINE_SHADE,
  GLORP_SILHOUETTE_GLSL,
  detailBodyMetrics,
  detailSpriteMetrics,
} from '@/render/glorp-detail'
import { GLORP_HOLO_SPEED, GLORP_HOLO_STRENGTH } from '@/render/glorp-holo'
import { GLORP_HOLO_GLSL } from '@/render/glorp-holo-shader'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { holoIndexForMutations } from '@/render/mutation-looks'
import { MAX_GLORPS } from '@/sim/config'
import { GLORP_TYPE } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

/**
 * Fixed sprite metrics: the mutation flare's snap grid and the coverage disc.
 * The body silhouette and outline are recomputed each frame from the camera
 * zoom (see `update`), so a glorp sharpens as you zoom in while the flare keeps
 * the one authored sprite look the HoloLab previews.
 */
const SPRITE = detailSpriteMetrics()

/** Initial body metrics; `update` overwrites them from the live camera zoom. */
const BODY = detailBodyMetrics()

/** Chooses the sheen branch for the mutated glorp at `index`. */
export type GlorpHoloPicker = (world: RenderableWorld, index: number) => number

/** The game look: each mutation wears its own sheen, picked from the mask. */
const holoByMutation: GlorpHoloPicker = (world, index) =>
  holoIndexForMutations(world.mutations[index], glorpTypeAt(world, index))

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aMutated;
  attribute float aHolo;
  attribute float aWarm;

  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;
  varying float vMutated;
  varying float vHolo;
  varying float vWarm;

  void main() {
    // The unit disc, so the fragment stage can shade by distance from center.
    vLocal = position.xy;
    vColor = aColor;
    vSeed = aSeed;
    vMutated = aMutated;
    vHolo = aHolo;
    vWarm = aWarm;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;
  varying float vMutated;
  varying float vHolo;
  varying float vWarm;

  uniform float uOutlineWidth;
  uniform float uOutlineShade;
  uniform float uBodyPixel;
  uniform float uFlarePixel;
  uniform float uBlobAmp;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uStrength;

  ${GLORP_SILHOUETTE_GLSL}
  ${GLORP_HOLO_GLSL}

  void main() {
    // Snap the body silhouette to the render-pixel grid (in the glorp's own
    // frame) so it reads as pixel art; it sharpens as the camera zooms in.
    vec2 pBody = glorpSnap(vLocal, uBodyPixel);
    float rBody = length(pBody);
    float boundaryBody = glorpBoundary(pBody, vSeed, uBlobAmp);
    if (rBody > boundaryBody) discard;

    vec3 body = vColor;
    if (vMutated > 0.5) {
      // Sample the sheen on the fixed sprite grid so the mutation flare keeps
      // its authored 8-bit look at every zoom, overlaid on the finer body.
      vec2 pFlare = glorpSnap(vLocal, uFlarePixel);
      body = glorpHolo(vColor, pFlare, boundaryBody, rBody, vHolo, vSeed, uTime * uSpeed, uStrength, vWarm);
    }

    vec3 outline = vColor * uOutlineShade;
    gl_FragColor = vec4(rBody > boundaryBody - uOutlineWidth ? outline : body, 1.0);
  }
`

/**
 * Outlined, blobby glorps drawn only when zoomed in enough to read the detail.
 * Below `DETAIL_MIN_ZOOM` the layer draws nothing and `GlorpLayer`'s flat disc
 * takes over, so the zoomed-out look is unchanged. Mutated glorps additionally
 * wear a `glorpHolo` sheen; `pickHolo` selects which, so the lab can override
 * the type-based production mapping.
 */
export class GlorpDetailLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly pickHolo: GlorpHoloPicker
  private readonly colors = new Float32Array(MAX_GLORPS * 3)
  private readonly seeds = new Float32Array(MAX_GLORPS)
  private readonly mutated = new Float32Array(MAX_GLORPS)
  private readonly holos = new Float32Array(MAX_GLORPS)
  private readonly warms = new Float32Array(MAX_GLORPS)
  private readonly colorAttr: THREE.InstancedBufferAttribute
  private readonly seedAttr: THREE.InstancedBufferAttribute
  private readonly mutatedAttr: THREE.InstancedBufferAttribute
  private readonly holoAttr: THREE.InstancedBufferAttribute
  private readonly warmAttr: THREE.InstancedBufferAttribute
  private readonly matrix = new THREE.Matrix4()

  public constructor(pickHolo: GlorpHoloPicker = holoByMutation) {
    this.pickHolo = pickHolo
    this.geometry = new THREE.CircleGeometry(
      SPRITE.shapeRadius,
      GLORP_BLOB_SEGMENTS,
    )

    this.colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.seedAttr = new THREE.InstancedBufferAttribute(this.seeds, 1)
    this.mutatedAttr = new THREE.InstancedBufferAttribute(this.mutated, 1)
    this.holoAttr = new THREE.InstancedBufferAttribute(this.holos, 1)
    this.warmAttr = new THREE.InstancedBufferAttribute(this.warms, 1)
    for (const attribute of [
      this.colorAttr,
      this.seedAttr,
      this.mutatedAttr,
      this.holoAttr,
      this.warmAttr,
    ]) {
      attribute.setUsage(THREE.DynamicDrawUsage)
    }
    this.geometry.setAttribute('aColor', this.colorAttr)
    this.geometry.setAttribute('aSeed', this.seedAttr)
    this.geometry.setAttribute('aMutated', this.mutatedAttr)
    this.geometry.setAttribute('aHolo', this.holoAttr)
    this.geometry.setAttribute('aWarm', this.warmAttr)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uOutlineWidth: { value: BODY.outline },
        uOutlineShade: { value: GLORP_OUTLINE_SHADE },
        uBodyPixel: { value: BODY.pixel },
        uFlarePixel: { value: SPRITE.pixel },
        uBlobAmp: { value: GLORP_BLOB_AMPLITUDE },
        uTime: { value: 0 },
        uSpeed: { value: GLORP_HOLO_SPEED },
        uStrength: { value: GLORP_HOLO_STRENGTH },
      },
      toneMapped: false,
      side: THREE.DoubleSide,
      // Transparent so the aura layer (order 1) draws under it (order 2); the
      // body itself is opaque (alpha 1) and writes no depth.
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_GLORPS,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    // Transparent body draws after the aura (order 1); hearts and the
    // selection ring sit above it.
    this.mesh.renderOrder = 2
  }

  public update(
    world: RenderableWorld,
    bounds: ViewBounds,
    zoom: number,
    time: number,
  ): void {
    if (zoom < DETAIL_MIN_ZOOM) {
      this.mesh.count = 0
      return
    }

    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius
    // The body grid sharpens with the camera; only the flare stays fixed (see
    // DETAIL_SPRITE_ZOOM). No screen size means no grid to snap to.
    const body = detailBodyMetrics(radius, zoom)
    if (body.pixel <= 0) {
      this.mesh.count = 0
      return
    }

    const margin = radius + CAMERA.cullMargin
    this.material.uniforms.uBodyPixel.value = body.pixel
    this.material.uniforms.uOutlineWidth.value = body.outline
    this.material.uniforms.uTime.value = time
    let visible = 0

    for (let index = 0; index < count; index += 1) {
      const x = world.x[index]
      const y = world.y[index]
      if (x < bounds.left - margin || x > bounds.right + margin) continue
      if (y < bounds.top - margin || y > bounds.bottom + margin) continue

      this.matrix.makeScale(radius, radius, 1)
      this.matrix.setPosition(x, y, 0)
      this.mesh.setMatrixAt(visible, this.matrix)
      writeGlorpColor(world, index, this.colors, visible)
      // Hash the id to a stable phase, so each glorp keeps its own blob shape
      // without large ids losing precision in the float attribute.
      this.seeds[visible] = hashUnit(world.id[index]) * TAU
      this.mutated[visible] = world.mutations[index] !== 0 ? 1 : 0
      this.holos[visible] = this.pickHolo(world, index)
      this.warms[visible] = world.type[index] === GLORP_TYPE.hunter ? 1 : 0
      visible += 1
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    this.colorAttr.needsUpdate = true
    this.seedAttr.needsUpdate = true
    this.mutatedAttr.needsUpdate = true
    this.holoAttr.needsUpdate = true
    this.warmAttr.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
