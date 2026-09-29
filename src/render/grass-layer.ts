import * as THREE from 'three'
import { GRASS_GREEN, GROUND_COLOR } from '@/render/palette'
import { grassCols, grassRows } from '@/sim/grass'
import type { RenderableWorld } from '@/sim/view'

/** Tiles at or below this density are left as bare ground. */
const MIN_VISIBLE = 0.02

/** Between the ground (-1) and the blobs (0). */
const GRASS_Z = -0.5

/** Instanced quads tinted by local grass density. */
export class GrassLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.PlaneGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly colors: Float32Array
  private readonly matrix = new THREE.Matrix4()
  private readonly base = new THREE.Color(GROUND_COLOR)
  private readonly green = new THREE.Color(GRASS_GREEN)
  private readonly mixed = new THREE.Color()

  public constructor() {
    const capacity = grassCols() * grassRows()
    this.geometry = new THREE.PlaneGeometry(1, 1)
    this.material = new THREE.MeshBasicMaterial({
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.colors = new Float32Array(capacity * 3)
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
  }

  public update(world: RenderableWorld): void {
    const grass = world.grass
    const tile = grass.tileSize
    const half = tile / 2
    let visible = 0

    for (let row = 0; row < grass.rows; row += 1) {
      for (let col = 0; col < grass.cols; col += 1) {
        const value = grass.values[row * grass.cols + col]
        if (value <= MIN_VISIBLE) continue

        this.matrix.makeScale(tile, tile, 1)
        this.matrix.setPosition(col * tile + half, row * tile + half, GRASS_Z)
        this.mesh.setMatrixAt(visible, this.matrix)

        this.mixed.copy(this.base).lerp(this.green, value)
        const offset = visible * 3
        this.colors[offset] = this.mixed.r
        this.colors[offset + 1] = this.mixed.g
        this.colors[offset + 2] = this.mixed.b
        visible += 1
      }
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
