import {
  Group,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import type { GameSnapshot } from '../game/GameState'
import { HOUSE_MATERIAL, overlayMaterial } from './materials'
import { ModelKit } from './retroBuildings'
import { IconBillboards } from './spriteAtlas'

const tileGeometry = new PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2)
tileGeometry.userData.shared = true

/** A white cot with its pillow. */
function bedGeometry(): BufferGeometry {
  const k = new ModelKit()
  k.box(0, 0.12, 0, 0.24, 0.07, 0.72, 0xf2f4ef)
  k.box(0, 0.18, -0.24, 0.18, 0.045, 0.16, 0xffffff)
  for (const x of [-0.1, 0.1]) for (const z of [-0.32, 0.32]) k.box(x, 0.045, z, 0.025, 0.09, 0.025, 0x9aa4a8)
  return k.finish()
}

/** Whoever lies in it: a blanket and a head on the pillow. */
function patientGeometry(): BufferGeometry {
  const k = new ModelKit()
  k.box(0, 0.2, 0.06, 0.13, 0.08, 0.46, 0x7094c7)
  k.box(0, 0.215, -0.23, 0.1, 0.07, 0.1, 0xe0b48a)
  return k.finish()
}

/**
 * The medical area: a pale tile per cell, a cot per slot, a patient in every occupied
 * cot and the sleep symbol over them. Three instanced batches and one billboard batch
 * however many beds there are; when occupants change, only instances are rewritten.
 */
export class MedicalView {
  readonly group = new Group()
  private fingerprint = ''
  private readonly bed = bedGeometry()
  private readonly patient = patientGeometry()
  private tiles: InstancedMesh | null = null
  private beds: InstancedMesh | null = null
  private patients: InstancedMesh | null = null
  private readonly sleep = new IconBillboards('zzz', 0.3)

  constructor() {
    this.group.add(this.sleep.mesh)
  }

  invalidate(): void {
    this.fingerprint = ''
  }

  update(snapshot: Readonly<GameSnapshot>): void {
    const fingerprint = snapshot.medicalCells
      .map((cell) => `${cell.x}:${cell.z}:${cell.elevation}:${cell.occupants.join(',')}`)
      .join('|')
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    const tiles: Matrix4[] = [], beds: Matrix4[] = [], patients: Matrix4[] = [], sleepers: Vector3[] = []
    for (const cell of snapshot.medicalCells) {
      tiles.push(new Matrix4().makeTranslation(cell.x + 0.5, cell.elevation + 0.018, cell.z + 0.5))
      cell.occupants.forEach((occupant, slot) => {
        const x = cell.x + 0.2 + slot * 0.3, z = cell.z + 0.5
        beds.push(new Matrix4().makeTranslation(x, cell.elevation, z))
        if (!occupant) return
        patients.push(new Matrix4().makeTranslation(x, cell.elevation, z))
        sleepers.push(new Vector3(x + 0.08, cell.elevation + 0.47, z - 0.18))
      })
    }
    this.tiles = this.fill(this.tiles, tileGeometry, overlayMaterial(0xb9e4ee, 0.72), tiles, false)
    this.beds = this.fill(this.beds, this.bed, HOUSE_MATERIAL, beds, true)
    this.patients = this.fill(this.patients, this.patient, HOUSE_MATERIAL, patients, true)
    this.sleep.setPositions(sleepers)
  }

  private fill(
    current: InstancedMesh | null,
    geometry: BufferGeometry,
    material: Material,
    matrices: readonly Matrix4[],
    castShadow: boolean,
  ): InstancedMesh {
    let batch = current
    if (!batch || batch.instanceMatrix.count < matrices.length) {
      if (batch) {
        this.group.remove(batch)
        batch.dispose()
      }
      batch = new InstancedMesh(geometry, material, Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, matrices.length)))))
      batch.frustumCulled = false
      batch.castShadow = castShadow
      batch.receiveShadow = true
      this.group.add(batch)
    }
    matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix))
    batch.count = matrices.length
    batch.instanceMatrix.needsUpdate = true
    return batch
  }
}
