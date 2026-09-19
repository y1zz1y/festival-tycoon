import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three'
import type { Attraction } from '../game/attractions/types'
import { disposeObject3D } from './disposeObject3D'

const segmentGeometry = new BoxGeometry(0.34, 0.16, 1)
const areaGeometry = new BoxGeometry(0.96, 0.06, 0.96)
const referenceGeometry = new BoxGeometry(0.5, 0.5, 0.5)
const scriptedGeometry = new BoxGeometry(0.8, 1, 0.8)
for (const geometry of [segmentGeometry, areaGeometry, referenceGeometry, scriptedGeometry]) {
  geometry.userData.shared = true
}

const trackMaterial = sharedMaterial(0xb56d32)
const areaMaterial = sharedMaterial(0x4d8e52)
const referenceMaterial = sharedMaterial(0x476b89)
const scriptedMaterial = sharedMaterial(0xe4af39)
const up = new Vector3(0, 0, 1)

export class AttractionView {
  readonly group = new Group()
  private signature = ''

  update(attractions: readonly Attraction[], legacyIds: ReadonlySet<string> = new Set()): void {
    const visible = attractions.filter((attraction) => !legacyIds.has(attraction.id))
    const signature = JSON.stringify(visible.map((attraction) => [
      attraction.id,
      attraction.definitionId,
      attraction.layout,
      attraction.access,
    ]))
    if (signature === this.signature) return
    this.signature = signature
    disposeObject3D(this.group)
    this.group.clear()

    const segmentInstances: InstanceTransform[] = []
    const areaInstances: InstanceTransform[] = []
    const referenceInstances: InstanceTransform[] = []
    const scriptedInstances: InstanceTransform[] = []

    visible.forEach((attraction) => {
      if (attraction.layout.kind === 'track') {
        const layout = attraction.layout
        layout.graph.edges.forEach((edge) => {
          for (let index = 1; index < edge.points.length; index += 1) {
            const from = edge.points[index - 1]
            const to = edge.points[index]
            const start = new Vector3(from.x, from.elevation + 0.12, from.z)
            const end = new Vector3(to.x, to.elevation + 0.12, to.z)
            const delta = end.clone().sub(start)
            if (delta.lengthSq() < 0.0001) continue
            segmentInstances.push({
              attractionId: attraction.id,
              position: start.clone().add(end).multiplyScalar(0.5),
              rotation: new Quaternion().setFromUnitVectors(up, delta.clone().normalize()),
              scale: new Vector3(1, layout.agentKind === 'vehicle' ? 1.8 : 1, delta.length()),
            })
          }
        })
      } else if (attraction.layout.kind === 'area') {
        const layout = attraction.layout
        layout.cells.forEach((cell) => {
          areaInstances.push({
            attractionId: attraction.id,
            position: new Vector3(cell.x + 0.5, cell.elevation + 0.03, cell.z + 0.5),
            rotation: new Quaternion(),
            scale: new Vector3(1, 1, 1),
          })
        })
        layout.references.forEach((reference) => {
          referenceInstances.push({
            attractionId: attraction.id,
            position: new Vector3(reference.x + 0.5, reference.elevation + 0.3, reference.z + 0.5),
            rotation: new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              reference.rotation * Math.PI / 2,
            ),
            scale: referenceScale(reference.kind),
          })
        })
      } else {
        const layout = attraction.layout
        layout.segments.forEach((segment) => {
          scriptedInstances.push({
            attractionId: attraction.id,
            position: new Vector3(
              layout.anchor.x + 0.5,
              layout.anchor.elevation + segment.level + 0.5,
              layout.anchor.z + 0.5,
            ),
            rotation: new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              layout.rotation * Math.PI / 2,
            ),
            scale: new Vector3(1, 1, 1),
          })
        })
      }
    })

    this.addInstances(segmentGeometry, trackMaterial, segmentInstances)
    this.addInstances(areaGeometry, areaMaterial, areaInstances)
    this.addInstances(referenceGeometry, referenceMaterial, referenceInstances)
    this.addInstances(scriptedGeometry, scriptedMaterial, scriptedInstances)
  }

  pickRoot(): Object3D {
    return this.group
  }

  private addInstances(
    geometry: BoxGeometry,
    material: MeshStandardMaterial,
    transforms: readonly InstanceTransform[],
  ): void {
    if (transforms.length === 0) return
    const mesh = new InstancedMesh(geometry, material, transforms.length)
    const matrix = new Matrix4()
    transforms.forEach((transform, index) => {
      matrix.compose(transform.position, transform.rotation, transform.scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.userData.buildingIds = transforms.map((transform) => transform.attractionId)
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
  }
}

type InstanceTransform = {
  attractionId: string
  position: Vector3
  rotation: Quaternion
  scale: Vector3
}

function sharedMaterial(color: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.75,
    metalness: 0.05,
  })
  material.userData.shared = true
  return material
}

function referenceScale(kind: string): Vector3 {
  if (kind === 'water') return new Vector3(1.7, 0.08, 1.7)
  if (kind === 'cover') return new Vector3(1.4, 0.8, 0.5)
  if (kind.includes('Start')) return new Vector3(1.3, 0.08, 1.3)
  if (kind === 'tree') return new Vector3(0.7, 3, 0.7)
  return new Vector3(1, 1, 1)
}
