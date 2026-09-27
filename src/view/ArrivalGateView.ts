import { Group, Mesh, Quaternion, Vector3, type BufferGeometry } from 'three'
import type { GameSnapshot } from '../game/GameState'
import { ENTRANCE_PATH_ID } from '../game/snapshotBootstrap'
import { HOUSE_MATERIAL } from './materials'
import { ModelKit } from './retroBuildings'

/**
 * The arrival gate over the walk-in field (`entrance-path`), where visitors who come
 * without a car appear: two posts, a banner with a walking pictogram on both faces, a
 * flag that reads from far out and chevrons on the ground pointing into the grounds.
 * One merged mesh in the house material (one draw call, no material of its own); it
 * carries the path's building id, so a click on it opens the arrival field.
 */
const timber = 0x6d4a31, banner = 0xd8553a, pictogram = 0xfff4dc, pole = 0xb9c2c2, flag = 0xffc83d, chevron = 0xc9442e

function pictogramOn(kit: ModelKit, z: number): void {
  const tilt = (angle: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle)
  kit.box(0.02, 1.26, z, 0.06, 0.06, 0.02, pictogram)
  kit.box(0, 1.15, z, 0.06, 0.13, 0.02, pictogram)
  kit.box(-0.035, 1.03, z, 0.03, 0.12, 0.02, pictogram, tilt(0.45))
  kit.box(0.04, 1.03, z, 0.03, 0.12, 0.02, pictogram, tilt(-0.45))
  kit.box(-0.04, 1.16, z, 0.03, 0.1, 0.02, pictogram, tilt(-0.6))
  kit.box(0.045, 1.17, z, 0.03, 0.1, 0.02, pictogram, tilt(0.7))
}

/** A flat arrow with its tip towards +z (into the grounds). */
function chevronAt(kit: ModelKit, z: number): void {
  const turn = (angle: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle)
  kit.box(-0.08, 0.07, z, 0.26, 0.025, 0.06, chevron, turn(-Math.PI / 4))
  kit.box(0.08, 0.07, z, 0.26, 0.025, 0.06, chevron, turn(Math.PI / 4))
}

let gateGeometry: BufferGeometry | null = null

/** Built once, facing +z (into the grounds), centred on the tile. */
function arrivalGateGeometry(): BufferGeometry {
  if (gateGeometry) return gateGeometry
  const kit = new ModelKit()
  const gateZ = -0.34
  kit.box(-0.45, 0.72, gateZ, 0.08, 1.44, 0.08, timber)
  kit.box(0.45, 0.72, gateZ, 0.08, 1.44, 0.08, timber)
  kit.box(0, 1.4, gateZ, 1.0, 0.08, 0.1, timber)
  kit.box(0, 1.15, gateZ, 0.72, 0.36, 0.04, banner)
  pictogramOn(kit, gateZ + 0.03)
  pictogramOn(kit, gateZ - 0.03)
  kit.cylinder(0.45, 1.8, gateZ, 0.018, 0.8, pole)
  kit.box(0.6, 2.08, gateZ, 0.28, 0.16, 0.015, flag)
  chevronAt(kit, 0.02)
  chevronAt(kit, 0.3)
  gateGeometry = kit.finish()
  return gateGeometry
}

/** Direction into the grounds from a field on the map edge, as a yaw for a +z model. */
function inwardYaw(x: number, z: number, worldSize: number): number {
  const half = worldSize / 2
  const edges: Array<[number, number]> = [
    [z + half, 0], // north edge: walk towards +z
    [half - 1 - z, Math.PI], // south edge
    [x + half, Math.PI / 2], // west edge: towards +x
    [half - 1 - x, -Math.PI / 2], // east edge
  ]
  return edges.reduce((best, entry) => (entry[0] < best[0] ? entry : best))[1]
}

export class ArrivalGateView {
  readonly group = new Group()
  private readonly mesh = new Mesh(arrivalGateGeometry(), HOUSE_MATERIAL)
  private fingerprint = ''

  constructor() {
    this.group.name = 'arrivalGate'
    this.mesh.castShadow = true
    this.mesh.userData.buildingId = ENTRANCE_PATH_ID
    this.group.add(this.mesh)
    this.group.visible = false
  }

  invalidate(): void {
    this.fingerprint = ''
  }

  update(snapshot: Readonly<GameSnapshot>): void {
    const entrance = snapshot.buildings.find((building) => building.id === ENTRANCE_PATH_ID)
    const worldSize = snapshot.scenario.worldSize
    const fingerprint = entrance ? `${entrance.x}:${entrance.z}:${entrance.elevation}:${worldSize}` : ''
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    this.group.visible = Boolean(entrance)
    if (!entrance) return
    this.mesh.position.set(entrance.x + 0.5, entrance.elevation, entrance.z + 0.5)
    this.mesh.rotation.y = inwardYaw(entrance.x, entrance.z, worldSize)
    this.mesh.updateMatrixWorld(true)
  }
}
