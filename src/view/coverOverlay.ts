import { BoxGeometry, Group, InstancedMesh, Matrix4 } from 'three'
import { campingBoundary } from './campingGround'
import { disposeObject3D } from './disposeObject3D'
import { AREA_EDGE_MATERIAL } from './materials'

export type AreaEdgeCell = { x: number; z: number; y: number }

export const AREA_EDGE_COLOR = 0xc4bba0

const curbGeometry = new BoxGeometry(0.34, 0.07, 0.065)
curbGeometry.userData.shared = true

function nextCapacity(needed: number): number {
  return Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(needed, 1))))
}

/** One instanced stone curb family for the exterior of a designated area. Interior stays open. */
export class AreaEdgeBatch {
  readonly group = new Group()
  private batch: InstancedMesh | null = null
  private readonly matrix = new Matrix4()

  clear(): void {
    if (!this.batch) return
    this.group.remove(this.batch)
    disposeObject3D(this.batch)
    this.batch = null
  }

  update(cells: readonly AreaEdgeCell[]): void {
    const heights = new Map<string, number>()
    for (const cell of cells) heights.set(`${cell.x},${cell.z}`, cell.y)
    const edges = campingBoundary(cells)
    const count = edges.length * 2
    if (count === 0) {
      this.clear()
      return
    }
    if (!this.batch || this.batch.instanceMatrix.count < count) {
      this.clear()
      this.batch = new InstancedMesh(curbGeometry, AREA_EDGE_MATERIAL, nextCapacity(count))
      this.batch.frustumCulled = false
      this.batch.userData.areaEdge = true
      this.group.add(this.batch)
    }
    let at = 0
    for (const edge of edges) {
      const y = (heights.get(`${edge.x},${edge.z}`) ?? 0) + 0.045
      for (const offset of [-0.28, 0.28]) {
        const angle = (edge.direction * Math.PI) / 2
        this.matrix.makeRotationY(angle)
        this.matrix.setPosition(
          edge.x + 0.5 + Math.sin(angle) * 0.47 + Math.cos(angle) * offset,
          y,
          edge.z + 0.5 + Math.cos(angle) * 0.47 - Math.sin(angle) * offset,
        )
        this.batch.setMatrixAt(at++, this.matrix)
      }
    }
    this.batch.count = count
    this.batch.instanceMatrix.needsUpdate = true
  }
}
