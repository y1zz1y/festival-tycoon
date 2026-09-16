import { MeshStandardMaterial, Vector3 } from 'three'

/** View-local uniforms: one material for every facade batch, no per-instance rebuild. */
export class FacadeReveal {
  readonly center = { value: new Vector3() }
  readonly strength = { value: 0 }
  private active = false
  private targetCenter = new Vector3()
  private lastTime: number | undefined
  readonly material: MeshStandardMaterial

  constructor(source: MeshStandardMaterial) {
    this.material = source.clone()
    this.material.userData = { shared: true }
    // Smooth local translucency preserves a faint silhouette for orientation.
    this.material.transparent = true
    this.material.depthWrite = false
    this.material.onBeforeCompile = shader => {
      shader.uniforms.facadeCenter = this.center
      shader.uniforms.facadeStrength = this.strength
      shader.vertexShader = 'varying vec3 facadeWorldPosition;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 facadeWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          facadeWorld = instanceMatrix * facadeWorld;
        #endif
        facadeWorldPosition = (modelMatrix * facadeWorld).xyz;`)
      shader.fragmentShader = 'varying vec3 facadeWorldPosition;\nuniform vec3 facadeCenter;\nuniform float facadeStrength;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphahash_fragment>', `
        float revealArea = 1.0 - smoothstep(1.0, 2.5, distance(facadeWorldPosition.xz, facadeCenter.xz));
        diffuseColor.a *= 1.0 - 0.9 * facadeStrength * revealArea;
        #include <alphahash_fragment>`)
    }
    this.material.customProgramCacheKey = () => 'facade-reveal-v1'
  }
  setTarget(point: Vector3 | null): void {
    if (point) {
      if (!this.active && this.strength.value < .01) this.center.value.copy(point)
      this.targetCenter.copy(point)
    }
    this.active = point !== null
  }
  reset(): void {
    this.active = false
    this.strength.value = 0
    this.material.depthWrite = true
  }
  /** Match the shader's spatial falloff at the actual ray intersection. */
  isClickThrough(point: Vector3): boolean {
    const distance = Math.hypot(point.x - this.center.value.x, point.z - this.center.value.z)
    const t = Math.max(0, Math.min(1, (distance - 1) / 1.5))
    return .9 * this.strength.value * (1 - t * t * (3 - 2 * t)) > .05
  }
  update(time: number): void {
    const dt = this.lastTime === undefined ? 0 : Math.max(0, Math.min(.1, (time - this.lastTime) / 1000))
    this.lastTime = time
    const blend = 1 - Math.exp(-dt * 10)
    this.center.value.lerp(this.targetCenter, blend)
    this.strength.value += ((this.active ? 1 : 0) - this.strength.value) * blend
    if (!this.active && this.strength.value < .001) this.strength.value = 0
    this.material.depthWrite = this.strength.value === 0
  }
}
