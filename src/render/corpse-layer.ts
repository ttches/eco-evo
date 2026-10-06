import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { TAU, hashUnit } from '@/engine/math'
import { CORPSE_COLORS, corpseDeflate } from '@/render/corpse-look'
import {
  GLORP_BLOB_AMPLITUDE,
  GLORP_BLOB_SEGMENTS,
  GLORP_OUTLINE_SHADE,
  GLORP_SILHOUETTE_GLSL,
  detailBodyMetrics,
  detailSpriteMetrics,
} from '@/render/glorp-detail'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { CORPSE_SECONDS, MAX_CORPSES } from '@/sim/config'
import { glorpTypeFrom } from '@/sim/types'
import type { RenderableWorld } from '@/sim/view'

/** Fixed coverage disc, matching the detailed glorp's worst-case silhouette. */
const SPRITE = detailSpriteMetrics()

/** Initial body metrics; `update` overwrites them from the live camera zoom. */
const BODY = detailBodyMetrics()

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;

  void main() {
    vLocal = position.xy;
    vColor = aColor;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;

  uniform float uOutlineWidth;
  uniform float uOutlineShade;
  uniform float uBodyPixel;
  uniform float uBlobAmp;

  ${GLORP_SILHOUETTE_GLSL}

  void main() {
    // Same pixel-snapped silhouette as a living glorp, so a corpse reads as the
    // glorp it was, just flat and dark.
    vec2 pBody = glorpSnap(vLocal, uBodyPixel);
    float rBody = length(pBody);
    float boundaryBody = glorpBoundary(pBody, vSeed, uBlobAmp);
    if (rBody > boundaryBody) discard;

    vec3 outline = vColor * uOutlineShade;
    gl_FragColor = vec4(rBody > boundaryBody - uOutlineWidth ? outline : vColor, 1.0);
  }
`

/**
 * Darkened, deflating glorps left behind by starvation. Drawn only when zoomed
 * in past `DETAIL_MIN_ZOOM` (the detailed view), like the conception hearts, so
 * the zoomed-out flat-disc look is untouched.
 */
export class CorpseLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly colors = new Float32Array(MAX_CORPSES * 3)
  private readonly seeds = new Float32Array(MAX_CORPSES)
  private readonly colorAttr: THREE.InstancedBufferAttribute
  private readonly seedAttr: THREE.InstancedBufferAttribute
  private readonly matrix = new THREE.Matrix4()

  public constructor() {
    this.geometry = new THREE.CircleGeometry(
      SPRITE.shapeRadius,
      GLORP_BLOB_SEGMENTS,
    )

    this.colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.seedAttr = new THREE.InstancedBufferAttribute(this.seeds, 1)
    this.colorAttr.setUsage(THREE.DynamicDrawUsage)
    this.seedAttr.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('aColor', this.colorAttr)
    this.geometry.setAttribute('aSeed', this.seedAttr)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uOutlineWidth: { value: BODY.outline },
        uOutlineShade: { value: GLORP_OUTLINE_SHADE },
        uBodyPixel: { value: BODY.pixel },
        uBlobAmp: { value: GLORP_BLOB_AMPLITUDE },
      },
      toneMapped: false,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_CORPSES,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    // Below the living glorps (order 2) but above the grass, so corpses lie on
    // the ground under anything still alive.
    this.mesh.renderOrder = 1
  }

  public update(
    world: RenderableWorld,
    bounds: ViewBounds,
    zoom: number,
  ): void {
    if (zoom < DETAIL_MIN_ZOOM) {
      this.mesh.count = 0
      return
    }

    const corpses = world.corpses
    const count = Math.min(corpses.count, MAX_CORPSES)
    const radius = world.radius
    const body = detailBodyMetrics(radius, zoom)
    if (body.pixel <= 0) {
      this.mesh.count = 0
      return
    }

    const margin = radius + CAMERA.cullMargin
    this.material.uniforms.uBodyPixel.value = body.pixel
    this.material.uniforms.uOutlineWidth.value = body.outline
    let visible = 0

    for (let index = 0; index < count; index += 1) {
      const x = corpses.x[index]
      const y = corpses.y[index]
      if (x < bounds.left - margin || x > bounds.right + margin) continue
      if (y < bounds.top - margin || y > bounds.bottom + margin) continue

      const scale =
        radius * corpseDeflate(corpses.remaining[index], CORPSE_SECONDS)
      this.matrix.makeScale(scale, scale, 1)
      this.matrix.setPosition(x, y, 0)
      this.mesh.setMatrixAt(visible, this.matrix)

      const color = CORPSE_COLORS[glorpTypeFrom(corpses.type[index])]
      this.colors[visible * 3] = color[0]
      this.colors[visible * 3 + 1] = color[1]
      this.colors[visible * 3 + 2] = color[2]
      // Same id-hashed phase as the living detail layer, so the corpse keeps
      // the exact silhouette it had alive.
      this.seeds[visible] = hashUnit(corpses.id[index]) * TAU
      visible += 1
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    this.colorAttr.needsUpdate = true
    this.seedAttr.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
