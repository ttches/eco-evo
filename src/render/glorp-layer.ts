import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import { writeGlorpColor } from '@/render/appearance'
import { MAX_GLORPS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

const BLOB_SEGMENTS = 16

/** Instanced flat blobs, one per glorp inside the view. */
export class GlorpLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly colors = new Float32Array(MAX_GLORPS * 3)
  private readonly matrix = new THREE.Matrix4()

  public constructor() {
    this.geometry = new THREE.CircleGeometry(1, BLOB_SEGMENTS)
    this.material = new THREE.MeshBasicMaterial({
      toneMapped: false,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_GLORPS,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3)
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
  }

  public update(world: RenderableWorld, bounds: ViewBounds): void {
    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius
    const margin = radius + CAMERA.cullMargin
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
      visible += 1
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
