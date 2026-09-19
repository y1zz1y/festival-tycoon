import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three'
import type { GameSnapshot } from '../game/GameState'
import { disposeChildren } from './disposeObject3D'

const BEAM_COLORS = [0x2ee6a6, 0x38bdf8, 0xc77dff, 0xff4fc3]
const beamGeometry = new PlaneGeometry(0.045, 7.2)
beamGeometry.translate(0, 3.6, 0)
beamGeometry.userData.shared = true
const beamMaterials = BEAM_COLORS.map((color) => {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  })
  material.userData.shared = true
  return material
})

export class LaserView {
  readonly group = new Group()
  private fingerprint = ''
  private batches: InstancedMesh[] = []
  private sources: Array<{ x: number; y: number; z: number }> = []
  private readonly pose = new Object3D()

  invalidate(): void {
    this.fingerprint = ''
  }

  update(snapshot: Readonly<GameSnapshot>, performing: boolean): void {
    const powered = new Set(snapshot.power.poweredBuildingIds)
    const lasers = snapshot.buildings.filter(
      (building) => building.kind === 'laserShow' && powered.has(building.id),
    )
    const fingerprint = `${performing}:${lasers.map((laser) => laser.id).join(',')}`
    if (fingerprint !== this.fingerprint) {
      this.fingerprint = fingerprint
      disposeChildren(this.group)
      this.batches = []
      this.sources = lasers.map((laser) => ({
        x: laser.x + 0.5,
        y: laser.elevation + 0.68,
        z: laser.z + 0.5,
      }))
      if (performing) {
        beamMaterials.forEach((material) => {
          const batch = new InstancedMesh(
            beamGeometry,
            material,
            Math.max(1, this.sources.length),
          )
          batch.count = this.sources.length
          batch.instanceMatrix.setUsage(DynamicDrawUsage)
          batch.frustumCulled = false
          this.batches.push(batch)
          this.group.add(batch)
        })
      }
    }
    if (!performing) return
    const time = snapshot.minute * 0.08
    this.batches.forEach((batch, colorIndex) => {
      this.sources.forEach((source, sourceIndex) => {
        this.pose.position.set(source.x, source.y, source.z)
        this.pose.rotation.set(
          -0.78 + Math.sin(time * 1.4 + sourceIndex * 0.7) * 0.16,
          time * (0.4 + colorIndex * 0.18) + sourceIndex * 1.37,
          (colorIndex / BEAM_COLORS.length) * Math.PI - 0.4,
        )
        this.pose.updateMatrix()
        batch.setMatrixAt(sourceIndex, this.pose.matrix)
      })
      batch.instanceMatrix.needsUpdate = true
    })
  }
}
