import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments } from 'three'
import type { PedestrianGraphEdge } from '../game/pedestrianNavigation'
import { disposeObject3D } from './disposeObject3D'

/**
 * Vorübergehende Ersatzfassung: Marvins Commit verweist auf diese View, hat sie aber
 * nicht mitgeschickt; sobald seine Datei kommt, gilt seine.
 *
 * Debug-Overlay des Fußwegegraphen (🐞 → Weggraph): eine LineSegments-Gruppe, nicht
 * `retroStatic`, neu gebaut nur bei geänderter Revision.
 */
const material = new LineBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.85, depthTest: false })
material.userData.shared = true

export class PathGraphView {
  readonly group = new Group()
  private revision = ''

  constructor() {
    this.group.visible = false
    this.group.renderOrder = 20
  }

  invalidate(): void {
    this.revision = ''
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  update(edges: readonly PedestrianGraphEdge[], revision: string): void {
    if (revision === this.revision) return
    this.revision = revision
    for (const child of [...this.group.children]) {
      this.group.remove(child)
      disposeObject3D(child)
    }
    if (edges.length === 0) return
    const positions: number[] = []
    for (const edge of edges) {
      positions.push(edge.from.x + 0.5, 0.12, edge.from.z + 0.5, edge.to.x + 0.5, 0.12, edge.to.z + 0.5)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const lines = new LineSegments(geometry, material)
    lines.frustumCulled = false
    this.group.add(lines)
  }
}
