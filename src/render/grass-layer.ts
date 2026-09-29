import * as THREE from 'three'
import { WORLD } from '@/engine/config'
import { GRASS_GREEN, GROUND_COLOR } from '@/render/palette'
import { GRASS_TILE } from '@/sim/config'
import { grassCols, grassRows } from '@/sim/grass'
import type { RenderableWorld } from '@/sim/view'

/** Tiles at or below this density are left as bare ground. */
const MIN_VISIBLE = 0.02

/** Between the ground (-1) and the blobs (0). */
const GRASS_Z = -0.5

const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  uniform vec2 uWorldSize;

  void main() {
    vWorld = uv * uWorldSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vWorld;
  uniform sampler2D uDensity;
  uniform vec2 uFieldSize;
  uniform vec3 uBase;
  uniform vec3 uGreen;
  uniform float uMinVisible;

  void main() {
    float value = texture2D(uDensity, vWorld / uFieldSize).r;
    if (value <= uMinVisible) discard;
    gl_FragColor = vec4(mix(uBase, uGreen, value), 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * One world-sized quad tinted by grass density. The density grid is sampled
 * straight from the simulation's array as a nearest-filtered float texture,
 * so each frame uploads one float per tile and nothing else.
 */
export class GrassLayer {
  public readonly mesh: THREE.Mesh
  private readonly geometry: THREE.PlaneGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly texture: THREE.DataTexture

  public constructor() {
    const cols = grassCols()
    const rows = grassRows()
    // Swapped for the world's own density array on the first update.
    this.texture = new THREE.DataTexture(
      new Float32Array(cols * rows),
      cols,
      rows,
      THREE.RedFormat,
      THREE.FloatType,
    )
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.NearestFilter
    this.texture.needsUpdate = true

    this.geometry = new THREE.PlaneGeometry(WORLD.width, WORLD.height)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uDensity: { value: this.texture },
        uWorldSize: { value: new THREE.Vector2(WORLD.width, WORLD.height) },
        uFieldSize: {
          value: new THREE.Vector2(cols * GRASS_TILE, rows * GRASS_TILE),
        },
        uBase: { value: new THREE.Color(GROUND_COLOR) },
        uGreen: { value: new THREE.Color(GRASS_GREEN) },
        uMinVisible: { value: MIN_VISIBLE },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.position.set(WORLD.width / 2, WORLD.height / 2, GRASS_Z)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
  }

  public update(world: RenderableWorld): void {
    if (this.texture.image.data !== world.grass.values) {
      this.texture.image.data = world.grass.values
    }
    this.texture.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
  }
}
