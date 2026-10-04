import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { TAU, hashUnit } from '@/engine/math'
import { writeGlorpColor } from '@/render/appearance'
import {
  GLORP_BLOB_AMPLITUDE,
  GLORP_BLOB_SEGMENTS,
  GLORP_OUTLINE_SHADE,
  GLORP_SILHOUETTE_GLSL,
  glorpShapeRadius,
  outlineWidth,
  pixelSize,
} from '@/render/glorp-detail'
import {
  GLORP_HOLO_SPEED,
  GLORP_HOLO_STRENGTH,
  glorpHoloIndex,
  holoForType,
} from '@/render/glorp-holo'
import { GLORP_HOLO_GLSL } from '@/render/glorp-holo-shader'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { MAX_GLORPS } from '@/sim/config'
import { GLORP_TYPE, type GlorpType } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

/** Coverage disc sized once from the worst-case snap at the detail threshold. */
const SHAPE_RADIUS = glorpShapeRadius()

/** Chooses the sheen branch for the mutated glorp at `index`. */
export type GlorpHoloPicker = (world: RenderableWorld, index: number) => number

const typeOf = (world: RenderableWorld, index: number): GlorpType =>
  world.type[index] === GLORP_TYPE.hunter ? GLORP_TYPE.hunter : GLORP_TYPE.prey

/** The game look: prey shimmer green, hunters shimmer orange. */
const holoByType: GlorpHoloPicker = (world, index) =>
  glorpHoloIndex(holoForType(typeOf(world, index)))

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aMutated;
  attribute float aHolo;

  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;
  varying float vMutated;
  varying float vHolo;

  void main() {
    // The unit disc, so the fragment stage can shade by distance from center.
    vLocal = position.xy;
    vColor = aColor;
    vSeed = aSeed;
    vMutated = aMutated;
    vHolo = aHolo;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;
  varying float vMutated;
  varying float vHolo;

  uniform float uOutlineWidth;
  uniform float uOutlineShade;
  uniform float uPixel;
  uniform float uBlobAmp;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uStrength;

  ${GLORP_SILHOUETTE_GLSL}
  ${GLORP_HOLO_GLSL}

  void main() {
    // Snap the silhouette to the render-pixel grid (in the glorp's own frame)
    // so it reads as pixel art.
    vec2 p = glorpSnap(vLocal, uPixel);
    float r = length(p);
    float boundary = glorpBoundary(p, vSeed, uBlobAmp);
    if (r > boundary) discard;

    vec3 body = vColor;
    if (vMutated > 0.5) {
      body = glorpHolo(vColor, p, boundary, r, vHolo, vSeed, uTime * uSpeed, uStrength);
    }

    vec3 outline = vColor * uOutlineShade;
    gl_FragColor = vec4(r > boundary - uOutlineWidth ? outline : body, 1.0);
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
  private readonly colorAttr: THREE.InstancedBufferAttribute
  private readonly seedAttr: THREE.InstancedBufferAttribute
  private readonly mutatedAttr: THREE.InstancedBufferAttribute
  private readonly holoAttr: THREE.InstancedBufferAttribute
  private readonly matrix = new THREE.Matrix4()

  public constructor(pickHolo: GlorpHoloPicker = holoByType) {
    this.pickHolo = pickHolo
    this.geometry = new THREE.CircleGeometry(SHAPE_RADIUS, GLORP_BLOB_SEGMENTS)

    this.colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.seedAttr = new THREE.InstancedBufferAttribute(this.seeds, 1)
    this.mutatedAttr = new THREE.InstancedBufferAttribute(this.mutated, 1)
    this.holoAttr = new THREE.InstancedBufferAttribute(this.holos, 1)
    for (const attribute of [
      this.colorAttr,
      this.seedAttr,
      this.mutatedAttr,
      this.holoAttr,
    ]) {
      attribute.setUsage(THREE.DynamicDrawUsage)
    }
    this.geometry.setAttribute('aColor', this.colorAttr)
    this.geometry.setAttribute('aSeed', this.seedAttr)
    this.geometry.setAttribute('aMutated', this.mutatedAttr)
    this.geometry.setAttribute('aHolo', this.holoAttr)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uOutlineWidth: { value: 0 },
        uOutlineShade: { value: GLORP_OUTLINE_SHADE },
        uPixel: { value: 0 },
        uBlobAmp: { value: GLORP_BLOB_AMPLITUDE },
        uTime: { value: 0 },
        uSpeed: { value: GLORP_HOLO_SPEED },
        uStrength: { value: GLORP_HOLO_STRENGTH },
      },
      toneMapped: false,
      side: THREE.DoubleSide,
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
    // Same opaque layer as the flat disc; the two never draw at the same zoom.
    // The selection ring is transparent, so it always overlays.
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
    const pixel = pixelSize(radius, zoom)
    // No screen size means no pixel grid to snap to; draw the flat layer only.
    if (pixel <= 0) {
      this.mesh.count = 0
      return
    }

    const margin = radius + CAMERA.cullMargin
    this.material.uniforms.uOutlineWidth.value = outlineWidth(radius, zoom)
    this.material.uniforms.uPixel.value = pixel
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
      visible += 1
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    this.colorAttr.needsUpdate = true
    this.seedAttr.needsUpdate = true
    this.mutatedAttr.needsUpdate = true
    this.holoAttr.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
