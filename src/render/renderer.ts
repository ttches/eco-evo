import * as THREE from 'three'
import type { Camera } from '@/engine/camera'
import { viewBounds } from '@/engine/camera'
import { CAMERA, VIEWPORT, WORLD_BACKGROUND } from '@/engine/config'
import { writeGlorpColor } from '@/render/appearance'
import { GrassLayer } from '@/render/grass-layer'
import { GroundPass } from '@/render/ground'
import { GLORP_RADIUS, MAX_GLORPS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

const BLOB_SEGMENTS = 16

/** Soft mint highlight drawn around the currently inspected glorp. */
const SELECTION_COLOR = 0x9df5c9

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera
  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly mesh: THREE.InstancedMesh
  private readonly ring: THREE.Mesh
  private readonly ringGeometry: THREE.RingGeometry
  private readonly ringMaterial: THREE.MeshBasicMaterial
  private readonly ground = new GroundPass()
  private readonly grass = new GrassLayer()
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
    this.mesh.renderOrder = 2

    this.ringGeometry = new THREE.RingGeometry(0.82, 1, 24)
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: SELECTION_COLOR,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial)
    this.ring.visible = false
    this.ring.frustumCulled = false
    this.ring.renderOrder = 3

    this.scene.add(this.ground.mesh, this.grass.mesh, this.mesh, this.ring)
  }

  public draw(
    world: RenderableWorld,
    camera: Camera,
    selectedIndex = -1,
  ): void {
    const bounds = viewBounds(camera)
    this.camera.left = bounds.left
    this.camera.right = bounds.right
    this.camera.top = bounds.top
    this.camera.bottom = bounds.bottom
    this.camera.updateProjectionMatrix()

    this.grass.update(world)

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
      writeGlorpColor(world, index, colors, visible)
      visible += 1
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true

    if (selectedIndex >= 0 && selectedIndex < count) {
      this.ring.position.set(
        world.x[selectedIndex],
        world.y[selectedIndex],
        0.5,
      )
      const scale = radius * 1.5
      this.ring.scale.set(scale, scale, 1)
      this.ring.visible = true
    } else {
      this.ring.visible = false
    }

    this.renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
    this.ringGeometry.dispose()
    this.ringMaterial.dispose()
    this.ring.dispose()
    this.ground.dispose()
    this.grass.dispose()
    this.renderer.dispose()
  }
}
