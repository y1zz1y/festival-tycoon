import { BUILDINGS, type BuildingKind } from './catalog'
import { isEdgeScenery, isLargeScenery, isScenery } from './scenery'
import { SIMULATION_CONFIG } from './simulationConfig'
import { WAY_TYPES, type WayType } from './wayTypes'
import type { Direction } from './logistics'
import { groundKey } from './ground'

type CapturedBuilding = {
  kind: BuildingKind
  x: number
  z: number
  rotation: number
  elevation: number
  decorationSlot?: number
  pathType?: 'normal' | 'queue'
  queueDirection?: number
  wayType?: WayType
  pathSlope?: number
  pathSlopeDirection?: number
  staffOnly?: boolean
  staffGateDirection?: Direction
}

type CaptureSnapshot = {
  buildings: readonly CapturedBuilding[]
  logistics: {
    roadCells: ReadonlyArray<{
      x: number
      z: number
      elevation?: number
      roadSlope?: number
      roadSlopeDirection?: Direction
    }>
    parkingCells?: ReadonlyArray<{ x: number; z: number }>
  }
  festival: { infrastructure: { ground: Record<string, { roadway?: WayType } | undefined> } }
}

/** Kinds that need extra state (ride access, stage design, depot bays). Not copied. */
export const BLUEPRINT_SKIP_KINDS = new Set<string>([
  'ride',
  'stage',
  'ambulanceGarage',
  'busDepot',
  'wasteDepot',
  'specialDepot',
  'busStop',
])

export type BlueprintBuildingItem = {
  type: 'building'
  kind: BuildingKind
  dx: number
  dz: number
  rotation: number
  /** Missing = legacy full-tile scenery. Never invent a quarter/edge slot. */
  decorationSlot?: number
  elevationOffset: number
  pathType?: 'normal' | 'queue'
  queueDirection?: number
  wayType?: WayType
  pathSlope?: number
  pathSlopeDirection?: number
  staffOnly?: boolean
  staffGateDirection?: Direction
}

export type BlueprintRoadItem = {
  type: 'road'
  dx: number
  dz: number
  elevationOffset: number
  slope: number
  slopeDirection: number
  wayType?: WayType
}

export type BlueprintParkingItem = {
  type: 'parking'
  dx: number
  dz: number
}

export type BlueprintTerrainCell = {
  dx: number
  dz: number
  height: number
}

export type BlueprintItem = BlueprintBuildingItem | BlueprintRoadItem | BlueprintParkingItem

export type Blueprint = {
  version: 1
  width: number
  depth: number
  items: BlueprintItem[]
  /** Stored for the library; not applied when stamping. */
  terrain?: BlueprintTerrainCell[]
}

export type BlueprintLibraryEntry = {
  id: string
  name: string
  createdAt: number
  blueprint: Blueprint
}

export type BlueprintGhost = {
  x: number
  z: number
  kind: BuildingKind | 'road' | 'parking'
  rotation: number
  decorationSlot?: number
  elevationOffset: number
  valid: boolean
  isRoad: boolean
  isPath: boolean
  isParking?: boolean
}

export function isBlueprintCopyableKind(kind: string): boolean {
  return !BLUEPRINT_SKIP_KINDS.has(kind) && kind in BUILDINGS
}

export function rotateOffset(dx: number, dz: number, steps: number): { dx: number; dz: number } {
  let x = dx
  let z = dz
  const turns = ((steps % 4) + 4) % 4
  for (let i = 0; i < turns; i++) {
    const nextX = z
    const nextZ = -x
    x = nextX
    z = nextZ
  }
  return { dx: x, dz: z }
}

/** Quarter slots: 0 SW, 1 SE, 2 NW, 3 NE. +1 is 90° CCW around the tile (game Y rotation). */
export function rotateQuarterSlot(slot: number, steps: number): number {
  const map = [2, 0, 3, 1] as const
  let current = slot
  const turns = ((steps % 4) + 4) % 4
  for (let i = 0; i < turns; i++) current = map[current]!
  return current
}

export function rotateEdgeSlot(slot: number, steps: number): number {
  return (((slot + steps) % 4) + 4) % 4
}

