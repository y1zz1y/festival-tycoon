import { Group } from 'three'
import type { StageForecourtCell } from '../game/festivalAreas'
import type { GameSnapshot } from '../game/GameState'
import { AreaEdgeBatch } from './coverOverlay'

export class ForecourtView {
  readonly group = new Group()
  private readonly edges = new AreaEdgeBatch()
  private fingerprint = ''

  constructor() {
    this.group.add(this.edges.group)
  }

  invalidate(): void {
    this.fingerprint = ''
    this.edges.clear()
  }

  update(_snapshot: Readonly<GameSnapshot>, cells: readonly StageForecourtCell[]): void {
    const fingerprint = cells.map((cell) => `${cell.x}:${cell.z}:${cell.elevation}`).join('|')
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    this.edges.update(cells.map((cell) => ({ x: cell.x, z: cell.z, y: cell.elevation })))
  }
}
