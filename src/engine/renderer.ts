import * as THREE from 'three'
import {
  CANVAS,
  GLORP_RADIUS,
  MAX_GLORPS,
  WORLD_BACKGROUND,
} from '@/engine/config'
import type { RenderableWorld } from '@/engine/contracts'

const BLOB_SEGMENTS = 16

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly mesh: THREE.InstancedMesh
  private readonly colorValues = new Float32Array(MAX_GLORPS * 3)
  private readonly matrix = new THREE.Matrix4()

  public constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(CANVAS.width, CANVAS.height, false)
    this.renderer.setClearColor(WORLD_BACKGROUND, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // Y-down orthographic camera so world coordinates match screen coordinates.
    this.camera = new THREE.OrthographicCamera(
      0,
      CANVAS.width,
      0,
      CANVAS.height,
      -10,
      10,
    )

    this.geometry = new THREE.CircleGeometry(1, BLOB_SEGMENTS)
    this.material = new THREE.MeshBasicMaterial({ toneMapped: false })
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_GLORPS,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      this.colorValues,
      3,
    )
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }

  public draw(world: RenderableWorld): void {
    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius > 0 ? world.radius : GLORP_RADIUS
    const colors = this.colorValues

    for (let index = 0; index < count; index += 1) {
      this.matrix.makeScale(radius, radius, 1)
      this.matrix.setPosition(world.x[index], world.y[index], 0)
      this.mesh.setMatrixAt(index, this.matrix)

      const offset = index * 3
      colors[offset] = world.colors[offset]
      colors[offset + 1] = world.colors[offset + 1]
      colors[offset + 2] = world.colors[offset + 2]
    }

    this.mesh.count = count
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true

    this.renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
    this.renderer.dispose()
  }
}