export function rotateDecorationSlot(
  kind: string,
  slot: number | undefined,
  steps: number,
): number | undefined {
  if (slot === undefined) return undefined
  if (slot === 4 || isLargeScenery(kind)) return slot
  const turns = ((steps % 4) + 4) % 4
  if (turns === 0) return slot
  if (isEdgeScenery(kind)) return rotateEdgeSlot(slot, turns)
  if (slot >= 0 && slot <= 3) return rotateQuarterSlot(slot, turns)
  return slot
}

export function transformBlueprintItems(items: readonly BlueprintItem[], rotation: number): BlueprintItem[] {
  const turns = ((rotation % 4) + 4) % 4
  return items.map((item) => {
    const offset = rotateOffset(item.dx, item.dz, turns)
    if (item.type === 'road') {
      return {
        ...item,
        dx: offset.dx,
        dz: offset.dz,
        slopeDirection: (item.slopeDirection + turns) % 4,
      }
    }
    if (item.type === 'parking') {
      return { ...item, dx: offset.dx, dz: offset.dz }
    }
    const decorationSlot = rotateDecorationSlot(item.kind, item.decorationSlot, turns)
    const next: BlueprintBuildingItem = {
      ...item,
      dx: offset.dx,
      dz: offset.dz,
      rotation: (item.rotation + turns) % 4,
      pathSlopeDirection:
        item.pathSlopeDirection === undefined ? undefined : (item.pathSlopeDirection + turns) % 4,
      queueDirection: item.queueDirection === undefined ? undefined : (item.queueDirection + turns) % 4,
      staffGateDirection:
        item.staffGateDirection === undefined
          ? undefined
          : (((item.staffGateDirection + turns) % 4) as Direction),
    }
    if (decorationSlot === undefined) delete next.decorationSlot
    else next.decorationSlot = decorationSlot
    return next
  })
}

export function catalogItemCost(item: BlueprintItem): number {
  if (item.type === 'parking') {
    return SIMULATION_CONFIG.logistics.parkingDesignationCost
  }
  if (item.type === 'road') {
    return item.wayType ? WAY_TYPES[item.wayType].cost : SIMULATION_CONFIG.logistics.roadBuildCost
  }
  if (item.kind === 'path') {
    return item.wayType ? WAY_TYPES[item.wayType].cost : BUILDINGS.path.cost
  }
  return BUILDINGS[item.kind]?.cost ?? 0
}

export function blueprintCatalogCost(items: readonly BlueprintItem[]): number {
  return items.reduce((sum, item) => sum + catalogItemCost(item), 0)
}

export function blueprintStampCharge(items: readonly BlueprintItem[]): number {
  return Math.ceil(blueprintCatalogCost(items) * SIMULATION_CONFIG.economy.blueprintCopyCostFactor)
}

export function describeBlueprint(blueprint: Blueprint): string {
  const buildings = blueprint.items.filter((item) => item.type === 'building').length
  const roads = blueprint.items.filter((item) => item.type === 'road').length
  const parking = blueprint.items.filter((item) => item.type === 'parking').length
  const cost = blueprintStampCharge(blueprint.items)
  const parts = [`${buildings} Objekt${buildings === 1 ? '' : 'e'}`]
  if (roads) parts.push(`${roads} Straßenfeld${roads === 1 ? '' : 'er'}`)
  if (parking) parts.push(`${parking} Parkplatz${parking === 1 ? '' : 'felder'}`)
  parts.push(`${cost.toLocaleString('de-DE')} €`)
  return `${blueprint.width}×${blueprint.depth} · ${parts.join(' · ')}`
}

function captureBuilding(building: CapturedBuilding, originX: number, originZ: number, terrain: number): BlueprintBuildingItem {
  const item: BlueprintBuildingItem = {
    type: 'building',
    kind: building.kind,
    dx: building.x - originX,
    dz: building.z - originZ,
    rotation: building.rotation,
    elevationOffset: building.elevation - terrain,
  }
  if (building.decorationSlot !== undefined) item.decorationSlot = building.decorationSlot
  if (building.kind === 'path') {
    item.pathType = building.pathType
    item.queueDirection = building.queueDirection
    item.wayType = building.wayType
    item.pathSlope = building.pathSlope
    item.pathSlopeDirection = building.pathSlopeDirection
    item.staffOnly = building.staffOnly
    item.staffGateDirection = building.staffGateDirection
  }
  return item
}

