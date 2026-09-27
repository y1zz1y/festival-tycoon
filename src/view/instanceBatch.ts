import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Quaternion,
  Vector3,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three'

export type InstanceBatchOptions = {
  /**
   * Gives every instance a colour (`instanceColor`). A material serves either
   * coloured batches or uncoloured ones, never both, and never a plain Mesh as well:
   * each switch would rebuild its shader program.
   */
  colors?: boolean
  /** The userData key under which the batch keeps one picking id per instance. */
  idKey?: 'staffIds' | 'vehicleIds' | 'accessIds'
  castShadow?: boolean
  receiveShadow?: boolean
  /** The starting capacity, rounded up to a power of two (at least 16). */
  capacity?: number
  name?: string
}

const MIN_CAPACITY = 16
const WHITE = new Color(0xffffff)
const placePosition = new Vector3()
const placeQuaternion = new Quaternion()
const placeScale = new Vector3()
const UP = new Vector3(0, 1, 0)

/** Position, heading about the vertical and an optional build (width, height) as a matrix. */
export function placementMatrix(out: Matrix4, x: number, y: number, z: number, yaw: number, width = 1, height = 1): Matrix4 {
  return out.compose(
    placePosition.set(x, y, z),
    placeQuaternion.setFromAxisAngle(UP, yaw),
    placeScale.set(width, height, width),
  )
}

/** The next power of two that holds `needed` instances, never below 16. */
function instanceCapacity(needed: number): number {
  return Math.max(MIN_CAPACITY, 2 ** Math.ceil(Math.log2(Math.max(1, needed))))
}

function markUsed(attribute: BufferAttribute, floats: number): void {
  attribute.clearUpdateRanges()
  attribute.addUpdateRange(0, floats)
  attribute.needsUpdate = true
}

/**
 * One InstancedMesh refilled from scratch whenever what it shows changes: `begin`
 * empties it, `add` appends an instance (the capacity doubles when it is full),
 * `finish` uploads only the used part and drops the bounding sphere so frustum culling
 * and raycasts recompute it for the new positions. An empty batch is hidden, so the
 * renderer skips it entirely (three would not draw it anyway, but still set up its
 * program); the shader compile at load walks hidden objects too, so views create
 * their batches up front and simply leave them empty. Geometry and material are
 * shared and outlive the batch.
 */
export class InstanceBatch {
  mesh: InstancedMesh
  /** Who each instance belongs to, for picking; also `mesh.userData[idKey]`. */
  readonly ids: Array<string | undefined> = []
  count = 0
  readonly geometry: BufferGeometry
  readonly material: Material
  private readonly parent: Object3D
  private readonly options: InstanceBatchOptions

  constructor(parent: Object3D, geometry: BufferGeometry, material: Material, options: InstanceBatchOptions = {}) {
    this.parent = parent
    this.geometry = geometry
    this.material = material
    this.options = options
    this.mesh = this.create(instanceCapacity(options.capacity ?? MIN_CAPACITY))
    parent.add(this.mesh)
  }

  get capacity(): number {
    return this.mesh.instanceMatrix.count
  }

  begin(): void {
    this.count = 0
  }

  add(matrix: Matrix4, id?: string, color?: Color): number {
    if (this.count >= this.capacity) this.grow()
    const index = this.count++
    this.mesh.setMatrixAt(index, matrix)
    if (this.options.colors) this.mesh.setColorAt(index, color ?? WHITE)
    this.ids[index] = id
    return index
  }

  finish(): void {
    const mesh = this.mesh
    mesh.count = this.count
    this.ids.length = this.count
    if (this.count > 0) {
      markUsed(mesh.instanceMatrix, this.count * 16)
      if (mesh.instanceColor) markUsed(mesh.instanceColor, this.count * 3)
    }
    mesh.visible = this.count > 0
    mesh.boundingSphere = null
    mesh.boundingBox = null
  }

  private create(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    if (this.options.colors) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3)
      mesh.instanceColor.setUsage(DynamicDrawUsage)
    }
    mesh.count = 0
    mesh.visible = false
    mesh.castShadow = this.options.castShadow ?? false
    mesh.receiveShadow = this.options.receiveShadow ?? false
    if (this.options.name) mesh.name = this.options.name
    if (this.options.idKey) mesh.userData[this.options.idKey] = this.ids
    return mesh
  }

  /** Doubles the capacity mid-fill: what is already written moves along. */
  private grow(): void {
    const previous = this.mesh
    const next = this.create(this.capacity * 2)
    ;(next.instanceMatrix.array as Float32Array).set(previous.instanceMatrix.array as Float32Array)
    if (previous.instanceColor && next.instanceColor) {
      ;(next.instanceColor.array as Float32Array).set(previous.instanceColor.array as Float32Array)
    }
    this.parent.remove(previous)
    this.parent.add(next)
    // Releases the old instance buffers; geometry and material are shared.
    previous.dispose()
    this.mesh = next
  }
}
