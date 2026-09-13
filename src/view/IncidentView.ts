import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { GroundIncident } from '../game/incidents'
import { SIMULATION_CONFIG } from '../game/simulationConfig'
import { disposeChildren } from './disposeObject3D'

const litterMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
})
litterMaterial.userData.shared = true

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

function colorGeometry(geometry: BufferGeometry, hex: number): BufferGeometry {
  const tint = new Color(hex)
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.deleteAttribute('uv')
  return geometry
}

export class IncidentView {
  readonly group = new Group()
  private fingerprint = ''

  invalidate(): void {
    this.fingerprint = ''
  }

  update(incidents: readonly GroundIncident[]): void {
    const fingerprint = incidents.map((item) => `${item.id}:${item.severity}`).join('|')
    if (fingerprint !== this.fingerprint) {
      this.fingerprint = fingerprint
      disposeChildren(this.group)
      incidents.forEach((incident) => {
        const model =
          incident.kind === 'vomit'
            ? this.createVomit(incident.severity)
            : incident.kind === 'litter'
              ? this.createLitter(incident.id, incident.severity)
              : this.createFire()
        model.name = incident.id
        const offset =
          incident.kind === 'litter' || incident.kind === 'fire'
            ? { x: 0, z: 0 }
            : this.getGroundOffset(incident.id)
        model.position.set(
          incident.x + 0.5 + offset.x,
          incident.elevation +
            (incident.kind === 'vomit'
              ? 0.095
              : incident.kind === 'litter'
                ? 0.03
                : 0.035),
          incident.z + 0.5 + offset.z,
        )
        this.group.add(model)
      })
    }
    const phase = performance.now() * 0.006
    incidents
      .filter((incident) => incident.kind === 'fire')
      .forEach((incident, index) => {
        const model = this.group.getObjectByName(incident.id)
        if (model) model.scale.y = 0.82 + Math.sin(phase + index) * 0.18
      })
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

  private createVomit(severity: number): Group {
    const group = new Group()
    const patchCount = Math.min(10, 2 + Math.ceil(severity))
    Array.from({ length: patchCount }, (_, index) => {
      const angle = index * 2.399
      const distance = 0.03 + (index % 4) * 0.035
      return [
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        0.07 + (index % 3) * 0.025,
      ]
    }).forEach(([x, z, radius]) => {
      const patch = new Mesh(
        new CircleGeometry(radius, 10),
        new MeshStandardMaterial({ color: 0x8da642, roughness: 1 }),
      )
      patch.rotation.x = -Math.PI / 2
      patch.position.set(x, 0, z)
      group.add(patch)
    })
    return group
  }

  private createLitter(id: string, severity: number): Group {
    const group = new Group()
    const count = Math.max(
      1,
      Math.min(
        SIMULATION_CONFIG.incidents.maximumSeverityPerCell,
        Math.round(severity),
      ),
    )
    const parts: BufferGeometry[] = []
    for (let index = 0; index < count; index += 1) {
      const { x, z, yaw } = litterGroundOffset(id, index)
      const hash = Math.abs((id.charCodeAt(index % id.length) ?? 0) + index * 17)
      const width = 0.09 + (hash % 5) * 0.008
      const depth = 0.07 + ((hash >> 2) % 4) * 0.008
      const piece = colorGeometry(
        new BoxGeometry(width, 0.045, depth),
        LITTER_COLORS[index % LITTER_COLORS.length]!,
      )
      piece.rotateY(yaw)
      piece.translate(x, 0.022, z)
      parts.push(piece)
    }
    const merged = mergeGeometries(parts)!
    parts.forEach((part) => part.dispose())
    merged.computeBoundingSphere()
    group.add(new Mesh(merged, litterMaterial))
    return group
  }

  private createFire(): Group {
    const group = new Group()
    const outer = new Mesh(
      new ConeGeometry(0.16, 0.46, 8),
      new MeshBasicMaterial({ color: 0xff5a1f }),
    )
    const inner = new Mesh(
      new ConeGeometry(0.08, 0.3, 8),
      new MeshBasicMaterial({ color: 0xffe45e }),
    )
    outer.position.y = 0.23
    inner.position.y = 0.18
    group.add(outer, inner)
    return group
  }
}
