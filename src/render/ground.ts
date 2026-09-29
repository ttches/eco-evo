import * as THREE from 'three'
import { WORLD } from '@/engine/config'
import { GRID_COLOR, GROUND_COLOR } from '@/render/palette'

const GRID_SPACING = 64

/** Grid lines fade out as their on-screen spacing shrinks between these, in render px. */
const GRID_FADE = { visible: 16, hidden: 8 } as const

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
  uniform vec3 uGrid;
  uniform vec2 uWorldSize;
  uniform float uSpacing;
  uniform vec2 uFade;

  void main() {
    vec2 coord = vWorld / uSpacing;
    vec2 cellsPerPixel = fwidth(coord);
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / cellsPerPixel;
    float spacingPx = 1.0 / max(cellsPerPixel.x, 0.0001);
    float fade = smoothstep(uFade.y, uFade.x, spacingPx);
    float line = (1.0 - min(min(grid.x, grid.y), 1.0)) * fade;

    vec2 halfSize = uWorldSize * 0.5;
    vec2 edge = abs(abs(vWorld) - halfSize);
    vec2 edgeWidth = max(fwidth(vWorld) * 1.5, vec2(0.0001));
    float border = 1.0 - min(min(edge.x / edgeWidth.x, edge.y / edgeWidth.y), 1.0);

    float amount = clamp(max(line, border), 0.0, 1.0);
    gl_FragColor = vec4(mix(uGround, uGrid, amount), 1.0);
  }
`

/** Flat world floor with a subtle world-space grid and edge outline. */
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
        uGrid: { value: new THREE.Color(GRID_COLOR) },
        uSpacing: { value: GRID_SPACING },
        uFade: { value: new THREE.Vector2(GRID_FADE.visible, GRID_FADE.hidden) },
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