export function captureBlueprint(
  snapshot: CaptureSnapshot,
  cells: ReadonlyArray<{ x: number; z: number }>,
  getHeight: (x: number, z: number) => number,
): Blueprint {
  if (cells.length === 0) {
    return { version: 1, width: 0, depth: 0, items: [], terrain: [] }
  }
  const xs = cells.map((cell) => cell.x)
  const zs = cells.map((cell) => cell.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const inside = new Set(cells.map((cell) => `${cell.x},${cell.z}`))
  const items: BlueprintItem[] = []

  for (const building of snapshot.buildings) {
    if (!inside.has(`${building.x},${building.z}`)) continue
    if (!isBlueprintCopyableKind(building.kind)) continue
    items.push(captureBuilding(building, minX, minZ, getHeight(building.x, building.z)))
  }

  for (const road of snapshot.logistics.roadCells) {
    if (!inside.has(`${road.x},${road.z}`)) continue
    const terrain = getHeight(road.x, road.z)
    const ground = snapshot.festival.infrastructure.ground[groundKey(road.x, road.z)]
    const wayType = ground?.roadway
    items.push({
      type: 'road',
      dx: road.x - minX,
      dz: road.z - minZ,
      elevationOffset: (road.elevation ?? terrain) - terrain,
      slope: road.roadSlope ?? 0,
      slopeDirection: road.roadSlopeDirection ?? 0,
      wayType,
    })
  }

  for (const parking of snapshot.logistics.parkingCells ?? []) {
    if (!inside.has(`${parking.x},${parking.z}`)) continue
    items.push({
      type: 'parking',
      dx: parking.x - minX,
      dz: parking.z - minZ,
    })
  }

  const terrain: BlueprintTerrainCell[] = cells.map((cell) => ({
    dx: cell.x - minX,
    dz: cell.z - minZ,
    height: getHeight(cell.x, cell.z),
  }))

  return {
    version: 1,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
    items,
    terrain,
  }
}

export function normalizeBlueprint(raw: unknown): Blueprint | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<Blueprint>
  if (!Array.isArray(data.items)) return null
  const items: BlueprintItem[] = []
  for (const item of data.items) {
    if (!item || typeof item !== 'object') continue
    if (item.type === 'road') {
      if (!Number.isFinite(item.dx) || !Number.isFinite(item.dz)) continue
      items.push({
        type: 'road',
        dx: item.dx,
        dz: item.dz,
        elevationOffset: Number(item.elevationOffset) || 0,
        slope: Number(item.slope) || 0,
        slopeDirection: Number(item.slopeDirection) || 0,
        wayType: item.wayType,
      })
      continue
    }
    if (item.type === 'parking') {
      if (!Number.isFinite(item.dx) || !Number.isFinite(item.dz)) continue
      items.push({ type: 'parking', dx: item.dx, dz: item.dz })
      continue
    }
    if (item.type !== 'building' || !isBlueprintCopyableKind(item.kind)) continue
    const next: BlueprintBuildingItem = {
      type: 'building',
      kind: item.kind,
      dx: item.dx,
      dz: item.dz,
      rotation: item.rotation & 3,
      elevationOffset: Number(item.elevationOffset) || 0,
    }
    if (item.decorationSlot !== undefined) next.decorationSlot = item.decorationSlot
    if (item.kind === 'path') {
      next.pathType = item.pathType
      next.queueDirection = item.queueDirection
      next.wayType = item.wayType
      next.pathSlope = item.pathSlope
      next.pathSlopeDirection = item.pathSlopeDirection
      next.staffOnly = item.staffOnly
      next.staffGateDirection = item.staffGateDirection
    }
    items.push(next)
  }
  return {
    version: 1,
    width: Math.max(0, Math.floor(Number(data.width) || 0)),
    depth: Math.max(0, Math.floor(Number(data.depth) || 0)),
    items,
    terrain: Array.isArray(data.terrain) ? data.terrain : [],
  }
}

export function preserveLegacyScenerySlot(item: BlueprintBuildingItem): boolean {
  return isScenery(item.kind) && item.decorationSlot === undefined
}
