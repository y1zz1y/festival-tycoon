import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from 'three'
import { SHIRT_STYLES, type ShirtStyle } from '../game/shopGoods'
import { ModelKit } from './retroBuildings'

const partCache = new Map<string, BufferGeometry>()

/** Shared plush: one mesh, instance color tints the body. Eyes stay dark via vertex color. */
export function createMascotGeometry(): BufferGeometry {
  const cached = partCache.get('mascot')
  if (cached) return cached
  const k = new ModelKit()
  const fur = 0xffffff
  const dark = 0x2a2422
  k.box(0, 0.038, 0.01, 0.068, 0.072, 0.058, fur)
  for (const x of [-0.026, 0.026]) k.box(x, 0.078, -0.002, 0.02, 0.018, 0.018, fur)
  for (const x of [-0.016, 0.016]) k.box(x, 0.048, 0.036, 0.01, 0.01, 0.006, dark)
  k.box(0, 0.038, 0.04, 0.012, 0.01, 0.008, dark)
  for (const x of [-0.036, 0.036]) k.box(x, 0.01, 0.01, 0.016, 0.02, 0.016, fur)
  const geometry = k.finish()
  partCache.set('mascot', geometry)
  return geometry
}

/** Torso overlays tinted by instance color. One shared mesh per cut. */
export function createShirtStyleGeometry(style: ShirtStyle): BufferGeometry {
  const cached = partCache.get(`shirt:${style}`)
  if (cached) return cached
  const k = new ModelKit()
  const cloth = 0xffffff
  if (style === 'tank') {
    k.box(0, 0.46, 0.062, 0.12, 0.028, 0.018, cloth)
    for (const x of [-0.09, 0.09]) k.box(x, 0.438, 0.01, 0.02, 0.07, 0.09, cloth)
  } else if (style === 'hoodie') {
    k.box(0, 0.58, -0.055, 0.12, 0.07, 0.05, cloth)
    k.box(0, 0.63, -0.02, 0.1, 0.04, 0.08, cloth)
    k.box(0, 0.42, 0.068, 0.05, 0.08, 0.016, cloth)
    k.box(0, 0.36, 0.07, 0.036, 0.05, 0.014, cloth)
  } else if (style === 'polo') {
    k.box(0, 0.5, 0.058, 0.09, 0.02, 0.03, cloth)
    for (const x of [-0.03, 0.03]) k.box(x, 0.518, 0.05, 0.04, 0.028, 0.04, cloth)
    k.box(0, 0.47, 0.064, 0.018, 0.04, 0.01, cloth)
  } else {
    k.box(0, 0.498, 0.06, 0.1, 0.02, 0.02, cloth)
    k.box(0, 0.318, 0.056, 0.14, 0.016, 0.018, cloth)
  }
  const geometry = k.finish()
  partCache.set(`shirt:${style}`, geometry)
  return geometry
}

const MASCOT_TINTS = [0xe8a07a, 0x7ec8c4, 0xf2d36b] as const

export class SouvenirPropsView {
  readonly group = new Group()
  private mascot: InstancedMesh | null = null
  private shirts = new Map<ShirtStyle, InstancedMesh>()
  private capacity = 0
  private mascotMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
  })
  private shirtMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
  })
  private color = new Color()

  begin(count: number): void {
    if (count > this.capacity) {
      this.capacity = Math.max(32, count, this.capacity * 2)
      this.rebuild()
    }
    if (this.mascot) this.mascot.count = 0
    for (const mesh of this.shirts.values()) mesh.count = 0
  }

  placeMascot(matrix: Matrix4, variant: number): void {
    const mesh = this.mascot
    if (!mesh) return
    const index = mesh.count
    mesh.setMatrixAt(index, matrix)
    this.color.setHex(MASCOT_TINTS[Math.max(0, variant - 1) % MASCOT_TINTS.length]!)
    mesh.setColorAt(index, this.color)
    mesh.count = index + 1
  }

  placeShirt(style: ShirtStyle, matrix: Matrix4, color: number): void {
    const mesh = this.shirts.get(style)
    if (!mesh) return
    const index = mesh.count
    mesh.setMatrixAt(index, matrix)
    this.color.setHex(color)
    mesh.setColorAt(index, this.color)
    mesh.count = index + 1
  }

  finish(): void {
    if (this.mascot) {
      this.mascot.instanceMatrix.needsUpdate = true
      if (this.mascot.instanceColor) this.mascot.instanceColor.needsUpdate = true
    }
    for (const mesh of this.shirts.values()) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }

  get batchCount(): number {
    return (this.mascot ? 1 : 0) + this.shirts.size
  }

  private rebuild(): void {
    if (this.mascot) {
      this.group.remove(this.mascot)
      this.mascot.dispose()
    }
    for (const mesh of this.shirts.values()) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    this.shirts.clear()
    this.mascot = this.createBatch(createMascotGeometry(), this.mascotMaterial)
    this.group.add(this.mascot)
    for (const style of SHIRT_STYLES) {
      const mesh = this.createBatch(createShirtStyleGeometry(style), this.shirtMaterial)
      this.shirts.set(style, mesh)
      this.group.add(mesh)
    }
  }

  private createBatch(geometry: BufferGeometry, material: MeshStandardMaterial): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, this.capacity)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3)
    mesh.instanceColor.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.castShadow = false
    return mesh
  }
}
