import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import { disposeChildren, disposeObject3D } from './disposeObject3D'

/** One-shot wrapper for previews and asset tests. */
export function batchCampMeshes(source: Group): Group {
  const batches = new CampMeshBatcher()
  batches.update(source)
  return batches.group
}

/** Keep the exact camp parts/colors while retaining their GPU allocations. */
export class CampMeshBatcher {
  readonly group = new Group()
  private readonly batches = new Map<string, InstancedMesh>()
  private readonly geometryKeys = new WeakMap<BufferGeometry, string>()

  clear(): void {
    disposeChildren(this.group)
    this.batches.clear()
  }

  update(source: Group): void {
    source.updateWorldMatrix(true, true)
    const inverse = new Matrix4().copy(source.matrixWorld).invert()
    const buckets = new Map<string, Mesh[]>()
    source.traverse(object => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial) || object.material.map || object.material.transparent) return
      const material = object.material
      let geometryKey = this.geometryKeys.get(object.geometry)
      if (!geometryKey) {
        geometryKey = JSON.stringify([
          (object.geometry as BufferGeometry & { parameters?: unknown }).parameters ?? object.geometry.uuid,
          object.geometry.type,
        ])
        this.geometryKeys.set(object.geometry, geometryKey)
      }
      const key = `${geometryKey}:${material.vertexColors}:${material.side}:${material.roughness}:${material.metalness}:${object.castShadow}`
      let bucket = buckets.get(key)
      if (!bucket) { bucket = []; buckets.set(key, bucket) }
      bucket.push(object)
      object.visible = false
    })
    const transform = new Matrix4()
    for (const [key, parts] of buckets) {
      const first = parts[0]!
      let batch = this.batches.get(key)
      if (!batch || batch.instanceMatrix.count < parts.length) {
        if (batch) { this.group.remove(batch); disposeObject3D(batch) }
        const material = (first.material as MeshStandardMaterial).clone()
        material.color.setHex(0xffffff)
        const capacity = Math.max(16, 2 ** Math.ceil(Math.log2(parts.length)))
        batch = new InstancedMesh(first.geometry.clone(), material, capacity)
        // Batch copies are owned; cached source geometry must never be freed.
        batch.geometry.userData = { ...first.geometry.userData, shared: false }
        material.userData = { ...material.userData, shared: false }
        batch.castShadow = first.castShadow
        batch.frustumCulled = false
        this.batches.set(key, batch)
        this.group.add(batch)
      }
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index]!
        transform.multiplyMatrices(inverse, part.matrixWorld)
        batch.setMatrixAt(index, transform)
        batch.setColorAt(index, (part.material as MeshStandardMaterial).color)
      }
      batch.count = parts.length
      batch.instanceMatrix.needsUpdate = true
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true
      batch.boundingBox = null
      batch.boundingSphere = null
    }
    for (const [key, batch] of this.batches) {
      if (buckets.has(key)) continue
      this.group.remove(batch)
      disposeObject3D(batch)
      this.batches.delete(key)
    }
  }
}
