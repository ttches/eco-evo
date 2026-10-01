import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { TAU, hashUnit } from '@/engine/math'
import { writeGlorpColor } from '@/render/appearance'
import {
  GLORP_BLOB_AMPLITUDE,
  GLORP_OUTLINE_SHADE,
  outlineWidth,
  pixelSize,
} from '@/render/glorp-detail'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { GLORP_RADIUS, MAX_GLORPS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

/** Segments in the coverage disc; enough that it never clips the silhouette. */
const BLOB_SEGMENTS = 32

/** Furthest a sample can sit from the pixel it snaps to, in render pixels. */
const SNAP_OVERSHOOT = Math.SQRT1_2

/**
 * The coverage disc must reach past the lumpiest, pixel-snapped silhouette or
 * it would clip it. The snap is worst at the lowest detail zoom, so size the
 * margin from there and account for the polygon's inscribed radius.
 */
const SHAPE_RADIUS =
  (1 +
    GLORP_BLOB_AMPLITUDE +
    SNAP_OVERSHOOT * pixelSize(GLORP_RADIUS, DETAIL_MIN_ZOOM)) /
  Math.cos(Math.PI / BLOB_SEGMENTS)

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;

  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vSeed;

  void main() {
    // The unit disc, so the fragment stage can shade by distance from center.
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
  uniform float uPixel;
  uniform float uBlobAmp;

  void main() {
    // Snap the silhouette to the render-pixel grid (in the glorp's own frame)
    // so it reads as pixel art.
    vec2 p = floor(vLocal / uPixel + 0.5) * uPixel;
    float r = length(p);
    float angle = atan(p.y, p.x);

    // Two harmonics give each glorp a stable, slightly lumpy outline.
    float wobble = uBlobAmp * (
      sin(angle * 3.0 + vSeed) * 0.6 +
      sin(angle * 5.0 - vSeed * 1.3) * 0.4
    );
    float boundary = 1.0 + wobble;
    if (r > boundary) discard;

    vec3 outline = vColor * uOutlineShade;
    gl_FragColor = vec4(r > boundary - uOutlineWidth ? outline : vColor, 1.0);
  }
`

/**
 * Outlined, blobby glorps drawn only when zoomed in enough to read the detail.
 * Below `DETAIL_MIN_ZOOM` the layer draws nothing and `GlorpLayer`'s flat disc
 * takes over, so the zoomed-out look is unchanged.
 */
export class GlorpDetailLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly colors = new Float32Array(MAX_GLORPS * 3)
  private readonly seeds = new Float32Array(MAX_GLORPS)
  private readonly colorAttr: THREE.InstancedBufferAttribute
  private readonly seedAttr: THREE.InstancedBufferAttribute
  private readonly matrix = new THREE.Matrix4()

  public constructor() {
    this.geometry = new THREE.CircleGeometry(SHAPE_RADIUS, BLOB_SEGMENTS)

    this.colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.seedAttr = new THREE.InstancedBufferAttribute(this.seeds, 1)
    for (const attribute of [this.colorAttr, this.seedAttr]) {
      attribute.setUsage(THREE.DynamicDrawUsage)
    }
    this.geometry.setAttribute('aColor', this.colorAttr)
    this.geometry.setAttribute('aSeed', this.seedAttr)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uOutlineWidth: { value: 0 },
        uOutlineShade: { value: GLORP_OUTLINE_SHADE },
        uPixel: { value: 0 },
        uBlobAmp: { value: GLORP_BLOB_AMPLITUDE },
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
