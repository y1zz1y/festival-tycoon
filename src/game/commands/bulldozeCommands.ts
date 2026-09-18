import { groundKey } from '../ground'
import { occupiesBuildingCell } from '../stageDesign'
import type { PlacedBuilding } from '../types/entities'
import type { ActionResult, GameSnapshot } from '../types/snapshot'

type RideAccessHit = {
  building: PlacedBuilding
  type: 'entrance' | 'exit'
}

export type BulldozeCommandContext = {
  state: GameSnapshot
  getRideAccessAt: (x: number, z: number) => RideAccessHit | undefined
  getRemovableCoasterAt: (x: number, z: number) => { id: string } | undefined
  removeCoaster: (id: string) => ActionResult
  clearDesignatedOccupancy: (x: number, z: number) => ActionResult | null
  bulldozeAt: (x: number, z: number, buildingId?: string) => ActionResult
  recalculateQueueDirections: () => void
  invalidateBuildingIndex: () => void
  emit: () => void
}

export function bulldozeCommand(
  context: BulldozeCommandContext,
  x: number,
  z: number,
  buildingId?: string,
): ActionResult {
  const gate = context.getRideAccessAt(x, z)
  if (gate && (!buildingId || gate.building.id === buildingId)) {
    if (
      context.state.visitors.some(
        (visitor) => visitor.targetId === gate.building.id && visitor.state === 'using',
      )
    ) {
      return { ok: false, message: 'Bitte die laufende Fahrt abwarten' }
    }
    delete gate.building[gate.type === 'entrance' ? 'rideEntrance' : 'rideExit']
    context.invalidateBuildingIndex()
    context.recalculateQueueDirections()
    context.emit()
    return { ok: true, message: 'Zugang entfernt' }
  }
  if (!buildingId) {
    const coaster = context.getRemovableCoasterAt(x, z)
    if (coaster) return context.removeCoaster(coaster.id)
  }
  if (
    buildingId &&
    !context.state.buildings.some(
      (building) => building.id === buildingId && occupiesBuildingCell(building, x, z),
    )
  ) {
    const cleared = context.clearDesignatedOccupancy(x, z)
    return cleared ?? { ok: false, message: 'Objekt nicht mehr vorhanden' }
  }
  const result = context.bulldozeAt(x, z, buildingId)
  const ground = context.state.festival.infrastructure.ground[groundKey(x, z)]
  if (result.ok && ground) {
    if (
      !context.state.buildings.some(
        (building) => building.kind === 'path' && building.x === x && building.z === z,
      )
    ) {
      delete ground.footway
    }
    if (
      !context.state.logistics.roadCells.some((road) => road.x === x && road.z === z)
    ) {
      delete ground.roadway
    }
    context.emit()
  }
  return result
}

export function bulldozeAreaCommand(
  cells: ReadonlyArray<{ x: number; z: number }>,
  bulldoze: (x: number, z: number) => ActionResult,
  buildingCountAt: (x: number, z: number) => number,
): ActionResult {
  const unique = new Map(cells.map((cell) => [`${cell.x},${cell.z}`, cell]))
  let removed = 0
  let lastIssue = 'Auf der Fläche gibt es nichts abzureißen'
  for (const cell of unique.values()) {
    const limit = buildingCountAt(cell.x, cell.z) + 1
    for (let index = 0; index < limit; index += 1) {
      const result = bulldoze(cell.x, cell.z)
      if (result.ok) removed += 1
      else {
        if (result.message !== 'Hier gibt es nichts abzureißen') lastIssue = result.message
        break
      }
    }
  }
  return removed > 0
    ? {
        ok: true,
        message: `${removed} ${removed === 1 ? 'Element' : 'Elemente'} entfernt`,
      }
    : { ok: false, message: lastIssue }
}
