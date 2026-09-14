import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { GroundIncident } from '../game/incidents'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { disposeChildren } from './disposeObject3D'

const LITTER_COLORS = [0x7a6238, 0x4a4030, 0x5c4a28] as const

export function litterGroundOffset(
  id: string,
  index: number,
): { x: number; z: number; yaw: number } {
  let hash = 2166136261
  const text = `${id}:${index}`
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  }
  hash = hash >>> 0
  const angle = index * 2.399 + ((hash & 255) / 255) * 0.9
  const radius = Math.min(
    0.38,
    0.05 + index * 0.042 + ((hash >>> 8) & 31) * 0.007,
  )
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    yaw: ((hash >>> 16) & 255) / 255 * Math.PI * 2,
  }
}

export class IncidentView {
  readonly group = new Group()
  private readonly batches = new Map<string, InstancedMesh>()
  private fingerprint = ''
  private readonly matrix = new Matrix4()
  private readonly color = new Color()
  private readonly scale = new Vector3()

  invalidate(): void {
    disposeChildren(this.group)
    this.batches.clear()
    this.fingerprint = ''
  }

  update(incidents: readonly GroundIncident[]): void {
    let fingerprint = ''
    let litterCount = 0, vomitCount = 0, fireCount = 0
    for (const incident of incidents) {
      const pieces = this.pieceCount(incident)
      fingerprint += `${incident.id}:${incident.kind}:${pieces}:${incident.x}:${incident.z}:${incident.elevation}|`
      if (incident.kind === 'litter') litterCount += pieces
      else if (incident.kind === 'vomit') vomitCount += pieces
      else fireCount++
    }
    const changed = fingerprint !== this.fingerprint
    if (!changed && fireCount === 0) return
    this.fingerprint = fingerprint
    const litter = this.batch('litter', litterCount, () => new BoxGeometry(1, 1, 1), () => new MeshStandardMaterial({ roughness: 1 }))
    const vomit = this.batch('vomit', vomitCount, () => new CircleGeometry(1, 10), () => new MeshStandardMaterial({ color: 0x8da642, roughness: 1 }))
    const outer = this.batch('fire-outer', fireCount, () => new ConeGeometry(0.16, 0.46, 8), () => new MeshBasicMaterial({ color: 0xff5a1f }))
    const inner = this.batch('fire-inner', fireCount, () => new ConeGeometry(0.08, 0.3, 8), () => new MeshBasicMaterial({ color: 0xffe45e }))
    let litterIndex = 0, vomitIndex = 0, fireIndex = 0
    const phase = performance.now() * 0.006
    for (const incident of incidents) {
      const pieces = this.pieceCount(incident)
      if (incident.kind === 'fire') {
        const scale = 0.82 + Math.sin(phase + fireIndex) * 0.18
        this.matrix.makeScale(1, scale, 1)
        this.matrix.setPosition(incident.x + 0.5, incident.elevation + 0.035 + 0.23 * scale, incident.z + 0.5)
        outer!.setMatrixAt(fireIndex, this.matrix)
        this.matrix.setPosition(incident.x + 0.5, incident.elevation + 0.035 + 0.18 * scale, incident.z + 0.5)
        inner!.setMatrixAt(fireIndex, this.matrix)
        outer!.userData.incidentIds[fireIndex] = inner!.userData.incidentIds[fireIndex] = incident.id
        fireIndex++
      } else if (changed && incident.kind === 'litter') {
        for (let index = 0; index < pieces; index++) {
          const { x, z, yaw } = litterGroundOffset(incident.id, index)
          const hash = Math.abs((incident.id.charCodeAt(index % incident.id.length) ?? 0) + index * 17)
          const width = 0.09 + (hash % 5) * 0.008, depth = 0.07 + ((hash >> 2) % 4) * 0.008
          // The same boxes, rotations, offsets and colors as the merged piles.
          const c = Math.cos(yaw), s = Math.sin(yaw)
          this.matrix.set(c * width, 0, s * depth, incident.x + 0.5 + x,
            0, 0.045, 0, incident.elevation + 0.052,
            -s * width, 0, c * depth, incident.z + 0.5 + z,
            0, 0, 0, 1)
          litter!.setMatrixAt(litterIndex, this.matrix)
          litter!.setColorAt(litterIndex, this.color.setHex(LITTER_COLORS[index % LITTER_COLORS.length]!))
          litter!.userData.incidentIds[litterIndex++] = incident.id
        }
      } else if (changed && incident.kind === 'vomit') {
        const offset = this.getGroundOffset(incident.id)
        for (let index = 0; index < pieces; index++) {
          const angle = index * 2.399, distance = 0.03 + (index % 4) * 0.035
          const radius = 0.07 + (index % 3) * 0.025
          this.matrix.makeRotationX(-Math.PI / 2)
          this.matrix.scale(this.scale.set(radius, radius, 1))
          this.matrix.setPosition(incident.x + 0.5 + offset.x + Math.cos(angle) * distance,
            incident.elevation + 0.095, incident.z + 0.5 + offset.z + Math.sin(angle) * distance)
          vomit!.setMatrixAt(vomitIndex, this.matrix)
          vomit!.userData.incidentIds[vomitIndex++] = incident.id
        }
      }
    }
    if (changed) { this.markUpdated(litter); this.markUpdated(vomit) }
    this.markUpdated(outer); this.markUpdated(inner)
  }

  private pieceCount(incident: GroundIncident): number {
    return incident.kind === 'litter'
      ? Math.max(1, Math.min(SIMULATION_CONFIG.incidents.maximumSeverityPerCell, Math.round(incident.severity)))
      : incident.kind === 'vomit' ? Math.min(10, 2 + Math.ceil(incident.severity)) : 1
  }

  private batch(name: string, count: number, geometry: () => BufferGeometry, material: () => Material): InstancedMesh | undefined {
    let batch = this.batches.get(name)
    if (!batch && count === 0) return undefined
    if (!batch || batch.instanceMatrix.count < count) {
      const old = batch
      batch = new InstancedMesh(old?.geometry ?? geometry(), old?.material ?? material(), Math.max(16, 2 ** Math.ceil(Math.log2(count))))
      batch.name = name
      batch.frustumCulled = false
      batch.userData.incidentIds = []
      if (old) { this.group.remove(old); old.dispose() }
      this.batches.set(name, batch)
      this.group.add(batch)
    }
    batch.count = count
    batch.userData.incidentIds.length = count
    return batch
  }

  private markUpdated(batch: InstancedMesh | undefined): void {
    if (!batch) return
    batch.instanceMatrix.needsUpdate = true
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true
    batch.boundingBox = null
    batch.boundingSphere = null
  }

  private getGroundOffset(id: string): { x: number; z: number } {
    let hash = 0
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash * 31 + id.charCodeAt(index)) | 0
    }
    const angle = ((Math.abs(hash) % 360) / 180) * Math.PI
    const radius = 0.08 + (Math.abs(hash >> 8) % 14) / 100
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  }

}
