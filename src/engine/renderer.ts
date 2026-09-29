import * as THREE from 'three'
import type { Camera } from '@/engine/camera'
import { viewBounds } from '@/engine/camera'
import {
  CAMERA,
  GLORP_RADIUS,
  MAX_GLORPS,
  VIEWPORT,
  WORLD_BACKGROUND,
} from '@/engine/config'
import type { RenderableWorld } from '@/engine/contracts'
import { GroundPass } from '@/engine/ground'

const BLOB_SEGMENTS = 16

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly mesh: THREE.InstancedMesh
  private readonly ground = new GroundPass()
  private readonly colorValues = new Float32Array(MAX_GLORPS * 3)
  private readonly matrix = new THREE.Matrix4()

  public constructor(canvas: HTMLCanvasElement) {
    THREE.ColorManagement.enabled = false

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(VIEWPORT.width, VIEWPORT.height, false)
    this.renderer.setClearColor(WORLD_BACKGROUND, 1)

    // Y-down orthographic camera so world coordinates match screen coordinates.
    this.camera = new THREE.OrthographicCamera(
      0,
      VIEWPORT.width,
      0,
      VIEWPORT.height,
      -10,
      10,
    )

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
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      this.colorValues,
      3,
    )
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1

    this.scene.add(this.ground.mesh, this.mesh)
  }

  public draw(world: RenderableWorld, camera: Camera): void {
    const bounds = viewBounds(camera)
    this.camera.left = bounds.left
    this.camera.right = bounds.right
    this.camera.top = bounds.top
    this.camera.bottom = bounds.bottom
    this.camera.updateProjectionMatrix()

    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius > 0 ? world.radius : GLORP_RADIUS
    const margin = radius + CAMERA.cullMargin
    const colors = this.colorValues
    let visible = 0

    for (let index = 0; index < count; index += 1) {
      const x = world.x[index]
      const y = world.y[index]
      if (x < bounds.left - margin || x > bounds.right + margin) continue
      if (y < bounds.top - margin || y > bounds.bottom + margin) continue

      this.matrix.makeScale(radius, radius, 1)
      this.matrix.setPosition(x, y, 0)
      this.mesh.setMatrixAt(visible, this.matrix)

      const source = index * 3
      const target = visible * 3
      colors[target] = world.colors[source]
      colors[target + 1] = world.colors[source + 1]
      colors[target + 2] = world.colors[source + 2]
      visible += 1
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true

    this.renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
    this.ground.dispose()
    this.renderer.dispose()
  }
}
