import { Group, Matrix4, PlaneGeometry } from 'three'
import type { StageForecourtCell } from '../game/festivalAreas'
import { InstanceBatch } from './instanceBatch'
import { overlayMaterial } from './materials'

const tileGeometry = new PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2)
tileGeometry.userData.shared = true

/**
 * The purple floor in front of every stage: one instanced overlay for all cells,
 * like the medical and backstage areas. Rewritten only when a cell appears, goes or
 * changes height.
 */
export class ForecourtView {
  readonly group = new Group()
  private fingerprint = ''
  private readonly tiles = new InstanceBatch(this.group, tileGeometry, overlayMaterial(0x70518e, 0.58), {
    receiveShadow: true,
    name: 'stageForecourt',
  })
  private readonly matrix = new Matrix4()

  invalidate(): void {
    this.fingerprint = ''
  }

  update(cells: readonly StageForecourtCell[]): void {
    const fingerprint = cells.map((cell) => `${cell.x}:${cell.z}:${cell.elevation}`).join('|')
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    this.tiles.begin()
    for (const cell of cells) {
      this.tiles.add(this.matrix.makeTranslation(cell.x + 0.5, cell.elevation + 0.02, cell.z + 0.5))
    }
    this.tiles.finish()
  }
}
