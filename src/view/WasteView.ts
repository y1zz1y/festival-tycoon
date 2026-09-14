import {
  BoxGeometry,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import type { WasteDumpCell } from '../game/waste'
import type { PlacedBuilding } from '../game/GameState'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { disposeChildren } from './disposeObject3D'

const CARTON_COLORS = [0xc4a15a, 0xa88848, 0xd2b06a] as const
const CARTON_SLOTS = [
  { x: 0.22, z: 0.14, yaw: 0.38, lie: false },
  { x: -0.21, z: 0.16, yaw: -0.82, lie: true },
  { x: 0.18, z: -0.2, yaw: 1.15, lie: false },
  { x: -0.17, z: -0.18, yaw: 0.22, lie: true },
] as const

export function wasteBinFillRatio(stored: number, capacity: number): number {
  if (capacity <= 0) return 0
  return Math.min(1, Math.max(0, stored / capacity))
}

/** Coarse carton piles: empty stays clear, a full bin (12) shows four boxes. */
export function wasteBinCartonCount(
  stored: number,
  capacity = SIMULATION_CONFIG.waste.binCapacity,
): number {
  if (stored <= 0 || capacity <= 0) return 0
  return Math.min(CARTON_SLOTS.length, Math.max(1, Math.ceil((stored / capacity) * CARTON_SLOTS.length)))
}

export function wasteDumpPileCount(stored: number): number {
  return Math.min(8, Math.max(0, Math.ceil(stored / 5)))
}

function markShared(object: { userData: { shared?: boolean } }): void {
  object.userData.shared = true
}

export class WasteView {
  readonly group = new Group()
  private fingerprint = ''
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly scale = new Vector3(1, 1, 1)
  private readonly rotation = new Quaternion()
  private readonly euler = new Euler()
  private readonly tileRotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
  )
  private readonly color = new Color()
  private readonly dumpTileGeometry = new PlaneGeometry(0.94, 0.94)
  private readonly bagGeometry = new BoxGeometry(0.16, 0.12, 0.13)
  private readonly cartonGeometry = new BoxGeometry(0.15, 0.1, 0.12)
  private readonly dumpTileMaterial = new MeshStandardMaterial({
    color: 0x5a4a28,
    transparent: true,
    opacity: 0.78,
    roughness: 1,
  })
  private readonly bagMaterial = new MeshStandardMaterial({ roughness: 1 })
  private readonly cartonMaterial = new MeshStandardMaterial({ roughness: 0.92 })

  constructor() {
    markShared(this.dumpTileGeometry)
    markShared(this.bagGeometry)
    markShared(this.cartonGeometry)
    markShared(this.dumpTileMaterial)
    markShared(this.bagMaterial)
    markShared(this.cartonMaterial)
  }

  invalidate(): void {
    this.fingerprint = ''
  }

  update(
    cells: readonly WasteDumpCell[],
    bins: readonly PlacedBuilding[] = [],
  ): void {
    const fingerprint = [
      ...cells.map((cell) => `${cell.x}:${cell.z}:${cell.stored}`),
      ...bins.map((bin) => `${bin.id}:${bin.wasteFill ?? 0}`),
    ].join('|')
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    disposeChildren(this.group)

    if (cells.length > 0) {
      const tiles = new InstancedMesh(
        this.dumpTileGeometry,
        this.dumpTileMaterial,
        cells.length,
      )
      tiles.frustumCulled = false
      cells.forEach((cell, index) => {
        this.position.set(cell.x + 0.5, cell.elevation + 0.016, cell.z + 0.5)
        this.scale.set(1, 1, 1)
        this.matrix.compose(this.position, this.tileRotation, this.scale)
        tiles.setMatrixAt(index, this.matrix)
      })
      tiles.instanceMatrix.needsUpdate = true
      this.group.add(tiles)
    }

    const dumpBags = cells.flatMap((cell) => {
      const fill = wasteBinFillRatio(cell.stored, SIMULATION_CONFIG.waste.dumpCapacity)
      return Array.from({ length: wasteDumpPileCount(cell.stored) }, (_, index) => {
        const angle = index * 2.2
        return {
          x: cell.x + 0.5 + Math.cos(angle) * 0.22,
          y: cell.elevation + 0.1,
          z: cell.z + 0.5 + Math.sin(angle) * 0.22,
          height: 1 + fill * 0.65,
          yaw: 0,
          lie: false,
          color: index % 2 === 0 ? 0x6b5a32 : 0x3d4a2e,
        }
      })
    })
    this.addBoxes(this.bagGeometry, this.bagMaterial, dumpBags)

    const cartons = bins.flatMap((bin) => {
      const stored = bin.wasteFill ?? 0
      return Array.from({ length: wasteBinCartonCount(stored) }, (_, index) => {
        const slot = CARTON_SLOTS[index]!
        return {
          x: bin.x + 0.5 + slot.x,
          y: bin.elevation + (slot.lie ? 0.06 : 0.05),
          z: bin.z + 0.5 + slot.z,
          height: 1,
          yaw: slot.yaw,
          lie: slot.lie,
          color: CARTON_COLORS[index % CARTON_COLORS.length]!,
        }
      })
    })
    this.addBoxes(this.cartonGeometry, this.cartonMaterial, cartons)
  }

  private addBoxes(
    geometry: BoxGeometry,
    material: MeshStandardMaterial,
    boxes: readonly {
      x: number
      y: number
      z: number
      height: number
      yaw: number
      lie: boolean
      color: number
    }[],
  ): void {
    if (boxes.length === 0) return
    const batch = new InstancedMesh(geometry, material, boxes.length)
    batch.frustumCulled = false
    boxes.forEach((box, index) => {
      this.position.set(box.x, box.y, box.z)
      this.scale.set(1, box.height, 1)
      this.euler.set(box.lie ? Math.PI / 2 : 0, box.yaw, 0)
      this.rotation.setFromEuler(this.euler)
      this.matrix.compose(this.position, this.rotation, this.scale)
      batch.setMatrixAt(index, this.matrix)
      batch.setColorAt(index, this.color.setHex(box.color))
    })
    batch.instanceMatrix.needsUpdate = true
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true
    this.group.add(batch)
  }
}
