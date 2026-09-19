import { BUILDINGS, type BuildingKind } from './catalog'
import { isQueuedFacilityKind } from './shopGoods'
import { bookFinance } from './finance'
import { groundKey } from './ground'
import { DIRECTION_OFFSETS, DIRECTIONS, roadLayerElevation, type Direction, type RoadCell, type SpeedLimit } from './logistics'
import { isEdgeScenery } from './scenery'
import { occupiesBuildingCell } from './stageDesign'
import { syncStageAudience } from './stageAudience'
import { SIMULATION_CONFIG } from './simulationConfig'
import type { PlacedBuilding, Visitor } from './types/entities'
import type { ActionResult, GameSnapshot } from './types/snapshot'
import { isSealedWasteContainer } from './waste'
import {
  MAX_PATH_ELEVATION,
  WAY_ELEVATION_EPSILON,
  WAY_LEVEL_MATCH,
  elevationsMatch,
  maxRoadElevation,
  snapWayElevation,
  wayOverlapsRoadGrade,
} from './wayElevation'
import { WAY_TYPES, wayIssue, type WayType } from './wayTypes'
import { ENTRANCE_PATH_ID } from './snapshotBootstrap'
import { THEMED_BIN_KINDS } from './decorationWalls'

const PATH_COMPATIBLE_KINDS = new Set<BuildingKind>([
  'path', 'fence', 'bench', 'lighting', 'lightBalloon', 'securityGate',
  'busStop', 'wasteBin', ...THEMED_BIN_KINDS,
])

export type PlacementServiceContext = {
  state: GameSnapshot
  isInWorld: (x: number, z: number) => boolean
  getTerrainHeight: (x: number, z: number) => number
  getWaterLevel: () => number
  isWaterTerrain: (x: number, z: number) => boolean
  getRideAccessAt: (x: number, z: number) => unknown
  isLogisticsBuildingCell: (x: number, z: number) => boolean
  getCampingCellAt: (x: number, z: number) => unknown
  getMedicalCellAt: (x: number, z: number) => unknown
  getStageForecourtCellAt: (x: number, z: number) => unknown
  getBuildingVerticalBounds: (building: PlacedBuilding) => { base: number; top: number }
  coasterOccupiesVolume: (x: number, z: number, elevation: number, height: number) => boolean
  getRoadCellsAt: (x: number, z: number) => RoadCell[]
  getRoadCellAt: (x: number, z: number, elevation?: number) => RoadCell | undefined
  getPathAt: (x: number, z: number, elevation?: number) => PlacedBuilding | undefined
  hasLiveParkingOccupancy: (x: number, z: number) => boolean
  isAtTerrainLevel: (x: number, z: number, elevation: number) => boolean
  getTreeClearCost: (x: number, z: number, elevation: number, height: number) => number
  clearTreesAt: (x: number, z: number, elevation: number, height: number) => void
  clearDesignatedOccupancyAt: (
    x: number,
    z: number,
    refund: boolean,
    options?: { preserveMedical?: boolean },
  ) => ActionResult | null
  clearStrandedGroundDirt: () => boolean
  nextId: (prefix: string) => string
  invalidateBuildingIndex: () => void
  invalidateRoadGraph: () => void
  recalculateQueueDirections: () => void
  relocateVisitorsFromPath: (path: PlacedBuilding) => void
  removeAccessControlsAt: (x: number, z: number) => number
  evaluateAccessSignals: () => void
  designateCampingCell: (x: number, z: number, enabled: boolean) => ActionResult
  getPowerCableAt: (x: number, z: number) => unknown
  clearVisitorActivity: (visitor: Visitor) => void
  decideNextVisitorAction: (visitor: Visitor) => void
  getAt: (x: number, z: number) => PlacedBuilding | undefined
  recalculatePark: () => void
  refreshPower: () => void
  emit: () => void
  getWorldSize: () => number
}

export class PlacementService {
  private readonly context: PlacementServiceContext

  constructor(context: PlacementServiceContext) {
    this.context = context
  }

