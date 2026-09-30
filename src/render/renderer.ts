import * as THREE from 'three'
import { viewBounds, type Camera, type Viewport } from '@/engine/camera'
import { GlorpLayer } from '@/render/glorp-layer'
import { GrassLayer } from '@/render/grass-layer'
import { GroundPass } from '@/render/ground'
import { HeartLayer } from '@/render/heart-layer'
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
  private readonly hearts = new HeartLayer()
  private readonly selection = new SelectionRing()

  public constructor(canvas: HTMLCanvasElement, viewport: Viewport) {
    THREE.ColorManagement.enabled = false

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.resize(viewport)
    this.renderer.setClearColor(WORLD_BACKGROUND, 1)

    // Y-down orthographic camera; its bounds are set from the view every draw.
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10)

    this.scene.add(
      this.ground.mesh,
      this.grass.mesh,
      this.glorps.mesh,
      this.hearts.mesh,
      this.selection.mesh,
    )
  }

  /** Match the backing store to a new viewport; CSS keeps the display size. */
  public resize(viewport: Viewport): void {
    this.renderer.setSize(viewport.width, viewport.height, false)
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
    this.hearts.update(world, bounds, camera.zoom)
    this.selection.update(world, selectedIndex)

    this.renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.ground.dispose()
    this.grass.dispose()
    this.glorps.dispose()
    this.hearts.dispose()
    this.selection.dispose()
    this.renderer.dispose()
  }
}
