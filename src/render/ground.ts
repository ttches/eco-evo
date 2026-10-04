import * as THREE from 'three'
import { WORLD } from '@/engine/config'
import { GROUND_COLOR, WORLD_EDGE_COLOR } from '@/render/palette'

const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  uniform vec2 uWorldSize;

  void main() {
    vWorld = (uv - 0.5) * uWorldSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vWorld;
  uniform vec3 uGround;
  uniform vec3 uEdge;
  uniform vec2 uWorldSize;

  void main() {
    vec2 halfSize = uWorldSize * 0.5;
    vec2 edge = abs(abs(vWorld) - halfSize);
    vec2 edgeWidth = max(fwidth(vWorld) * 1.5, vec2(0.0001));
    float border = 1.0 - min(min(edge.x / edgeWidth.x, edge.y / edgeWidth.y), 1.0);

    gl_FragColor = vec4(mix(uGround, uEdge, clamp(border, 0.0, 1.0)), 1.0);
  }
`

/** Flat world floor with a subtle outline around the world's edge. */
export class GroundPass {
  public readonly mesh: THREE.Mesh
  private readonly geometry: THREE.PlaneGeometry
  private readonly material: THREE.ShaderMaterial

  public constructor() {
    this.geometry = new THREE.PlaneGeometry(WORLD.width, WORLD.height)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uWorldSize: { value: new THREE.Vector2(WORLD.width, WORLD.height) },
        uGround: { value: new THREE.Color(GROUND_COLOR) },
        uEdge: { value: new THREE.Color(WORLD_EDGE_COLOR) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.position.set(WORLD.width / 2, WORLD.height / 2, -1)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 0
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