  placeRoadSegment(
    x: number,
    z: number,
    elevation: number,
    slope = 0,
    slopeDirection = 0,
    wayType?: WayType,
  ): ActionResult {
    const c = this.context
    if (wayType && WAY_TYPES[wayType]?.mode !== 'road') {
      return { ok: false, message: 'Gültigen Straßenbelag wählen' }
    }
    if (!c.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    const terrain = c.getTerrainHeight(x, z)
    elevation = snapWayElevation(elevation)
    slope = snapWayElevation(slope)
    const direction = ((slopeDirection % 4) + 4) % 4 as Direction
    const rampStart = elevation - slope
    if (elevation < terrain - WAY_LEVEL_MATCH || rampStart < terrain - WAY_LEVEL_MATCH) {
      return { ok: false, message: 'Die Straße kann nicht unter das Gelände' }
    }
    if (
      elevation > maxRoadElevation(terrain) + WAY_ELEVATION_EPSILON ||
      rampStart > maxRoadElevation(terrain) + WAY_ELEVATION_EPSILON
    ) {
      return { ok: false, message: 'Autos dürfen höchstens eine Höhenstufe über dem Gelände fahren' }
    }
    if (c.isWaterTerrain(x, z) && elevation <= c.getWaterLevel()) {
      return { ok: false, message: 'Im Wasser kann keine Straße gebaut werden' }
    }
    if (
      c.getRideAccessAt(x, z) ||
      c.isLogisticsBuildingCell(x, z) ||
      c.getCampingCellAt(x, z) ||
      c.getMedicalCellAt(x, z) ||
      c.getStageForecourtCellAt(x, z)
    ) {
      return { ok: false, message: 'Hier konnte keine Straße gebaut werden' }
    }
    const candidateBase = Math.min(elevation, rampStart)
    const candidateTop = Math.max(elevation, rampStart) + 0.28
    if (
      c.state.buildings.some((building) => {
        if (
          !occupiesBuildingCell(building, x, z) ||
          building.kind === 'tree' ||
          isSealedWasteContainer(building.kind)
        ) {
          return false
        }
        const bounds = c.getBuildingVerticalBounds(building)
        return bounds.base < candidateTop && candidateBase < bounds.top
      }) ||
      c.coasterOccupiesVolume(x, z, candidateBase, candidateTop - candidateBase)
    ) {
      return { ok: false, message: 'Auf dieser Höhe ist nicht genug Platz' }
    }
    const offsets = DIRECTION_OFFSETS[direction]
    const layersHere = c.getRoadCellsAt(x, z)
    const existing = layersHere.find((layer) =>
      wayOverlapsRoadGrade(elevation, slope, layer.elevation ?? terrain),
    )
    const hasLowerRoad = layersHere.some(
      (layer) =>
        (layer.elevation ?? terrain) + WAY_LEVEL_MATCH <
        Math.min(elevation, rampStart),
    )
    if (slope !== 0) {
      const previous = c
        .getRoadCellsAt(x - offsets.x, z - offsets.z)
        .find((layer) =>
          elevationsMatch(
            layer.elevation ?? c.getTerrainHeight(layer.x, layer.z),
            rampStart,
          ),
        )
      if (!previous && !existing) {
        return { ok: false, message: 'Eine Rampe muss an eine bestehende Straße anschließen' }
      }
    } else if (!c.isAtTerrainLevel(x, z, elevation)) {
      const hasNeighbor = DIRECTIONS.some((neighborDirection) => {
        const offset = DIRECTION_OFFSETS[neighborDirection]
        return c.getRoadCellsAt(x + offset.x, z + offset.z).some((neighbor) =>
          elevationsMatch(
            neighbor.elevation ?? c.getTerrainHeight(neighbor.x, neighbor.z),
            elevation,
          ),
        )
      })
      if (!hasNeighbor && !existing && !hasLowerRoad) {
        return { ok: false, message: 'Eine erhöhte Straße muss anschließen' }
      }
    }
    if (wayType && elevation <= terrain) {
      const issue = wayIssue(c.state, x, z, wayType)
      if (issue) return { ok: false, message: issue }
    }
    const clearCost = c.getTreeClearCost(x, z, candidateBase, candidateTop - candidateBase)
    const roadCost = wayType
      ? WAY_TYPES[wayType].cost
      : SIMULATION_CONFIG.logistics.roadBuildCost
    const extra = existing && wayType
      ? Math.max(0, roadCost - SIMULATION_CONFIG.logistics.roadBuildCost)
      : existing
        ? 0
        : roadCost
    if (c.state.money < extra + clearCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    c.clearTreesAt(x, z, candidateBase, candidateTop - candidateBase)
    if (extra) bookFinance(c.state, 'construction', -extra)
    const crossingPath = c.state.buildings.find(
      (building) =>
        building.kind === 'path' &&
        building.x === x &&
        building.z === z &&
        wayOverlapsRoadGrade(building.elevation, building.pathSlope ?? 0, elevation),
    )
    if (existing) {
      existing.roadSlope = slope
      existing.roadSlopeDirection = direction
      if (wayType) existing.speedLimit = WAY_TYPES[wayType].limit as SpeedLimit
      if (crossingPath) existing.crosswalk = true
    } else {
      c.state.logistics.roadCells.push({
        x,
        z,
        allowedDirections: null,
        blockedEdges: 0,
        speedLimit: wayType
          ? (WAY_TYPES[wayType].limit as SpeedLimit)
          : SIMULATION_CONFIG.logistics.defaultSpeedLimit,
        crosswalk: Boolean(crossingPath),
        elevation,
        roadSlope: slope,
        roadSlopeDirection: direction,
      })
    }
    if (wayType) {
      const cell = c.state.festival.infrastructure.ground[groundKey(x, z)] ??= {}
      cell.roadway = wayType
    }
    c.invalidateRoadGraph()
    c.emit()
    return {
      ok: true,
      message: existing
        ? 'Straße aktualisiert'
        : hasLowerRoad
          ? 'Straße über die Autostraße gebaut'
          : slope === 0
            ? `Straße auf Ebene ${elevation} gebaut`
            : `${slope > 0 ? 'Aufwärts-' : 'Abwärts-'}Rampe gebaut`,
    }
  }

  undoRoadSegment(
    x: number,
    z: number,
    previousRoad?: RoadCell,
    elevation?: number,
  ): ActionResult {
    const c = this.context
    const layerElevation = previousRoad
      ? roadLayerElevation(previousRoad, c.getTerrainHeight(x, z))
      : elevation
    const road = c.getRoadCellAt(x, z, layerElevation)
    if (!road) {
      return { ok: false, message: 'Dieses Straßenstück kann nicht zurückgenommen werden' }
    }
    if (previousRoad) Object.assign(road, structuredClone(previousRoad))
    else {
      c.state.logistics.roadCells = c.state.logistics.roadCells.filter(
        (cell) => cell !== road,
      )
      bookFinance(c.state, 'construction', SIMULATION_CONFIG.logistics.roadBuildCost)
    }
    c.invalidateRoadGraph()
    c.emit()
    return {
      ok: true,
      message: previousRoad ? 'Vorheriges Straßenfeld' : 'Straße zurückgenommen',
    }
  }

  placePathSegment(
    x: number,
    z: number,
    elevation: number,
    pathType: 'normal' | 'queue' = 'normal',
    queueDirection = 0,
    slope = 0,
    wayType?: WayType,
  ): ActionResult {
    const c = this.context
    elevation = snapWayElevation(elevation)
    slope = snapWayElevation(slope)
    if (wayType && WAY_TYPES[wayType]?.mode !== 'foot') {
      return { ok: false, message: 'Gültigen Fußwegbelag wählen' }
    }
    if (wayType && elevation <= c.getTerrainHeight(x, z)) {
      const issue = wayIssue(c.state, x, z, wayType)
      if (issue) return { ok: false, message: issue }
    }
    const pathCost = wayType ? WAY_TYPES[wayType].cost : BUILDINGS.path.cost
    if (!c.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    if (c.hasLiveParkingOccupancy(x, z) || c.isLogisticsBuildingCell(x, z)) {
      return { ok: false, message: 'Hier liegt bereits eine Logistikfläche' }
    }
    const road = c.getRoadCellsAt(x, z).find((layer) =>
      wayOverlapsRoadGrade(
        elevation,
        slope,
        layer.elevation ?? c.getTerrainHeight(x, z),
      ),
    )
    if (road && pathType === 'queue') {
      return { ok: false, message: 'Eine Warteschlange kann nicht auf der Autostraße liegen' }
    }
    if (c.getCampingCellAt(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch einen Zeltplatz kann kein Weg führen' }
    }
    if (c.getMedicalCellAt(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch den Krankenbereich kann kein Weg führen' }
    }
    if (c.getStageForecourtCellAt(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch den Bühnenvorplatz kann kein Weg führen' }
    }
    const rampStartElevation = elevation - slope
    const candidateBase = Math.min(elevation, rampStartElevation)
    const candidateTop =
      Math.max(elevation, rampStartElevation) + BUILDINGS.path.height
    const gate = c.getRideAccessAt(x, z) as
      | { point: { y: number } }
      | undefined
    if (gate && gate.point.y < candidateTop && candidateBase < gate.point.y + 0.8) {
      return { ok: false, message: 'Hier steht ein Ein- oder Ausgang – den Weg daneben anschließen' }
    }
    const occupants = c.state.buildings.filter((building) => {
      if (!occupiesBuildingCell(building, x, z)) return false
      const bounds = c.getBuildingVerticalBounds(building)
      return bounds.base < candidateTop && candidateBase < bounds.top
    })
    const existingPath = occupants.find((building) => building.kind === 'path')
    const blocking = occupants.find(
      (building) =>
        building.kind !== 'tree' &&
        !PATH_COMPATIBLE_KINDS.has(building.kind) &&
        !(
          building.decorationSlot !== undefined &&
          isEdgeScenery(building.kind) &&
          slope === 0
        ),
    )
    if (
      blocking ||
      c.coasterOccupiesVolume(x, z, candidateBase, candidateTop - candidateBase)
    ) {
      return { ok: false, message: 'Auf dieser Höhe ist nicht genug Platz' }
    }
    if (c.isWaterTerrain(x, z) && elevation <= c.getWaterLevel()) {
      return { ok: false, message: 'Im Wasser kann kein Weg gebaut werden' }
    }
    if (elevation < c.getWaterLevel() || elevation > MAX_PATH_ELEVATION) {
      return { ok: false, message: 'Diese Bauhöhe ist nicht möglich' }
    }
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const direction = directions[queueDirection]
    if (
      slope !== 0 &&
      (!direction ||
        !c.getPathAt(x - direction.x, z - direction.z, elevation - slope))
    ) {
      return { ok: false, message: 'Eine Rampe muss an einen bestehenden Weg anschließen' }
    }
    const clearCost = c.getTreeClearCost(x, z, candidateBase, candidateTop - candidateBase)
    if (c.state.money < pathCost + clearCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    c.clearTreesAt(x, z, candidateBase, candidateTop - candidateBase)
    c.clearDesignatedOccupancyAt(x, z, false, { preserveMedical: true })
    bookFinance(c.state, 'construction', -pathCost)
    const pathData: Omit<PlacedBuilding, 'id'> = {
      kind: 'path',
      x,
      z,
      rotation: queueDirection,
      elevation,
      pathType,
      wayType,
      queueDirection: pathType === 'queue' ? queueDirection : undefined,
      queueEntryDirection: undefined,
      queueSplit: false,
      pathSlope: slope,
      pathSlopeDirection: queueDirection,
      price: 0,
    }
    if (existingPath) Object.assign(existingPath, pathData)
    else c.state.buildings.push({ id: c.nextId('building'), ...pathData })
    if (wayType && elevation === c.getTerrainHeight(x, z)) {
      const cell = c.state.festival.infrastructure.ground[groundKey(x, z)] ??= {}
      cell.footway = wayType
    }
    c.invalidateBuildingIndex()
    const roadElevation = road
      ? road.elevation ?? c.getTerrainHeight(x, z)
      : c.getTerrainHeight(x, z)
    const crossing = Boolean(
      road && wayOverlapsRoadGrade(elevation, slope, roadElevation),
    )
    if (crossing && road && !road.crosswalk) {
      road.crosswalk = true
      c.invalidateRoadGraph()
    }
    const overRoad =
      !crossing &&
      c.getRoadCellsAt(x, z).some(
        (layer) =>
          (layer.elevation ?? c.getTerrainHeight(x, z)) + WAY_LEVEL_MATCH <
          Math.min(elevation, elevation - slope),
      )
    c.recalculateQueueDirections()
    c.emit()
    return {
      ok: true,
      message: existingPath
        ? `${pathType === 'queue' ? 'Warteschlange' : 'Weg'} ersetzt`
        : crossing
          ? 'Übergang über die Autostraße gebaut'
          : overRoad
            ? 'Gehweg über die Straße gebaut'
            : slope === 0
              ? `Weg auf Ebene ${elevation} gebaut`
              : `${slope > 0 ? 'Aufwärts-' : 'Abwärts-'}Rampe gebaut`,
    }
  }

  undoPathSegment(
    x: number,
    z: number,
    elevation: number,
    previousPath?: PlacedBuilding,
  ): ActionResult {
    const c = this.context
    const path = c.getPathAt(x, z, elevation)
    if (!path || path.kind !== 'path' || (path.id === ENTRANCE_PATH_ID && !previousPath)) {
      return { ok: false, message: 'Dieses Wegstück kann nicht zurückgenommen werden' }
    }
    if (previousPath) {
      const index = c.state.buildings.findIndex((building) => building.id === path.id)
      if (index >= 0) c.state.buildings[index] = structuredClone(previousPath)
    } else {
      c.relocateVisitorsFromPath(path)
      c.state.buildings = c.state.buildings.filter((building) => building.id !== path.id)
    }
    bookFinance(c.state, 'construction', BUILDINGS.path.cost)
    c.recalculateQueueDirections()
    if (elevation === c.getTerrainHeight(x, z)) {
      const ground = c.state.festival.infrastructure.ground[groundKey(x, z)]
      if (ground) {
        if (previousPath?.wayType) ground.footway = previousPath.wayType
        else delete ground.footway
      }
    }
    c.emit()
    return {
      ok: true,
      message: previousPath
        ? 'Vorheriger Weg wiederhergestellt'
        : 'Letztes Wegstück zurückgenommen',
    }
  }

  bulldozeAt(x: number, z: number, buildingId?: string): ActionResult {
    const c = this.context
    if (!buildingId && c.removeAccessControlsAt(x, z) > 0) {
      c.evaluateAccessSignals()
      c.emit()
      return { ok: true, message: 'Kontrolle entfernt' }
    }
    const busStop = c.state.logistics.busStops.find(
      (stop) => stop.x === x && stop.z === z,
    )
    if (busStop && (!buildingId || busStop.id === buildingId)) {
      c.state.logistics.busStops = c.state.logistics.busStops.filter(
        (stop) => stop.id !== busStop.id,
      )
      c.state.logistics.busLines = c.state.logistics.busLines.filter(
        (line) => !line.stopIds.includes(busStop.id),
      )
      c.emit()
      return { ok: true, message: 'Bushaltestelle entfernt' }
    }
    const building = buildingId
      ? c.state.buildings.find((candidate) => candidate.id === buildingId)
      : c.getAt(x, z)
    if (!building) return this.bulldozeDesignationOrRoad(x, z)
    if (building.id === ENTRANCE_PATH_ID) {
      return { ok: false, message: 'Der Parkeingang kann nicht abgerissen werden' }
    }
    if (
      building.kind === 'tree' &&
      c.state.money < SIMULATION_CONFIG.economy.treeClearCost
    ) {
      return { ok: false, message: 'Nicht genug Geld, um den Baum zu entfernen' }
    }
    if (building.kind === 'path') {
      c.relocateVisitorsFromPath(building)
      c.removeAccessControlsAt(x, z)
    }
    const occupiedDepot =
      building.kind === 'ambulanceGarage'
        ? c.state.logistics.ambulanceGarages.find((item) => item.id === building.id)?.bays.some(Boolean)
        : building.kind === 'busDepot'
          ? Boolean(c.state.logistics.busDepots.find((item) => item.id === building.id)?.busIds.length)
          : building.kind === 'wasteDepot'
            ? Boolean(c.state.logistics.wasteDepots.find((item) => item.id === building.id)?.truckIds.length)
            : building.kind === 'specialDepot'
              ? Boolean(c.state.logistics.specialDepots.find((item) => item.id === building.id)?.vehicleIds.length)
              : false
    if (occupiedDepot) {
      const noun =
        building.kind === 'ambulanceGarage'
          ? 'Krankenwagen'
          : building.kind === 'busDepot'
            ? 'Busse'
            : building.kind === 'wasteDepot'
              ? 'Müllfahrzeuge'
              : 'Spezialfahrzeuge'
      return { ok: false, message: `Vor dem Abriss müssen alle ${noun} entfernt werden` }
    }
    if (building.kind === 'ambulanceGarage') {
      c.state.logistics.ambulanceGarages = c.state.logistics.ambulanceGarages.filter(
        (item) => item.id !== building.id,
      )
    } else if (building.kind === 'busDepot') {
      c.state.logistics.busDepots = c.state.logistics.busDepots.filter(
        (item) => item.id !== building.id,
      )
    } else if (building.kind === 'wasteDepot') {
      c.state.logistics.wasteDepots = c.state.logistics.wasteDepots.filter(
        (item) => item.id !== building.id,
      )
    } else if (building.kind === 'specialDepot') {
      c.state.logistics.specialDepots = c.state.logistics.specialDepots.filter(
        (item) => item.id !== building.id,
      )
    }
    c.state.buildings = c.state.buildings.filter((item) => item.id !== building.id)
    if (building.stageDesign) syncStageAudience(c.state)
    if (
      building.kind === 'path' ||
      isQueuedFacilityKind(building.kind) ||
      building.kind === 'stage'
    ) {
      c.recalculateQueueDirections()
    }
    if (building.kind === 'tree') {
      bookFinance(c.state, 'landscaping', -SIMULATION_CONFIG.economy.treeClearCost)
    } else {
      bookFinance(
        c.state,
        'construction',
        Math.floor(
          BUILDINGS[building.kind].cost *
            SIMULATION_CONFIG.economy.demolitionRefundRate,
        ),
      )
    }
    c.state.visitors.forEach((visitor) => {
      if (visitor.targetId !== building.id) return
      visitor.targetId = null
      visitor.route = []
      visitor.state = 'exploring'
      visitor.thought = 'Mein Ziel ist verschwunden.'
    })
    // A path that is torn up takes the rubbish lying on it with it.
    c.clearStrandedGroundDirt()
    c.recalculatePark()
    c.refreshPower()
    c.emit()
    return { ok: true, message: `${BUILDINGS[building.kind].name} abgerissen` }
  }

  private bulldozeDesignationOrRoad(x: number, z: number): ActionResult {
    const c = this.context
    const cleared = c.clearDesignatedOccupancyAt(x, z, true)
    if (cleared) {
      c.clearStrandedGroundDirt()
      c.emit()
      return cleared
    }
    const layers = c.getRoadCellsAt(x, z)
    const road = layers.length > 1
      ? [...layers].sort(
          (a, b) =>
            roadLayerElevation(b, c.getTerrainHeight(x, z)) -
            roadLayerElevation(a, c.getTerrainHeight(x, z)),
        )[0]
      : layers[0]
    if (road) {
      if (
        z === -c.getWorldSize() / 2 &&
        x >= -3 &&
        x <= 2 &&
        layers.length === 1
      ) {
        return { ok: false, message: 'Die Einfahrtsstraße kann nicht entfernt werden' }
      }
      if (
        c.state.logistics.roadVehicles.some((vehicle) => {
          if (vehicle.cell?.x !== x || vehicle.cell.z !== z) return false
          if (vehicle.cell.elevation === undefined) return layers.length === 1
          return elevationsMatch(
            vehicle.cell.elevation,
            roadLayerElevation(road, c.getTerrainHeight(x, z)),
          )
        })
      ) {
        return { ok: false, message: 'Auf der Straße befindet sich ein Fahrzeug' }
      }
      c.state.logistics.roadCells = c.state.logistics.roadCells.filter(
        (cell) => cell !== road,
      )
      c.invalidateRoadGraph()
      if (c.getRoadCellsAt(x, z).length === 0) c.removeAccessControlsAt(x, z)
      c.emit()
      return { ok: true, message: 'Straße entfernt' }
    }
    if (c.getCampingCellAt(x, z)) {
      const given = c.designateCampingCell(x, z, false)
      // A camping field that is given up loses its rubbish with it.
      c.clearStrandedGroundDirt()
      return given
    }
    if (c.getPowerCableAt(x, z)) {
      c.state.power.cableCells = c.state.power.cableCells.filter(
        (cell) => cell.x !== x || cell.z !== z,
      )
      c.refreshPower()
      c.emit()
      return { ok: true, message: 'Kabel entfernt' }
    }
    const wasteDump = c.state.wasteDumpCells.find((cell) => cell.x === x && cell.z === z)
    if (wasteDump) {
      if (wasteDump.stored > 0) {
        return {
          ok: false,
          message: 'Die Müllablage ist noch beladen und kann nicht aufgehoben werden',
        }
      }
      c.state.wasteDumpCells = c.state.wasteDumpCells.filter(
        (cell) => cell.x !== x || cell.z !== z,
      )
      c.emit()
      return { ok: true, message: 'Müllablage aufgehoben' }
    }
    const forecourt = c.state.stageForecourtCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
    if (forecourt) {
      if (forecourt.stageId) {
        return {
          ok: false,
          message: 'Die Zuschauerfläche gehört zur Bühne und lässt sich nicht einzeln entfernen',
        }
      }
      c.state.stageForecourtCells = c.state.stageForecourtCells.filter(
        (cell) => cell.x !== x || cell.z !== z,
      )
      c.state.visitors.forEach((visitor) => {
        if (visitor.activityTarget?.x !== x || visitor.activityTarget.z !== z) return
        c.clearVisitorActivity(visitor)
        c.decideNextVisitorAction(visitor)
      })
      c.recalculateQueueDirections()
      c.emit()
      return { ok: true, message: 'Bühnenvorplatz aufgehoben' }
    }
    return { ok: false, message: 'Hier gibt es nichts abzureißen' }
  }
}
