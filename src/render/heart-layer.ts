import * as THREE from 'three'
import type { ViewBounds } from '@/engine/camera'
import { CAMERA } from '@/engine/config'
import {
  HEARTS_PER_BURST,
  HEART_RISE,
  HEART_SIZE,
  burstProgress,
} from '@/render/heart-burst'
import { DETAIL_MIN_ZOOM } from '@/render/lod'
import { HEART_COLOR } from '@/render/palette'
import { GESTATION_SECONDS, MAX_GLORPS } from '@/sim/config'
import type { RenderableWorld } from '@/sim/view'

/** A heart silhouette, unit-sized and centered, built from four curves. */
const createHeartGeometry = (): THREE.ShapeGeometry => {
  const shape = new THREE.Shape()
  shape.moveTo(0, -1)
  shape.bezierCurveTo(-0.2, -0.7, -0.7, -0.35, -0.7, 0.1)
  shape.bezierCurveTo(-0.7, 0.55, -0.1, 0.6, 0, 0.2)
  shape.bezierCurveTo(0.1, 0.6, 0.7, 0.55, 0.7, 0.1)
  shape.bezierCurveTo(0.7, -0.35, 0.2, -0.7, 0, -1)
  const geometry = new THREE.ShapeGeometry(shape, 4)
  geometry.center()
  // World Y grows downward, so flip or the heart's point would face up.
  geometry.scale(1, -1, 1)
  return geometry
}

/**
 * Flat hearts that burst above a glorp at conception. One short pulse per
 * pregnancy, skipped while zoomed out past `DETAIL_MIN_ZOOM` where a heart is
 * only a couple of pixels across.
 */
export class HeartLayer {
  public readonly mesh: THREE.InstancedMesh
  private readonly geometry: THREE.ShapeGeometry
  private readonly material: THREE.MeshBasicMaterial
  private readonly matrix = new THREE.Matrix4()

  public constructor() {
    this.geometry = createHeartGeometry()
    this.material = new THREE.MeshBasicMaterial({
      color: HEART_COLOR,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_GLORPS * HEARTS_PER_BURST,
    )
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
  }

  public update(world: RenderableWorld, bounds: ViewBounds, zoom: number): void {
    if (zoom < DETAIL_MIN_ZOOM) {
      this.mesh.count = 0
      return
    }

    const count = Math.min(world.count, MAX_GLORPS)
    const radius = world.radius
    const margin = radius + HEART_RISE + CAMERA.cullMargin
    let visible = 0

    for (let index = 0; index < count; index += 1) {
      if (world.pregnant[index] <= 0) continue
      const x = world.x[index]
      const y = world.y[index]
      if (x < bounds.left - margin || x > bounds.right + margin) continue
      if (y < bounds.top - margin || y > bounds.bottom + margin) continue

      for (let heart = 0; heart < HEARTS_PER_BURST; heart += 1) {
        const progress = burstProgress(
          world.pregnant[index],
          heart,
          GESTATION_SECONDS,
        )
        if (progress === null) continue

        // Grow from nothing to full size, then shrink back to nothing.
        const scale = HEART_SIZE * Math.sin(Math.PI * progress)
        const fan = (heart - (HEARTS_PER_BURST - 1) / 2) * HEART_SIZE
        this.matrix.makeScale(scale, scale, 1)
        this.matrix.setPosition(
          x + fan,
          y - radius - HEART_RISE * progress,
          0,
        )
        this.mesh.setMatrixAt(visible, this.matrix)
        visible += 1
      }
    }

    this.mesh.count = visible
    this.mesh.instanceMatrix.needsUpdate = true
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }
}
