import { isScenery, sceneryTransform } from '../game/scenery'
import { occupiesBuildingCell } from '../game/stageDesign'
import type { PlacedBuilding } from '../game/GameState'

export type PickedCell = {
  x: number
  z: number
  localX?: number
  localZ?: number
  buildingId?: string
}

export type MeshPickHit = {
  buildingId?: string
  accessId?: string
  instanceId?: number
  buildingIds?: ReadonlyArray<string | undefined>
  x: number
  z: number
}

type UserDataHolder = {
  userData?: { buildingId?: unknown; buildingIds?: unknown; accessId?: unknown }
  parent?: UserDataHolder | null
}

export function cellFromWorldPoint(x: number, z: number): PickedCell {
  const cellX = Math.floor(x)
  const cellZ = Math.floor(z)
  return { x: cellX, z: cellZ, localX: x - cellX, localZ: z - cellZ }
}

export function buildingIdFromUserData(
  userData: { buildingId?: unknown; buildingIds?: unknown } | undefined,
  instanceId?: number,
): string | undefined {
  if (typeof instanceId === 'number' && Array.isArray(userData?.buildingIds)) {
    const id = userData.buildingIds[instanceId]
    return typeof id === 'string' ? id : undefined
  }
  return typeof userData?.buildingId === 'string' ? userData.buildingId : undefined
}

export function buildingIdFromObject(
  object: UserDataHolder | null | undefined,
  instanceId?: number,
): string | undefined {
  let current = object
  let index = instanceId
  while (current) {
    const id = buildingIdFromUserData(current.userData, index)
    if (id) return id
    index = undefined
    current = current.parent
  }
  return undefined
}

export function accessIdFromObject(object: UserDataHolder | null | undefined): string | undefined {
  let current = object
  while (current) {
    if (typeof current.userData?.accessId === 'string') return current.userData.accessId
    current = current.parent
  }
  return undefined
}

function isRideAccessCell(building: PlacedBuilding, x: number, z: number): boolean {
  const entrance = building.rideEntrance
  const exit = building.rideExit
  return (
    (entrance?.x === x && entrance?.z === z) || (exit?.x === x && exit?.z === z)
  )
}

export function resolvePickedBuilding(
  buildings: readonly PlacedBuilding[],
  buildingId: string,
  hitX?: number,
  hitZ?: number,
): PickedCell | null {
  const building = buildings.find((item) => item.id === buildingId)
  if (!building) return null
  const slot = isScenery(building.kind) ? sceneryTransform(building) : { x: 0.5, z: 0.5 }
  if (hitX === undefined || hitZ === undefined) {
    return {
      x: building.x,
      z: building.z,
      localX: slot.x,
      localZ: slot.z,
      buildingId: building.id,
    }
  }
  const cell = cellFromWorldPoint(hitX, hitZ)
  if (
    occupiesBuildingCell(building, cell.x, cell.z) ||
    isRideAccessCell(building, cell.x, cell.z)
  ) {
    return {
      x: cell.x,
      z: cell.z,
      localX: occupiesBuildingCell(building, cell.x, cell.z) ? slot.x : cell.localX,
      localZ: occupiesBuildingCell(building, cell.x, cell.z) ? slot.z : cell.localZ,
      buildingId: building.id,
    }
  }
  return {
    x: building.x,
    z: building.z,
    localX: slot.x,
    localZ: slot.z,
    buildingId: building.id,
  }
}

/** First ray hit wins. Unlabeled meshes (road, parking) stop the search so a building behind them is not chosen. */
export function resolveMeshPick(
  buildings: readonly PlacedBuilding[],
  hits: readonly MeshPickHit[],
): PickedCell | null {
  for (const hit of hits) {
    if (hit.accessId) return cellFromWorldPoint(hit.x, hit.z)
    const id =
      hit.buildingId ??
      (typeof hit.instanceId === 'number' ? hit.buildingIds?.[hit.instanceId] : undefined)
    if (typeof id === 'string') {
      const picked = resolvePickedBuilding(buildings, id, hit.x, hit.z)
      if (picked) return picked
    }
    return cellFromWorldPoint(hit.x, hit.z)
  }
  return null
}
