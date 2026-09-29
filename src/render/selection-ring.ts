import * as THREE from 'three'
import { SELECTION_COLOR } from '@/render/palette'
import type { RenderableWorld } from '@/sim/view'

/** Highlight ring drawn around the currently inspected glorp. */
export class SelectionRing {
  public readonly mesh: THREE.Mesh
  private readonly geometry: THREE.RingGeometry
  private readonly material: THREE.MeshBasicMaterial

  public constructor() {
    this.geometry = new THREE.RingGeometry(0.82, 1, 24)
    this.material = new THREE.MeshBasicMaterial({
      color: SELECTION_COLOR,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
  }

  /** Follow the glorp at `index`, or hide when it is -1 or out of range. */
  public update(world: RenderableWorld, index: number): void {
    if (index < 0 || index >= world.count) {
      this.mesh.visible = false
      return
    }
    this.mesh.position.set(world.x[index], world.y[index], 0.5)
    const scale = world.radius * 1.5
    this.mesh.scale.set(scale, scale, 1)
    this.mesh.visible = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
