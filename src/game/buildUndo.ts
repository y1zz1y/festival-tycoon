import type { ActionResult } from './types/snapshot'

export const MAX_BUILD_UNDO = 40

export type BuildUndoEntry = {
  refund: number
  buildingIds: string[]
  parking: Array<{ x: number; z: number }>
  roads: Array<{ x: number; z: number; elevation?: number }>
  paths: Array<{ x: number; z: number; elevation: number }>
}

export type BuildUndoMarker = {
  money: number
  buildingIds: ReadonlySet<string>
  pathKeys: ReadonlySet<string>
  parkingKeys: ReadonlySet<string>
  roadKeys: ReadonlySet<string>
}

type BuildUndoSnapshot = {
  money: number
  buildings: ReadonlyArray<{ id: string; kind: string; x: number; z: number; elevation: number }>
  logistics: {
    parkingCells: ReadonlyArray<{ x: number; z: number }>
    roadCells: ReadonlyArray<{ x: number; z: number; elevation?: number }>
  }
}

export type BuildUndoHooks = {
  money: () => number
  adjustMoney: (delta: number) => void
  removeBuildingById: (id: string) => boolean
  removeParking: (x: number, z: number) => boolean
  removeRoad: (x: number, z: number, elevation?: number) => boolean
  removePath: (x: number, z: number, elevation: number) => boolean
}

function roadKey(cell: { x: number; z: number; elevation?: number }): string {
  return `${cell.x},${cell.z},${cell.elevation ?? ''}`
}

function pathKey(cell: { x: number; z: number; elevation: number }): string {
  return `${cell.x},${cell.z},${cell.elevation}`
}

export function pushBuildUndo(stack: readonly BuildUndoEntry[], entry: BuildUndoEntry): BuildUndoEntry[] {
  const next = [...stack, entry]
  return next.length > MAX_BUILD_UNDO ? next.slice(next.length - MAX_BUILD_UNDO) : next
}

export function captureBuildMarker(state: BuildUndoSnapshot): BuildUndoMarker {
  return {
    money: state.money,
    buildingIds: new Set(
      state.buildings.filter((building) => building.kind !== 'path').map((building) => building.id),
    ),
    pathKeys: new Set(
      state.buildings
        .filter((building) => building.kind === 'path')
        .map((building) => pathKey(building)),
    ),
    parkingKeys: new Set(state.logistics.parkingCells.map((cell) => `${cell.x},${cell.z}`)),
    roadKeys: new Set(state.logistics.roadCells.map((cell) => roadKey(cell))),
  }
}

export function diffBuildUndo(before: BuildUndoMarker, state: BuildUndoSnapshot): BuildUndoEntry | null {
  const buildingIds = state.buildings
    .filter((building) => building.kind !== 'path' && !before.buildingIds.has(building.id))
    .map((building) => building.id)
  const paths = state.buildings
    .filter((building) => building.kind === 'path' && !before.pathKeys.has(pathKey(building)))
    .map((building) => ({ x: building.x, z: building.z, elevation: building.elevation }))
  const parking = state.logistics.parkingCells
    .filter((cell) => !before.parkingKeys.has(`${cell.x},${cell.z}`))
    .map((cell) => ({ x: cell.x, z: cell.z }))
  const roads = state.logistics.roadCells
    .filter((cell) => !before.roadKeys.has(roadKey(cell)))
    .map((cell) => ({ x: cell.x, z: cell.z, elevation: cell.elevation }))
  if (buildingIds.length + paths.length + parking.length + roads.length === 0) return null
  return {
    refund: Math.max(0, before.money - state.money),
    buildingIds,
    parking,
    roads,
    paths,
  }
}

export function applyBuildUndo(entry: BuildUndoEntry, hooks: BuildUndoHooks): ActionResult {
  const expected =
    entry.buildingIds.length + entry.parking.length + entry.roads.length + entry.paths.length
  if (expected === 0) return { ok: false, message: 'Nichts zum Rückgängigmachen' }
  const moneyBefore = hooks.money()
  let removed = 0
  for (const id of entry.buildingIds) {
    if (hooks.removeBuildingById(id)) removed += 1
  }
  for (const cell of entry.parking) {
    if (hooks.removeParking(cell.x, cell.z)) removed += 1
  }
  for (const cell of entry.roads) {
    if (hooks.removeRoad(cell.x, cell.z, cell.elevation)) removed += 1
  }
  for (const cell of entry.paths) {
    if (hooks.removePath(cell.x, cell.z, cell.elevation)) removed += 1
  }
  if (removed === 0) return { ok: false, message: 'Die Änderung ist schon weg' }
  const desired = Math.round(entry.refund * (removed / expected))
  hooks.adjustMoney(desired - (hooks.money() - moneyBefore))
  return { ok: true, message: 'Letzten Bau zurückgenommen' }
}
