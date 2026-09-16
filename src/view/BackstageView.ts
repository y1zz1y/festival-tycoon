import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import type { BackstageCell } from '../game/bandSupply'
import { disposeChildren } from './disposeObject3D'

export class BackstageView {
  readonly group = new Group()
  private fingerprint = ''
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly scale = new Vector3(0.96, 1, 0.96)
  private readonly rotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
  )
  private readonly color = new Color()
  private readonly geometry = new PlaneGeometry(1, 1)
  private readonly material = new MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    roughness: 1,
    depthWrite: false,
  })

  constructor() {
    this.geometry.userData.shared = true
    this.material.userData.shared = true
  }

  invalidate(): void {
    this.fingerprint = ''
  }

  update(
    cells: readonly BackstageCell[],
    activeKeys: ReadonlySet<string>,
  ): void {
    const fingerprint = `${cells
      .map((cell) => `${cell.x}:${cell.z}:${cell.elevation}`)
      .join('|')}#${[...activeKeys].sort().join(',')}`
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    disposeChildren(this.group)
    if (cells.length === 0) return
    const tiles = new InstancedMesh(this.geometry, this.material, cells.length)
    tiles.frustumCulled = false
    tiles.receiveShadow = true
    cells.forEach((cell, index) => {
      this.position.set(cell.x + 0.5, cell.elevation + 0.018, cell.z + 0.5)
      this.matrix.compose(this.position, this.rotation, this.scale)
      tiles.setMatrixAt(index, this.matrix)
      tiles.setColorAt(
        index,
        this.color.setHex(activeKeys.has(`${cell.x}:${cell.z}`) ? 0x3d6f7a : 0xb56a2c),
      )
    })
    tiles.instanceMatrix.needsUpdate = true
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true
    this.group.add(tiles)
  }
}
