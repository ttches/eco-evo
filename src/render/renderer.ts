import * as THREE from 'three'
import type { Camera } from '@/engine/camera'
import { viewBounds } from '@/engine/camera'
import { VIEWPORT } from '@/engine/config'
import { GlorpLayer } from '@/render/glorp-layer'
import { GrassLayer } from '@/render/grass-layer'
import { GroundPass } from '@/render/ground'
import { WORLD_BACKGROUND } from '@/render/palette'
import { SelectionRing } from '@/render/selection-ring'
import type { RenderableWorld } from '@/sim/view'

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera
  private readonly ground = new GroundPass()
  private readonly grass = new GrassLayer()
  private readonly glorps = new GlorpLayer()
  private readonly selection = new SelectionRing()

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

    this.scene.add(
      this.ground.mesh,
      this.grass.mesh,
      this.glorps.mesh,
      this.selection.mesh,
    )
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
    this.glorps.update(world, bounds)
    this.selection.update(world, selectedIndex)

    this.renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.ground.dispose()
    this.grass.dispose()
    this.glorps.dispose()
    this.selection.dispose()
    this.renderer.dispose()
  }
}
