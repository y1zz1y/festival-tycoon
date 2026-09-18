import { pathFurnitureRotation } from './pathFurniture';
import { isWasteBin } from './decorationWalls';
import { wallSpec } from './decorationWalls';
import { isScenery, isLargeScenery, isEdgeScenery, sceneryOverlaps, sceneryTransform, pedestrianBarrierOccupancy } from './scenery';
import { syncStageAudience } from './stageAudience';
import { stageSiteIssue } from './stageSite';
import { isStageAudienceCell, buildingFootprint, occupiesBuildingCell, stageDesignIssue, stageStats, type StageDesign } from './stageDesign';
import { WAY_TYPES, wayInfo, wayIssue } from './wayTypes';
import type { WayType } from './wayTypes';
import { groundRectangle } from './ground';
import { createInfrastructure, updateSupplyChain, localStock, normalizeInfrastructure, normalizeStock } from './supplyChain';
import { CARDINAL_OFFSETS, isShopServiceKind } from './shopAccess';
import { isPricedShopKind, isQueuedFacilityKind, normalizeShirtColor, normalizeShirtStyle, shopSupplyKind, stockoutThought, type ShirtStyle } from './shopGoods';
import { QUEUE_CARDINALS, isStallQueueKind, queueStandOffset as computeQueueStandOffset, queueTravelLane, stallQueueLaneFromLocal, stallQueueTileOffset } from './queueLanes';
import { groundInfo, groundKey, roadGroundLimit } from './ground';
import { BUILDINGS, SAVE_KEY, SAVE_SLOTS_KEY, saveSlotDataKey } from './catalog';
import { serializeSnapshot, storageErrorMessage } from './saveText';
import { bookFinance, financeEdition, financeForecast, loanInterest, loanLimit, rollFinanceDay, LOAN, CARRIER_WAGE_PER_MINUTE, type FinanceCategory, type FinanceEntries, type FinanceState } from './finance';
import { updateScenarioProgress } from './scenarioGoals';
import { createFestivalManagement, festivalAction, updateFestival, activeBookings, showIssue } from './festivalManagement';
import type { Booking, FestivalAction } from './festivalManagement';
import { createScenarioEntrance, createScenarioRoadEntry, normalizeScenarioSettings } from './scenario';
import type { ScenarioSettings } from './scenario';
import type { BuildingKind, Tool } from './catalog';
import { TRACK_PIECES, computeTrackFrame, isCoasterCircuitClosed, snapTrackPieceToAnchor, trackAnchorsAlign } from './coasters';
import type { Coaster, CoasterOperationMode, CoasterTypeId, DispatchMode, TrackBuildOptions, TrackPiece, TrackPieceKind } from './coasters';
import { abandonVisitorCamp, CampingSystem, decayUnclaimedInstallations, isCollectibleCamp } from './camping';
import type { CampingCell } from './camping';
import { getItemQuantity } from './inventory';
import { FireworksSystem } from './fireworks';
import { PedestrianNavigation, isPedestrianSolidKind, type PedestrianNeighborOptions } from './pedestrianNavigation';
import { updateLogisticsSimulation, type LogisticsTickState } from './logisticsSimulation';
import { RoadVehicleSimulation } from './roadVehicleSimulation';
import { DeterministicRng, rollsBungeeNude } from './rng';
import { applyGameCommand } from '../net/commands';
import { isOptimisticCommand } from '../net/commandRegistry';
import { allowsPathFlow, normalizeFlowDirection } from './pathFlow';
import { createStaffMember, STAFF_DEFINITIONS } from './staff';
import type { StaffRole } from './staff';
import { setAssignedWorkZones, zonePaintActive } from './staffZones';
import { StaffSimulation } from './staffSimulation';
import { MedicalSystem, allowsMedicalOverlay, normalizeMedicalCell } from './medical';
import type { MedicalCell } from './medical';
import { IncidentSystem } from './incidents';
import type { GroundIncident, GroundIncidentKind } from './incidents';
import { DEFAULT_SECURITY_CONFIG, SecuritySystem } from './security';
import type { SecurityGateConfig } from './security';
import { SIMULATION_CONFIG } from './simulationConfig';
import { blueprintCatalogCost, blueprintStampCharge, preserveLegacyScenerySlot, transformBlueprintItems, type BlueprintItem } from './blueprints';
import type { GameCommand, SimSnapshot, WorldSnapshot } from '../net/protocol';
import { applySim, applyWorld } from '../net/codec';
import { AtmosphereSystem } from './atmosphere';
import { FestivalAreaSystem } from './festivalAreas';
import type { StageForecourtCell } from './festivalAreas';
import { acceptWasteAtDump, acceptWasteAtSealedContainer, designateWasteDumps, emptySealedContainerStored, isSealedWasteContainer } from './waste';
import type { SealedWasteContainerInfo, WasteDumpCell } from './waste';
import { bandSupplyAt, bandSupplyForStage, buildBandSupplyGraph, collectBandSupplySnapshot, designateBackstageAreas, isBandSupplyKind, isFanIntrusionEligible, showQualityForStage, type BackstageCell, type BandSupplyComponent, type BandSupplyStats } from './bandSupply';
import { bandActorShouldPerform, createBandActor, createTourBusVehicle, idleWanderReady, isBandOnSiteMinute, nextWanderDelay, placeActorOnCell, planBandPresence, stepBandActor, type BandActor, type PlannedBandPresence } from './bandActors';
import { bandCostumeId, bandRoles } from './bandLooks';
import { consumesPower, normalizePower, PowerSystem } from './power';
import type { PowerCableCell } from './power';
import { getFestivalCycleStatus, getOpenWindowHours, isFestivalOfferActive } from './dayPlan';
import type { DayPlanOffer } from './dayPlan';
import { createComplaintCounts } from './complaints';
import type { ComplaintTopic } from './complaints';
import { cellKey as roadCellKey, chooseParkingDisembarkPath, collectSeatedPassengerIds, createRoadGraph, directionBit, directionFromDelta, isRoadDirectionAllowed, previewBusLineRoute as buildBusLineRoutePreview, oppositeDirection, resolveRoadLayer, roadLayerElevation, roadLayerKey, toRoadPosition } from './logistics';
import { WAY_ELEVATION_EPSILON, WAY_LEVEL_MATCH, canStepPedestrianHeight, canTraverseWayElevation, pedestrianEdgesMeet, wayEdgeHeights, wayOverlapsRoadGrade, waySurfaceY, waySurfaceYAt, packWayElevation, snapWayElevation } from './wayElevation';
import { snapBuildElevation, stepBuildElevation } from './placementPreview';
import { VisitorSimulation } from './visitorSimulation';
import { VisitorBehaviorService } from './visitorBehavior';
import { VisitorCrowdingSimulation } from './visitorCrowdingSimulation';
import { VisitorSpawning } from './visitorSpawning';
import { CoasterSimulation } from './coasterSimulation';
import { PlacementService } from './placementService';
import { normalizeSnapshotForRuntime, repairSnapshotEntities, type SnapshotRepairContext } from './snapshotRepair';
export { FEMALE_VISITOR_NAMES, MALE_VISITOR_NAMES, visitorGivenName } from './visitorSpawning';
import { appendCoasterPieceCommand, deleteCoasterPieceCommand, startCoasterCommand, undoCoasterPieceCommand, type CoasterCommandContext } from './commands/coasterCommands';
import { placeBuildingCommand, previewPlacementCommand } from './commands/placementCommands';
import { bulldozeAreaCommand, bulldozeCommand } from './commands/bulldozeCommands';
import type { ArrivalGroup, Direction, FindRoadRouteOptions, ParkingCell, ParkingDisembarkCandidate, RoadCell, RoadPosition, RoadGraph, RoadVehicle, SpeedLimit } from './logistics';
import { previewBusLineMarkers as buildBusLineMarkers, sortBusLineStops as orderBusLineStops, type BusPlannerStopMarker } from './busPlanner';
import { accessCellKey, accessEdgeKey, closedAccessEdges, createPathBarrier, createTrafficLight, evaluateAccessSignal, statsForArea, stepUsesClosedEdge, toggleAreaCells, normalizeScheduleHours, normalizeScheduleOffer, normalizeSchedulePhases, normalizeScheduleTime, type AccessAreaCell, type AccessAreaIndexes, type AccessAreaStats, type AccessControl, type AccessControlKind, type AccessControlPatch, type AccessScheduleContext } from './accessControl';
import { applyTerrainChanges, getTerrainHeight as readTerrainHeight, getWaterLevel, isMudHeight, isSwimmableHeight, isWaterHeight, planTerrainAreaEdit, planTerrainEdit, sampleTerrainSurface, terrainWalkEdgeHeights } from './terrain';
import type { TerrainEditMode } from './terrain';
import { createInitialSnapshot, ENTRANCE_PATH_ID } from './snapshotBootstrap';
import { migrateSnapshot } from './snapshotMigration';
import type { PlacementPreviewRequest, PlacementPreviewResult } from './placementPreview';
import type { Cell, PlacedBuilding, Visitor } from './types/entities';
import type { ActionResult, GameSnapshot, LocalSaveSlot, SimTurn } from './types/snapshot';


export type {
  CashEffect,
  Cell,
  PlacedBuilding,
  Visitor,
  VisitorEmotion,
  VisitorNeeds,
  VisitorState,
} from './types/entities'
export type {
  ActionResult,
  GameSnapshot,
  LocalSaveSlot,
  SimTurn,
} from './types/snapshot'

type StoredSaveSlot = LocalSaveSlot & { snapshot?: string }

type Listener = (snapshot: Readonly<GameSnapshot>) => void

const SIMULATION_SPEED_MULTIPLIERS = SIMULATION_CONFIG.time.speedMultipliers
const BAND_NAMES = ['Neon Echo', 'Festival Riot', 'Moonlight Avenue', 'Bassgarten']

export class GameState {
  private state: GameSnapshot
  private listeners = new Set<Listener>()
  private idCounter = 0
  private simulatedMinutes = 0
  private uiRefreshSeconds = 0
  private crowdingMinutes = 0
  private camping: CampingSystem
  private fireworks = new FireworksSystem()
  private buildingCellIndex = new Map<number, PlacedBuilding[]>()
  private rideAccessIndex = new Map<number, Array<{ building: PlacedBuilding; type: 'entrance' | 'exit'; point: { x: number; y: number; z: number } }>>()
  private pathExactIndex = new Map<number, PlacedBuilding>()
  private parkingIndex = new Map<number, ParkingCell[]>()
  private medicalIndex = new Map<number, MedicalCell>()
  private wasteDumpIndex = new Map<number, WasteDumpCell>()
  private forecourtIndex = new Map<number, StageForecourtCell>()
  private backstageIndex = new Map<number, BackstageCell>()
  private indexedBackstageRef: readonly BackstageCell[] | null = null
  private bandSupplyComponents: BandSupplyComponent[] = []
  private activeBackstagePacked = new Set<number>()
  private tourBusReachCache = new Map<string, boolean>()
  private tourBusReachRevision = -1
  private coasterOccupancyIndex = new Map<
    number,
    Array<{ y: number; coasterId: string }>
  >()
  private indexedBuildingCount = -1
  private coasterIndexKey = ''
  private indexedParkingRef: readonly ParkingCell[] | null = null
  private indexedParkingCount = -1
  private indexedMedicalRef: readonly MedicalCell[] | null = null
  private indexedWasteDumpRef: readonly WasteDumpCell[] | null = null
  private indexedForecourtRef: readonly StageForecourtCell[] | null = null
  /** Packed half-steps (`height * 2`) so 0.5 land edits stay exact. */
  private terrainHeights: Int8Array | null = null
  private cachedWorldSize = 0
  private cachedWorldHalf = 0
  private attractivenessPacked = new Map<number, number>()
  private readonly pedestrianNavigation = new PedestrianNavigation({
    worldRevision: () => this.worldRevision,
    simTick: () => this.state.simTick,
    accessSignalRevision: () => this.accessSignalRevision,
    worldSize: () => this.getWorldSize(),
    terrainStorageSize: () => this.terrainHeights?.byteLength ?? 0,
    buildings: () => this.state.buildings,
    roadCells: () => this.state.logistics.roadCells,
    parkingCount: () => this.state.logistics.parkingCells.length,
    campingCount: () => this.state.campingCells.length,
    medicalCount: () => this.state.medicalCells.length,
    forecourtCount: () => this.state.stageForecourtCells.length,
    prepareGraph: () => {
      this.refreshBandSupplyGraph()
      this.ensureSpatialIndexes()
    },
    packCell: (cell) => this.packCell(cell),
    packXZ: (x, z) => this.packXZ(x, z),
    directionIndex: (dx, dz) => this.getDirectionIndex(dx, dz),
    getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
    getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
    getRoadAt: (x, z) => this.getRoadCellAt(x, z),
    getBuildingsAt: (x, z) => this.getBuildingsAtCell(x, z),
    isCampingAt: (x, z) => Boolean(this.getCampingCellAt(x, z)),
    isMedicalAt: (x, z) => Boolean(this.getMedicalCellAt(x, z)),
    isForecourtAt: (x, z) => Boolean(this.getStageForecourtCellAt(x, z)),
    hasParkingAt: (x, z) => this.hasParkingAt(x, z),
    isBackstageAt: (x, z) => this.activeBackstagePacked.has(this.packXZ(x, z)),
    isWaterAt: (x, z) => isWaterHeight(this.getTerrainHeight(x, z), this.getWaterLevel()),
    isSolidAt: (x, z, elevation) => this.isPedestrianSolidAt(x, z, elevation),
    surfaceCost: (cell) => this.getPedestrianSurfaceCost(cell),
    walkEdgeHeights: (cell, path, direction) => path
      ? wayEdgeHeights(
          path.elevation,
          path.pathSlope ?? 0,
          path.pathSlopeDirection ?? 0,
          direction,
        )
      : terrainWalkEdgeHeights(
          this.state.terrain,
          cell.x,
          cell.z,
          direction,
          this.getWaterLevel(),
          (x, z) => this.isInWorld(x, z),
        ),
    edgesMeet: (left, right) => pedestrianEdgesMeet(left, right),
    canTraversePath: (from, to, fromX, fromZ, allowQueue, ignore, elevation) =>
      this.canTraversePath(from, to, fromX, fromZ, allowQueue, ignore, elevation),
    searchNeighbors: (cell, options) => this.getPedestrianNeighbors(cell, options),
    isClosedPathEdge: (x, z, direction) =>
      this.closedPathEdges.has(accessEdgeKey(x, z, direction)),
    crowdingCost: (packed) => this.visitorCrowding?.costAtPacked(packed) ?? 0,
  })
  /** Compatibility seam for regression diagnostics; ownership stays in the module. */
  get pedestrianPathCache() {
    return this.pedestrianNavigation.pathCacheView()
  }
  private accessSignalRevision = 0
  private accessEmergency = false
  private closedTrafficEdges = new Set<string>()
  private closedPathEdges = new Set<string>()
  private visitorIndex = new Map<string, Visitor>()
  private facilityQueues = new Map<string, string[]>()
  private indexedVisitorCount = -1
  private medical = new MedicalSystem()
  private incidents = new IncidentSystem()
  private security = new SecuritySystem()
  private staffSimulation = new StaffSimulation()
  private atmosphere = new AtmosphereSystem()
  private festivalAreas = new FestivalAreaSystem()
  private powerSystem = new PowerSystem()
  private poweredBuildingIds = new Set<string>()
  private showFireworkSlots = new Map<string, number>()
  private atmosphereMinutes = 0
  private attractivenessValues = new Map<string, number>()
  private partyMoodValues = new Map<string, number>()
  private roadGraph: RoadGraph | null = null
  // At most eight entries per road layer (four headings, two U-turn modes).
  // A replaced graph drops all results, including proven unreachable exits.
  private visitorSimulation: VisitorSimulation
  private visitorBehavior: VisitorBehaviorService
  /** Guests walking a stall return lane; full speed, then an immediate next goal. */
  private stallQueueReturnIds = new Set<string>()
  private processingSimulationStep = false
  private decisionBudget = 0
  private decidedThisTick = new Set<string>()
  /** Local diagnostic counter; deliberately excluded from saves and network state. */
  executedLogicTicks = 0
  networkMode: 'solo' | 'host' | 'client' = 'solo'
  commandOutbox: ((command: GameCommand) => void) | null = null
  onTurnCommit: ((turn: SimTurn) => void) | null = null
  onDesync: ((expected: number, actual: number) => void) | null = null
  onFestivalResult: ((result: ActionResult) => void) | null = null
  onCommandResult: ((command: GameCommand, result: ActionResult) => void) | null = null
  applyingCommand = false
  worldRevision = 0
  lockstepReady = true
  readonly rng: DeterministicRng = new DeterministicRng(1)
  private tickAccumulator = 0
  private lastNavRevision = -1
  private scheduledCommands = new Map<number, GameCommand[]>()
  private turnHashes = new Map<number, number>()
  private optimisticCommandSequence = 0
  private optimisticCommands = new Map<string, GameCommand>()
  private roadVehicleSimulation: RoadVehicleSimulation
  private visitorCrowding: VisitorCrowdingSimulation
  private visitorSpawning: VisitorSpawning
  private coasterSimulation: CoasterSimulation
  private placementService: PlacementService

  constructor(snapshot?: GameSnapshot) {
    this.state = snapshot
      ? structuredClone(snapshot)
      : createInitialSnapshot()
    this.visitorSimulation = new VisitorSimulation({
      state: this.state,
      getVisitor: (id) => this.getVisitor(id),
      isProcessingStep: () => this.processingSimulationStep,
      takeDecision: (visitorId) => {
        if (
          this.decisionBudget <= 0 ||
          this.decidedThisTick.has(visitorId) ||
          this.visitorSimulation.hasPendingRouting(visitorId)
        ) {
          return false
        }
        this.decisionBudget -= 1
        this.decidedThisTick.add(visitorId)
        return true
      },
      beginDeparture: (visitor) => this.beginVisitorDeparture(visitor),
      ensureExitRoute: (visitor) => this.ensureExitRoute(visitor),
      routeWaste: (visitor) => this.visitorBehavior.tryDisposeWaste(visitor),
      chooseNextAction: (visitor) => this.visitorBehavior.chooseNextVisitorAction(visitor),
      updateVisitors: (minutes) => this.updateVisitors(minutes),
      updateFanIntrusion: (minutes) => this.updateFanIntrusion(minutes),
      updateBandActors: (minutes) => this.updateBandActors(minutes),
      updateFacilityQueues: (minutes) => this.updateFacilityQueues(minutes),
      updateVisitorFireworks: (minutes) => this.updateVisitorFireworks(minutes),
      updateCoasters: () => this.updateCoastersForCurrentTick(),
    })
    this.state.selectedTool = 'inspect'
    this.state.festival ??= createFestivalManagement()
    this.state.festival.infrastructure ??= createInfrastructure()
    this.state.festival.supplies = normalizeStock(this.state.festival.supplies)
    this.state.festival.infrastructure = normalizeInfrastructure(this.state.festival.infrastructure)
    this.state.scenario = normalizeScenarioSettings(this.state.scenario)
    this.camping = new CampingSystem({
      getCells: () => this.state.campingCells,
      setCells: (cells) => {
        this.state.campingCells = cells
      },
      getVisitors: () => this.state.visitors,
      getInstallations: () => this.state.campInstallations,
      setInstallations: (installations) => {
        this.state.campInstallations = installations
      },
      getItemQuantity: (visitorId, kind) => {
        const visitor = this.getVisitor(visitorId)
        return visitor ? getItemQuantity(visitor.inventory, kind) : 0
      },
      createId: () => this.nextId('camp-installation'),
      rng: () => this.rng,
      isInWorld: (x, z) => this.isInWorld(x, z),
      isGroundOccupied: (x, z) =>
        Boolean(
          this.getAt(x, z) ||
            this.getCoasterAt(x, z) ||
            this.getWasteDumpAt(x, z) ||
            this.isWaterTerrain(x, z),
        ),
      findPath: (start, goals, allowCamping) =>
        this.findPath(start, goals, false, allowCamping),
      hasPath: (cell) => Boolean(this.getPathAt(cell.x, cell.z, cell.elevation)),
      clearQueues: (visitorId) => this.removeVisitorFromCoasterQueues(visitorId),
      getAttractiveness: (x, z, elevation) =>
        this.getAtmosphereValue(this.attractivenessValues, x, z, elevation),
      getPartyMood: (x, z, elevation) =>
        this.getAtmosphereValue(this.partyMoodValues, x, z, elevation),
    })
    const owner = this
    this.visitorBehavior = new VisitorBehaviorService({
      get state() { return owner.state },
      get medical() { return owner.medical },
      get incidents() { return owner.incidents },
      get visitorSimulation() { return owner.visitorSimulation },
      get camping() { return owner.camping },
      get rng() { return owner.rng },
      get indexedVisitorCount() { return owner.indexedVisitorCount },
      set indexedVisitorCount(value) { owner.indexedVisitorCount = value },
      get stallQueueReturnIds() { return owner.stallQueueReturnIds },
      get pedestrianNavigation() { return owner.pedestrianNavigation },
      get lastNavRevision() { return owner.lastNavRevision },
      set lastNavRevision(value) { owner.lastNavRevision = value },
      get worldRevision() { return owner.worldRevision },
      get attractivenessValues() { return owner.attractivenessValues },
      get partyMoodValues() { return owner.partyMoodValues },
      get security() { return owner.security },
      get crowdingCosts() { return owner.visitorCrowding.costMap() },
      getWorldSize: () => this.getWorldSize(),
      getEntrance: () => this.getEntrance(),
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      getWaterLevel: () => this.getWaterLevel(),
      isWaterTerrain: (x, z) => this.isWaterTerrain(x, z),
      isSwimmableTerrain: (x, z) => this.isSwimmableTerrain(x, z),
      isMudTerrain: (x, z) => this.isMudTerrain(x, z),
      isVisitorSeatedInVehicle: (visitor, seated) => this.isVisitorSeatedInVehicle(visitor, seated),
      beginVisitorDeparture: (visitor) => this.beginVisitorDeparture(visitor),
      ensureExitRoute: (visitor) => this.ensureExitRoute(visitor),
      getVisitorArrivalCar: (visitor) => this.getVisitorArrivalCar(visitor),
      shouldReturnToArrivalCar: (visitor) => this.shouldReturnToArrivalCar(visitor),
      tryBoardDepartureCar: (visitor) => this.tryBoardDepartureCar(visitor),
      getMedicalCellAt: (x, z) => this.getMedicalCellAt(x, z),
      getWasteDumpAt: (x, z) => this.getWasteDumpAt(x, z),
      getStageForecourtCellAt: (x, z) => this.getStageForecourtCellAt(x, z),
      showQualityForStage: (stageId) => this.showQualityForStage(stageId),
      getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
      getSecurityGateAt: (x, z, elevation) => this.getSecurityGateAt(x, z, elevation),
      getCampingCellAt: (x, z) => this.getCampingCellAt(x, z),
      getVisitor: (id) => this.getVisitor(id),
      getCoaster: (id) => this.getCoaster(id),
      getCoasterQueueCapacity: (coasterId) => this.getCoasterQueueCapacity(coasterId),
      getRoadCellAt: (x, z, elevation) => this.getRoadCellAt(x, z, elevation),
      isOfferCurrentlyActive: (offer) => this.isOfferCurrentlyActive(offer),
      isBuildingCurrentlyActive: (building) => this.isBuildingCurrentlyActive(building),
      normalizeCarManifest: (group) => this.normalizeCarManifest(group),
      addGroundIncident: (kind, cell, severity) => this.addGroundIncident(kind, cell, severity),
      leaveVisitorCampBehind: (visitor) => this.leaveVisitorCampBehind(visitor),
      ensurePanicFleeRoute: (visitor) => this.ensurePanicFleeRoute(visitor),
      queueVisitorDecision: (visitor) => this.queueVisitorDecision(visitor),
      runVisitorRouting: (visitor, kind, action) => this.runVisitorRouting(visitor, kind, action),
      flushVisitorDecisions: (limit) => this.flushVisitorDecisions(limit),
      getCoasterQueueCells: (coaster) => this.getCoasterQueueCells(coaster),
      getBuildingQueueCells: (building) => this.getBuildingQueueCells(building),
      getFacilityQueue: (buildingId) => this.getFacilityQueue(buildingId),
      startFacilityInteraction: (visitor, target) => this.startFacilityInteraction(visitor, target),
      findPath: (start, goals, allowQueue, allowCamping, allowMedical, ignoreDirectionalRestrictions, allowFestival, maxVisited, allowStaff, allowBackstage) => this.findPath(start, goals, allowQueue, allowCamping, allowMedical, ignoreDirectionalRestrictions, allowFestival, maxVisited, allowStaff, allowBackstage),
      getPedestrianNeighbors: (cell, options) => this.getPedestrianNeighbors(cell, options),
      ensurePedestrianNav: (revalidate) => this.ensurePedestrianNav(revalidate),
      isPedestrianSolidAt: (x, z, elevation) => this.isPedestrianSolidAt(x, z, elevation),
      isPedestrianEdgeBlocked: (from, to) => this.isPedestrianEdgeBlocked(from, to),
      getDirectionIndex: (deltaX, deltaZ) => this.getDirectionIndex(deltaX, deltaZ),
      getAccessPathNeighbors: (access) => this.getAccessPathNeighbors(access),
      removeVisitorFromCoasterQueues: (visitorId) => this.removeVisitorFromCoasterQueues(visitorId),
      buildQueueExitRoute: (from, queueCells) => this.buildQueueExitRoute(from, queueCells),
      leaveQueueOnFoot: (visitor, thought) => this.leaveQueueOnFoot(visitor, thought),
      getFacilityAccessCells: (building) => this.getFacilityAccessCells(building),
      isVisitorAtShopCounter: (visitor, building) => this.isVisitorAtShopCounter(visitor, building),
      isWalkableServiceCell: (cell) => this.isWalkableServiceCell(cell),
      isAtParkExit: (visitor) => this.isAtParkExit(visitor),
      packCell: (cell) => this.packCell(cell),
      occupancyKeyForCell: (cell, path, localX, localZ) => this.occupancyKeyForCell(cell, path, localX, localZ),
      visitorOccupancyKey: (visitor) => this.visitorOccupancyKey(visitor),
      beginStallQueueReturn: (visitor, next) => this.beginStallQueueReturn(visitor, next),
      continueAfterStallQueueReturn: (visitor) => this.continueAfterStallQueueReturn(visitor),
      applyQueueLaneOffset: (visitor, next) => this.applyQueueLaneOffset(visitor, next),
      isInWorld: (x, z) => this.isInWorld(x, z),
      cellKey: (x, z, elevation) => this.cellKey(x, z, elevation),
      samplePedestrianSurfaceY: (x, z, path, fallback) => this.samplePedestrianSurfaceY(x, z, path, fallback),
      recordComplaint: (visitor, topic) => this.recordComplaint(visitor, topic),
      refundEntryFee: (visitor) => this.refundEntryFee(visitor),
      chargeVisitor: (visitor, amount, position, category) => this.chargeVisitor(visitor, amount, position, category),
    })
    const snapshotRepairContext: SnapshotRepairContext = {
      state: this.state,
      rng: this.rng,
      mergeIncidentStacks: (incidents) => this.mergeIncidentStacks(incidents),
      rebuildTerrainCache: () => this.rebuildTerrainCache(),
      recalculateCoasterTrackState: (coaster) => this.recalculateCoasterTrackState(coaster),
      getAt: (x, z) => this.getAt(x, z),
      getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
      restoreVisitorSleepRhythm: (visitor) => this.visitorBehavior.restoreVisitorSleepRhythm(visitor),
      repairDesignatedOccupancyReservations: () => this.repairDesignatedOccupancyReservations(),
      ensureEntrancePath: () => this.ensureEntrancePath(),
      ensureRoadIngress: () => this.ensureRoadIngress(),
      migrateWayElevations: () => this.migrateWayElevations(),
      migrateLegacyBusStopsToRoadside: () => this.migrateLegacyBusStopsToRoadside(),
      recalculateQueueDirections: () => this.recalculateQueueDirections(),
      refreshPower: () => this.refreshPower(),
      refreshBandSupplyGraph: () => this.refreshBandSupplyGraph(),
      evaluateAccessSignals: () => this.evaluateAccessSignals(),
    }
    normalizeSnapshotForRuntime(snapshotRepairContext)
    this.roadVehicleSimulation = new RoadVehicleSimulation({
      state: this.state,
      closedTrafficEdges: () => this.closedTrafficEdges,
      lastNavRevision: () => this.lastNavRevision,
      worldRevision: () => this.worldRevision,
      nextRandom: () => this.rng.next(),
      pedestrianCostAt: (cell) => this.pedestrianNavigation.costAt(cell),
      decideNextAction: (visitor) => this.visitorBehavior.decideNextAction(visitor),
      beginVehiclePullIn: this.beginVehiclePullIn.bind(this),
      canParkedCarDepart: this.canParkedCarDepart.bind(this),
      completeVisitorCarArrival: this.completeVisitorCarArrival.bind(this),
      createRoadVehicle: this.createRoadVehicle.bind(this),
      dispatchTourBuses: this.dispatchTourBuses.bind(this),
      emit: this.emit.bind(this),
      ensurePedestrianNav: this.ensurePedestrianNav.bind(this),
      findAvailableRoadEntry: this.findAvailableRoadEntry.bind(this),
      findPath: this.findPath.bind(this),
      finishTourBusLeg: this.finishTourBusLeg.bind(this),
      finishVehicleParking: this.finishVehicleParking.bind(this),
      getAdjacentParkingCells: this.getAdjacentParkingCells.bind(this),
      getAdjacentRoadPositions: this.getAdjacentRoadPositions.bind(this),
      getDirectionIndex: this.getDirectionIndex.bind(this),
      getLogisticsBuildingAccess: this.getLogisticsBuildingAccess.bind(this),
      getLogisticsPathAccess: this.getLogisticsPathAccess.bind(this),
      getOpenParkingApproachRoads: (parking) => this.getOpenParkingApproachRoads(parking),
      getParkingApproachRoads: this.getParkingApproachRoads.bind(this),
      getPathAt: this.getPathAt.bind(this),
      getPedestrianNeighbors: this.getPedestrianNeighbors.bind(this),
      getPedestrianSurfaceCost: this.getPedestrianSurfaceCost.bind(this),
      getRoadCellAt: this.getRoadCellAt.bind(this),
      getRoadCellsAt: this.getRoadCellsAt.bind(this),
      getRoadEntry: this.getRoadEntry.bind(this),
      getRoadGraph: this.getRoadGraph.bind(this),
      getSweeperAccessCells: this.getSweeperAccessCells.bind(this),
      getTerrainHeight: this.getTerrainHeight.bind(this),
      getVisitor: this.getVisitor.bind(this),
      getWorldSize: this.getWorldSize.bind(this),
      hasArrivalPassengersStillSeated: this.hasArrivalPassengersStillSeated.bind(this),
      isIllegalParkingPullIn: this.isIllegalParkingPullIn.bind(this),
      isMudTerrain: this.isMudTerrain.bind(this),
      isSealedWasteContainerOnRoad: this.isSealedWasteContainerOnRoad.bind(this),
      isSweeperDriveCell: this.isSweeperDriveCell.bind(this),
      isVehicleAtParkingAccess: this.isVehicleAtParkingAccess.bind(this),
      isVehicleOnItsParkingCell: this.isVehicleOnItsParkingCell.bind(this),
      isVisitorSeatedInVehicle: this.isVisitorSeatedInVehicle.bind(this),
      listFreeRoadEntries: this.listFreeRoadEntries.bind(this),
      nextId: this.nextId.bind(this),
      normalizeCarManifest: this.normalizeCarManifest.bind(this),
      packCell: this.packCell.bind(this),
      recordComplaint: this.recordComplaint.bind(this),
      refundEntryFee: this.refundEntryFee.bind(this),
      roadPositionKey: this.roadPositionKey.bind(this),
      searchReachableRoadExit: (start, direction, blocked, allowUTurn) =>
        this.searchReachableRoadExit(start, direction, blocked, allowUTurn),
    })
    this.idCounter = repairSnapshotEntities(snapshotRepairContext)
    this.visitorCrowding = new VisitorCrowdingSimulation({
      state: this.state,
      nextRandom: () => this.rng.next(),
      cellKey: (x, z, elevation) => this.cellKey(x, z, elevation),
      packCell: (cell) => this.packCell(cell),
      isVisitorSeated: (visitor, seated) => this.isVisitorSeatedInVehicle(visitor, seated),
      hasStageForecourt: (x, z) => Boolean(this.getStageForecourtCellAt(x, z)),
      clearVisitorActivity: (visitor) => this.visitorBehavior.clearVisitorActivity(visitor),
      removeVisitorFromCoasterQueues: (id) => this.removeVisitorFromCoasterQueues(id),
      isAtParkExit: (visitor) => this.isAtParkExit(visitor),
      getPedestrianNeighbors: (cell) => this.getPedestrianNeighbors(cell, {
        allowQueue: true, allowCamping: true, allowMedical: true,
        allowFestival: true, allowGrass: true, ignoreDirectionalRestrictions: true,
      }),
      getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
      findPathToEntrance: (start) => this.findPath(start, [this.getEntrance()], true, true, true, true),
      recordComplaint: (visitor, topic) => this.recordComplaint(visitor, topic),
      beginVisitorDeparture: (visitor) => this.beginVisitorDeparture(visitor),
    })
    this.visitorSpawning = new VisitorSpawning({
      state: this.state,
      rng: this.rng,
      getScenario: () => this.getScenario(),
      getEntrance: () => this.getEntrance(),
      getRoadEntry: () => this.getRoadEntry(),
      findAvailableRoadEntry: () => this.findAvailableRoadEntry(),
      nextId: (prefix) => this.nextId(prefix),
      idCounter: () => this.idCounter,
      getBookableCampingCapacity: () => this.getBookableCampingCapacity(),
      createPreferredSleepRhythm: () => this.visitorBehavior.createPreferredSleepRhythm(),
      samplePoisson: (lambda) => this.visitorBehavior.samplePoisson(lambda),
      ticketPriceFor: (ticketType) => this.ticketPriceFor(ticketType),
      chargeVisitor: (visitor, amount, position, category) => this.chargeVisitor(visitor, amount, position, category),
      queueVisitorDecision: (visitor) => this.queueVisitorDecision(visitor),
      assignCampsite: (visitor) => this.camping.assignCampsite(visitor),
      dispatchIncomingVisitorCar: (vehicle) => this.dispatchIncomingVisitorCar(vehicle),
      visitorsChanged: () => { this.indexedVisitorCount = -1 },
    })
    this.coasterSimulation = new CoasterSimulation({
      state: this.state,
      getVisitor: (id) => this.getVisitor(id),
      getCoasterQueueCells: (coaster) => this.getCoasterQueueCells(coaster),
      getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
      getEntrance: () => this.getEntrance(),
      isOfferCurrentlyActive: () => this.isOfferCurrentlyActive('rides'),
      chargeVisitor: (visitor, amount, position) => this.chargeVisitor(visitor, amount, position, 'rides'),
      queueStandOffset: (index, direction, packed) => this.queueStandOffset(index, direction, packed),
      samplePedestrianSurfaceY: (x, z, path, fallback) => this.samplePedestrianSurfaceY(x, z, path, fallback),
      prioritizeArrivedQueueVisitors: (queue) => this.prioritizeArrivedQueueVisitors(queue),
      getAccessPathNeighbors: (access) => this.getAccessPathNeighbors(access),
      addRideNausea: (visitor) => this.incidents.addRideNausea(visitor, SIMULATION_CONFIG.nausea.coasterIntensity),
    })
    this.placementService = new PlacementService({
      state: this.state,
      isInWorld: (x, z) => this.isInWorld(x, z),
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      getWaterLevel: () => this.getWaterLevel(),
      isWaterTerrain: (x, z) => this.isWaterTerrain(x, z),
      getRideAccessAt: (x, z) => this.getRideAccessAt(x, z),
      isLogisticsBuildingCell: (x, z) => this.isLogisticsBuildingCell(x, z),
      getCampingCellAt: (x, z) => this.getCampingCellAt(x, z),
      getMedicalCellAt: (x, z) => this.getMedicalCellAt(x, z),
      getStageForecourtCellAt: (x, z) => this.getStageForecourtCellAt(x, z),
      getBuildingVerticalBounds: (building) => this.getBuildingVerticalBounds(building),
      coasterOccupiesVolume: (x, z, elevation, height) => this.coasterOccupiesVolume(x, z, elevation, height),
      getRoadCellsAt: (x, z) => this.getRoadCellsAt(x, z),
      getRoadCellAt: (x, z, elevation) => this.getRoadCellAt(x, z, elevation),
      getPathAt: (x, z, elevation) => this.getPathAt(x, z, elevation),
      hasLiveParkingOccupancy: (x, z) => this.hasLiveParkingOccupancy(x, z),
      isAtTerrainLevel: (x, z, elevation) => this.isAtTerrainLevel(x, z, elevation),
      getTreeClearCost: (x, z, elevation, height) => this.getTreeClearCost(x, z, elevation, height),
      clearTreesAt: (x, z, elevation, height) => this.clearTreesAt(x, z, elevation, height),
      clearDesignatedOccupancyAt: (x, z, refund, options) => this.clearDesignatedOccupancyAt(x, z, refund, options),
      nextId: (prefix) => this.nextId(prefix),
      invalidateBuildingIndex: () => { this.indexedBuildingCount = -1 },
      invalidateRoadGraph: () => this.invalidateRoadGraph(),
      recalculateQueueDirections: () => this.recalculateQueueDirections(),
      relocateVisitorsFromPath: (path) => this.relocateVisitorsFromPath(path),
      removeAccessControlsAt: (x, z) => this.removeAccessControlsAt(x, z),
      evaluateAccessSignals: () => this.evaluateAccessSignals(),
      designateCampingCell: (x, z, enabled) => this.designateCampingCell(x, z, enabled),
      getPowerCableAt: (x, z) => this.getPowerCableAt(x, z),
      clearVisitorActivity: (visitor) => this.visitorBehavior.clearVisitorActivity(visitor),
      decideNextVisitorAction: (visitor) => this.visitorBehavior.decideNextAction(visitor),
      getAt: (x, z) => this.getAt(x, z),
      recalculatePark: () => this.recalculatePark(),
      refreshPower: () => this.refreshPower(),
      emit: () => this.emit(),
      getWorldSize: () => this.getWorldSize(),
    })
  }

  static startNew(settings: ScenarioSettings): GameState {
    return new GameState(createInitialSnapshot(settings))
  }

  get snapshot(): Readonly<GameSnapshot> {
    return this.state
  }

  /** @deprecated Diagnostic seam; runtime ownership is VisitorSimulation. */
  get visitorsAwaitingDecision(): Set<string> {
    return this.visitorSimulation.decisionQueue
  }

  /** @deprecated Diagnostic seam; runtime ownership is VisitorSimulation. */
  get pendingVisitorRouting(): Map<string, 'departure' | 'exit' | 'waste'> {
    return this.visitorSimulation.routingQueue
  }

  get renderAlpha(): number {
    if (this.state.speed === 0) return 1
    return Math.min(
      1,
      this.tickAccumulator / (this.networkMode === 'client' ? 0.2 : SIMULATION_CONFIG.time.tickSeconds),
    )
  }

  private getScenario(): ScenarioSettings {
    return this.state.scenario
  }

  private getWorldSize(): number {
    if (this.cachedWorldSize === 0) this.rebuildTerrainCache()
    return this.cachedWorldSize || this.getScenario().worldSize
  }

  private getEntrance(): Cell {
    const planned = createScenarioEntrance(this.getWorldSize())
    const path = this.state.buildings.find((building) => building.id === ENTRANCE_PATH_ID)
    if (path) return { x: path.x, z: path.z, elevation: path.elevation }
    return { x: planned.x, z: planned.z, elevation: this.getTerrainHeight(planned.x, planned.z) }
  }

  private getRoadEntry(): RoadPosition {
    return createScenarioRoadEntry(this.getWorldSize())
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  gate(command: GameCommand): ActionResult | null {
    if (this.applyingCommand) return null
    if (this.networkMode === 'solo') return null
    if (this.networkMode === 'host') return this.executeHostCommand(command)
    if (this.networkMode === 'client' && isOptimisticCommand(command)) {
      const commandId = `client-${Date.now().toString(36)}-${++this.optimisticCommandSequence}`
      command.clientCommandId = commandId
      this.applyingCommand = true
      let result: ActionResult
      try {
        result = applyGameCommand(this, command)
      } finally {
        this.applyingCommand = false
      }
      if (!result.ok) return result
      this.optimisticCommands.set(commandId, structuredClone(command))
      this.commandOutbox?.(command)
      return result
    }
    this.commandOutbox?.(command)
    return { ok: true, message: 'Befehl eingeplant' }
  }

  resolveOptimisticCommand(commandId: string): boolean {
    return this.optimisticCommands.delete(commandId)
  }

  private replayOptimisticCommands(): void {
    if (this.optimisticCommands.size === 0) return
    this.applyingCommand = true
    try {
      for (const command of this.optimisticCommands.values()) applyGameCommand(this, command)
    } finally {
      this.applyingCommand = false
    }
  }

  prepareClientLockstep(): void {
    this.lockstepReady = false
    this.scheduledCommands.clear()
    this.turnHashes.clear()
    this.optimisticCommands.clear()
  }

  receiveTurn(turn: SimTurn): void {
    if (turn.tick < this.state.simTick) {
      if (turn.commands.length > 0) this.onDesync?.(turn.hash, this.hashSim())
      return
    }
    if (turn.commands.length > 0) {
      const queued = this.scheduledCommands.get(turn.tick) ?? []
      queued.push(...turn.commands)
      this.scheduledCommands.set(turn.tick, queued)
    }
    if (turn.hash) this.turnHashes.set(turn.tick, turn.hash)
  }

  schedulePublicCommand(command: GameCommand): void {
    this.executeHostCommand(command)
  }

  private executeHostCommand(command: GameCommand): ActionResult {
    const elevation = this.state.buildElevation
    const rotation = this.state.buildRotation
    const applying = this.applyingCommand
    this.applyingCommand = true
    let result: ActionResult
    try {
      if (command.context) {
        this.state.buildElevation = command.context.buildElevation
        this.state.buildRotation = command.context.buildRotation
      }
      result = applyGameCommand(this, command)
    } finally {
      this.state.buildElevation = elevation
      this.state.buildRotation = rotation
      this.applyingCommand = applying
    }
    this.onCommandResult?.(command, result)
    if (command.type === 'festival' && !command.originPlayerId) this.onFestivalResult?.(result)
    return result
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.state.simTick}-${this.idCounter}`
  }

  private takeScheduledCommands(tick: number): GameCommand[] {
    const commands = this.scheduledCommands.get(tick) ?? []
    this.scheduledCommands.delete(tick)
    return commands
  }

  private hashSim(): number {
    let hash = this.state.simTick >>> 0
    hash = Math.imul(hash ^ (this.state.money | 0), 16777619)
    hash = Math.imul(hash ^ this.state.guests, 16777619)
    hash = Math.imul(hash ^ ((this.state.minute * 1000) | 0), 16777619)
    hash = Math.imul(hash ^ this.rng.getState(), 16777619)
    hash = Math.imul(hash ^ this.state.speed, 16777619)
    const visitor = this.state.visitors[0]
    if (visitor) {
      hash = Math.imul(
        hash ^ (visitor.cellX * 1009 + visitor.cellZ * 9176 + visitor.cellElevation),
        16777619,
      )
    }
    return hash >>> 0
  }

  private applyTurnCommands(commands: readonly GameCommand[]): void {
    this.applyingCommand = true
    try {
      for (const command of commands) {
        const elevation = this.state.buildElevation
        const rotation = this.state.buildRotation
        try {
          if (command.context) {
            this.state.buildElevation = command.context.buildElevation
            this.state.buildRotation = command.context.buildRotation
          }
          const result = applyGameCommand(this, command)
          this.onCommandResult?.(command, result)
          if (command.type === 'festival') this.onFestivalResult?.(result)
        } finally {
          this.state.buildElevation = elevation
          this.state.buildRotation = rotation
        }
      }
    } finally {
      this.applyingCommand = false
    }
  }

  private advanceOne(step: boolean): void {
    const tick = this.state.simTick
    this.applyTurnCommands(this.takeScheduledCommands(tick))
    if (step) this.stepFixed()
    this.state.simTick += 1
    this.state.rngState = this.rng.getState()
    const expected = this.turnHashes.get(this.state.simTick)
    if (expected) {
      this.turnHashes.delete(this.state.simTick)
      const actual = this.hashSim()
      if (expected !== actual) this.onDesync?.(expected, actual)
    } else if (
      this.networkMode === 'host' &&
      this.state.simTick % SIMULATION_CONFIG.time.hashIntervalTicks === 0
    ) {
      this.onTurnCommit?.({
        tick: this.state.simTick,
        commands: [],
        step,
        hash: this.hashSim(),
      })
    }
    if (!step) this.emit('tick')
  }

  private runReadyTurns(): void {
    while (this.scheduledCommands.has(this.state.simTick) && this.state.speed === 0) {
      this.advanceOne(false)
    }
  }

  refreshAfterNetworkApply(): void {
    this.indexedBuildingCount = -1
    this.indexedVisitorCount = -1
    this.roadGraph = null
    this.invalidateDesignatedOccupancy()
    this.rebuildTerrainCache()
    this.emit('tick')
  }

  applyNetworkWorld(world: WorldSnapshot): void {
    applyWorld(this.state, world)
    this.state.simTick ??= 0
    this.state.rngState ??= 1
    this.rng.setState(this.state.rngState)
    this.scheduledCommands.clear()
    this.turnHashes.clear()
    this.tickAccumulator = 0
    this.lastNavRevision = -1
    this.lockstepReady = true
    this.refreshAfterNetworkApply()
    this.replayOptimisticCommands()
  }

  applyNetworkSim(sim: SimSnapshot): void {
    applySim(this.state, sim)
    this.indexedVisitorCount = -1
    this.emit('tick')
  }

  manageFestival(action: FestivalAction): ActionResult {
    const blocked = this.gate({ type: 'festival', action })
    if (blocked) return blocked
    if (action.type === 'depot') {
      const preview = this.canPlaceSupplyDepot(action.x, action.z, action.role ?? 'storage')
      if (!preview.ok) return preview
    }
    if (action.type === 'staffGate') {
      const preview = this.canPlaceStaffGate(action.x, action.z, action.elevation)
      if (!preview.ok) return preview
    }
    if (action.type === 'stageDesign' && action.stageId) {
      const invalid = stageDesignIssue(action.design)
      if(invalid)return {ok:false,message:invalid}
      const stage=this.state.buildings.find(b=>b.id===action.stageId&&b.kind==='stage')
      if(stage){const issue=this.checkStageSite(action.design,stage.x,stage.z,stage.rotation,stage.elevation,stage.id);if(issue)return {ok:false,message:issue}}
    }
    let result: ActionResult
    this.wayBatch = action.type === 'wayArea'
    try { result = action.type === 'wayArea' ? this.buildWayArea(action.from, action.to, action.kind) : festivalAction(this.state, action) } finally { this.wayBatch = false }
    if (result.ok && action.type === 'stageDesign') { syncStageAudience(this.state); this.indexedBuildingCount=-1; this.refreshPower() }
    if (result.ok) { this.atmosphereMinutes = 999; this.worldRevision++; this.emit() }
    return result
  }

  private buildWayArea(from: { x: number; z: number }, to: { x: number; z: number }, kind: WayType): ActionResult {
    const type = WAY_TYPES[kind]
    if (!type) return { ok: false, message: 'Unbekannter Wegtyp' }
    const cells = groundRectangle(this.state, from, to)
    let changed = 0, reason = 'Keine geeigneten Felder'; const money = this.state.money
    for (const c of cells) {
      const key = groundKey(c.x, c.z), work = this.state.festival.infrastructure.ground[key]
      const property = type.mode === 'foot' ? 'footway' : 'roadway'
      const existing = type.mode === 'foot' ? this.getPathAt(c.x, c.z, this.getTerrainHeight(c.x, c.z)) : this.getRoadCellAt(c.x, c.z)
      if (existing && work?.[property] === kind) continue
      const issue = wayIssue(this.state, c.x, c.z, kind)
      if (issue) { reason = issue; continue }
      const base = type.mode === 'foot' ? BUILDINGS.path.cost : SIMULATION_CONFIG.logistics.roadBuildCost
      const extra = existing ? type.cost : type.cost - base
      const clear = existing ? 0 : this.getTreeClearCost(c.x, c.z, this.getTerrainHeight(c.x, c.z), 1)
      if (this.state.money < type.cost + clear) { reason = 'Budget erschöpft'; continue }
      if (!existing) {
        const result = type.mode === 'foot' ? this.placePathSegment(c.x, c.z, this.getTerrainHeight(c.x, c.z)) : this.designateRoad([c])
        if (!result.ok) { reason = result.message; continue }
      }
      const path = type.mode === 'foot' ? this.getPathAt(c.x, c.z, this.getTerrainHeight(c.x, c.z)) : undefined
      const road = type.mode === 'road' ? this.getRoadCellAt(c.x, c.z) : undefined
      if (!path && !road) { reason = 'Weg konnte an dieser Stelle nicht angelegt werden'; continue }
      bookFinance(this.state, 'construction', -extra)
      const cell = this.state.festival.infrastructure.ground[key] ??= {}
      cell[property] = kind
      if (path) path.wayType = kind
      if (road) road.speedLimit = type.limit as SpeedLimit
      changed++
    }
    if (changed) this.invalidateRoadGraph()
    return { ok: changed > 0, message: changed ? `${changed} × ${type.name} · ${money - this.state.money} €${cells.length > changed ? ` · ${cells.length - changed} übersprungen: ${reason}` : ''}` : reason }
  }

  applyNetworkUpdate(
    world: Partial<WorldSnapshot>,
    visitors: Array<{ id: string; changes: Partial<Visitor> }> = [],
    removed: string[] = [],
  ): void {
    Object.assign(this.state, world)
    const byId = new Map(this.state.visitors.map(visitor => [visitor.id, visitor]))
    for (const id of removed) byId.delete(id)
    for (const patch of visitors) {
      const existing = byId.get(patch.id)
      if (existing) Object.assign(existing, patch.changes)
      else byId.set(patch.id, patch.changes as Visitor)
    }
    this.state.visitors = [...byId.values()]
    this.tickAccumulator = 0
    this.indexedVisitorCount = -1
    if (world.buildings || world.terrain || world.scenario || world.logistics ||
        world.campingCells || world.medicalCells || world.stageForecourtCells ||
        world.backstageCells || world.bandActors) {
      this.refreshAfterNetworkApply()
    } else {
      this.emit('tick')
    }
  }

  setTool(tool: Tool): void {
    if (this.state.selectedTool !== tool) this.state.buildElevation = 0
    this.state.selectedTool = tool
    this.emit('local')
  }

  setBuildElevation(value: number): void {
    this.state.buildElevation = snapBuildElevation(value)
    this.emit('local')
  }

  getTerrainHeight(x: number, z: number): number {
    if (!this.terrainHeights) this.rebuildTerrainCache()
    const heights = this.terrainHeights
    if (!heights) return 0
    const size = this.cachedWorldSize
    const ix = x + this.cachedWorldHalf
    const iz = z + this.cachedWorldHalf
    if (ix < 0 || iz < 0 || ix >= size || iz >= size) return 0
    return heights[(iz * size + ix) | 0]! / 2
  }

  getWaterLevel(): number {
    return getWaterLevel(this.state)
  }

  isWaterTerrain(x: number, z: number): boolean {
    return isWaterHeight(this.getTerrainHeight(x, z), this.getWaterLevel())
  }

  isSwimmableTerrain(x: number, z: number): boolean {
    return isSwimmableHeight(this.getTerrainHeight(x, z), this.getWaterLevel())
  }

  isMudTerrain(x: number, z: number): boolean {
    return isMudHeight(this.getTerrainHeight(x, z))
  }

  editTerrain(
    x: number,
    z: number,
    mode: TerrainEditMode,
    corner = 0,
    originHeight?: number,
  ): ActionResult {
    return this.commitTerrainEdit(
      planTerrainEdit(
        this.state.terrain,
        this.getWorldSize(),
        x,
        z,
        mode,
        (cellX, cellZ) => this.isTerrainProtected(cellX, cellZ),
        corner,
        originHeight,
      ),
      mode,
    )
  }

  editTerrainArea(
    cells: ReadonlyArray<{ x: number; z: number }>,
    mode: TerrainEditMode,
    originHeight?: number,
  ): ActionResult {
    return this.commitTerrainEdit(
      planTerrainAreaEdit(
        this.state.terrain,
        this.getWorldSize(),
        cells,
        mode,
        (cellX, cellZ) => this.isTerrainProtected(cellX, cellZ),
        originHeight,
      ),
      mode,
    )
  }

  private commitTerrainEdit(
    planned:
      | { ok: false; message: string }
      | { ok: true; changes: Array<{ x: number; z: number; from: number; to: number }>; cornerChanges?: Array<{ x: number; z: number; from: number; to: number }> },
    mode: TerrainEditMode,
  ): ActionResult {
    if (!planned.ok) return planned
    const changedCells = planned.changes.length
    const cost = Math.max(1, changedCells) * SIMULATION_CONFIG.terrain.editCost
    if (this.state.money < cost) {
      return {
        ok: false,
        message: `Nicht genug Geld (${cost} € für ${Math.max(1, changedCells)} Felder)`,
      }
    }
    bookFinance(this.state, 'landscaping', -cost)
    applyTerrainChanges(this.state.terrain, planned.changes, planned.cornerChanges)
    for (const c of planned.changes) delete this.state.festival.infrastructure.ground[groundKey(c.x, c.z)]
    this.terrainHeights = null
    this.worldRevision += 1
    planned.changes.forEach((change) => {
      this.state.buildings.forEach((building) => {
        if (building.kind !== 'tree') return
        if (building.x !== change.x || building.z !== change.z) return
        building.elevation = change.to
      })
      this.state.visitors.forEach((visitor) => {
        if (visitor.cellX !== change.x || visitor.cellZ !== change.z) return
        if (this.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)) {
          return
        }
        visitor.y = change.to
        visitor.cellElevation = change.to
      })
    })
    this.emit()
    const verb =
      mode === 'raise' || mode === 'raiseCorner'
        ? 'erhöht'
        : mode === 'lower' || mode === 'lowerCorner' || mode === 'water'
          ? 'abgesenkt'
          : mode === 'smooth'
            ? 'geglättet'
            : 'eingeebnet'
    const fields = Math.max(1, changedCells)
    return {
      ok: true,
      message: `Gelände ${verb} (${fields} Feld${
        fields === 1 ? '' : 'er'
      }, ${cost} €)`,
    }
  }

  adjustBuildElevation(delta: number): void {
    this.state.buildElevation = stepBuildElevation(this.state.buildElevation, delta)
    this.emit('local')
  }

  rotateBuild(): void {
    this.state.buildRotation = (this.state.buildRotation + 1) % 4
    this.emit('local')
  }

  setSpeed(speed: number): void {
    this.state.speed = Math.max(0, Math.min(3, Math.floor(speed)))
    this.emit()
  }

  setParkOpen(open: boolean): ActionResult {
    if (open && (this.state.festival.planning || this.state.festival.finished)) return { ok: false, message: 'Zuerst das Festival im Festivalmenü starten' }
    if (this.state.parkOpen === open) {
      return { ok: true, message: open ? 'Der Park ist bereits geöffnet' : 'Der Park ist bereits geschlossen' }
    }
    this.state.parkOpen = open
    if (!open) {
      this.state.visitors.forEach((visitor) => {
        if (visitor.state !== 'riding') this.deferVisitorDeparture(visitor)
      })
    }
    this.emit()
    return {
      ok: true,
      message: open
        ? 'Der Park ist wieder geöffnet'
        : 'Der Park ist geschlossen – die Besucher reisen ab',
    }
  }

  private isVisitorInDepartureVehicle(visitor: Visitor): boolean {
    return Boolean(
      this.state.logistics.roadVehicles.find(
        (vehicle) =>
          vehicle.kind === 'visitorCar' &&
          vehicle.passengerIds.includes(visitor.id),
      ),
    )
  }

  /** Still in a car/bus/ambulance, or flagged as a vehicle passenger. Not on foot. */
  private isVisitorSeatedInVehicle(
    visitor: Pick<Visitor, 'id' | 'state'>,
    seated: ReadonlySet<string>,
  ): boolean {
    return (
      seated.has(visitor.id) ||
      visitor.state === 'vehicle-arrival' ||
      visitor.state === 'bus-riding'
    )
  }

  private beginVisitorDeparture(visitor: Visitor): void {
    if (this.isVisitorInDepartureVehicle(visitor)) return
    if (visitor.pendingWaste > 0 && visitor.state === 'seeking' && visitor.route.length > 0 &&
        visitor.targetId && this.state.buildings.some(building => building.id === visitor.targetId && isWasteBin(building.kind))) return
    if (!this.runVisitorRouting(visitor, 'departure', () => this.planVisitorDeparture(visitor))) {
      this.deferVisitorDeparture(visitor)
    }
  }

  private deferVisitorDeparture(visitor: Visitor): void {
    if (this.isVisitorInDepartureVehicle(visitor)) return
    // Closing from a UI/network command must not search for the entire crowd
    // outside the tick budget, including while the simulation is paused.
    this.visitorSimulation.deferRouting(visitor.id, 'departure')
    this.clearVisitorForDeparture(visitor)
    visitor.state = 'leaving'
    visitor.route = []
    visitor.targetId = null
  }

  private planVisitorDeparture(visitor: Visitor): void {
    if ((visitor.pendingWaste ?? 0) > 0 && visitor.campingPhase !== 'packing') {
      this.visitorBehavior.tryDisposeWaste(visitor)
      if (
        visitor.state === 'seeking' &&
        visitor.pendingWaste > 0 &&
        visitor.route.length > 0
      ) {
        return
      }
    }
    this.clearVisitorForDeparture(visitor)
    this.camping.beginDeparture(visitor, this.getEntrance())
    if (visitor.state === 'leaving') this.leaveVisitorCampBehind(visitor)
    if (visitor.ticketType === 'day') visitor.hasHandcart = false
    this.ensureExitRoute(visitor)
  }

  private clearVisitorForDeparture(visitor: Visitor): void {
    this.visitorBehavior.clearVisitorActivity(visitor)
    this.removeVisitorFromCoasterQueues(visitor.id)
    visitor.streakingMinutes = 0
    visitor.toplessMinutes = 0
    this.medical.releaseBed(this.state.medicalCells, visitor.id)
    visitor.medicalCell = null
    visitor.medicalSlot = null
    visitor.securityResumeState = null
    this.state.staff.forEach((member) => {
      if (member.targetId !== visitor.id) return
      member.targetId = null
      member.route = []
      member.medicalCell = null
      member.medicalSlot = null
      member.state = 'patrolling'
    })
  }

  private ensureExitRoute(visitor: Visitor): void {
    if (visitor.state !== 'leaving') return
    // A loaded snapshot can reconstruct a departure whose routing was deferred.
    if (this.visitorSimulation.pendingRoutingKind(visitor.id) === 'departure' ||
        (visitor.campsite && visitor.campingPhase !== 'none') || visitor.pendingWaste > 0) {
      this.beginVisitorDeparture(visitor)
      return
    }
    if (this.isAtEntrance(visitor) && !this.getVisitorArrivalCar(visitor)) return
    if (visitor.route.length > 0 && (!visitor.arrivalGroupId || visitor.targetId)) return
    this.runVisitorRouting(visitor, 'exit', () => this.planExitRoute(visitor))
  }

  private planExitRoute(visitor: Visitor): void {
    if (this.routeVisitorToParkedCar(visitor)) return
    if (this.getVisitorArrivalGroup(visitor)?.mode === 'car') {
      visitor.route = []
      visitor.thought = 'Ich warte auf unser Auto.'
      return
    }
    if (visitor.route.length > 0) return
    visitor.route =
      this.findPath(
        {
          x: visitor.cellX,
          z: visitor.cellZ,
          elevation: visitor.cellElevation,
        },
        [this.getEntrance()],
        true,
        true,
        true,
        true,
      ) ?? [this.getEntrance()]
    visitor.thought = 'Der Park ist geschlossen – ich gehe jetzt zum Ausgang.'
  }

  private getVisitorArrivalGroup(visitor: Visitor): ArrivalGroup | undefined {
    if (!visitor.arrivalGroupId) return undefined
    return this.state.logistics.arrivalGroups.find(
      (candidate) => candidate.id === visitor.arrivalGroupId,
    )
  }

  private getVisitorArrivalCar(visitor: Visitor): RoadVehicle | undefined {
    const group = this.getVisitorArrivalGroup(visitor)
    if (!group?.vehicleId || group.mode !== 'car') return undefined
    return this.state.logistics.roadVehicles.find(
      (candidate) =>
        candidate.id === group.vehicleId &&
        candidate.kind === 'visitorCar',
    )
  }

  private shouldReturnToArrivalCar(visitor: Visitor): boolean {
    const vehicle = this.getVisitorArrivalCar(visitor)
    if (!vehicle || vehicle.state !== 'parked') return false
    if (!this.state.parkOpen) return true
    const group = this.getVisitorArrivalGroup(visitor)
    if (!group) return false
    return this.livingArrivalMembers(group).some(
      (member) =>
        member.id !== visitor.id &&
        (member.state === 'leaving' ||
          vehicle.passengerIds.includes(member.id)),
    )
  }

  private routeVisitorToParkedCar(visitor: Visitor): boolean {
    const vehicle = this.getVisitorArrivalCar(visitor)
    if (!vehicle || vehicle.state !== 'parked' || !vehicle.parkingCell) {
      return false
    }
    if (this.isVisitorAtParkedCarDoor(visitor, vehicle)) {
      visitor.targetId = vehicle.id
      visitor.route = []
      return true
    }
    if (visitor.targetId === vehicle.id && visitor.route.length > 0) return true
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const goals = this.getParkedCarBoardCells(vehicle.parkingCell)
    const path = this.findPath(start, goals)
    if (!path) return false
    visitor.targetId = vehicle.id
    visitor.route = path
    visitor.thought = 'Ich gehe zurück zu unserem Auto.'
    return true
  }

  private isVisitorAtParkedCarDoor(
    visitor: Pick<Visitor, 'cellX' | 'cellZ'>,
    vehicle: RoadVehicle,
  ): boolean {
    if (!vehicle.parkingCell) return false
    if (
      visitor.cellX === vehicle.parkingCell.x &&
      visitor.cellZ === vehicle.parkingCell.z
    ) {
      return true
    }
    if (
      this.collectParkingPathNeighbors(vehicle.parkingCell).some(
        (access) => access.x === visitor.cellX && access.z === visitor.cellZ,
      )
    ) {
      return true
    }
    return this.getParkingApproachRoads(vehicle.parkingCell).some(
      (access) => access.x === visitor.cellX && access.z === visitor.cellZ,
    )
  }

  private tryBoardDepartureCar(visitor: Visitor): boolean {
    if (!visitor.targetId) return false
    const vehicle = this.state.logistics.roadVehicles.find(
      (candidate) =>
        candidate.id === visitor.targetId &&
        candidate.kind === 'visitorCar' &&
        candidate.state === 'parked',
    )
    if (!vehicle) return false
    if (!this.isVisitorAtParkedCarDoor(visitor, vehicle)) return false
    const group = this.state.logistics.arrivalGroups.find(
      (candidate) => candidate.id === vehicle.groupId,
    )
    if (group) this.normalizeCarManifest(group)
    if (group && !group.memberIds.includes(visitor.id)) return false
    if (!vehicle.passengerIds.includes(visitor.id)) {
      vehicle.passengerIds.push(visitor.id)
    }
    visitor.state = 'leaving'
    visitor.route = []
    visitor.x = vehicle.position.x + 0.5
    visitor.z = vehicle.position.z + 0.5
    visitor.cellX = vehicle.position.x
    visitor.cellZ = vehicle.position.z
    visitor.thought = 'Ich sitze im Auto und warte auf die Abfahrt.'
    return true
  }

  hireStaff(role: StaffRole): ActionResult {
    const definition = STAFF_DEFINITIONS[role]
    if (this.state.money < definition.hireCost) {
      return { ok: false, message: 'Nicht genug Geld für diese Einstellung' }
    }
    bookFinance(this.state, 'staff', -definition.hireCost)
    const member = createStaffMember(this.nextId('staff'), role, this.getEntrance())
    const usedNumbers = new Set(
      this.state.staff
        .filter((p) => p.role === role)
        .map((p) => Number(/(\d+)$/.exec(p.name)?.[1]))
        .filter((n) => Number.isInteger(n)),
    )
    let number = 1
    while (usedNumbers.has(number)) number += 1
    member.name = `${definition.name} ${number}`
    member.hiredDay = this.state.day
    member.hiredMinute = this.state.minute
    this.state.staff.push(member)
    this.emit()
    return { ok: true, message: `${definition.name} eingestellt` }
  }

  toggleStaffZone(staffId: string, key: string): ActionResult {
    const assignee = this.findStaffZoneAssignee(staffId)
    if (!assignee) return { ok: false, message: 'Personal nicht gefunden' }
    return this.setStaffZone(staffId, key, zonePaintActive(assignee.workZones, key))
  }

  setStaffZone(staffId: string, key: string, active: boolean): ActionResult {
    const member = this.state.staff.find((p) => p.id === staffId)
    const sweeper = member
      ? undefined
      : this.state.logistics.roadVehicles.find(
          (vehicle) => vehicle.id === staffId && vehicle.kind === 'sweeper',
        )
    const assignee = member ?? sweeper
    if (!assignee) return { ok: false, message: 'Personal nicht gefunden' }
    const result = setAssignedWorkZones(assignee.workZones, key, active)
    if (!result.ok) return result
    if (!result.changed) {
      return { ok: true, message: active ? 'Bereich bereits zugewiesen' : 'Bereich bereits entfernt' }
    }
    assignee.workZones = result.next
    if (member && member.state === 'patrolling') member.route = []
    if (sweeper && (sweeper.state === 'idle' || sweeper.state === 'responding')) {
      sweeper.route = []
      sweeper.state = 'idle'
    }
    this.emit()
    return { ok: true, message: active ? 'Bereich zugewiesen' : 'Bereich entfernt' }
  }

  private findStaffZoneAssignee(staffId: string) {
    const member = this.state.staff.find((p) => p.id === staffId)
    if (member) return member
    return this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === staffId && vehicle.kind === 'sweeper',
    )
  }

  placeStaffAt(staffId: string, x: number, z: number): ActionResult {
    const member = this.state.staff.find((p) => p.id === staffId)
    if (!member) return { ok: false, message: 'Personal nicht gefunden' }
    const half = this.getWorldSize() / 2
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < -half || x >= half || z < -half || z >= half) {
      return { ok: false, message: 'Ziel liegt außerhalb der Karte' }
    }
    if (this.isWaterTerrain(x, z)) return { ok: false, message: 'Dort ist Wasser' }
    const elevation = this.getTerrainHeight(x, z)
    member.cellX = x
    member.cellZ = z
    member.cellElevation = elevation
    member.x = x + 0.5
    member.y = elevation
    member.z = z + 0.5
    member.route = []
    member.targetId = null
    this.emit()
    return { ok: true, message: `${member.name} platziert` }
  }

  fireStaff(role: StaffRole): ActionResult {
    let index = -1
    for (let cursor = this.state.staff.length - 1; cursor >= 0; cursor -= 1) {
      const member = this.state.staff[cursor]
      if (
        member?.role === role &&
        member.state !== 'carrying' &&
        (member.carryingWaste ?? 0) <= 0
      ) {
        index = cursor
        break
      }
    }
    if (index < 0) return { ok: false, message: 'Kein verfügbares Personal dieser Rolle' }
    const [removed] = this.state.staff.splice(index, 1)
    if (removed?.medicalCell && removed.targetId) {
      this.medical.releaseBed(this.state.medicalCells, removed.targetId)
    }
    this.emit()
    return { ok: true, message: `${STAFF_DEFINITIONS[role].name} entlassen` }
  }

  fireStaffMember(staffId: string): ActionResult {
    const sweeper = this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === staffId && vehicle.kind === 'sweeper',
    )
    if (sweeper) return this.removeSweeper(sweeper.id)
    const index = this.state.staff.findIndex((p) => p.id === staffId)
    if (index < 0) return { ok: false, message: 'Personal nicht gefunden' }
    const member = this.state.staff[index]!
    if (member.state === 'carrying' || (member.carryingWaste ?? 0) > 0) {
      return { ok: false, message: 'Person trägt noch Fracht und kann gerade nicht entlassen werden' }
    }
    const [removed] = this.state.staff.splice(index, 1)
    if (removed?.medicalCell && removed.targetId) {
      this.medical.releaseBed(this.state.medicalCells, removed.targetId)
    }
    this.emit()
    return { ok: true, message: `${removed!.name} entlassen` }
  }

  designateMedicalArea(
    cells: ReadonlyArray<{ x: number; z: number }>,
  ): ActionResult {
    const result = this.medical.designate(
      this.state.medicalCells,
      cells,
      (x, z) => this.canDesignateMedicalCell(x, z),
    )
    result.cells.forEach((cell) => {
      this.clearTreesAt(cell.x, cell.z, 0, 1)
      cell.elevation = this.getTerrainHeight(cell.x, cell.z)
    })
    this.state.medicalCells = result.cells
    this.invalidateDesignatedOccupancy()
    this.emit()
    return {
      ok: result.placed > 0,
      message:
        result.placed > 0
          ? `${result.placed} Felder als Krankenbereich ausgewiesen`
          : 'Keine freien Felder für den Krankenbereich',
    }
  }

  getMedicalCellAt(x: number, z: number): MedicalCell | undefined {
    this.ensureSpatialIndexes()
    return this.medicalIndex.get(this.packXZ(x, z))
  }

  private invalidateDesignatedOccupancy(): void {
    this.indexedParkingRef = null
    this.indexedMedicalRef = null
    this.indexedBackstageRef = null
    this.parkingIndex.clear()
    this.medicalIndex.clear()
    this.backstageIndex.clear()
    this.pedestrianNavigation.clear()
    this.lastNavRevision = -1
  }

  private repairDesignatedOccupancyReservations(): void {
    const visitorIds = new Set(this.state.visitors.map((visitor) => visitor.id))
    const vehicleIds = new Set(
      this.state.logistics.roadVehicles.map((vehicle) => vehicle.id),
    )
    this.state.logistics.parkingCells.forEach((cell) => {
      if (cell.occupiedBy && !vehicleIds.has(cell.occupiedBy)) {
        cell.occupiedBy = null
      }
    })
    this.state.logistics.roadVehicles.forEach((vehicle) => {
      if (
        vehicle.parkingCell &&
        !this.state.logistics.parkingCells.some(
          (cell) =>
            cell.x === vehicle.parkingCell?.x &&
            cell.z === vehicle.parkingCell?.z,
        )
      ) {
        vehicle.parkingCell = null
        if (vehicle.target?.kind === 'parking') vehicle.target = null
      }
    })
    this.state.medicalCells = this.state.medicalCells.map((cell) =>
      normalizeMedicalCell(cell, visitorIds),
    )
    this.state.visitors.forEach((visitor) => {
      if (
        visitor.medicalCell &&
        !this.state.medicalCells.some(
          (cell) =>
            cell.x === visitor.medicalCell?.x &&
            cell.z === visitor.medicalCell?.z,
        )
      ) {
        visitor.medicalCell = null
        visitor.medicalSlot = null
      }
    })
    this.state.staff.forEach((member) => {
      if (
        member.medicalCell &&
        !this.state.medicalCells.some(
          (cell) =>
            cell.x === member.medicalCell?.x &&
            cell.z === member.medicalCell?.z,
        )
      ) {
        member.medicalCell = null
        member.medicalSlot = null
      }
    })
    this.invalidateDesignatedOccupancy()
  }

  private parkingCellIsVacant(cell: { occupiedBy: string | null }): boolean {
    if (!cell.occupiedBy) return true
    return !this.state.logistics.roadVehicles.some(
      (vehicle) => vehicle.id === cell.occupiedBy,
    )
  }

  private hasLiveParkingOccupancy(x: number, z: number): boolean {
    const parking = this.state.logistics.parkingCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
    return Boolean(parking && !this.parkingCellIsVacant(parking))
  }

  private evictParkingOccupants(parking: { x: number; z: number; occupiedBy: string | null }): void {
    const vehicle = this.state.logistics.roadVehicles.find(
      (candidate) =>
        candidate.id === parking.occupiedBy ||
        (candidate.parkingCell?.x === parking.x &&
          candidate.parkingCell?.z === parking.z),
    )
    if (vehicle) {
      const access =
        this.getParkingApproachRoads(parking)[0] ??
        this.getAdjacentRoadPositions(parking)[0]
      this.releaseVisitorCarParking(vehicle)
      if (
        access &&
        (vehicle.state === 'parked' || vehicle.state === 'parking')
      ) {
        vehicle.cell = { ...access }
        vehicle.position = { ...access }
        vehicle.state = 'driving'
        vehicle.route = []
        vehicle.target = null
      }
    }
    parking.occupiedBy = null
  }

  private evictMedicalOccupants(cell: MedicalCell): void {
    for (const occupantId of cell.occupants) {
      if (!occupantId) continue
      const visitor = this.getVisitor(occupantId)
      this.medical.releaseBed(this.state.medicalCells, occupantId)
      if (!visitor) continue
      visitor.medicalCell = null
      visitor.medicalSlot = null
      if (visitor.state === 'medical' || visitor.state === 'medical-transport') {
        visitor.state = 'exploring'
        visitor.thought = 'Die Liege ist verschwunden.'
        this.visitorBehavior.decideNextAction(visitor)
      }
    }
    this.state.staff.forEach((member) => {
      if (
        member.medicalCell?.x === cell.x &&
        member.medicalCell?.z === cell.z
      ) {
        member.medicalCell = null
        member.medicalSlot = null
      }
    })
  }

  private tileBlocksMedicalDesignation(x: number, z: number): boolean {
    return this.getBuildingsAtCell(x, z).some(
      (building) => building.kind !== 'tree' && !allowsMedicalOverlay(building.kind),
    )
  }

  private clearDesignatedOccupancyAt(
    x: number,
    z: number,
    evict: boolean,
    options?: { preserveMedical?: boolean },
  ): ActionResult | null {
    const parking = this.state.logistics.parkingCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
    if (parking) {
      if (!evict && !this.parkingCellIsVacant(parking)) return null
      this.evictParkingOccupants(parking)
      this.state.logistics.parkingCells =
        this.state.logistics.parkingCells.filter((cell) => cell !== parking)
      this.invalidateDesignatedOccupancy()
      return { ok: true, message: 'Parkplatz aufgehoben' }
    }
    if (options?.preserveMedical) return null
    const medical = this.state.medicalCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
    if (medical) {
      if (
        !evict &&
        medical.occupants.some((occupant) => occupant && this.getVisitor(occupant))
      ) {
        return null
      }
      this.evictMedicalOccupants(medical)
      this.state.medicalCells = this.state.medicalCells.filter(
        (cell) => cell.x !== x || cell.z !== z,
      )
      this.invalidateDesignatedOccupancy()
      return { ok: true, message: 'Krankenbereich aufgehoben' }
    }
    return null
  }

  getWasteDumpAt(x: number, z: number): WasteDumpCell | undefined {
    this.ensureSpatialIndexes()
    return this.wasteDumpIndex.get(this.packXZ(x, z))
  }

  private listSealedWasteContainers(): SealedWasteContainerInfo[] {
    const reachable = this.collectGarbageTruckReachableRoadKeys()
    const truckEnRouteIds = new Set<string>()
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'garbageTruck' || vehicle.state === 'idle') continue
      const target = vehicle.target
      if (target?.kind === 'sealedWasteContainer') {
        truckEnRouteIds.add(target.buildingId)
      }
    }
    return this.state.buildings
      .filter((building) => isSealedWasteContainer(building.kind))
      .map((building) => {
        const road = this.getRoadCellAt(building.x, building.z, building.elevation)
        const onRoad = Boolean(road)
        const truckReachable =
          onRoad && this.sealedContainerRoadIsReachable(building, reachable)
        return {
          id: building.id,
          x: building.x,
          z: building.z,
          elevation: building.elevation,
          stored: building.wasteFill ?? 0,
          onRoad,
          truckReachable,
          truckEnRoute: truckEnRouteIds.has(building.id),
        }
      })
  }

  private collectGarbageTruckReachableRoadKeys(): Set<string> {
    const graph = this.getRoadGraph()
    const seeds: RoadPosition[] = []
    for (const depot of this.state.logistics.wasteDepots) {
      const access = this.getLogisticsBuildingAccess(depot, 2)
      if (access) seeds.push(access)
    }
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'garbageTruck') continue
      const here = vehicle.cell ?? vehicle.position
      if (here) seeds.push(here)
    }
    const seen = new Set<string>()
    const queue: string[] = []
    const enqueue = (position: RoadPosition) => {
      const road = this.getRoadCellAt(position.x, position.z, position.elevation)
      if (!road) return
      const key = roadLayerKey(
        road.x,
        road.z,
        road.elevation ?? this.getTerrainHeight(road.x, road.z),
      )
      if (seen.has(key)) return
      seen.add(key)
      queue.push(key)
    }
    seeds.forEach((seed) => enqueue(seed))
    while (queue.length > 0) {
      const key = queue.shift()!
      const neighbors = graph.neighbors.get(key) ?? []
      neighbors.forEach((neighbor) => enqueue(neighbor))
    }
    return seen
  }

  isSealedWasteContainerOnRoad(building: {
    x: number
    z: number
    elevation: number
  }): boolean {
    return Boolean(this.getRoadCellAt(building.x, building.z, building.elevation))
  }

  getDepotAt(x: number, z: number) {
    return this.state.festival.infrastructure.depots.find((depot) => depot.x === x && depot.z === z)
  }

  getDepot(id: string) {
    return this.state.festival.infrastructure.depots.find((depot) => depot.id === id)
  }

  designateWasteDump(
    cells: ReadonlyArray<{ x: number; z: number }>,
  ): ActionResult {
    const result = designateWasteDumps(
      this.state.wasteDumpCells,
      cells,
      (x, z) => this.canDesignateWasteDumpCell(x, z),
      this.state.money,
    )
    result.cells.forEach((cell) => {
      this.clearTreesAt(cell.x, cell.z, 0, 1)
      cell.elevation = this.getTerrainHeight(cell.x, cell.z)
    })
    bookFinance(this.state, 'landscaping', -result.cost)
    this.state.wasteDumpCells = result.cells
    this.emit()
    return {
      ok: result.placed > 0,
      message:
        result.placed > 0
          ? `${result.placed} Felder als Müllablage ausgewiesen`
          : this.state.money < SIMULATION_CONFIG.waste.dumpDesignationCost
            ? 'Nicht genug Geld für eine Müllablage'
            : 'Keine freien Felder für eine Müllablage',
    }
  }

  getStageForecourtCellAt(
    x: number,
    z: number,
  ): StageForecourtCell | undefined {
    this.ensureSpatialIndexes()
    return this.forecourtIndex.get(this.packXZ(x, z))
  }

  designateStageForecourt(
    cells: ReadonlyArray<{ x: number; z: number }>,
  ): ActionResult {
    const result = this.festivalAreas.designate(
      this.state.stageForecourtCells,
      cells,
      (x, z) =>
        this.isInWorld(x, z) &&
        !this.isWaterTerrain(x, z) &&
        (!this.getAt(x, z) || this.getAt(x, z)?.kind === 'tree') &&
        !this.getCampingCellAt(x, z) &&
        !this.getMedicalCellAt(x, z) &&
        !this.getWasteDumpAt(x, z) &&
        !this.getCoasterAt(x, z),
      this.state.money,
    )
    result.cells.forEach((cell) => {
      this.clearTreesAt(cell.x, cell.z, 0, 1)
      cell.elevation = this.getTerrainHeight(cell.x, cell.z)
    })
    this.state.stageForecourtCells = result.cells
    bookFinance(this.state, 'landscaping', -result.cost)
    if (result.placed > 0) this.recalculateQueueDirections()
    this.emit()
    return {
      ok: result.placed > 0,
      message:
        result.placed > 0
          ? `${result.placed} Bühnenvorplatz-Felder ausgewiesen`
          : 'Keine freien oder bezahlbaren Felder für den Bühnenvorplatz',
    }
  }

  getBackstageCellAt(x: number, z: number): BackstageCell | undefined {
    this.ensureSpatialIndexes()
    return this.backstageIndex.get(this.packXZ(x, z))
  }

  getBandSupplyAt(x: number, z: number): BandSupplyStats | undefined {
    this.refreshBandSupplyGraph()
    return bandSupplyAt(this.state.bandSupply, this.bandSupplyComponents, x, z)
  }

  getBandSupplyForStage(stageId: string): BandSupplyStats | undefined {
    this.refreshBandSupplyGraph()
    return bandSupplyForStage(this.state.bandSupply, stageId)
  }

  showQualityForStage(stageId: string): number {
    this.refreshBandSupplyGraph()
    return showQualityForStage(this.state.bandSupply, stageId)
  }

  getActiveBackstageKeys(): string[] {
    this.refreshBandSupplyGraph()
    return this.bandSupplyComponents.flatMap((component) =>
      component.active ? component.cells.map((cell) => `${cell.x}:${cell.z}`) : [],
    )
  }

  designateBackstageArea(
    cells: ReadonlyArray<{ x: number; z: number }>,
    enabled = true,
  ): ActionResult {
    const result = designateBackstageAreas(
      this.state.backstageCells,
      cells,
      (x, z) => this.canDesignateBackstageCell(x, z),
      this.state.money,
      enabled,
      (x, z) => this.getTerrainHeight(x, z),
    )
    bookFinance(this.state, 'landscaping', -result.cost)
    this.state.backstageCells = result.cells
    this.indexedBackstageRef = null
    this.refreshBandSupplyGraph()
    this.emit()
    return {
      ok: result.changed > 0,
      message:
        result.changed > 0
          ? enabled
            ? `${result.changed} Backstage-Felder ausgewiesen`
            : `${result.changed} Backstage-Felder entfernt`
          : enabled
            ? this.state.money < SIMULATION_CONFIG.bandSupply.backstageDesignationCost
              ? 'Nicht genug Geld für Backstage'
              : 'Keine neuen Backstage-Felder'
            : 'Keine Backstage-Felder zum Entfernen',
    }
  }

  syncBandSupply(): void {
    this.refreshBandSupplyGraph()
    this.syncBandActors()
  }

  setPathFlow(
    x: number,
    z: number,
    elevation: number,
    direction: number | null,
  ): ActionResult {
    const path = this.getPathAt(x, z, elevation)
    if (!path || path.pathType !== 'normal') {
      return { ok: false, message: 'Nur normale Wege können eine Laufrichtung erhalten' }
    }
    path.flowDirection = normalizeFlowDirection(direction)
    this.emit()
    return {
      ok: true,
      message:
        path.flowDirection == null
          ? 'Bewegungsrichtung entfernt'
          : 'Bewegungsrichtung des Weges gesetzt',
    }
  }

  placeTrafficLight(x: number, z: number, direction: Direction): ActionResult {
    if (!this.getRoadCellAt(x, z)) {
      return { ok: false, message: 'Ampeln stehen nur auf einer Straße' }
    }
    const existing = this.state.accessControls.trafficLights.find(
      (light) => light.x === x && light.z === z && light.direction === direction,
    )
    if (existing) {
      return { ok: false, message: 'Hier steht bereits eine Ampel in dieser Richtung', placedId: existing.id }
    }
    const cost = SIMULATION_CONFIG.logistics.trafficLightCost
    if (this.state.money < cost) {
      return { ok: false, message: `Die Ampel kostet ${cost} €` }
    }
    bookFinance(this.state, 'construction', -cost)
    const light = createTrafficLight(this.nextId('light'), x, z, direction)
    this.state.accessControls.trafficLights.push(light)
    this.evaluateAccessSignals()
    this.emit()
    return { ok: true, message: 'Ampel gebaut', placedId: light.id }
  }

  placePathBarrier(x: number, z: number, elevation: number, direction: Direction): ActionResult {
    const path = this.getPathAt(x, z, elevation) ?? this.getPathAt(x, z)
    if (!path || path.pathType !== 'normal') {
      return { ok: false, message: 'Schranken stehen nur auf normalen Wegen' }
    }
    const existing = this.state.accessControls.pathBarriers.find(
      (barrier) =>
        barrier.x === x &&
        barrier.z === z &&
        Math.abs(barrier.elevation - path.elevation) < 0.01 &&
        barrier.direction === direction,
    )
    if (existing) {
      return { ok: false, message: 'Hier steht bereits eine Schranke in dieser Richtung', placedId: existing.id }
    }
    const cost = SIMULATION_CONFIG.logistics.pathBarrierCost
    if (this.state.money < cost) {
      return { ok: false, message: `Die Schranke kostet ${cost} €` }
    }
    bookFinance(this.state, 'construction', -cost)
    const barrier = createPathBarrier(
      this.nextId('barrier'),
      x,
      z,
      path.elevation,
      direction,
    )
    this.state.accessControls.pathBarriers.push(barrier)
    this.evaluateAccessSignals()
    this.emit()
    return { ok: true, message: 'Wegschranke gebaut', placedId: barrier.id }
  }

  configureAccessControl(
    id: string,
    patch: AccessControlPatch,
  ): ActionResult {
    const control = this.getAccessControl(id)
    if (!control) return { ok: false, message: 'Kontrolle nicht gefunden' }
    if (patch.mode) control.mode = patch.mode
    if (patch.openSlots) {
      control.openSlots = Array.from({ length: 6 }, (_, index) =>
        Boolean(patch.openSlots?.[index]),
      )
    }
    if (patch.scheduleTime) {
      control.scheduleTime = normalizeScheduleTime(patch.scheduleTime)
    }
    if (patch.scheduleHours) {
      control.scheduleHours = normalizeScheduleHours(patch.scheduleHours)
    }
    if (patch.scheduleOffer) {
      control.scheduleOffer = normalizeScheduleOffer(patch.scheduleOffer)
    }
    if (Array.isArray(patch.schedulePhases)) {
      control.schedulePhases = normalizeSchedulePhases(patch.schedulePhases)
    }
    if (patch.polarity) control.polarity = patch.polarity
    if (typeof patch.sensorThreshold === 'number') {
      control.sensorThreshold = Math.max(0, Math.round(patch.sensorThreshold))
    }
    if (patch.sensorKind) {
      if (control.kind === 'trafficLight') {
        if (
          patch.sensorKind === 'freeParking' ||
          patch.sensorKind === 'noFreeParking' ||
          patch.sensorKind === 'carsBelow' ||
          patch.sensorKind === 'carsAbove'
        ) {
          control.sensorKind = patch.sensorKind
        }
      } else if (
        patch.sensorKind === 'freeCamping' ||
        patch.sensorKind === 'occupiedCamping' ||
        patch.sensorKind === 'peopleBelow' ||
        patch.sensorKind === 'peopleAbove'
      ) {
        control.sensorKind = patch.sensorKind
      }
    }
    if (
      control.kind === 'pathBarrier' &&
      (patch.passage === 'oneWay' || patch.passage === 'both')
    ) {
      control.passage = patch.passage
    }
    if (control.kind === 'pathBarrier' && typeof patch.openInEmergency === 'boolean') {
      control.openInEmergency = patch.openInEmergency
    }
    this.evaluateAccessSignals()
    this.emit()
    return { ok: true, message: 'Kontrolle gespeichert' }
  }

  toggleAccessControlArea(
    id: string,
    from: { x: number; z: number },
    to: { x: number; z: number },
  ): ActionResult {
    const control = this.getAccessControl(id)
    if (!control) return { ok: false, message: 'Kontrolle nicht gefunden' }
    control.area = toggleAreaCells(control.area, from, to)
    this.evaluateAccessSignals()
    this.emit()
    return { ok: true, message: 'Gebiet aktualisiert' }
  }

  clearAccessControlArea(id: string): ActionResult {
    const control = this.getAccessControl(id)
    if (!control) return { ok: false, message: 'Kontrolle nicht gefunden' }
    control.area = []
    this.evaluateAccessSignals()
    this.emit()
    return { ok: true, message: 'Gebiet geleert' }
  }

  getAccessControl(id: string): AccessControl | undefined {
    return (
      this.state.accessControls.trafficLights.find((item) => item.id === id) ??
      this.state.accessControls.pathBarriers.find((item) => item.id === id)
    )
  }

  getAccessControlAt(
    x: number,
    z: number,
    kind?: AccessControlKind,
  ): AccessControl | undefined {
    const lights = kind === 'pathBarrier' ? [] : this.state.accessControls.trafficLights
    const barriers = kind === 'trafficLight' ? [] : this.state.accessControls.pathBarriers
    return (
      lights.find((item) => item.x === x && item.z === z) ??
      barriers.find((item) => item.x === x && item.z === z)
    )
  }

  accessAreaStats(cells: readonly AccessAreaCell[]): AccessAreaStats {
    return statsForArea(cells, this.buildAccessAreaIndexes())
  }

  accessAreaPreview(id: string): AccessAreaStats | null {
    const control = this.getAccessControl(id)
    if (!control) return null
    return this.accessAreaStats(control.area)
  }

  private removeAccessControlsAt(x: number, z: number): number {
    const lights = this.state.accessControls.trafficLights.length
    const barriers = this.state.accessControls.pathBarriers.length
    this.state.accessControls.trafficLights =
      this.state.accessControls.trafficLights.filter(
        (light) => light.x !== x || light.z !== z,
      )
    this.state.accessControls.pathBarriers =
      this.state.accessControls.pathBarriers.filter(
        (barrier) => barrier.x !== x || barrier.z !== z,
      )
    return (
      lights -
      this.state.accessControls.trafficLights.length +
      (barriers - this.state.accessControls.pathBarriers.length)
    )
  }

  private buildAccessAreaIndexes(): AccessAreaIndexes {
    const freeParking = new Set<string>()
    const occupiedParking = new Set<string>()
    const carsOnRoad = new Map<string, number>()
    const freeCamping = new Set<string>()
    const occupiedCamping = new Set<string>()
    const people = new Map<string, number>()
    for (const parking of this.state.logistics.parkingCells) {
      const key = accessCellKey(parking.x, parking.z)
      if (parking.occupiedBy) occupiedParking.add(key)
      else freeParking.add(key)
    }
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.state === 'parked') continue
      const cell = vehicle.cell ?? vehicle.position
      const key = accessCellKey(cell.x, cell.z)
      carsOnRoad.set(key, (carsOnRoad.get(key) ?? 0) + 1)
    }
    const claimedCamps = new Set<string>()
    let emergency = this.state.incidents.some((incident) => incident.kind === 'fire')
    for (const visitor of this.state.visitors) {
      const personKey = accessCellKey(visitor.cellX, visitor.cellZ)
      people.set(personKey, (people.get(personKey) ?? 0) + 1)
      if (visitor.isPanicking || visitor.state === 'panicking') emergency = true
      if (visitor.campsite) {
        claimedCamps.add(accessCellKey(visitor.campsite.x, visitor.campsite.z))
      }
    }
    for (const member of this.state.staff) {
      const key = accessCellKey(member.cellX, member.cellZ)
      people.set(key, (people.get(key) ?? 0) + 1)
    }
    for (const cell of this.state.campingCells) {
      const key = accessCellKey(cell.x, cell.z)
      if (claimedCamps.has(key)) occupiedCamping.add(key)
      else freeCamping.add(key)
    }
    return {
      freeParking,
      occupiedParking,
      carsOnRoad,
      freeCamping,
      occupiedCamping,
      people,
      emergency,
    }
  }

  isAccessEmergency(): boolean {
    return this.accessEmergency
  }

  private accessScheduleContext(): AccessScheduleContext {
    return {
      day: this.state.day,
      dayPlan: this.state.dayPlan,
    }
  }

  private evaluateAccessSignals(): void {
    const indexes = this.buildAccessAreaIndexes()
    const emergency = indexes.emergency
    let changed = emergency !== this.accessEmergency
    this.accessEmergency = emergency
    const update = (control: AccessControl) => {
      const next = evaluateAccessSignal(
        control,
        this.state.minute,
        statsForArea(control.area, indexes),
        emergency,
        this.accessScheduleContext(),
      )
      if (control.signal !== next) {
        control.signal = next
        changed = true
      }
    }
    this.state.accessControls.trafficLights.forEach(update)
    this.state.accessControls.pathBarriers.forEach(update)
    this.closedTrafficEdges = closedAccessEdges(this.state.accessControls.trafficLights)
    this.closedPathEdges = closedAccessEdges(
      this.state.accessControls.pathBarriers,
      false,
      0,
      Number.POSITIVE_INFINITY,
      emergency,
    )
    if (changed) {
      this.accessSignalRevision += 1
      this.pedestrianNavigation.clearPathCache()
    }
  }

  updateSecurityGate(
    id: string,
    config: Partial<SecurityGateConfig>,
  ): ActionResult {
    const gate = this.state.buildings.find(
      (building) => building.id === id && building.kind === 'securityGate',
    )
    if (!gate) return { ok: false, message: 'Sicherheitsschleuse nicht gefunden' }
    gate.securityConfig = {
      ...(gate.securityConfig ?? DEFAULT_SECURITY_CONFIG),
      ...config,
      thoroughness: Math.max(
        0,
        Math.min(1, config.thoroughness ?? gate.securityConfig?.thoroughness ?? 0.5),
      ),
      flowShare: Math.max(
        0,
        Math.min(1, config.flowShare ?? gate.securityConfig?.flowShare ?? 1),
      ),
    }
    this.emit()
    return { ok: true, message: 'Sicherheitseinstellungen gespeichert' }
  }

  getAt(x: number, z: number, elevation?: number, localX?: number, localZ?: number): PlacedBuilding | undefined {
    const gate = this.getRideAccessAt(x, z, elevation)
    if (gate) return gate.building
    const matches = this.getBuildingsAtCell(x, z).filter(
      (item) =>
        elevation === undefined || this.volumesOverlap(item, elevation, 0.01),
    )
    return matches.sort((a, b) => {
      const elevationDifference = b.elevation - a.elevation
      if (elevationDifference !== 0) return elevationDifference
      if (localX !== undefined && localZ !== undefined) {
        const distance = (item: PlacedBuilding) => {
          if (item.decorationSlot === undefined || item.decorationSlot === 4) return 2
          const position = sceneryTransform(item)
          if (isEdgeScenery(item.kind)) {
            const perpendicular = item.decorationSlot % 2 ? Math.abs(position.x - localX) : Math.abs(position.z - localZ)
            if (perpendicular > .16) return 3
          } else if (Math.abs(position.x - localX) > .25 || Math.abs(position.z - localZ) > .25) return 3
          return (position.x - localX) ** 2 + (position.z - localZ) ** 2
        }
        const difference = distance(a) - distance(b)
        if (difference !== 0) return difference
      }
      if (a.kind === 'path' && b.kind !== 'path') return 1
      if (b.kind === 'path' && a.kind !== 'path') return -1
      return 0
    })[0]
  }

  getPathAt(x: number, z: number, elevation?: number): PlacedBuilding | undefined {
    this.ensureSpatialIndexes()
    if (elevation !== undefined) {
      return this.pathExactIndex.get(this.packCell({ x, z, elevation }))
    }
    let best: PlacedBuilding | undefined
    for (const item of this.getBuildingsAtCell(x, z)) {
      if (item.kind !== 'path') continue
      if (!best || item.elevation > best.elevation) best = item
    }
    return best
  }

  private getSecurityGateAt(
    x: number,
    z: number,
    elevation?: number,
  ): PlacedBuilding | undefined {
    for (const building of this.getBuildingsAtCell(x, z)) {
      if (building.kind !== 'securityGate') continue
      if (
        elevation === undefined ||
        Math.abs(building.elevation - elevation) < 0.01
      ) {
        return building
      }
    }
    return undefined
  }

  getCampingCellAt(x: number, z: number): CampingCell | undefined {
    return this.camping.getCellAt(x, z)
  }

  designateCampingCell(x: number, z: number, enabled = true): ActionResult {
    if (enabled && this.isWaterTerrain(x, z)) {
      return { ok: false, message: 'Im Wasser kann kein Zeltbereich entstehen' }
    }
    if (enabled) {
      const clearCost = this.getTreeClearCost(x, z, 0, 1)
      if (this.state.money < clearCost) {
        return { ok: false, message: 'Nicht genug Geld, um den Baum zu entfernen' }
      }
      this.clearTreesAt(x, z, 0, 1)
    }
    const result = this.camping.designateCell(x, z, enabled)
    const cell = this.getCampingCellAt(x, z)
    if (cell) cell.elevation = this.getTerrainHeight(x, z)
    result.displacedVisitors.forEach((visitor) => {
      const current = this.getVisitor(visitor.id)
      if (current) this.visitorBehavior.decideNextAction(current)
    })
    this.emit()
    return { ok: result.ok, message: result.message }
  }

  designateCampingArea(cells: ReadonlyArray<{ x: number; z: number }>): ActionResult {
    const landCells = cells.filter((cell) => !this.isWaterTerrain(cell.x, cell.z))
    const clearCost = landCells.reduce(
      (total, cell) => total + this.getTreeClearCost(cell.x, cell.z, 0, 1),
      0,
    )
    if (this.state.money < clearCost) {
      return { ok: false, message: 'Nicht genug Geld, um Bäume zu entfernen' }
    }
    landCells.forEach((cell) => this.clearTreesAt(cell.x, cell.z, 0, 1))
    const result = this.camping.designateArea(landCells)
    this.state.campingCells.forEach((cell) => {
      cell.elevation = this.getTerrainHeight(cell.x, cell.z)
    })
    this.emit()
    return { ok: result.ok, message: result.message }
  }

  getVisitor(id: string): Visitor | undefined {
    if (this.indexedVisitorCount !== this.state.visitors.length) {
      this.visitorIndex = new Map(
        this.state.visitors.map((visitor) => [visitor.id, visitor]),
      )
      this.indexedVisitorCount = this.state.visitors.length
    }
    return this.visitorIndex.get(id)
  }

  getCoaster(id: string): Coaster | undefined {
    return this.state.coasters.find((coaster) => coaster.id === id)
  }

  getCoasterQueueCapacity(coasterId: string): number {
    const coaster = this.getCoaster(coasterId)
    return coaster
      ? this.getCoasterQueueCells(coaster).length *
          SIMULATION_CONFIG.coasters.queueSlotsPerCell
      : 0
  }

  getCoasterAt(x: number, z: number): Coaster | undefined {
    return this.state.coasters.find(
      (coaster) =>
        coaster.entrance && Math.round(coaster.entrance.x) === x && Math.round(coaster.entrance.z) === z ||
        coaster.exit && Math.round(coaster.exit.x) === x && Math.round(coaster.exit.z) === z ||
        coaster.pieces.some((piece) =>
          piece.points.some(
            (point) => Math.round(point.x) === x && Math.round(point.z) === z,
          ),
        ),
    )
  }

  private coasterCommandContext(): CoasterCommandContext {
    return {
      state: this.state,
      nextId: (prefix) => this.nextId(prefix),
      getPlaceElevation: (x, z) => this.getPlaceElevation(x, z),
      isInWorld: (x, z) => this.isInWorld(x, z),
      canBuildTrackPiece: (piece, options) => this.canBuildTrackPiece(piece, options),
      recalculateTrackState: (coaster) => this.recalculateCoasterTrackState(coaster),
      recallTrain: (coaster) => this.recallCoasterTrainInternal(coaster),
      emit: () => this.emit(),
    }
  }

  startCoaster(typeId: CoasterTypeId, x: number, z: number): ActionResult & { id?: string } {
    return startCoasterCommand(this.coasterCommandContext(), typeId, x, z)
  }

  appendCoasterPiece(
    coasterId: string,
    kind: TrackPieceKind,
    chainLift: boolean,
    afterPieceIndex?: number,
    options: TrackBuildOptions = {},
  ): ActionResult {
    return appendCoasterPieceCommand(
      this.coasterCommandContext(),
      this.getCoaster(coasterId),
      kind,
      chainLift,
      afterPieceIndex,
      options,
    )
  }

  undoCoasterPiece(coasterId: string): ActionResult {
    return undoCoasterPieceCommand(
      this.coasterCommandContext(),
      this.getCoaster(coasterId),
    )
  }

  getRideAccessAt(x: number, z: number, elevation?: number) {
    this.ensureSpatialIndexes()
    return this.rideAccessIndex.get(this.packXZ(x, z))?.find(g => elevation === undefined || Math.abs(g.point.y - elevation) < .8)
  }

  getRideAccessIssue(building: PlacedBuilding): string | null {
    if (building.kind !== 'ride') return null
    if (!building.rideEntrance) return 'Eingang fehlt – im Konstruktionsfenster bauen'
    if (!building.rideExit) return 'Ausgang fehlt – im Konstruktionsfenster bauen'
    if (!this.getAccessPathNeighbors(building.rideEntrance).some(c => this.getPathAt(c.x, c.z, c.elevation)?.pathType === 'queue')) return 'Warteweg mit dem Eingang verbinden'
    if (!this.getAccessPathNeighbors(building.rideExit).some(c => this.getPathAt(c.x, c.z, c.elevation)?.pathType !== 'queue')) return 'Ausgang mit einem normalen Gehweg verbinden'
    return null
  }

  canPlaceRideAccess(buildingId: string, type: 'entrance' | 'exit', x: number, z: number): ActionResult {
    const building = this.state.buildings.find(b => b.id === buildingId && b.kind === 'ride')
    if (!building || !['entrance', 'exit'].includes(type)) return { ok: false, message: 'Fahrgeschäft nicht gefunden' }
    if (!Number.isInteger(x) || !Number.isInteger(z) || !this.isInWorld(x,z) || Math.abs(x-building.x)+Math.abs(z-building.z)!==1) return { ok: false, message: 'Ein- und Ausgang direkt neben das Fahrgeschäft setzen' }
    const own = type === 'entrance' ? building.rideEntrance : building.rideExit
    if (own && this.state.visitors.some(v => v.targetId === building.id && v.state === 'using')) return { ok: false, message: 'Bitte die laufende Fahrt abwarten' }
    const occupied = this.getRideAccessAt(x,z,building.elevation)
    if ((occupied && (occupied.building.id !== buildingId || occupied.type !== type)) || this.findCollision('ride',x,z,building.elevation) || this.coasterOccupiesVolume(x,z,building.elevation,.8) || this.state.coasters.some(c => [c.entrance,c.exit].some(a=>a && a.x===x && a.z===z && Math.abs(a.y-building.elevation)<.8))) return { ok: false, message: 'Ein- und Ausgang brauchen eigene, freie Felder' }
    if (this.getTerrainHeight(x,z)>building.elevation || this.isWaterTerrain(x,z) || this.getCampingCellAt(x,z) || this.getRoadCellAt(x,z) || this.getMedicalCellAt(x,z) || this.getWasteDumpAt(x,z) || this.getStageForecourtCellAt(x,z) || this.state.festival.infrastructure.depots.some(d=>d.x===x&&d.z===z)) return { ok: false, message: 'Dieses Feld ist für einen Zugang ungeeignet' }
    const cost = own ? 0 : SIMULATION_CONFIG.economy.coasterAccessCost
    if (this.state.logistics.parkingCells.some(c=>c.x===x && c.z===z)) return {ok:false,message:'Hier liegt bereits eine Parkfläche'}
    return this.state.money < cost ? {ok:false,message:'Nicht genug Geld'} : {ok:true,message:`${type==='entrance'?'Eingang':'Ausgang'} bauen · ${cost} €`}
  }

  setRideAccess(buildingId: string, type: 'entrance' | 'exit', x: number, z: number): ActionResult {
    const result = this.canPlaceRideAccess(buildingId,type,x,z)
    if (!result.ok) return result
    const building = this.state.buildings.find(b=>b.id===buildingId)!
    const key = type === 'entrance' ? 'rideEntrance' : 'rideExit'
    if (!building[key]) bookFinance(this.state, 'construction', -SIMULATION_CONFIG.economy.coasterAccessCost)
    building[key] = {x,y:building.elevation,z}
    this.indexedBuildingCount = -1
    this.recalculateQueueDirections(); this.emit()
    return {ok:true,message:type==='entrance'?'Eingang angebaut – Warteweg anschließen':'Ausgang angebaut – Gehweg anschließen'}
  }

  setCoasterAccess(
    coasterId: string,
    accessType: 'entrance' | 'exit',
    x: number,
    z: number,
  ): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
    const stations = coaster.pieces.filter((piece) => piece.kind === 'station')
    const station = stations.find(
      (piece) => Math.abs(piece.start.x - x) + Math.abs(piece.start.z - z) === 1,
    )
    if (!station) {
      return { ok: false, message: 'Ein- und Ausgang müssen neben einer Stationsplattform liegen' }
    }
    if (this.findCollision('path', x, z, station.start.elevation) || this.getRideAccessAt(x, z, station.start.elevation)) {
      return { ok: false, message: 'Dieses Feld ist belegt' }
    }
    const other = accessType === 'entrance' ? coaster.exit : coaster.entrance
    if (other && Math.round(other.x) === x && Math.round(other.z) === z) {
      return { ok: false, message: 'Ein- und Ausgang benötigen getrennte Felder' }
    }
    const accessCost = coaster[accessType]
      ? 0
      : SIMULATION_CONFIG.economy.coasterAccessCost
    if (this.state.money < accessCost) return { ok: false, message: 'Nicht genug Geld' }
    coaster[accessType] = { x, y: station.start.elevation, z }
    bookFinance(this.state, 'construction', -accessCost)
    this.recalculateQueueDirections()
    this.emit()
    return {
      ok: true,
      message: accessType === 'entrance' ? 'Eingang angebaut' : 'Ausgang angebaut',
    }
  }

  updateCoasterSettings(
    coasterId: string,
    dispatchMode: DispatchMode,
    intervalMinutes: number,
  ): void {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return
    coaster.settings.dispatchMode = dispatchMode
    coaster.settings.dispatchIntervalMinutes = Math.max(
      SIMULATION_CONFIG.coasters.minimumDispatchIntervalMinutes,
      Math.min(
        SIMULATION_CONFIG.coasters.maximumDispatchIntervalMinutes,
        intervalMinutes,
      ),
    )
    this.emit()
  }

  updateBuildingPrice(
    buildingId: string,
    price: number,
    allOfKind = false,
  ): void {
    const building = this.state.buildings.find((item) => item.id === buildingId)
    if (
      !building ||
      !isPricedShopKind(building.kind)
    ) {
      return
    }
    const normalized = this.normalizePrice(price)
    if (allOfKind) {
      this.state.buildings.forEach((item) => {
        if (item.kind === building.kind) item.price = normalized
      })
    } else {
      building.price = normalized
    }
    this.emit()
  }

  configureShirtStall(
    buildingId: string,
    settings: { color?: number; style?: ShirtStyle },
  ): ActionResult {
    const building = this.state.buildings.find((item) => item.id === buildingId)
    if (!building || building.kind !== 'shirt') {
      return { ok: false, message: 'T-Shirt-Stand wählen' }
    }
    if (settings.color !== undefined) building.shirtColor = normalizeShirtColor(settings.color)
    if (settings.style !== undefined) building.shirtStyle = normalizeShirtStyle(settings.style)
    this.emit()
    return { ok: true, message: 'Shirt-Angebot gespeichert' }
  }

  updateEntryPrice(price: number): void {
    this.state.entryPrice = this.normalizePrice(price)
    this.emit()
  }

  updateCampingTicketPrice(price: number): void {
    this.state.campingTicketPrice = this.normalizePrice(price)
    this.emit()
  }

  ticketPriceFor(ticketType: 'day' | 'camping'): number {
    return ticketType === 'camping'
      ? this.state.campingTicketPrice
      : this.state.entryPrice
  }

  updateDayVisitorWindow(entryHour: number, exitHour: number): ActionResult {
    const entry = Math.max(0, Math.min(23, Math.floor(entryHour)))
    const exit = Math.max(0, Math.min(23, Math.floor(exitHour)))
    const openHours = getOpenWindowHours(entry, exit)
    if (openHours < 1 || openHours > 23) {
      return {
        ok: false,
        message:
          'Tagesgäste benötigen ein Einlassfenster und mindestens eine geschlossene Stunde.',
      }
    }
    this.state.dayPlan.dayVisitorEntryHour = entry
    this.state.dayPlan.dayVisitorExitHour = exit
    this.visitorBehavior.enforceDayPlan()
    this.emit()
    return {
      ok: true,
      message: `Tagesgäste dürfen von ${String(entry).padStart(2, '0')}:00 bis ${String(exit).padStart(2, '0')}:00 bleiben.`,
    }
  }

  updateFestivalCycle(
    leadDays: number,
    festivalDays: number,
    breakDays: number,
  ): ActionResult {
    const lead = Math.max(0, Math.min(14, Math.floor(leadDays)))
    const festival = Math.max(1, Math.min(14, Math.floor(festivalDays)))
    const pause = Math.max(1, Math.min(30, Math.floor(breakDays)))
    this.state.dayPlan.leadDays = lead
    this.state.dayPlan.festivalDays = festival
    this.state.dayPlan.breakDays = pause
    this.state.dayPlan.cycleStartDay = this.state.day
    this.visitorBehavior.enforceDayPlan()
    this.updateAtmosphere()
    this.emit()
    return {
      ok: true,
      message: `Neuer Zyklus: ${lead} Vorlauf-, ${festival} Festival- und ${pause} Pausentage.`,
    }
  }

  updateCampingCapacityBuffer(percent: number): ActionResult {
    this.state.dayPlan.campingCapacityBufferPercent = Math.max(
      0,
      Math.min(50, Math.floor(percent)),
    )
    this.emit()
    return {
      ok: true,
      message: `Camping-Sicherheitsabschlag: ${this.state.dayPlan.campingCapacityBufferPercent}% · ${this.getBookableCampingCapacity()} Plätze buchbar.`,
    }
  }

  getBookableCampingCapacity(): number {
    return Math.max(
      0,
      Math.floor(
        this.state.campingCells.length *
          (1 -
            this.state.dayPlan.campingCapacityBufferPercent / 100),
      ),
    )
  }

  /**
   * What the park is worth on paper: everything standing on it, at what it cost to
   * build. The bank lends against this, and the overview shows it next to the debt.
   */
  parkValue(): number {
    const buildings = this.state.buildings.reduce(
      (total, item) =>
        total +
        BUILDINGS[item.kind].cost +
        (item.stageDesign ? stageStats(item.stageDesign).cost : 0),
      0,
    )
    const coasters = this.state.coasters.reduce(
      (total, coaster) => total + coaster.pieces.reduce((sum, piece) => sum + TRACK_PIECES[piece.kind].cost, 0),
      0,
    )
    return Math.round(buildings + coasters)
  }

  /** Everything the finance window draws, in one place, so the UI never has to know how the books are kept. */
  financeOverview(): {
    periods: FinanceState['periods']
    forecast: FinanceEntries
    loan: number
    loanLimit: number
    interestPerDay: number
    parkValue: number
    companyValue: number
    money: number
    edition: number
  } {
    const parkValue = this.parkValue()
    return {
      periods: this.state.finance.periods,
      forecast: this.financeForecast(),
      loan: this.state.finance.loan,
      loanLimit: loanLimit(parkValue),
      interestPerDay: LOAN.interestPerDay,
      parkValue,
      companyValue: Math.round(parkValue + this.state.money - this.state.finance.loan),
      money: this.state.money,
      edition: financeEdition(this.state),
    }
  }

  /**
   * Borrowing and repaying. A loan is not income and a repayment is not an expense —
   * both only move money between the cash box and the debt, so neither is booked into
   * the table; what the loan costs shows up as interest, day by day.
   */
  manageLoan(action: { type: 'borrow' | 'repay'; amount: number }): ActionResult {
    const amount = Math.round(Number(action.amount))
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: 'Betrag wählen' }
    const finance = this.state.finance
    if (action.type === 'borrow') {
      const limit = loanLimit(this.parkValue())
      if (finance.loan + amount > limit) {
        return { ok: false, message: `Die Bank gibt derzeit höchstens ${limit.toLocaleString('de-DE')} € — davon laufen bereits ${Math.round(finance.loan).toLocaleString('de-DE')} €` }
      }
      finance.loan += amount
      this.state.money += amount
      this.emit()
      return { ok: true, message: `${amount.toLocaleString('de-DE')} € aufgenommen · ${(LOAN.interestPerDay * 100).toFixed(1)} % Zinsen pro Tag` }
    }
    if (finance.loan <= 0) return { ok: false, message: 'Es läuft kein Darlehen' }
    const payment = Math.min(amount, Math.floor(finance.loan), Math.floor(this.state.money))
    if (payment <= 0) return { ok: false, message: 'Nicht genug Geld für eine Tilgung' }
    finance.loan = Math.round((finance.loan - payment) * 100) / 100
    this.state.money -= payment
    updateScenarioProgress(this.state, financeEdition(this.state))
    this.emit()
    return {
      ok: true,
      message: finance.loan > 0
        ? `${payment.toLocaleString('de-DE')} € getilgt · noch ${Math.round(finance.loan).toLocaleString('de-DE')} € offen`
        : `${payment.toLocaleString('de-DE')} € getilgt · Darlehen vollständig zurückgezahlt`,
    }
  }

  addDebugMoney(): ActionResult {
    const amount = 100_000
    // Deliberately not booked: a debug purse is not income, and the finance table
    // should keep adding up to what the park actually earned.
    this.state.money += amount
    this.state.cashEffects.push({
      id: this.nextId('debug-cash'),
      amount,
      x: this.getEntrance().x + 0.5,
      y: 1.1,
      z: this.getEntrance().z + 0.5,
      age: 0,
    })
    this.emit()
    return { ok: true, message: 'Debug: 100.000 € hinzugefügt' }
  }

  removeVisitorCarsForDebug(): ActionResult {
    const cars = this.state.logistics.roadVehicles.filter(
      (vehicle) => vehicle.kind === 'visitorCar',
    )
    const carIds = new Set(cars.map((vehicle) => vehicle.id))
    const groupIds = new Set(
      cars.flatMap((vehicle) => (vehicle.groupId ? [vehicle.groupId] : [])),
    )
    const visitorIds = new Set<string>()
    const dropCells = new Map<string, Cell>()
    const rememberDrop = (visitorId: string, cell: Cell): void => {
      if (!dropCells.has(visitorId)) dropCells.set(visitorId, cell)
    }
    cars.forEach((vehicle) => {
      const drop = vehicle.parkingCell
        ? this.getParkingDisembarkAccess(vehicle.parkingCell)
        : {
            x: (vehicle.cell ?? vehicle.position).x,
            z: (vehicle.cell ?? vehicle.position).z,
            elevation:
              vehicle.cell?.elevation ??
              vehicle.position.elevation ??
              0,
          }
      vehicle.passengerIds.forEach((visitorId) => {
        visitorIds.add(visitorId)
        rememberDrop(visitorId, drop)
      })
    })
    this.state.logistics.arrivalGroups.forEach((group) => {
      if (group.mode !== 'car' && !groupIds.has(group.id)) return
      group.memberIds.forEach((visitorId) => visitorIds.add(visitorId))
    })
    // Delete cars before routing home. Seated passengers now count as
    // "in a departure vehicle", so beginVisitorDeparture is a no-op while
    // the car still exists — and a throw in that loop used to skip deletion.
    this.state.logistics.parkingCells.forEach((cell) => {
      cell.occupiedBy = null
    })
    this.state.logistics.roadVehicles = this.state.logistics.roadVehicles
      .filter((vehicle) => !carIds.has(vehicle.id))
      .map((vehicle) => ({
        ...vehicle,
        passengerIds: vehicle.passengerIds.filter(
          (visitorId) => !visitorIds.has(visitorId),
        ),
      }))
    this.state.logistics.arrivalGroups =
      this.state.logistics.arrivalGroups.filter(
        (group) => group.mode !== 'car' && !groupIds.has(group.id),
      )
    this.state.visitors.forEach((visitor) => {
      if (visitor.arrivalMode !== 'car' && !visitorIds.has(visitor.id)) return
      visitorIds.add(visitor.id)
      const drop = dropCells.get(visitor.id)
      if (drop) {
        this.placeVisitorOnDisembarkCell(visitor, drop)
      } else if (
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'bus-riding'
      ) {
        this.placeVisitorOnDisembarkCell(visitor, {
          x: visitor.cellX,
          z: visitor.cellZ,
          elevation: visitor.cellElevation,
        })
      }
      visitor.arrivalMode = 'pedestrian'
      visitor.arrivalGroupId = null
      visitor.injuryVehicleId = null
      visitor.rescueVehicleId = null
      visitor.busLineId = null
      visitor.busDestination = null
      visitor.busDestinationStopId = null
      visitor.busResumeState = null
      visitor.busResumeTargetId = null
      if (
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'bus-riding'
      ) {
        visitor.state = 'leaving'
      }
      this.beginVisitorDeparture(visitor)
      visitor.thought =
        'Mein Auto wurde entfernt. Ich gehe zu Fuß nach Hause.'
    })
    this.emit()
    return {
      ok: true,
      message: `Debug: ${cars.length} Autos entfernt, alle Parkplätze freigegeben; die Gäste gehen zu Fuß nach Hause`,
    }
  }

  placeBungee(x: number, z: number, height: number): ActionResult {
    const preview = this.canPlaceBungee(x, z, height)
    if (!preview.ok) return preview
    const result = this.place('ride', x, z)
    if (!result.ok) return result
    const tower = this.state.buildings.at(-1)!
    tower.rideType = 'bungee'; tower.bungeeHeight = height
    bookFinance(this.state, 'construction', -(height * 25))
    this.emit()
    return { ok: true, message: `Bungee-Turm (${height} m) gebaut` }
  }

  private canPlaceBungee(x: number, z: number, height: number): ActionResult {
    if (!Number.isInteger(height) || height < 4 || height > 200) return { ok: false, message: 'Turmhöhe: 4 bis 200 Meter in Meterschritten' }
    const elevation = this.getPlaceElevation(x, z)
    const top = height / 4 + .4
    if (this.coasterOccupiesVolume(x, z, elevation, top) || this.state.buildings.some(b => b.x === x && b.z === z && this.volumesOverlap(b, elevation, top))) return { ok: false, message: 'Über der Turmfläche muss Platz frei bleiben' }
    if (this.state.money < BUILDINGS.ride.cost + height * 25) return { ok: false, message: 'Nicht genug Geld für diese Turmhöhe' }
    return this.canPlace('ride', x, z)
  }

  setBungeeHeight(id: string, height: number): ActionResult {
    const tower = this.state.buildings.find(b => b.id === id && b.rideType === 'bungee')
    if (!tower || !Number.isInteger(height) || height < 4 || height > 200) return { ok: false, message: 'Turmhöhe: 4 bis 200 Meter' }
    if (this.state.visitors.some(v => v.targetId === id && v.state === 'using')) return { ok: false, message: 'Bitte den laufenden Sprung abwarten' }
    const top = height / 4 + .4
    if (this.coasterOccupiesVolume(tower.x, tower.z, tower.elevation, top) || this.state.buildings.some(b => b.id !== id && b.x === tower.x && b.z === tower.z && this.volumesOverlap(b, tower.elevation, top))) return { ok: false, message: 'Über der Turmfläche muss Platz frei bleiben' }
    const cost = Math.max(0, height - (tower.bungeeHeight ?? 20)) * 25
    if (this.state.money < cost) return { ok: false, message: 'Nicht genug Geld' }
    bookFinance(this.state, 'construction', -cost); tower.bungeeHeight = height; this.emit()
    return { ok: true, message: `Turmhöhe auf ${height} m geändert` }
  }

  clearWasteForDebug(): ActionResult {
    const living = new Set(this.state.visitors.map(v => v.id))
    const removed = new Set(this.state.campInstallations.filter(c => !living.has(c.ownerId) && !c.contributorIds.some(id => living.has(id))).map(c => c.id))
    const dirty = this.state.incidents.filter(i => i.kind === 'litter' || i.kind === 'vomit')
    this.state.incidents = this.state.incidents.filter(i => i.kind !== 'litter' && i.kind !== 'vomit')
    this.state.campInstallations = this.state.campInstallations.filter(c => !removed.has(c.id))
    for (const b of this.state.buildings) {
      if (isWasteBin(b.kind) || isSealedWasteContainer(b.kind)) b.wasteFill = 0
    }
    for (const dump of this.state.wasteDumpCells) dump.stored = 0
    for (const v of this.state.visitors) v.pendingWaste = 0
    for (const member of this.state.staff) if (member.role === 'cleaner') {
      member.carryingWaste = 0; member.wasteFromBin = false; member.targetId = null
      member.route = []; member.workMinutes = 0; member.state = 'patrolling'
    }
    for (const vehicle of this.state.logistics.roadVehicles) if (vehicle.kind === 'garbageTruck') vehicle.cargo = 0
    for (const route of this.state.festival.infrastructure.routes) if (route.kind === 'waste') {
      route.cargo = 0; route.path = []; route.phase = 'idle'; route.targetId = ''; route.job = undefined
    }
    this.updateAtmosphere()
    this.emit()
    return { ok: true, message: `Debug: ${dirty.length} Müllstellen und ${removed.size} alte Gegenstände entfernt; Müllbehälter geleert` }
  }

  placeSceneryLine(
    kind: BuildingKind,
    cells: Array<{ x: number; z: number }>,
    slot: number,
    rotation = this.state.buildRotation,
  ): ActionResult {
    if (!isScenery(kind) || cells.length > this.getWorldSize() * 2 || !Number.isInteger(slot) || slot < 0 || slot > (isLargeScenery(kind) ? 4 : 3)) return { ok: false, message: 'Ungültige Dekolinie' }
    if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) return { ok: false, message: 'Ungültige Dekolinie' }
    let placed = 0
    const visited = new Set<string>()
    const previousRotation = this.state.buildRotation
    this.state.buildRotation = rotation
    try {
      for (const cell of cells) {
        const key = `${cell.x},${cell.z}`
        if (visited.has(key) || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) continue
        visited.add(key)
        if (this.place(kind, cell.x, cell.z, slot).ok) placed++
      }
    } finally {
      this.state.buildRotation = previousRotation
    }
    return { ok: placed > 0, message: `${placed} Dekorationen platziert · ${cells.length - placed} übersprungen` }
  }

  getRoadCellsAt(x: number, z: number): RoadCell[] {
    const layers = this.getRoadGraph().byXZ.get(roadCellKey(x, z))
    if (layers?.length) return [...layers]
    return this.state.logistics.roadCells.filter((cell) => cell.x === x && cell.z === z)
  }

  getRoadCellAt(x: number, z: number, elevation?: number): RoadCell | undefined {
    return resolveRoadLayer(this.getRoadCellsAt(x, z), elevation)
  }

  private roadPositionKey(position: RoadPosition): string {
    return roadLayerKey(position.x, position.z, position.elevation ??
      this.getRoadCellAt(position.x, position.z)?.elevation ??
      this.getTerrainHeight(position.x, position.z))
  }

  private getRoadGraph(): RoadGraph {
    this.roadGraph ??= createRoadGraph(
      this.state.logistics.roadCells,
      this.getWorldSize(),
    )
    return this.roadGraph
  }

  private invalidateRoadGraph(): void {
    this.roadGraph = null
  }

  designateRoad(cells: readonly RoadPosition[]): ActionResult {
    let placed = 0
    for (const cell of cells) {
      if (!this.isInWorld(cell.x, cell.z) || this.getRoadCellAt(cell.x, cell.z)) {
        continue
      }
      if (this.isWaterTerrain(cell.x, cell.z) || this.getRideAccessAt(cell.x, cell.z)) continue
      if (
        this.state.buildings.some(
          (building) =>
            occupiesBuildingCell(building,cell.x,cell.z) &&
            building.kind !== 'tree' &&
            !isSealedWasteContainer(building.kind) &&
            building.elevation < 1,
        ) ||
        this.isLogisticsBuildingCell(cell.x, cell.z) ||
        this.getCampingCellAt(cell.x, cell.z) ||
        this.getMedicalCellAt(cell.x, cell.z) ||
        this.getStageForecourtCellAt(cell.x, cell.z)
      ) {
        continue
      }
      const clearCost = this.getTreeClearCost(cell.x, cell.z, 0, 1)
      const roadCost = SIMULATION_CONFIG.logistics.roadBuildCost + clearCost
      if (this.state.money < roadCost) break
      this.clearTreesAt(cell.x, cell.z, 0, 1)
      bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.roadBuildCost)
      this.state.logistics.roadCells.push({
        ...cell,
        allowedDirections: null,
        blockedEdges: 0,
        speedLimit: SIMULATION_CONFIG.logistics.defaultSpeedLimit,
        crosswalk: false,
        elevation: this.getTerrainHeight(cell.x, cell.z),
        roadSlope: 0,
        roadSlopeDirection: 0,
      })
      placed += 1
    }
    if (placed > 0) this.invalidateRoadGraph()
    this.emit()
    return {
      ok: placed > 0,
      message:
        placed > 0
          ? `${placed} Straßenfeld${placed === 1 ? '' : 'er'} gebaut`
          : 'Hier konnte keine Straße gebaut werden',
    }
  }

  placeRoadSegment(x: number, z: number, elevation: number, slope = 0, slopeDirection = 0, wayType?: WayType): ActionResult {
    return this.placementService.placeRoadSegment(x, z, elevation, slope, slopeDirection, wayType)
  }

  undoRoadSegment(x: number, z: number, previousRoad?: RoadCell, elevation?: number): ActionResult {
    return this.placementService.undoRoadSegment(x, z, previousRoad, elevation)
  }

  designateParkingArea(cells: readonly RoadPosition[]): ActionResult {
    let placed = 0
    for (const cell of cells) {
      if (
        !this.isInWorld(cell.x, cell.z) ||
        this.state.logistics.parkingCells.some(
          (existing) => existing.x === cell.x && existing.z === cell.z,
        ) ||
        this.getRoadCellAt(cell.x, cell.z) ||
        this.isWaterTerrain(cell.x, cell.z) ||
        this.getRideAccessAt(cell.x, cell.z) ||
        this.state.buildings.some(
          (building) =>
            occupiesBuildingCell(building,cell.x,cell.z) &&
            building.kind !== 'tree' &&
            building.elevation < 1,
        ) ||
        this.isLogisticsBuildingCell(cell.x, cell.z) ||
        this.getCampingCellAt(cell.x, cell.z) ||
        this.getMedicalCellAt(cell.x, cell.z) ||
        this.getStageForecourtCellAt(cell.x, cell.z)
      ) {
        continue
      }
      const clearCost = this.getTreeClearCost(cell.x, cell.z, 0, 1)
      if (
        this.state.money <
        SIMULATION_CONFIG.logistics.parkingDesignationCost + clearCost
      ) {
        break
      }
      this.clearTreesAt(cell.x, cell.z, 0, 1)
      bookFinance(this.state, 'landscaping', -SIMULATION_CONFIG.logistics.parkingDesignationCost)
      this.state.logistics.parkingCells.push({
        ...cell,
        occupiedBy: null,
      })
      placed += 1
    }
    if (placed > 0) this.invalidateDesignatedOccupancy()
    this.emit()
    return {
      ok: placed > 0,
      message:
        placed > 0
          ? `${placed} Parkplatz${placed === 1 ? '' : 'felder'} ausgewiesen`
          : 'Hier konnte kein Parkplatz ausgewiesen werden',
    }
  }

  setRoadDirection(
    x: number,
    z: number,
    direction: Direction,
  ): ActionResult {
    const road = this.getRoadCellAt(x, z)
    if (!road) return { ok: false, message: 'Hier liegt keine Straße' }
    road.allowedDirections =
      road.allowedDirections === directionBit(direction)
        ? null
        : directionBit(direction)
    this.invalidateRoadGraph()
    this.realignVehiclesOnRoad(
      x,
      z,
      road.allowedDirections === null ? null : direction,
      roadLayerElevation(road),
    )
    this.emit()
    return {
      ok: true,
      message:
        road.allowedDirections === null
          ? 'Straße wieder in beide Richtungen freigegeben'
          : 'Fahrtrichtung gesetzt',
    }
  }

  toggleRoadSeparator(
    x: number,
    z: number,
    direction: Direction,
  ): ActionResult {
    const road = this.getRoadCellAt(x, z)
    if (!road) return { ok: false, message: 'Hier liegt keine Straße' }
    const bit = directionBit(direction)
    road.blockedEdges ^= bit
    const offset = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ][direction]!
    const neighbor = this.getRoadCellAt(x + offset.x, z + offset.z)
    if (neighbor) {
      neighbor.blockedEdges =
        road.blockedEdges & bit
          ? neighbor.blockedEdges | directionBit(oppositeDirection(direction))
          : neighbor.blockedEdges & ~directionBit(oppositeDirection(direction))
    }
    this.invalidateRoadGraph()
    this.emit()
    return { ok: true, message: 'Straßentrennlinie geändert' }
  }

  setRoadSpeed(x: number, z: number, speedLimit: SpeedLimit): ActionResult {
    const road = this.getRoadCellAt(x, z)
    if (!road) return { ok: false, message: 'Hier liegt keine Straße' }
    if (speedLimit > roadGroundLimit(this.state, x, z)) return { ok: false, message: speedLimit === 50 ? 'Tempo 50 benötigt eine gepflasterte Fahrbahn' : 'Tempo 30 benötigt mindestens eine Schotterdecke' }
    road.speedLimit = speedLimit
    this.invalidateRoadGraph()
    this.emit()
    return { ok: true, message: `Geschwindigkeitszone ${speedLimit} gesetzt` }
  }

  toggleCrosswalk(x: number, z: number): ActionResult {
    const road = this.getRoadCellAt(x, z)
    if (!road) return { ok: false, message: 'Hier liegt keine Straße' }
    road.crosswalk = !road.crosswalk
    this.emit()
    return {
      ok: true,
      message: road.crosswalk
        ? 'Zebrastreifen gebaut'
        : 'Zebrastreifen entfernt',
    }
  }

  setDayPlanHour(
    offer: DayPlanOffer,
    hour: number,
    active: boolean,
  ): void {
    if (!this.state.dayPlan.offers[offer]) return
    const normalizedHour = Math.max(0, Math.min(23, Math.floor(hour)))
    this.state.dayPlan.offers[offer][normalizedHour] = active
    this.visitorBehavior.enforceDayPlan()
    this.updateAtmosphere()
    this.emit()
  }

  isOfferCurrentlyActive(offer: DayPlanOffer): boolean {
    return isFestivalOfferActive(
      this.state.dayPlan,
      offer,
      this.state.minute,
      this.state.day,
    )
  }

  isBuildingCurrentlyActive(building: PlacedBuilding): boolean {
    if (building.kind === 'ride' && this.getRideAccessIssue(building)) return false
    const offer = this.visitorBehavior.getBuildingDayPlanOffer(building.kind)
    if (offer && !this.isOfferCurrentlyActive(offer)) return false
    if (consumesPower(building.kind) && !this.poweredBuildingIds.has(building.id)) {
      return false
    }
    if (building.kind === 'stage' && this.state.festival.enabled) {
      return activeBookings(this.state).some(b => b.stageId === building.id && !showIssue(this.state, b))
    }
    return building.kind !== 'stage' || this.isStagePerforming()
  }

  isBuildingPowered(buildingId: string): boolean {
    return this.poweredBuildingIds.has(buildingId)
  }

  getPowerCableAt(x: number, z: number): PowerCableCell | undefined {
    return this.state.power.cableCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
  }

  designatePowerCable(x: number, z: number, enabled = true): ActionResult {
    if (!this.isInWorld(x, z)) {
      return { ok: false, message: 'Außerhalb des Geländes' }
    }
    if (enabled && this.isWaterTerrain(x, z)) {
      return { ok: false, message: 'Im Wasser können keine Kabel liegen' }
    }
    const existing = this.getPowerCableAt(x, z)
    if (!enabled) {
      if (!existing) return { ok: false, message: 'Hier liegt kein Kabel' }
      this.state.power.cableCells = this.state.power.cableCells.filter(
        (cell) => cell.x !== x || cell.z !== z,
      )
      this.refreshPower()
      this.emit()
      return { ok: true, message: 'Kabel entfernt' }
    }
    if (existing) return { ok: true, message: 'Hier liegt bereits ein Kabel' }
    const cost = SIMULATION_CONFIG.power.cableCost
    if (this.state.money < cost) {
      return { ok: false, message: `Nicht genug Geld (${cost} €)` }
    }
    bookFinance(this.state, 'construction', -cost)
    this.state.power.cableCells = [
      ...this.state.power.cableCells,
      { x, z },
    ]
    this.refreshPower()
    this.emit()
    return { ok: true, message: 'Stromkabel verlegt' }
  }

  designatePowerCableArea(
    cells: ReadonlyArray<{ x: number; z: number }>,
  ): ActionResult {
    const costEach = SIMULATION_CONFIG.power.cableCost
    const result = this.powerSystem.designateArea(
      this.state.power.cableCells,
      cells,
      (x, z) => this.isInWorld(x, z) && !this.isWaterTerrain(x, z),
    )
    const cost = result.placed * costEach
    if (result.placed === 0) {
      return { ok: false, message: 'In dieser Fläche gibt es keine freien Kabelfelder' }
    }
    if (this.state.money < cost) {
      return {
        ok: false,
        message: `Nicht genug Geld (${cost} € für ${result.placed} Felder)`,
      }
    }
    bookFinance(this.state, 'construction', -cost)
    this.state.power.cableCells = result.cells
    this.refreshPower()
    this.emit()
    return {
      ok: true,
      message: `${result.placed} Kabel verlegt (${cost} €)`,
    }
  }

  isStagePerforming(): boolean {
    if (!this.isOfferCurrentlyActive('stages')) return false
    const performanceMinutes =
      SIMULATION_CONFIG.atmosphere.stagePerformanceMinutes
    const cycleMinutes =
      performanceMinutes +
      SIMULATION_CONFIG.atmosphere.stageBreakMinutes
    return this.state.minute % cycleMinutes < performanceMinutes
  }

  updateCoasterPrice(coasterId: string, price: number): void {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return
    coaster.ticketPrice = this.normalizePrice(price)
    this.emit()
  }

  setCoasterOperationMode(
    coasterId: string,
    mode: CoasterOperationMode,
  ): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
    if (mode !== 'closed' && !coaster.closed) {
      return { ok: false, message: 'Die Strecke muss zuerst vollständig geschlossen werden' }
    }
    if (mode === 'open' && (!coaster.entrance || !coaster.exit)) {
      return { ok: false, message: 'Für den Betrieb fehlen Eingang oder Ausgang' }
    }
    if (coaster.operationMode !== mode) this.recallCoasterTrainInternal(coaster)
    coaster.operationMode = mode
    this.emit()
    return {
      ok: true,
      message:
        mode === 'open'
          ? 'Achterbahn geöffnet'
          : mode === 'test'
            ? 'Testbetrieb gestartet'
            : 'Achterbahn geschlossen',
    }
  }

  recallCoasterTrain(coasterId: string): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
    this.recallCoasterTrainInternal(coaster)
    this.emit()
    return { ok: true, message: 'Wagen sicher zur Station zurückgeholt' }
  }

  getRemovableCoasterAt(x: number, z: number): Coaster | undefined {
    const coaster = this.getCoasterAt(x, z)
    return coaster && this.coasterStationOrAccessAt(coaster, x, z) ? coaster : undefined
  }

  removeCoaster(coasterId: string): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }

    const queueCells = this.getCoasterQueueCells(coaster)
    const queuePaths = queueCells
      .map((cell) => this.getPathAt(cell.x, cell.z, cell.elevation))
      .filter((path): path is PlacedBuilding => Boolean(path && path.pathType === 'queue'))
    const passengers = [...coaster.train.passengerIds]
    const station = coaster.pieces.find((piece) => piece.kind === 'station') ?? coaster.pieces[0]
    this.recallCoasterTrainInternal(coaster)
    if (!coaster.exit && station) {
      passengers.forEach((visitorId) => {
        const visitor = this.getVisitor(visitorId)
        if (!visitor) return
        visitor.x = station.start.x + 0.5
        visitor.y = station.start.elevation
        visitor.z = station.start.z + 0.5
        visitor.cellX = Math.round(station.start.x)
        visitor.cellZ = Math.round(station.start.z)
        visitor.cellElevation = station.start.elevation
      })
    }

    this.state.visitors.forEach((visitor) => {
      if (visitor.targetId !== coaster.id) return
      visitor.targetId = null
      visitor.route = []
      if (visitor.state === 'riding' || visitor.state === 'queuing') {
        visitor.state = 'exploring'
      }
      visitor.thought = 'Mein Ziel ist verschwunden.'
    })

    const investment =
      coaster.pieces.reduce(
        (total, piece) =>
          total +
          TRACK_PIECES[piece.kind].cost +
          (piece.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0),
        0,
      ) +
      (coaster.entrance ? SIMULATION_CONFIG.economy.coasterAccessCost : 0) +
      (coaster.exit ? SIMULATION_CONFIG.economy.coasterAccessCost : 0) +
      queuePaths.length * BUILDINGS.path.cost
    const refund = Math.floor(investment * SIMULATION_CONFIG.economy.demolitionRefundRate)
    if (refund > 0) bookFinance(this.state, 'construction', refund)

    queuePaths.forEach((path) => {
      this.relocateVisitorsFromPath(path)
      this.removeAccessControlsAt(path.x, path.z)
    })
    const removedPathIds = new Set(queuePaths.map((path) => path.id))
    if (removedPathIds.size > 0) {
      this.state.buildings = this.state.buildings.filter((building) => !removedPathIds.has(building.id))
      this.indexedBuildingCount = -1
      queuePaths.forEach((path) => {
        const ground = this.state.festival.infrastructure.ground[groundKey(path.x, path.z)]
        if (
          ground &&
          !this.state.buildings.some(
            (building) => building.kind === 'path' && building.x === path.x && building.z === path.z,
          )
        ) {
          delete ground.footway
        }
      })
    }

    this.state.coasters = this.state.coasters.filter((item) => item.id !== coaster.id)
    this.recalculateQueueDirections()
    this.recalculatePark()
    this.emit()
    return { ok: true, message: `${coaster.name} abgerissen` }
  }

  private coasterStationOrAccessAt(coaster: Coaster, x: number, z: number): boolean {
    if (
      (coaster.entrance &&
        Math.round(coaster.entrance.x) === x &&
        Math.round(coaster.entrance.z) === z) ||
      (coaster.exit && Math.round(coaster.exit.x) === x && Math.round(coaster.exit.z) === z)
    ) {
      return true
    }
    return coaster.pieces.some(
      (piece) =>
        piece.kind === 'station' &&
        piece.points.some((point) => Math.round(point.x) === x && Math.round(point.z) === z),
    )
  }

  deleteCoasterPiece(coasterId: string, pieceIndex: number): ActionResult {
    return deleteCoasterPieceCommand(
      this.coasterCommandContext(),
      this.getCoaster(coasterId),
      pieceIndex,
    )
  }

  private checkStageSite(design:StageDesign,x:number,z:number,rotation:number,elevation:number,ignoreId?:string):string|null {
    const issue=stageSiteIssue(this.state,design,x,z,rotation,ignoreId)
    if(issue)return issue
    if(design.audience?.length&&Math.abs(elevation-this.getTerrainHeight(x,z))>.01)return 'Bühnen mit Zuschauerflächen müssen auf Geländehöhe stehen'
    for(const c of buildingFootprint({x,z,rotation,stageDesign:design})){
      if(this.isWaterTerrain(c.x,c.z))return 'Bühnenfläche darf nicht im Wasser liegen'
      if(this.getRideAccessAt(c.x,c.z,elevation)||this.isLogisticsBuildingCell(c.x,c.z)||this.coasterOccupiesVolume(c.x,c.z,elevation,BUILDINGS.stage.height))return 'Bühnenfläche überschneidet sich mit einer Anlage'
    }
    return null
  }

  /**
   * Authoritative, read-only placement query used by every hover consumer.
   * Keep this as delegation to the same validators used by the matching action.
   */
  previewPlacement(request: PlacementPreviewRequest): PlacementPreviewResult {
    return previewPlacementCommand({
      state: this.state,
      previewBlueprint: (originX, originZ, rotation, items) =>
        this.previewBlueprint(originX, originZ, rotation, items),
      canPlaceRideAccess: (buildingId, accessType, x, z) =>
        this.canPlaceRideAccess(buildingId, accessType, x, z),
      canPlaceBungee: (x, z, height) => this.canPlaceBungee(x, z, height),
      canPlace: (kind, x, z, decorationSlot, preserveLegacySlot) =>
        this.canPlace(kind, x, z, decorationSlot, preserveLegacySlot),
      previewTool: (tool, x, z, enabled) =>
        this.previewToolPlacement(tool, x, z, enabled),
    }, request)
  }

  private canDesignateMedicalCell(x: number, z: number): boolean {
    return (
      this.isInWorld(x, z) &&
      !this.isWaterTerrain(x, z) &&
      !this.tileBlocksMedicalDesignation(x, z) &&
      !this.getCampingCellAt(x, z) &&
      !this.getWasteDumpAt(x, z) &&
      !this.getCoasterAt(x, z)
    )
  }

  private canDesignateWasteDumpCell(x: number, z: number): boolean {
    const at = this.getAt(x, z)
    return (
      this.isInWorld(x, z) &&
      !this.isWaterTerrain(x, z) &&
      (!at || at.kind === 'tree') &&
      !this.getCampingCellAt(x, z) &&
      !this.getMedicalCellAt(x, z) &&
      !this.getStageForecourtCellAt(x, z) &&
      !this.getWasteDumpAt(x, z) &&
      !this.getRoadCellAt(x, z) &&
      !this.hasParkingAt(x, z) &&
      !this.getCoasterAt(x, z)
    )
  }

  private canDesignateBackstageCell(x: number, z: number): boolean {
    return (
      this.isInWorld(x, z) &&
      !this.isWaterTerrain(x, z) &&
      !this.getCampingCellAt(x, z) &&
      !this.getMedicalCellAt(x, z) &&
      !this.getWasteDumpAt(x, z) &&
      !this.getStageForecourtCellAt(x, z)
    )
  }

  private canPlaceStaffGate(x: number, z: number, elevation: number): ActionResult {
    const path = this.getPathAt(x, z, elevation)
    if (!path) return { ok: false, message: 'Personaltor auf einem Fußweg platzieren' }
    if (path.staffOnly) return { ok: true, message: 'Personaltor entfernen' }
    return this.state.money < 80
      ? { ok: false, message: 'Personaltor kostet 80 €' }
      : { ok: true, message: 'Personaltor setzen' }
  }

  private previewToolPlacement(
    tool: Exclude<Tool, BuildingKind | 'copy'>,
    x: number,
    z: number,
    enabled = true,
  ): PlacementPreviewResult {
    let result: ActionResult
    if (tool === 'camping') {
      const clearCost = this.getTreeClearCost(x, z, 0, 1)
      result = this.isWaterTerrain(x, z)
        ? { ok: false, message: 'Im Wasser kann kein Zeltbereich entstehen' }
        : this.getCampingCellAt(x, z)
          ? { ok: false, message: 'Dieses Feld gehört bereits zum Zeltbereich' }
          : this.state.money < clearCost
            ? { ok: false, message: 'Nicht genug Geld, um den Baum zu entfernen' }
            : { ok: true, message: 'Zeltbereich ausweisen' }
    } else if (tool === 'medicalArea') {
      const valid = this.canDesignateMedicalCell(x, z)
      result = valid
        ? { ok: true, message: 'Krankenbereich ausweisen' }
        : { ok: false, message: 'Keine freien Felder für den Krankenbereich' }
    } else if (tool === 'wasteDump') {
      const valid = this.canDesignateWasteDumpCell(x, z)
      result = !valid
        ? { ok: false, message: 'Keine freien Felder für eine Müllablage' }
        : this.state.money < SIMULATION_CONFIG.waste.dumpDesignationCost
          ? { ok: false, message: 'Nicht genug Geld für eine Müllablage' }
          : { ok: true, message: 'Müllablage ausweisen' }
    } else if (tool === 'backstageArea') {
      const existing = Boolean(this.getBackstageCellAt(x, z))
      const valid = enabled
        ? this.canDesignateBackstageCell(x, z) && !existing
        : existing
      result = !valid
        ? { ok: false, message: enabled ? 'Keine neuen Backstage-Felder' : 'Keine Backstage-Felder zum Entfernen' }
        : enabled && this.state.money < SIMULATION_CONFIG.bandSupply.backstageDesignationCost
          ? { ok: false, message: 'Nicht genug Geld für Backstage' }
          : { ok: true, message: enabled ? 'Backstage ausweisen' : 'Backstage entfernen' }
    } else if (tool === 'deliveryYard' || tool === 'supplyDepot') {
      result = this.canPlaceSupplyDepot(x, z, tool === 'deliveryYard' ? 'delivery' : 'storage')
    } else if (tool === 'trafficLight') {
      result = this.getRoadCellAt(x, z)
        ? { ok: true, message: 'Ampel bauen' }
        : { ok: false, message: 'Ampeln stehen nur auf einer Straße' }
    } else if (tool === 'pathBarrier') {
      const path = this.getPathAt(x, z, this.state.buildElevation) ?? this.getPathAt(x, z)
      result = path?.pathType === 'normal'
        ? { ok: true, message: 'Wegschranke bauen' }
        : { ok: false, message: 'Schranken stehen nur auf normalen Wegen' }
    } else if (tool === 'staffGate') {
      const path = this.getPathAt(x, z)
      result = this.canPlaceStaffGate(x, z, path?.elevation ?? 0)
    } else {
      result = { ok: true, message: 'Platzierung möglich' }
    }
    return {
      ...result,
      renderMode: 'footprint',
      x,
      z,
      rotation: this.state.buildRotation,
      footprint: { width: 1, depth: 1 },
    }
  }

  private canPlaceSupplyDepot(
    x: number,
    z: number,
    role: 'delivery' | 'storage',
  ): ActionResult {
    if (!Number.isInteger(x) || !Number.isInteger(z) || !this.isInWorld(x, z)) {
      return { ok: false, message: 'Außerhalb des Geländes' }
    }
    if (
      this.getTerrainHeight(x, z) < 0 ||
      this.state.buildings.some((building) => occupiesBuildingCell(building, x, z)) ||
      [
        ...this.state.festival.infrastructure.depots,
        ...this.state.logistics.roadCells,
        ...this.state.logistics.parkingCells,
        ...this.state.campingCells,
        ...this.state.wasteDumpCells,
        ...this.state.stageForecourtCells,
        ...this.state.medicalCells,
      ].some((cell) => cell.x === x && cell.z === z) ||
      this.getRideAccessAt(x, z) ||
      this.isLogisticsBuildingCell(x, z) ||
      this.coasterOccupiesVolume(x, z, this.getTerrainHeight(x, z), 1)
    ) {
      return { ok: false, message: 'Depot benötigt ein freies, trockenes Feld' }
    }
    if (groundInfo(this.state, x, z).bearing < 2) {
      return { ok: false, message: 'Depot benötigt verdichteten Untergrund' }
    }
    if (this.state.money < 400) return { ok: false, message: 'Depot kostet 400 €' }
    if (role === 'delivery' && this.getAdjacentRoadPositions({ x, z }).length === 0) {
      return { ok: false, message: 'Anlieferungsplatz direkt neben einer Straße setzen' }
    }
    return { ok: true, message: 'Depot bauen' }
  }

  canPlace(kind: BuildingKind, x: number, z: number, decorationSlot?: number, preserveLegacySlot = false): ActionResult {
    if (this.getRideAccessAt(x,z,this.getPlaceElevation(x,z))) return {ok:false,message:'Hier befindet sich ein Fahrgeschäft-Zugang'}
    if (isScenery(kind)) {
      if (!(preserveLegacySlot && decorationSlot === undefined)) {
        decorationSlot ??= isLargeScenery(kind) ? 4 : isEdgeScenery(kind) ? this.state.buildRotation : 0
        if (!Number.isInteger(decorationSlot) || decorationSlot < 0 || decorationSlot > (isLargeScenery(kind) ? 4 : 3)) return { ok: false, message: 'Ungültige Dekoposition' }
      }
    } else if (decorationSlot !== undefined) return { ok: false, message: 'Dieses Objekt benötigt ein ganzes Feld' }
    if (kind === 'ambulanceGarage') {
      return this.canPlaceLogisticsFootprint(this.createFootprint(x, z, 2), BUILDINGS.ambulanceGarage.cost)
    }
    if (kind === 'busDepot') {
      return this.canPlaceLogisticsFootprint(this.createFootprint(x, z, 3), BUILDINGS.busDepot.cost)
    }
    if (kind === 'wasteDepot') {
      return this.canPlaceLogisticsFootprint(this.createFootprint(x, z, 2), BUILDINGS.wasteDepot.cost)
    }
    if (kind === 'specialDepot') {
      return this.canPlaceLogisticsFootprint(this.createFootprint(x, z, 3), BUILDINGS.specialDepot.cost, 'path')
    }
    if (kind === 'busStop') return this.canPlaceBusStop(x, z)
    const selected = kind==='stage' ? this.state.festival.stageTemplates?.find(t=>t.name===this.state.festival.selectedStageTemplate) : undefined
    if(selected){const issue=this.checkStageSite(selected,x,z,this.state.buildRotation,this.getPlaceElevation(x,z));if(issue)return {ok:false,message:issue}}

    if (!this.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    if (this.state.festival.infrastructure.depots.some(d => d.x === x && d.z === z)) return { ok: false, message: 'Hier steht ein Warendepot' }
    if (kind === 'stage' && groundInfo(this.state, x, z).bearing < 2) return { ok: false, message: 'Bühnen brauchen tragfähigen Untergrund: zuerst verdichten' }
    if (kind === 'ride' && groundInfo(this.state, x, z).bearing < 3) return { ok: false, message: 'Große Fahrgeschäfte brauchen ein entwässertes, gepflastertes Fundament' }
    if (
      (this.getRoadCellAt(x, z) &&
        kind !== 'path' &&
        kind !== 'bench' &&
        !isSealedWasteContainer(kind)) ||
      this.isLogisticsBuildingCell(x, z)
    ) {
      return { ok: false, message: 'Diese Fläche wird für die Logistik genutzt' }
    }
    if (
      kind !== 'fence' &&
      this.hasLiveParkingOccupancy(x, z)
    ) {
      return { ok: false, message: 'Diese Fläche wird für die Logistik genutzt' }
    }
    if (this.getCampingCellAt(x, z) && this.state.buildElevation < 1.2 && kind !== 'fence') {
      return { ok: false, message: 'Diese Fläche ist als Zeltbereich ausgewiesen' }
    }
    if (this.getMedicalCellAt(x, z) && !allowsMedicalOverlay(kind)) {
      return { ok: false, message: 'Diese Fläche gehört zum Krankenbereich' }
    }
    // A delay tower belongs out in the crowd — it takes the audience ground it stands on with it
    // (see place), rather than being kept off the forecourt like everything else.
    if (this.getStageForecourtCellAt(x, z) && this.state.buildElevation < 1.2 && kind !== 'fence' && kind !== 'delayTower') {
      return { ok: false, message: 'Diese Fläche gehört zum Bühnenvorplatz' }
    }
    if (this.getWasteDumpAt(x, z) && this.state.buildElevation < 1.2 && kind !== 'fence') {
      return { ok: false, message: 'Diese Fläche ist als Müllablage ausgewiesen' }
    }
    if (isBandSupplyKind(kind) && !this.getBackstageCellAt(x, z)) {
      return { ok: false, message: 'Bandversorgung nur auf ausgewiesenem Backstage' }
    }
    if (
      kind === 'tourBusParking' &&
      this.getAdjacentRoadPositions({ x, z }).length === 0
    ) {
      return { ok: false, message: 'Der Tourbus-Parkplatz braucht eine angrenzende Straße' }
    }
    const placeElevation = this.getPlaceElevation(x, z)
    if (this.isWaterTerrain(x, z) && placeElevation <= this.getWaterLevel()) {
      return { ok: false, message: 'Im Wasser kann nicht gebaut werden' }
    }
    const collision = this.findCollision(kind, x, z, placeElevation, decorationSlot)
    if (
      (kind === 'securityGate' || kind === 'bench' || isWasteBin(kind)) &&
      this.state.buildings.some(
        (building) => (isWasteBin(kind) ? isWasteBin(building.kind) : building.kind === kind) && building.x === x && building.z === z && Math.abs(building.elevation - placeElevation) < .1,
      )
    ) {
      return {
        ok: false,
        message:
          isWasteBin(kind)
            ? 'Hier steht bereits ein Mülleimer'
            : kind === 'bench'
              ? 'Hier steht bereits eine Bank'
              : 'Hier steht bereits eine Sicherheitsschleuse',
      }
    }
    if (
      kind === 'fence' &&
      this.state.buildings.some(
        (building) =>
          building.kind === 'fence' &&
          building.x === x &&
          building.z === z &&
          building.rotation === this.state.buildRotation &&
          Math.abs(building.elevation - placeElevation) < 0.01,
      )
    ) {
      return { ok: false, message: 'Auf dieser Seite steht bereits ein Bauzaun' }
    }
    const furnitureRoad =
      (kind === 'bench' || isSealedWasteContainer(kind)) &&
      Boolean(this.getRoadCellAt(x, z, placeElevation))
    if ((kind === 'securityGate' || kind === 'bench') && collision?.kind !== 'path' && !furnitureRoad) {
      return {
        ok: false,
        message:
          kind === 'bench'
            ? 'Eine Bank muss an einem Weg oder einer Straße aufgestellt werden'
            : 'Eine Sicherheitsschleuse muss auf einem Weg stehen',
      }
    }
    if (kind === 'bench' && this.findBenchRotation(x, z) === null) {
      return {
        ok: false,
        message: 'An diesem Weg oder dieser Straße ist keine freie Außenkante für eine Bank',
      }
    }
    const allowedOverlap =
      ((kind === 'securityGate' ||
        kind === 'bench' ||
        kind === 'fence' ||
        isWasteBin(kind) ||
        isSealedWasteContainer(kind)) &&
        collision?.kind === 'path') ||
      (kind === 'fence' && collision?.kind === 'fence') ||
      (collision?.kind === 'tree' && !isScenery(kind))
    if (
      (collision && !allowedOverlap) ||
      (!wallSpec(kind) && this.coasterOccupiesVolume(x, z, placeElevation, BUILDINGS[kind].height))
    ) {
      return { ok: false, message: 'Auf dieser Höhe ist nicht genug Platz' }
    }
    const clearCost = isScenery(kind) ? 0 : this.getTreeClearCost(
      x,
      z,
      placeElevation,
      BUILDINGS[kind].height,
    )
    const design = kind === 'stage' ? this.state.festival.stageTemplates?.find(t=>t.name===this.state.festival.selectedStageTemplate) : undefined
    if (this.state.money < BUILDINGS[kind].cost + clearCost + (design ? stageStats(design).cost : 0)) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    if (design) return {ok:true,message:`${design.name} bauen · ${BUILDINGS[kind].cost + clearCost + stageStats(design).cost} €`}
    return {
      ok: true,
      message:
        clearCost > 0
          ? `${BUILDINGS[kind].name} bauen und Baum entfernen (${
              BUILDINGS[kind].cost + clearCost
            } €)`
          : `${BUILDINGS[kind].name} auf Ebene ${placeElevation} bauen`,
    }
  }

  place(kind: BuildingKind, x: number, z: number, decorationSlot?: number, preserveLegacySlot = false): ActionResult {
    return placeBuildingCommand({
      state: this.state,
      canPlace: (buildingKind, cellX, cellZ, slot, legacy) =>
        this.canPlace(buildingKind, cellX, cellZ, slot, legacy),
      placeSpecial: (buildingKind, cellX, cellZ) => {
        if (buildingKind === 'ambulanceGarage') return this.placeAmbulanceGarage(cellX, cellZ)
        if (buildingKind === 'busDepot') return this.placeBusDepot(cellX, cellZ)
        if (buildingKind === 'wasteDepot') return this.placeWasteDepot(cellX, cellZ)
        if (buildingKind === 'specialDepot') return this.placeSpecialDepot(cellX, cellZ)
        if (buildingKind === 'busStop') return this.placeBusStop(cellX, cellZ)
        return null
      },
      clearDesignatedOccupancy: (cellX, cellZ) => {
        this.clearDesignatedOccupancyAt(cellX, cellZ, false, { preserveMedical: true })
      },
      getPlaceElevation: (cellX, cellZ) => this.getPlaceElevation(cellX, cellZ),
      clearTrees: (cellX, cellZ, elevation, height) =>
        this.clearTreesAt(cellX, cellZ, elevation, height),
      nextId: (prefix) => this.nextId(prefix),
      findFurnitureRotation: (cellX, cellZ, preferred) =>
        this.findBenchRotation(cellX, cellZ, preferred),
      nextBandName: () => BAND_NAMES[this.idCounter % BAND_NAMES.length]!,
      syncStageAudience: () => syncStageAudience(this.state),
      recalculateQueueDirections: () => this.recalculateQueueDirections(),
      recalculatePark: () => this.recalculatePark(),
      refreshPower: () => this.refreshPower(),
      emit: () => this.emit(),
    }, kind, x, z, decorationSlot, preserveLegacySlot)
  }

  previewBlueprint(
    originX: number,
    originZ: number,
    rotation: number,
    items: readonly BlueprintItem[],
  ): { ok: boolean; message: string; charge: number; placements: Array<{ x: number; z: number; valid: boolean; item: BlueprintItem }> } {
    const transformed = transformBlueprintItems(items, rotation)
    const savedRotation = this.state.buildRotation
    const savedElevation = this.state.buildElevation
    const placements: Array<{ x: number; z: number; valid: boolean; item: BlueprintItem }> = []
    try {
      for (const item of transformed) {
        const x = originX + item.dx
        const z = originZ + item.dz
        this.state.buildElevation = item.elevationOffset
        if (item.type === 'road') {
          placements.push({ x, z, valid: this.canStampRoadPreview(x, z, item), item })
          continue
        }
        this.state.buildRotation = item.rotation
        if (item.kind === 'path') {
          const result = this.canPlace('path', x, z)
          placements.push({ x, z, valid: result.ok, item })
          continue
        }
        const result = this.canPlace(
          item.kind,
          x,
          z,
          item.decorationSlot,
          preserveLegacyScenerySlot(item),
        )
        placements.push({ x, z, valid: result.ok, item })
      }
    } finally {
      this.state.buildRotation = savedRotation
      this.state.buildElevation = savedElevation
    }
    const charge = blueprintStampCharge(items)
    const valid = placements.filter((entry) => entry.valid).length
    const ok = placements.length > 0 && placements.every((entry) => entry.valid) && this.state.money >= charge
    return {
      ok,
      charge,
      placements,
      message:
        placements.length === 0
          ? 'Die Auswahl ist leer'
          : this.state.money < charge
            ? `Nicht genug Geld (${charge} €)`
            : ok
              ? `${valid} Objekt${valid === 1 ? '' : 'e'} für ${charge} € kopieren`
              : `${valid} von ${placements.length} passen hier`,
    }
  }

  stampBlueprint(originX: number, originZ: number, rotation: number, items: readonly BlueprintItem[]): ActionResult {
    const transformed = transformBlueprintItems(items, rotation)
    if (transformed.length === 0) return { ok: false, message: 'Die Auswahl ist leer' }
    const charge = blueprintStampCharge(transformed)
    if (this.state.money < charge) {
      return { ok: false, message: `Nicht genug Geld (${charge} €)` }
    }
    const preview = this.previewBlueprint(originX, originZ, rotation, items)
    if (!preview.placements.every((entry) => entry.valid)) {
      return { ok: false, message: preview.message }
    }
    const catalog = blueprintCatalogCost(transformed)
    const credit = catalog - charge
    if (credit > 0) bookFinance(this.state, 'construction', credit)
    const savedRotation = this.state.buildRotation
    const savedElevation = this.state.buildElevation
    let placed = 0
    try {
      for (const item of transformed) {
        const x = originX + item.dx
        const z = originZ + item.dz
        this.state.buildElevation = item.elevationOffset
        if (item.type === 'road') {
          const terrain = this.getTerrainHeight(x, z)
          if (this.placeRoadSegment(x, z, terrain + item.elevationOffset, item.slope, item.slopeDirection, item.wayType).ok) {
            placed += 1
          }
          continue
        }
        this.state.buildRotation = item.rotation
        if (item.kind === 'path') {
          const terrain = this.getTerrainHeight(x, z)
          if (
            this.placePathSegment(
              x,
              z,
              terrain + item.elevationOffset,
              item.pathType ?? 'normal',
              item.queueDirection ?? item.rotation,
              item.pathSlope ?? 0,
              item.wayType,
            ).ok
          ) {
            placed += 1
          }
          continue
        }
        if (this.place(item.kind, x, z, item.decorationSlot, preserveLegacyScenerySlot(item)).ok) placed += 1
      }
    } finally {
      this.state.buildRotation = savedRotation
      this.state.buildElevation = savedElevation
    }
    if (placed === 0) {
      if (credit > 0) bookFinance(this.state, 'construction', -credit)
      return { ok: false, message: 'Hier konnte nichts kopiert werden' }
    }
    this.emit()
    return {
      ok: true,
      message: `${placed} Objekt${placed === 1 ? '' : 'e'} kopiert · ${charge} €`,
    }
  }

  private canStampRoadPreview(
    x: number,
    z: number,
    item: Extract<BlueprintItem, { type: 'road' }>,
  ): boolean {
    if (!this.isInWorld(x, z)) return false
    const terrain = this.getTerrainHeight(x, z)
    const elevation = terrain + item.elevationOffset
    if (this.isWaterTerrain(x, z) && elevation <= this.getWaterLevel()) return false
    return true
  }

  private placeAmbulanceGarage(x: number, z: number): ActionResult {
    const footprint = this.createFootprint(x, z, 2)
    const result = this.canPlaceLogisticsFootprint(
      footprint,
      BUILDINGS.ambulanceGarage.cost,
    )
    if (!result.ok) return result
    footprint.forEach((cell) => {
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false, { preserveMedical: true })
      this.clearTreesAt(cell.x, cell.z, 0, 1)
    })
    const id = this.nextId('ambulance-garage')
    bookFinance(this.state, 'construction', -BUILDINGS.ambulanceGarage.cost)
    this.state.logistics.ambulanceGarages.push({
      id,
      x,
      z,
      bays: [null, null],
    })
    this.state.buildings.push({
      id,
      kind: 'ambulanceGarage',
      x,
      z,
      rotation: this.state.buildRotation,
      elevation: 0,
      price: 0,
    })
    this.emit()
    return { ok: true, message: '2×2-Krankenwagengarage gebaut' }
  }

  private placeBusDepot(x: number, z: number): ActionResult {
    const footprint = this.createFootprint(x, z, 3)
    const result = this.canPlaceLogisticsFootprint(
      footprint,
      BUILDINGS.busDepot.cost,
    )
    if (!result.ok) return result
    footprint.forEach((cell) => {
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false, { preserveMedical: true })
      this.clearTreesAt(cell.x, cell.z, 0, 1)
    })
    const id = this.nextId('bus-depot')
    bookFinance(this.state, 'construction', -BUILDINGS.busDepot.cost)
    this.state.logistics.busDepots.push({ id, x, z, busIds: [] })
    this.state.buildings.push({
      id,
      kind: 'busDepot',
      x,
      z,
      rotation: this.state.buildRotation,
      elevation: 0,
      price: 0,
    })
    this.emit()
    return { ok: true, message: '3×3-Busdepot gebaut' }
  }

  private placeWasteDepot(x: number, z: number): ActionResult {
    const footprint = this.createFootprint(x, z, 2)
    const result = this.canPlaceLogisticsFootprint(
      footprint,
      BUILDINGS.wasteDepot.cost,
    )
    if (!result.ok) return result
    footprint.forEach((cell) => {
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false, { preserveMedical: true })
      this.clearTreesAt(cell.x, cell.z, 0, 1)
    })
    const id = this.nextId('waste-depot')
    bookFinance(this.state, 'construction', -BUILDINGS.wasteDepot.cost)
    this.state.logistics.wasteDepots.push({ id, x, z, truckIds: [] })
    this.state.buildings.push({
      id,
      kind: 'wasteDepot',
      x,
      z,
      rotation: this.state.buildRotation,
      elevation: 0,
      price: 0,
    })
    this.refreshPower()
    this.emit()
    return { ok: true, message: '2×2-Mülldepot gebaut' }
  }

  private placeSpecialDepot(x: number, z: number): ActionResult {
    const footprint = this.createFootprint(x, z, 3)
    const result = this.canPlaceLogisticsFootprint(
      footprint,
      BUILDINGS.specialDepot.cost,
      'path',
    )
    if (!result.ok) return result
    footprint.forEach((cell) => {
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false, { preserveMedical: true })
      this.clearTreesAt(cell.x, cell.z, 0, 1)
    })
    const id = this.nextId('special-depot')
    bookFinance(this.state, 'construction', -BUILDINGS.specialDepot.cost)
    this.state.logistics.specialDepots.push({ id, x, z, vehicleIds: [] })
    this.state.buildings.push({
      id,
      kind: 'specialDepot',
      x,
      z,
      rotation: this.state.buildRotation,
      elevation: 0,
      price: 0,
    })
    this.refreshPower()
    this.emit()
    return { ok: true, message: '3×3-Betriebshof gebaut. Saugreiniger fahren von hier auf den Wegen und Bühnenvorplätzen, halten vor Besuchern und machen beim Fahren Lärm.' }
  }

  private placeBusStop(x: number, z: number): ActionResult {
    const result = this.canPlaceBusStop(x, z)
    if (!result.ok) return result
    const adjacentRoads = this.getAdjacentRoadPositions({ x, z })
    const id = this.nextId('bus-stop')
    bookFinance(this.state, 'construction', -BUILDINGS.busStop.cost)
    this.state.logistics.busStops.push({
      id,
      x,
      z,
      name: `Haltestelle ${this.state.logistics.busStops.length + 1}`,
      roadCell: { ...adjacentRoads[0]! },
    })
    this.emit()
    return { ok: true, message: 'Bushaltestelle gebaut' }
  }

  private canPlaceBusStop(x: number, z: number): ActionResult {
    const sidewalk = this.getPathAt(x, z, 0)
    if (
      this.getRoadCellAt(x, z) ||
      !sidewalk ||
      sidewalk.pathType !== 'normal'
    ) {
      return {
        ok: false,
        message: 'Eine Haltestelle muss auf einem Gehweg neben einer Straße stehen',
      }
    }
    const adjacentRoads = this.getAdjacentRoadPositions({ x, z })
    if (adjacentRoads.length === 0) {
      return {
        ok: false,
        message: 'Direkt neben der Haltestelle muss eine Straße verlaufen',
      }
    }
    if (
      this.state.logistics.busStops.some(
        (stop) => stop.x === x && stop.z === z,
      )
    ) {
      return { ok: false, message: 'Hier steht bereits eine Haltestelle' }
    }
    if (this.state.money < BUILDINGS.busStop.cost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    return { ok: true, message: 'Bushaltestelle bauen' }
  }

  private createFootprint(
    x: number,
    z: number,
    size: number,
  ): RoadPosition[] {
    return Array.from({ length: size * size }, (_, index) => ({
      x: x + (index % size),
      z: z + Math.floor(index / size),
    }))
  }

  private isLogisticsBuildingCell(x: number, z: number): boolean {
    return (
      this.state.festival.infrastructure.depots.some(d => d.x === x && d.z === z) ||
      this.state.logistics.ambulanceGarages.some(
        (garage) =>
          x >= garage.x &&
          x < garage.x + 2 &&
          z >= garage.z &&
          z < garage.z + 2,
      ) ||
      this.state.logistics.busDepots.some(
        (depot) =>
          x >= depot.x &&
          x < depot.x + 3 &&
          z >= depot.z &&
          z < depot.z + 3,
      ) ||
      this.state.logistics.wasteDepots.some(
        (depot) =>
          x >= depot.x &&
          x < depot.x + 2 &&
          z >= depot.z &&
          z < depot.z + 2,
      ) ||
      this.state.logistics.specialDepots.some(
        (depot) =>
          x >= depot.x &&
          x < depot.x + 3 &&
          z >= depot.z &&
          z < depot.z + 3,
      )
    )
  }

  private canPlaceLogisticsFootprint(
    footprint: readonly RoadPosition[],
    cost: number,
    access: 'road' | 'path' = 'road',
  ): ActionResult {
    const clearCost = footprint.reduce(
      (total, cell) => total + this.getTreeClearCost(cell.x, cell.z, 0, 1),
      0,
    )
    if (this.state.money < cost + clearCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    if (
      footprint.some(
        (cell) =>
          !this.isInWorld(cell.x, cell.z) ||
          this.getRoadCellAt(cell.x, cell.z) ||
          this.hasLiveParkingOccupancy(cell.x, cell.z) ||
          this.isWaterTerrain(cell.x, cell.z) ||
          this.state.buildings.some(
            (building) =>
              occupiesBuildingCell(building,cell.x,cell.z) &&
              building.kind !== 'tree' &&
              building.elevation < 1,
          ) ||
          Boolean(this.getCampingCellAt(cell.x, cell.z)) ||
          Boolean(this.getMedicalCellAt(cell.x, cell.z)) ||
          Boolean(this.getStageForecourtCellAt(cell.x, cell.z)) ||
          Boolean(this.getWasteDumpAt(cell.x, cell.z)),
      )
    ) {
      return { ok: false, message: 'Die gesamte Fläche muss frei sein' }
    }
    const adjacentAccess = footprint.some((cell) =>
      [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ].some(([dx, dz]) => {
        const x = cell.x + dx!
        const z = cell.z + dz!
        if (access === 'path') {
          const path =
            this.getPathAt(x, z, this.getTerrainHeight(x, z)) ??
            this.getPathAt(x, z)
          return Boolean(path && path.pathType === 'normal')
        }
        return Boolean(this.getRoadCellAt(x, z))
      }),
    )
    return adjacentAccess
      ? { ok: true, message: 'Bau möglich' }
      : {
          ok: false,
          message:
            access === 'path'
              ? 'Das Gebäude benötigt einen Wegeanschluss'
              : 'Das Gebäude benötigt einen Straßenanschluss',
        }
  }

  buyAmbulance(garageId: string): ActionResult {
    const garage = this.state.logistics.ambulanceGarages.find(
      (candidate) => candidate.id === garageId,
    )
    if (!garage) return { ok: false, message: 'Garage nicht gefunden' }
    const bay = garage.bays.findIndex((vehicleId) => vehicleId === null)
    if (bay < 0) return { ok: false, message: 'In dieser Garage stehen bereits zwei Krankenwagen' }
    if (this.state.money < SIMULATION_CONFIG.logistics.ambulanceCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    const access = this.getLogisticsBuildingAccess(garage, 2)
    if (!access) return { ok: false, message: 'Die Garage hat keinen befahrbaren Anschluss' }
    const id = this.nextId('ambulance')
    bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.ambulanceCost)
    garage.bays[bay] = id
    this.state.logistics.roadVehicles.push(
      this.createRoadVehicle(id, 'ambulance', access),
    )
    this.emit()
    return { ok: true, message: `Krankenwagen ${bay + 1} gekauft` }
  }

  sellAmbulance(garageId: string): ActionResult {
    const garage = this.state.logistics.ambulanceGarages.find(
      (candidate) => candidate.id === garageId,
    )
    if (!garage) return { ok: false, message: 'Garage nicht gefunden' }
    const vehicleId = [...garage.bays].reverse().find((id): id is string => Boolean(id))
    if (!vehicleId) return { ok: false, message: 'In dieser Garage gibt es keinen Krankenwagen' }
    return this.requestAmbulanceSale(vehicleId)
  }

  sellAmbulanceVehicle(vehicleId: string): ActionResult {
    return this.requestAmbulanceSale(vehicleId)
  }

  buyBus(depotId: string): ActionResult {
    const depot = this.state.logistics.busDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Busdepot nicht gefunden' }
    if (depot.busIds.length >= 3) {
      return { ok: false, message: 'Dieses Depot besitzt bereits drei Busse' }
    }
    if (this.state.money < SIMULATION_CONFIG.logistics.busCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    const access = this.getLogisticsBuildingAccess(depot, 3)
    if (!access) return { ok: false, message: 'Das Depot hat keinen befahrbaren Anschluss' }
    const id = this.nextId('bus')
    bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.busCost)
    depot.busIds.push(id)
    this.state.logistics.roadVehicles.push(
      this.createRoadVehicle(id, 'bus', access),
    )
    this.emit()
    return { ok: true, message: `Bus ${depot.busIds.length} gekauft` }
  }

  buyGarbageTruck(depotId: string): ActionResult {
    const depot = this.state.logistics.wasteDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Mülldepot nicht gefunden' }
    if (depot.truckIds.length >= 2) {
      return { ok: false, message: 'Dieses Depot besitzt bereits zwei Müllfahrzeuge' }
    }
    if (this.state.money < SIMULATION_CONFIG.logistics.garbageTruckCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }
    const access = this.getLogisticsBuildingAccess(depot, 2)
    if (!access) return { ok: false, message: 'Das Depot hat keinen befahrbaren Anschluss' }
    const id = this.nextId('garbage')
    bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.garbageTruckCost)
    depot.truckIds.push(id)
    this.state.logistics.roadVehicles.push(
      this.createRoadVehicle(id, 'garbageTruck', access),
    )
    this.emit()
    return { ok: true, message: `Müllfahrzeug ${depot.truckIds.length} gekauft` }
  }

  sellGarbageTruck(depotId: string): ActionResult {
    const depot = this.state.logistics.wasteDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Mülldepot nicht gefunden' }
    const truckId = depot.truckIds.at(-1)
    if (!truckId) return { ok: false, message: 'In diesem Depot gibt es kein Müllfahrzeug' }
    const truck = this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === truckId && vehicle.kind === 'garbageTruck',
    )
    const offMap = Boolean(
      truck && this.isOffMapRoadExit(truck.cell ?? truck.position),
    )
    if (truck && !offMap && (truck.state !== 'idle' || truck.cargo > 0)) {
      return { ok: false, message: 'Das Müllfahrzeug ist unterwegs oder noch beladen' }
    }
    depot.truckIds = depot.truckIds.filter((id) => id !== truckId)
    this.state.logistics.roadVehicles =
      this.state.logistics.roadVehicles.filter((vehicle) => vehicle.id !== truckId)
    bookFinance(this.state, 'construction', Math.floor(
      SIMULATION_CONFIG.logistics.garbageTruckCost *
        SIMULATION_CONFIG.logistics.busResaleFraction,
    ))
    this.emit()
    return {
      ok: true,
      message: truck
        ? 'Müllfahrzeug verkauft'
        : 'Müllfahrzeug war nicht mehr vorhanden und wurde verkauft',
    }
  }

  buySweeper(depotId: string): ActionResult {
    const depot = this.state.logistics.specialDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Betriebshof nicht gefunden' }
    if (depot.vehicleIds.length >= 4) {
      return { ok: false, message: 'In diesem Betriebshof stehen bereits vier Spezialfahrzeuge' }
    }
    if (this.state.money < SIMULATION_CONFIG.logistics.sweeperCost) {
      return { ok: false, message: 'Nicht genug Geld für den Saugreiniger' }
    }
    const access = this.getLogisticsPathAccess(depot, 3)
    if (!access) return { ok: false, message: 'Der Betriebshof hat keinen Wegeanschluss' }
    const id = this.nextId('sweeper')
    bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.sweeperCost)
    depot.vehicleIds.push(id)
    this.state.logistics.roadVehicles.push(
      this.createRoadVehicle(id, 'sweeper', access),
    )
    this.emit()
    return { ok: true, message: `Saugreiniger ${depot.vehicleIds.length} gekauft` }
  }

  sellSweeper(depotId: string): ActionResult {
    const depot = this.state.logistics.specialDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Betriebshof nicht gefunden' }
    const vehicleId = depot.vehicleIds.at(-1)
    if (!vehicleId) return { ok: false, message: 'Hier steht kein Spezialfahrzeug' }
    return this.removeSweeper(vehicleId)
  }

  private removeSweeper(vehicleId: string): ActionResult {
    const sweeper = this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === vehicleId && vehicle.kind === 'sweeper',
    )
    if (!sweeper) return { ok: false, message: 'Personal nicht gefunden' }
    if (sweeper.state !== 'idle' || sweeper.cargo > 0) {
      return { ok: false, message: 'Der Saugreiniger ist unterwegs oder noch beladen' }
    }
    for (const depot of this.state.logistics.specialDepots) {
      depot.vehicleIds = depot.vehicleIds.filter((id) => id !== vehicleId)
    }
    this.state.logistics.roadVehicles =
      this.state.logistics.roadVehicles.filter((vehicle) => vehicle.id !== vehicleId)
    bookFinance(this.state, 'construction', Math.floor(
      SIMULATION_CONFIG.logistics.sweeperCost *
        SIMULATION_CONFIG.logistics.busResaleFraction,
    ))
    this.emit()
    return { ok: true, message: 'Saugreiniger verkauft' }
  }

  sellBus(depotId: string): ActionResult {
    const depot = this.state.logistics.busDepots.find(
      (candidate) => candidate.id === depotId,
    )
    if (!depot) return { ok: false, message: 'Busdepot nicht gefunden' }
    const busId = depot.busIds.at(-1)
    if (!busId) return { ok: false, message: 'In diesem Depot gibt es keinen Bus' }
    const bus = this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === busId && vehicle.kind === 'bus',
    )
    if (!bus) {
      depot.busIds = depot.busIds.filter((id) => id !== busId)
      this.emit()
      return { ok: false, message: 'Der Bus war nicht mehr vorhanden und wurde bereinigt' }
    }
    const position = bus.cell ?? bus.position
    bus.passengerIds.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor) return
      visitor.x = position.x + visitor.tileOffsetX
      visitor.z = position.z + visitor.tileOffsetZ
      visitor.cellX = position.x
      visitor.cellZ = position.z
      visitor.cellElevation = 0
      const destination = visitor.busDestination
      const resumeState = visitor.busResumeState
      const resumeTargetId = visitor.busResumeTargetId
      visitor.busLineId = null
      visitor.busWaitMinutes = 0
      visitor.busDestination = null
      visitor.busDestinationStopId = null
      visitor.busResumeState = null
      visitor.busResumeTargetId = null
      const route = destination
        ? this.findPath(
            { x: position.x, z: position.z, elevation: 0 },
            [destination],
          )
        : null
      if (destination && route) {
        visitor.state = resumeState ?? 'exploring'
        visitor.targetId = resumeTargetId
        visitor.route = route
        visitor.thought =
          'Der Bus wurde verkauft. Ich gehe den Rest des Weges zu Fuß.'
      } else {
        visitor.state = 'exploring'
        visitor.route = []
        this.visitorBehavior.decideNextAction(visitor)
      }
    })
    depot.busIds = depot.busIds.filter((id) => id !== busId)
    this.state.logistics.busLines.forEach((line) => {
      line.busIds = line.busIds.filter((id) => id !== busId)
    })
    this.state.logistics.roadVehicles =
      this.state.logistics.roadVehicles.filter((vehicle) => vehicle.id !== busId)
    const refund = Math.round(
      SIMULATION_CONFIG.logistics.busCost *
        SIMULATION_CONFIG.logistics.busResaleFraction,
    )
    bookFinance(this.state, 'construction', refund)
    this.state.cashEffects.push({
      id: this.nextId('bus-sale'),
      amount: refund,
      x: depot.x + 1.5,
      y: 1.4,
      z: depot.z + 1.5,
      age: 0,
    })
    this.emit()
    return { ok: true, message: `Bus für ${refund.toLocaleString('de-DE')} € verkauft` }
  }

  createBusLine(
    name: string,
    depotId: string,
    stopIds: string[],
    busCount: number,
    headway: number,
  ): ActionResult {
    const depot = this.state.logistics.busDepots.find(
      (candidate) => candidate.id === depotId,
    )
    const validStops = stopIds.filter((id) =>
      this.state.logistics.busStops.some((stop) => stop.id === id),
    )
    if (!depot || validStops.length < 2) {
      return {
        ok: false,
        message: 'Eine Linie benötigt ein Depot und mindestens zwei Haltestellen',
      }
    }
    const alreadyAssigned = new Set(
      this.state.logistics.busLines.flatMap((line) => line.busIds),
    )
    const buses = depot.busIds
      .filter((id) => !alreadyAssigned.has(id))
      .slice(0, Math.max(1, Math.min(3, Math.floor(busCount))))
    if (buses.length === 0) {
      return { ok: false, message: 'Im Depot ist kein freier Bus verfügbar' }
    }
    const id = this.nextId('bus-line')
    this.state.logistics.busLines.push({
      id,
      name: name.trim() || `Buslinie ${this.state.logistics.busLines.length + 1}`,
      depotId,
      stopIds: validStops,
      busIds: buses,
      headway: Math.max(2, Math.min(120, Math.floor(headway))),
      active: true,
      lastDepartureMinute: null,
    })
    buses.forEach((busId) => {
      const bus = this.state.logistics.roadVehicles.find(
        (vehicle) => vehicle.id === busId,
      )
      if (bus) bus.lineId = id
    })
    this.emit()
    return { ok: true, message: 'Buslinie angelegt' }
  }

  addBusToLine(lineId: string): ActionResult {
    const line = this.state.logistics.busLines.find(
      (candidate) => candidate.id === lineId,
    )
    if (!line) return { ok: false, message: 'Buslinie nicht gefunden' }
    const depot = this.state.logistics.busDepots.find(
      (candidate) => candidate.id === line.depotId,
    )
    if (!depot) return { ok: false, message: 'Busdepot nicht gefunden' }
    const assigned = new Set(
      this.state.logistics.busLines.flatMap((candidate) => candidate.busIds),
    )
    let busId = depot.busIds.find((id) => !assigned.has(id))
    if (!busId) {
      if (depot.busIds.length >= 3) {
        return { ok: false, message: 'Dieses Depot besitzt bereits drei Busse' }
      }
      if (this.state.money < SIMULATION_CONFIG.logistics.busCost) {
        return { ok: false, message: 'Nicht genug Geld' }
      }
      const access = this.getLogisticsBuildingAccess(depot, 3)
      if (!access) return { ok: false, message: 'Das Depot hat keinen befahrbaren Anschluss' }
      busId = this.nextId('bus')
      bookFinance(this.state, 'construction', -SIMULATION_CONFIG.logistics.busCost)
      depot.busIds.push(busId)
      this.state.logistics.roadVehicles.push(
        this.createRoadVehicle(busId, 'bus', access),
      )
    }
    if (line.busIds.includes(busId)) {
      return { ok: false, message: 'Dieser Bus fährt bereits auf der Linie' }
    }
    line.busIds.push(busId)
    const bus = this.state.logistics.roadVehicles.find(
      (vehicle) => vehicle.id === busId,
    )
    if (bus) bus.lineId = line.id
    this.emit()
    return { ok: true, message: 'Bus zur Linie hinzugefügt' }
  }

  setBusLineStops(lineId: string, stopIds: string[]): ActionResult {
    const line = this.state.logistics.busLines.find(
      (candidate) => candidate.id === lineId,
    )
    const validStops = stopIds.filter((id) =>
      this.state.logistics.busStops.some((stop) => stop.id === id),
    )
    if (!line) return { ok: false, message: 'Buslinie nicht gefunden' }
    if (validStops.length < 2) {
      return {
        ok: false,
        message: 'Eine Linie benötigt mindestens zwei Haltestellen',
      }
    }
    line.stopIds = validStops
    line.busIds.forEach((busId) => {
      const bus = this.state.logistics.roadVehicles.find(
        (vehicle) => vehicle.id === busId,
      )
      if (bus && bus.nextStopIndex >= validStops.length) bus.nextStopIndex = 0
    })
    this.emit()
    return { ok: true, message: 'Haltestellenreihenfolge gespeichert' }
  }

  previewBusLineRoute(stopIds: string[]): RoadPosition[] {
    return buildBusLineRoutePreview({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      stops: this.state.logistics.busStops,
      stopIds,
      worldSize: this.getWorldSize(),
    })
  }

  previewBusLineMarkers(stopIds: string[], lineId?: string): BusPlannerStopMarker[] {
    return buildBusLineMarkers(this.state.logistics.busStops, stopIds, lineId)
  }

  sortBusLineStops(stopIds: string[], depotId?: string): string[] {
    const depot = depotId
      ? this.state.logistics.busDepots.find((candidate) => candidate.id === depotId)
      : undefined
    const depotAccess = depot ? this.getLogisticsBuildingAccess(depot, 3) : undefined
    return orderBusLineStops({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      stops: this.state.logistics.busStops,
      stopIds,
      worldSize: this.getWorldSize(),
      depotAccess: depotAccess ?? undefined,
    })
  }

  getBusStopAt(x: number, z: number, stopId?: string) {
    return this.state.logistics.busStops.find((stop) =>
      stopId ? stop.id === stopId : stop.x === x && stop.z === z,
    )
  }

  deleteBusLine(lineId: string): ActionResult {
    const line = this.state.logistics.busLines.find(
      (candidate) => candidate.id === lineId,
    )
    if (!line) return { ok: false, message: 'Buslinie nicht gefunden' }
    line.busIds.forEach((busId) => {
      const bus = this.state.logistics.roadVehicles.find(
        (vehicle) => vehicle.id === busId,
      )
      if (bus) {
        bus.lineId = null
        bus.state = 'idle'
        bus.route = []
      }
    })
    this.state.logistics.busLines =
      this.state.logistics.busLines.filter(
        (candidate) => candidate.id !== lineId,
      )
    this.emit()
    return { ok: true, message: 'Buslinie gelöscht' }
  }

  private createRoadVehicle(
    id: string,
    kind: RoadVehicle['kind'],
    position: RoadPosition,
  ): RoadVehicle {
    return {
      id,
      kind,
      position: { ...position },
      cell: { ...position },
      route: [],
      state: 'idle',
      speed: 0,
      passengerIds: [],
      groupId: null,
      parkingCell: null,
      target: null,
      facing: 0,
      waitMinutes: 0,
      lineId: null,
      nextStopIndex: 0,
      resumeState: null,
      cargo: 0,
      deliveryId: null,
    }
  }

  private getLogisticsBuildingAccess(
    building: RoadPosition,
    size: number,
  ): RoadPosition | null {
    return this.createFootprint(building.x, building.z, size)
      .flatMap((cell) => this.getAdjacentRoadPositions(cell))[0] ?? null
  }

  private getLogisticsPathAccess(
    building: RoadPosition,
    size: number,
  ): Cell | null {
    return (
      this.createFootprint(building.x, building.z, size)
        .flatMap((cell) => this.getAdjacentPathCells(cell))[0] ?? null
    )
  }

  private getAdjacentPathCells(cell: { x: number; z: number }): Cell[] {
    const cells: Cell[] = []
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const x = cell.x + dx
      const z = cell.z + dz
      const path =
        this.getPathAt(x, z, this.getTerrainHeight(x, z)) ?? this.getPathAt(x, z)
      if (path && path.pathType === 'normal') {
        cells.push({ x: path.x, z: path.z, elevation: path.elevation })
      }
    }
    return cells
  }

  private getParkingDisembarkAccess(parking: RoadPosition): Cell {
    const pathExit = this.getParkingDisembarkCell(parking)
    if (pathExit) return pathExit
    const road =
      this.getParkingApproachRoads(parking)[0] ??
      this.getAdjacentRoadPositions(parking)[0]
    if (road) {
      return {
        x: road.x,
        z: road.z,
        elevation:
          this.getRoadCellAt(road.x, road.z)?.elevation ??
          this.getTerrainHeight(road.x, road.z),
      }
    }
    return this.getEntrance()
  }

  private collectParkingPathNeighbors(
    parking: RoadPosition,
  ): ParkingDisembarkCandidate[] {
    const parkingGround = this.getTerrainHeight(parking.x, parking.z)
    const candidates: ParkingDisembarkCandidate[] = []
    for (const [dx, dz] of CARDINAL_OFFSETS) {
      const x = parking.x + dx
      const z = parking.z + dz
      const path =
        this.getPathAt(x, z, this.getTerrainHeight(x, z)) ?? this.getPathAt(x, z)
      if (
        !path ||
        path.pathType !== 'normal' ||
        path.staffOnly ||
        Math.abs(path.elevation - parkingGround) > 1 ||
        this.isPedestrianSolidAt(path.x, path.z, path.elevation)
      ) {
        continue
      }
      candidates.push({
        x: path.x,
        z: path.z,
        elevation: path.elevation,
        onRoad: this.getRoadCellsAt(path.x, path.z).some((layer) =>
          wayOverlapsRoadGrade(
            path.elevation,
            path.pathSlope ?? 0,
            layer.elevation ?? this.getTerrainHeight(path.x, path.z),
          ),
        ),
      })
    }
    return candidates
  }

  private getParkedCarBoardCells(parking: RoadPosition): Cell[] {
    const paths = this.collectParkingPathNeighbors(parking).map((cell) => ({
      x: cell.x,
      z: cell.z,
      elevation: cell.elevation,
    }))
    if (paths.length > 0) return paths
    return this.getParkingApproachRoads(parking).map((road) => ({
      x: road.x,
      z: road.z,
      elevation:
        road.elevation ??
        this.getRoadCellAt(road.x, road.z)?.elevation ??
        this.getTerrainHeight(road.x, road.z),
    }))
  }

  private getParkingDisembarkCell(parking: RoadPosition): Cell | null {
    const candidates = this.collectParkingPathNeighbors(parking)
    const chosen = chooseParkingDisembarkPath(
      parking,
      candidates,
      this.getParkingApproachRoads(parking),
    )
    return chosen
      ? { x: chosen.x, z: chosen.z, elevation: chosen.elevation }
      : null
  }

  private isSweeperDriveCell(x: number, z: number, elevation?: number): boolean {
    if (this.claimedTentCellKeys().has(roadCellKey(x, z))) return false
    if (this.getStageForecourtCellAt(x, z)) return true
    const path =
      elevation === undefined
        ? this.getPathAt(x, z, this.getTerrainHeight(x, z)) ?? this.getPathAt(x, z)
        : this.getPathAt(x, z, elevation) ?? this.getPathAt(x, z)
    return Boolean(path && path.pathType === 'normal')
  }

  private getSweeperAccessCells(cell: { x: number; z: number; elevation?: number }): Cell[] {
    const cells: Cell[] = []
    const seen = new Set<string>()
    const add = (x: number, z: number, elevation: number) => {
      if (!this.isSweeperDriveCell(x, z, elevation)) return
      const key = `${x}:${z}:${elevation}`
      if (seen.has(key)) return
      seen.add(key)
      cells.push({ x, z, elevation })
    }
    const here =
      cell.elevation ??
      this.getPathAt(cell.x, cell.z, this.getTerrainHeight(cell.x, cell.z))?.elevation ??
      this.getTerrainHeight(cell.x, cell.z)
    add(cell.x, cell.z, here)
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const x = cell.x + dx
      const z = cell.z + dz
      const path =
        this.getPathAt(x, z, this.getTerrainHeight(x, z)) ?? this.getPathAt(x, z)
      add(x, z, path?.elevation ?? this.getTerrainHeight(x, z))
    }
    return cells
  }

  private canCarrierStep(
    from: { x: number; z: number; elevation: number },
    to: { x: number; z: number; elevation: number },
  ): boolean {
    if (this.isPedestrianEdgeBlocked(from, to)) return false
    if (this.isPedestrianSolidAt(to.x, to.z, to.elevation)) return false
    const toPath = this.getPathAt(to.x, to.z, to.elevation)
    if (toPath) {
      return this.canTraversePath(
        this.getPathAt(from.x, from.z, from.elevation),
        toPath,
        from.x,
        from.z,
        false,
        false,
        from.elevation,
      )
    }
    return Boolean(this.getStageForecourtCellAt(to.x, to.z))
  }

  placePathSegment(x: number, z: number, elevation: number, pathType: 'normal' | 'queue' = 'normal', queueDirection = 0, slope = 0, wayType?: WayType): ActionResult {
    return this.placementService.placePathSegment(x, z, elevation, pathType, queueDirection, slope, wayType)
  }

  undoPathSegment(x: number, z: number, elevation: number, previousPath?: PlacedBuilding): ActionResult {
    return this.placementService.undoPathSegment(x, z, elevation, previousPath)
  }

  bulldoze(x: number, z: number, buildingId?: string): ActionResult {
    return bulldozeCommand({
      state: this.state,
      getRideAccessAt: (cellX, cellZ) => this.getRideAccessAt(cellX, cellZ),
      getRemovableCoasterAt: (cellX, cellZ) => this.getRemovableCoasterAt(cellX, cellZ),
      removeCoaster: (coasterId) => this.removeCoaster(coasterId),
      clearDesignatedOccupancy: (cellX, cellZ) => {
        const result = this.clearDesignatedOccupancyAt(cellX, cellZ, true)
        if (result) this.emit()
        return result
      },
      bulldozeAt: (cellX, cellZ, id) => this.bulldozeAt(cellX, cellZ, id),
      recalculateQueueDirections: () => this.recalculateQueueDirections(),
      invalidateBuildingIndex: () => { this.indexedBuildingCount = -1 },
      emit: () => this.emit(),
    }, x, z, buildingId)
  }

  bulldozeArea(cells: ReadonlyArray<{ x: number; z: number }>): ActionResult {
    return bulldozeAreaCommand(
      cells,
      (x, z) => this.bulldoze(x, z),
      (x, z) => this.getBuildingsAtCell(x, z).length,
    )
  }

  private bulldozeAt(x: number, z: number, buildingId?: string): ActionResult {
    return this.placementService.bulldozeAt(x, z, buildingId)
  }

  tick(realSeconds: number): void {
    // Only the host advances the world. Clients display authoritative snapshots.
    if (this.networkMode === 'client') {
      this.tickAccumulator = Math.min(0.2, this.tickAccumulator + realSeconds)
      return
    }
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return
    this.runReadyTurns()
    if (this.state.speed === 0) {
      this.tickAccumulator = 0
      return
    }
    const tickSeconds = SIMULATION_CONFIG.time.tickSeconds
    this.tickAccumulator = Math.min(this.tickAccumulator + realSeconds, tickSeconds * 4)
    const maxSteps = SIMULATION_CONFIG.time.maxStepsPerFrame
    let steps = 0
    while (this.tickAccumulator >= tickSeconds && steps < maxSteps) {
      this.tickAccumulator -= tickSeconds
      this.advanceOne(true)
      steps += 1
      if (this.state.speed === 0) { this.tickAccumulator = 0; break }
    }
  }

  private toSimulationMinutes(realSeconds: number): number {
    const speed = SIMULATION_SPEED_MULTIPLIERS[this.state.speed] ?? 1
    return (
      realSeconds *
      speed *
      (SIMULATION_CONFIG.time.minutesPerDay /
        SIMULATION_CONFIG.time.normalDayDurationSeconds)
    )
  }

  private stepFixed(): void {
    if (this.state.speed === 0) return
    // Festival planning freezes guests, economy and the weekend clock, but
    // Testfahrt still has to move trains — new scenarios start in planning.
    if (this.state.festival.planning) {
      this.updateCoastersForCurrentTick()
      return
    }
    this.processingSimulationStep = true
    this.decisionBudget = SIMULATION_CONFIG.pathfinding.decisionsPerTick
    this.decidedThisTick.clear()
    try {
      this.simulateFixedStep()
    } finally {
      this.processingSimulationStep = false
    }
  }

  private updateCoastersForCurrentTick(): void {
    const speed = SIMULATION_SPEED_MULTIPLIERS[this.state.speed] ?? 1
    const realSeconds = SIMULATION_CONFIG.time.tickSeconds
    const simulationSeconds =
      realSeconds * speed * SIMULATION_CONFIG.time.movementSimulationRate
    this.updateCoasters(this.toSimulationMinutes(realSeconds), simulationSeconds)
  }

  private simulateFixedStep(): void {
    this.executedLogicTicks += 1
    const realSeconds = SIMULATION_CONFIG.time.tickSeconds
    const wetBucket = Math.floor(this.state.festival.wetness / 20)
    if (wetBucket !== this.groundWetBucket) { this.groundWetBucket = wetBucket; this.worldRevision++ }
    if (this.worldRevision !== this.lastNavRevision) {
      this.lastNavRevision = this.worldRevision
      this.ensurePedestrianNav(true)
    } else {
      this.ensurePedestrianNav(false)
    }
    this.visitorBehavior.walkVisitors(this.toSimulationMinutes(realSeconds))
    const minutes = this.toSimulationMinutes(realSeconds)
    this.state.minute += minutes
    this.simulatedMinutes += minutes

    while (this.state.minute >= SIMULATION_CONFIG.time.minutesPerDay) {
      this.state.minute -= SIMULATION_CONFIG.time.minutesPerDay
      this.state.day += 1
      rollFinanceDay(this.state.finance)
      updateScenarioProgress(this.state, financeEdition(this.state))
      if (
        getFestivalCycleStatus(this.state.dayPlan, this.state.day)
          .cycleDay === 0
      ) {
        this.rotateComplaintSession()
      }
    }
    this.evaluateAccessSignals()
    this.visitorBehavior.enforceDayPlan()
    this.syncBandSupply()
    updateFestival(this.state)
    updateSupplyChain(this.state, (start, goals) => this.findPath(start, goals, false, false, false, false, true, undefined, true), (a, b) => this.canCarrierStep(a, b))

    this.visitorSpawning.update(minutes)

    this.state.incidents.forEach((incident) => {
      incident.ageMinutes += minutes
    })
    this.updateLogistics(minutes)
    this.updateAbandonedCamps(minutes)
    this.updateStaff(minutes)
    this.atmosphereMinutes += minutes
    if (
      this.atmosphereMinutes >=
      SIMULATION_CONFIG.atmosphere.updateIntervalMinutes
    ) {
      this.updateAtmosphere()
      this.atmosphereMinutes = 0
    }
    this.crowdingMinutes += minutes
    if (
      this.crowdingMinutes >=
      SIMULATION_CONFIG.crowding.updateIntervalMinutes
    ) {
      this.visitorCrowding.update(this.crowdingMinutes)
      this.crowdingMinutes = 0
    }
    this.visitorSimulation.runTickPhase(minutes)

    if (this.simulatedMinutes >= SIMULATION_CONFIG.time.economyIntervalMinutes) {
      const hours = Math.floor(
        this.simulatedMinutes / SIMULATION_CONFIG.time.economyIntervalMinutes,
      )
      this.simulatedMinutes %= SIMULATION_CONFIG.time.economyIntervalMinutes
      this.runEconomy(hours)
    }

    this.state.cashEffects.forEach((effect) => {
      effect.age += realSeconds
    })
    this.state.cashEffects = this.state.cashEffects.filter(
      (effect) => effect.age < SIMULATION_CONFIG.time.cashEffectLifetimeSeconds,
    )
    this.state.fireworkEffects.forEach((effect) => {
      effect.age += realSeconds
    })
    this.state.fireworkEffects = this.state.fireworkEffects.filter(
      (effect) => effect.age < SIMULATION_CONFIG.time.fireworkEffectLifetimeSeconds,
    )
    this.uiRefreshSeconds += realSeconds
    if (
      this.uiRefreshSeconds >= SIMULATION_CONFIG.time.uiRefreshIntervalSeconds
    ) {
      this.uiRefreshSeconds = 0
      this.emit('tick')
    }
  }

  private updateLogistics(minutes: number): void {
    updateLogisticsSimulation({
      state: this.state,
      roadPositionKey: (position) => this.roadPositionKey(position),
      isRoadPosition: (position) =>
        Boolean(this.getRoadCellAt(position.x, position.z, position.elevation)),
      isVisitorSeated: (visitor, seated) =>
        this.isVisitorSeatedInVehicle(visitor, seated),
      evaluateAccessSignals: () => this.evaluateAccessSignals(),
      syncFreightToVehicles: () => this.syncFreightToVehicles(),
      restoreMissingGarbageTrucks: () => this.restoreMissingGarbageTrucks(),
      resetPerTickCaches: () => {
        this.roadVehicleSimulation.resetPerTickCaches()
      },
      processVehicles: (tickMinutes, tick) =>
        this.processLogisticsVehicles(tickMinutes, tick),
      leaveVisitorCampBehind: (visitor) => this.leaveVisitorCampBehind(visitor),
      normalizeCarManifest: (group) => this.normalizeCarManifest(group),
      visitorsRemoved: () => {
        this.indexedVisitorCount = -1
      },
      syncVehiclesToFreight: () => this.syncVehiclesToFreight(),
    }, minutes)
  }

  private processLogisticsVehicles(minutes: number, tick: LogisticsTickState): void {
    this.roadVehicleSimulation.processLogisticsVehicles(minutes, tick)
  }

  private syncFreightToVehicles(): void { this.roadVehicleSimulation.syncFreightToVehicles() }
  private syncVehiclesToFreight(): void { this.roadVehicleSimulation.syncVehiclesToFreight() }
  private restoreMissingGarbageTrucks(): void { this.roadVehicleSimulation.restoreMissingGarbageTrucks() }
  private dispatchIncomingVisitorCar(vehicle: RoadVehicle): void { this.roadVehicleSimulation.dispatchIncomingVisitorCar(vehicle) }
  private realignVehiclesOnRoad(x: number, z: number, facing: Direction | null, elevation: number): void { this.roadVehicleSimulation.realignVehiclesOnRoad(x, z, facing, elevation) }
  private sealedContainerRoadIsReachable(container: { x: number; z: number; elevation?: number }, reachable: ReadonlySet<string>): boolean { return this.roadVehicleSimulation.sealedContainerRoadIsReachable(container, reachable) }
  private isOffMapRoadExit(position: RoadPosition): boolean { return this.roadVehicleSimulation.isOffMapRoadExit(position) }
  private requestAmbulanceSale(vehicleId: string): ActionResult { return this.roadVehicleSimulation.requestAmbulanceSale(vehicleId) }

  private releaseVisitorCarParking(vehicle: RoadVehicle): void { this.roadVehicleSimulation.releaseVisitorCarParking(vehicle) }
  private findRouteTowardParking(vehicle: RoadVehicle, blockedCells?: ReadonlySet<string>) { return this.roadVehicleSimulation.findRouteTowardParking(vehicle, blockedCells) }
  private findVisitorCarCirculation(vehicle: RoadVehicle, blockedCells?: ReadonlySet<string>) { return this.roadVehicleSimulation.findVisitorCarCirculation(vehicle, blockedCells) }
  private applyVisitorCarSearchRoute(vehicle: RoadVehicle, plan: { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> }): void { this.roadVehicleSimulation.applyVisitorCarSearchRoute(vehicle, plan) }
  private routePreferringOpenLights(options: FindRoadRouteOptions): RoadCell[] | null { return this.roadVehicleSimulation.routePreferringOpenLights(options) }
  private getVehicleDirection(vehicle: RoadVehicle): Direction { return this.roadVehicleSimulation.getVehicleDirection(vehicle) }
  private claimedTentCellKeys(): Set<string> { return this.roadVehicleSimulation.claimedTentCellKeys() }
  assignVisitorCarParking(vehicle: RoadVehicle, minutes: number, removedVisitors: Set<string>, removedGroups: Set<string>, removedVehicles: Set<string>, canSearch: boolean): void { this.roadVehicleSimulation.assignVisitorCarParking(vehicle, minutes, removedVisitors, removedGroups, removedVehicles, canSearch) }
  nudgeVehicleAlongRoad(vehicle: RoadVehicle, blockedCells?: ReadonlySet<string>): boolean { return this.roadVehicleSimulation.nudgeVehicleAlongRoad(vehicle, blockedCells) }
  reverseQueueTail(vehicle: RoadVehicle, occupied: ReadonlyMap<string, string>, blockedCells: ReadonlySet<string>): boolean { return this.roadVehicleSimulation.reverseQueueTail(vehicle, occupied, blockedCells) }
  dispatchGarbageTruck(vehicle: RoadVehicle): void { this.roadVehicleSimulation.dispatchGarbageTruck(vehicle) }
  finishGarbageTruckLeg(vehicle: RoadVehicle): void { this.roadVehicleSimulation.finishGarbageTruckLeg(vehicle) }
  findSweeperRoute(vehicle: RoadVehicle, goals: readonly Cell[]): RoadPosition[] | null { return this.roadVehicleSimulation.findSweeperRoute(vehicle, goals) }
  getSweeperDirtAccesses(zones?: string[]): Array<{ dirt: { x: number; z: number }; path: Cell }> { return this.roadVehicleSimulation.getSweeperDirtAccesses(zones) }
  sweepAround(vehicle: RoadVehicle): void { this.roadVehicleSimulation.sweepAround(vehicle) }
  findReachableRoadExit(start: RoadPosition, initialDirection: Direction, blockedCells?: ReadonlySet<string>, allowUTurn = false): { position: RoadPosition; route: RoadCell[] } | null { return this.roadVehicleSimulation.findReachableRoadExit(start, initialDirection, blockedCells, allowUTurn) }
  claimAdjacentFreeParking(vehicle: RoadVehicle): boolean { return this.roadVehicleSimulation.claimAdjacentFreeParking(vehicle) }
  private searchReachableRoadExit(start: RoadPosition, initialDirection: Direction, blockedCells?: ReadonlySet<string>, allowUTurn = false): { position: RoadPosition; route: RoadCell[] } | null { return this.roadVehicleSimulation.searchReachableRoadExit(start, initialDirection, blockedCells, allowUTurn) }

  private getAdjacentRoadPositions(position: RoadPosition): RoadPosition[] {
    return [
      { x: position.x, z: position.z + 1 },
      { x: position.x + 1, z: position.z },
      { x: position.x, z: position.z - 1 },
      { x: position.x - 1, z: position.z },
    ].filter((cell) => Boolean(this.getRoadCellAt(cell.x, cell.z)))
  }

  private canEnterParkingFromRoad(
    road: RoadCell,
    parking: RoadPosition,
  ): boolean {
    const direction = directionFromDelta(parking.x - road.x, parking.z - road.z)
    if (direction === null) return false
    if ((road.blockedEdges & directionBit(direction)) !== 0) return false
    const terrain = this.getTerrainHeight(road.x, road.z)
    return (
      Math.abs((road.elevation ?? terrain) - terrain) < WAY_LEVEL_MATCH &&
      Math.abs(road.roadSlope ?? 0) <= WAY_ELEVATION_EPSILON
    )
  }

  private getParkingApproachRoads(parking: RoadPosition): RoadPosition[] {
    return this.getAdjacentRoadPositions(parking).flatMap((approach) => {
      const road = this.getRoadCellAt(approach.x, approach.z)
      return road && this.canEnterParkingFromRoad(road, parking) ? [toRoadPosition(road)] : []
    })
  }

  private getOpenParkingApproachRoads(parking: RoadPosition): RoadPosition[] {
    return this.getParkingApproachRoads(parking).filter(
      (approach) =>
        !stepUsesClosedEdge(
          approach.x,
          approach.z,
          parking.x,
          parking.z,
          this.closedTrafficEdges,
        ),
    )
  }

  private isIllegalParkingPullIn(
    vehicle: RoadVehicle,
    here: RoadPosition,
    next: RoadPosition,
  ): boolean {
    if (vehicle.kind !== 'visitorCar') return false
    const parking = this.state.logistics.parkingCells.find(
      (cell) => cell.x === next.x && cell.z === next.z,
    )
    if (!parking) return false
    const road = this.getRoadCellAt(here.x, here.z, here.elevation)
    return !road || !this.canEnterParkingFromRoad(road, parking)
  }

  private isVehicleOnItsParkingCell(vehicle: RoadVehicle): boolean {
    if (!vehicle.parkingCell) return false
    const here = vehicle.cell ?? vehicle.position
    return here.x === vehicle.parkingCell.x && here.z === vehicle.parkingCell.z
  }

  private isVehicleAtParkingAccess(vehicle: RoadVehicle): boolean {
    if (!vehicle.parkingCell) return false
    const here = vehicle.cell ?? vehicle.position
    return this.getParkingApproachRoads(vehicle.parkingCell).some(
      (access) => this.roadPositionKey(access) === this.roadPositionKey(here),
    )
  }

  private beginVehiclePullIn(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) return
    if (!this.isVehicleAtParkingAccess(vehicle)) return
    vehicle.route = [{ x: vehicle.parkingCell.x, z: vehicle.parkingCell.z }]
    vehicle.state = 'parking'
    vehicle.target = {
      kind: 'parking',
      parkingCell: { ...vehicle.parkingCell },
    }
    vehicle.waitMinutes = 0
  }

  private completeVisitorCarArrival(vehicle: RoadVehicle): void {
    if (this.isVehicleOnItsParkingCell(vehicle)) {
      this.finishVehicleParking(vehicle)
      return
    }
    if (vehicle.parkingCell && this.isVehicleAtParkingAccess(vehicle)) {
      this.beginVehiclePullIn(vehicle)
      return
    }
    this.releaseVisitorCarParking(vehicle)
    const plan =
      this.findRouteTowardParking(vehicle) ??
      this.findVisitorCarCirculation(vehicle)
    if (plan) {
      this.applyVisitorCarSearchRoute(vehicle, plan)
      return
    }
    vehicle.state = 'waiting'
    vehicle.route = []
  }

  getVehicleAt(x: number, z: number): RoadVehicle | undefined {
    return this.state.logistics.roadVehicles.find((vehicle) => {
      if (vehicle.cell && vehicle.cell.x === x && vehicle.cell.z === z) return true
      if (vehicle.position.x === x && vehicle.position.z === z) return true
      return Boolean(
        vehicle.state === 'parked' &&
          vehicle.parkingCell &&
          vehicle.parkingCell.x === x &&
          vehicle.parkingCell.z === z,
      )
    })
  }

  private finishVehicleParking(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) {
      vehicle.state = 'waiting'
      return
    }
    if (!this.isVehicleOnItsParkingCell(vehicle)) {
      if (this.isVehicleAtParkingAccess(vehicle)) {
        this.beginVehiclePullIn(vehicle)
        return
      }
      this.completeVisitorCarArrival(vehicle)
      return
    }
    vehicle.state = 'parked'
    vehicle.waitMinutes = 0
    vehicle.position = { ...vehicle.parkingCell }
    vehicle.cell = null
    const group = this.state.logistics.arrivalGroups.find(
      (candidate) => candidate.id === vehicle.groupId,
    )
    if (group) group.state = 'arrived'
    const access = this.getParkingDisembarkAccess(vehicle.parkingCell)
    const remainingPassengers: string[] = []
    const toActivate: Visitor[] = []
    vehicle.passengerIds.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor) return
      if (visitor.state === 'leaving') {
        remainingPassengers.push(visitorId)
        return
      }
      const deferredInjury = visitor.state === 'injured'
      this.placeVisitorOnDisembarkCell(visitor, access)
      if (deferredInjury) {
        visitor.state = 'injured'
        visitor.route = []
        visitor.targetId = null
        return
      }
      visitor.state = 'entering'
      if (getItemQuantity(visitor.inventory, 'tent') > 0) {
        if (!this.camping.assignCampsite(visitor)) {
          visitor.state = 'camp-waiting'
          visitor.campingWaitRetryMinutes =
            SIMULATION_CONFIG.camping.unplacedRetryIntervalMinutes
        }
      } else {
        visitor.hasHandcart = false
        toActivate.push(visitor)
      }
    })
    vehicle.passengerIds = remainingPassengers
    toActivate.forEach((visitor) => {
      this.visitorBehavior.decideNextAction(visitor)
      this.keepDisembarkRouteOnFoot(visitor)
    })
  }

  private placeVisitorOnDisembarkCell(visitor: Visitor, access: Cell): void {
    this.ensurePedestrianNav(this.lastNavRevision !== this.worldRevision)
    const cell = this.snapToPedestrianNavCell(access)
    const offsetMin = SIMULATION_CONFIG.visitors.tileOffsetMinimum
    const offsetMax = 1 - offsetMin
    visitor.tileOffsetX = Math.min(
      offsetMax,
      Math.max(offsetMin, visitor.tileOffsetX),
    )
    visitor.tileOffsetZ = Math.min(
      offsetMax,
      Math.max(offsetMin, visitor.tileOffsetZ),
    )
    visitor.cellX = cell.x
    visitor.cellZ = cell.z
    visitor.cellElevation = cell.elevation
    visitor.x = cell.x + visitor.tileOffsetX
    visitor.z = cell.z + visitor.tileOffsetZ
    const path =
      this.getPathAt(cell.x, cell.z, cell.elevation) ??
      this.getPathAt(cell.x, cell.z)
    visitor.y = this.samplePedestrianSurfaceY(
      visitor.x,
      visitor.z,
      path,
      cell.elevation,
    )
    visitor.route = []
    visitor.targetId = null
  }

  private snapToPedestrianNavCell(cell: Cell): Cell {
    if (this.pedestrianNavigation.hasNode(cell)) return { ...cell }
    const path =
      this.getPathAt(cell.x, cell.z, cell.elevation) ?? this.getPathAt(cell.x, cell.z)
    if (path) {
      const snapped = { x: path.x, z: path.z, elevation: path.elevation }
      if (this.pedestrianNavigation.hasNode(snapped)) return snapped
    }
    const ground = {
      x: cell.x,
      z: cell.z,
      elevation: this.getTerrainHeight(cell.x, cell.z),
    }
    if (this.pedestrianNavigation.hasNode(ground)) return ground
    return { ...cell }
  }

  private isParkingBayWithoutPath(cell: { x: number; z: number; elevation: number }): boolean {
    return (
      this.hasParkingAt(cell.x, cell.z) &&
      !this.getPathAt(cell.x, cell.z, cell.elevation) &&
      !this.getPathAt(cell.x, cell.z)
    )
  }

  private keepDisembarkRouteOnFoot(visitor: Visitor): void {
    if (visitor.route.some((cell) => this.isParkingBayWithoutPath(cell))) {
      visitor.route = []
    }
    if (visitor.route.length > 0) return
    visitor.route = this.visitorBehavior.pickSeededWalk(
      {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      },
      SIMULATION_CONFIG.pathfinding.wanderMinSteps,
      this.visitorBehavior.visitorDecisionRng(visitor),
      { allowFestival: true },
    )
  }

  private livingArrivalMembers(group: ArrivalGroup): Visitor[] {
    return group.memberIds
      .map((visitorId) => this.getVisitor(visitorId))
      .filter((visitor): visitor is Visitor => Boolean(visitor))
  }

  private normalizeCarManifest(group: ArrivalGroup): void {
    group.memberIds = group.memberIds.filter((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      return Boolean(visitor && visitor.arrivalGroupId === group.id)
    })
  }

  private hasArrivalPassengersStillSeated(
    vehicle: RoadVehicle,
    group: ArrivalGroup,
  ): boolean {
    return this.livingArrivalMembers(group).some((visitor) => {
      if (!vehicle.passengerIds.includes(visitor.id)) return false
      return (
        visitor.state !== 'leaving' &&
        visitor.campingPhase !== 'packing'
      )
    })
  }

  private canParkedCarDepart(
    vehicle: RoadVehicle,
    group: ArrivalGroup,
  ): boolean {
    this.normalizeCarManifest(group)
    if (this.hasArrivalPassengersStillSeated(vehicle, group)) return false
    const originals = this.livingArrivalMembers(group)
    if (originals.length === 0) return true
    return originals.every((visitor) =>
      vehicle.passengerIds.includes(visitor.id),
    )
  }

  private updateVisitorFireworks(minutes: number): void {
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    const launches = this.fireworks.update(
      this.state.visitors.filter(
        (visitor) => !this.isVisitorSeatedInVehicle(visitor, seated),
      ),
      minutes,
      () => this.nextId('firework'),
      this.rng,
    )
    launches.forEach(({ visitorId, effect, startsFire }) => {
      const visitor = this.getVisitor(visitorId)
      if (visitor) {
        visitor.thought = 'Ich habe einen Feuerwerkskörper gezündet!'
        visitor.emotion = 'excited'
        visitor.emotionMinutes = SIMULATION_CONFIG.fireworks.emotionMinutes
        visitor.needs.fun = Math.min(
          100,
          visitor.needs.fun + SIMULATION_CONFIG.fireworks.funGain,
        )
        this.visitorBehavior.giveWaste(visitor, 1)
      }
      this.state.fireworkEffects.push(effect)
      if (startsFire) {
        this.addGroundIncident(
          'fire',
          {
            x: Math.floor(effect.x),
            z: Math.floor(effect.z),
            elevation: Math.max(0, Math.floor(effect.y)),
          },
          SIMULATION_CONFIG.fireworks.fireSeverity,
        )
      }
    })
    this.updateShowFireworks()
  }

  private updateShowFireworks(): void {
    if (!this.isStagePerforming()) return
    const interval = SIMULATION_CONFIG.power.showFireworkIntervalMinutes
    const slot = Math.floor(this.state.minute / interval)
    const colors = [0xff5964, 0xffca3a, 0x8ac926, 0x38bdf8, 0xc77dff]
    this.state.buildings.forEach((building) => {
      if (building.kind !== 'fireworkBattery') return
      if (!this.poweredBuildingIds.has(building.id)) return
      if (this.showFireworkSlots.get(building.id) === slot) return
      this.showFireworkSlots.set(building.id, slot)
      for (let index = 0; index < SIMULATION_CONFIG.power.showFireworkBurst; index += 1) {
        this.state.fireworkEffects.push({
          id: `show-firework-${building.id}-${slot}-${index}`,
          x: building.x + 0.5 + (index - 1) * 0.28,
          y: building.elevation + 0.7,
          z: building.z + 0.5,
          color: colors[(slot + index) % colors.length]!,
          age: index * 0.08,
        })
      }
    })
  }

  private refreshPower(): void {
    const hasPlant = this.state.buildings.some(
      (building) =>
        building.kind === 'generator' || building.kind === 'backupGenerator',
    )
    if (!hasPlant) {
      const demand = this.state.buildings.reduce(
        (total, building) =>
          total + (SIMULATION_CONFIG.power.demand[building.kind] ?? 0) + (building.stageDesign ? stageStats(building.stageDesign).power : 0),
        0,
      )
      const poweredBuildingIds = this.state.buildings
        .filter((building) => (SIMULATION_CONFIG.power.demand[building.kind] ?? 0) > 0)
        .map((building) => building.id)
      this.state.power = {
        ...normalizePower(this.state.power),
        demand,
        supply: 0,
        poweredBuildingIds,
        liveCableKeys: [],
      }
      this.poweredBuildingIds = new Set(poweredBuildingIds)
      return
    }
    const next = this.powerSystem.calculate(
      this.state.power.cableCells,
      this.state.buildings,
    )
    this.state.power = next
    this.poweredBuildingIds = new Set(next.poweredBuildingIds)
  }

  private addGroundIncident(
    kind: GroundIncidentKind,
    cell: { x: number; z: number; elevation: number },
    severity = 1,
  ): void {
    const existing = this.state.incidents.find(
      (incident) =>
        incident.kind === kind &&
        incident.x === cell.x &&
        incident.z === cell.z &&
        incident.elevation === cell.elevation,
    )
    if (existing) {
      existing.severity = Math.min(
        SIMULATION_CONFIG.incidents.maximumSeverityPerCell,
        existing.severity + severity,
      )
      existing.ageMinutes = 0
      return
    }
    this.state.incidents.push(
      this.incidents.createIncident(
        this.nextId('incident'),
        kind,
        cell,
        Math.min(
          SIMULATION_CONFIG.incidents.maximumSeverityPerCell,
          severity,
        ),
      ),
    )
  }

  private mergeIncidentStacks(
    incidents: readonly GroundIncident[],
  ): GroundIncident[] {
    const merged = new Map<string, GroundIncident>()
    incidents.forEach((incident) => {
      const key = `${incident.kind}:${incident.x}:${incident.z}:${incident.elevation}`
      const existing = merged.get(key)
      if (!existing) {
        merged.set(key, {
          ...incident,
          severity: Math.min(
            SIMULATION_CONFIG.incidents.maximumSeverityPerCell,
            incident.severity,
          ),
        })
        return
      }
      existing.severity = Math.min(
        SIMULATION_CONFIG.incidents.maximumSeverityPerCell,
        existing.severity + incident.severity,
      )
      existing.ageMinutes = Math.min(
        existing.ageMinutes,
        incident.ageMinutes,
      )
    })
    return [...merged.values()]
  }

  private updateAtmosphere(): void {
    this.updateVisitorConversations()
    const result = this.atmosphere.calculate(
      this.state.buildings
        .filter((building) => this.isBuildingCurrentlyActive(building))
        .map((building) => ({
          id: building.id,
          kind: building.kind,
          x: building.x,
          z: building.z,
          elevation: building.elevation,
          rotation: building.rotation,
          wasteFill: building.wasteFill,
          stageDesign: building.stageDesign,
        })),
      this.state.incidents,
      this.state.visitors,
      this.state.campInstallations,
      this.state.wasteDumpCells,
      this.getWorldSize(),
      this.state.logistics.roadVehicles
        .filter(
          (vehicle) =>
            vehicle.kind === 'sweeper' &&
            (vehicle.state === 'responding' || vehicle.state === 'returning'),
        )
        .map((vehicle) => {
          const x = vehicle.cell?.x ?? vehicle.position.x
          const z = vehicle.cell?.z ?? vehicle.position.z
          const path =
            this.getPathAt(x, z, this.getTerrainHeight(x, z)) ??
            this.getPathAt(x, z)
          return { x, z, elevation: path?.elevation ?? 0 }
        }),
    )
    this.state.attractiveness = result.attractiveness
    this.state.partyMood = result.partyMood
    this.attractivenessValues = result.attractivenessValues
    this.partyMoodValues = result.partyMoodValues
    this.attractivenessPacked.clear()
    result.attractivenessValues.forEach((value, key) => {
      const packed = this.packAtmosphereKey(key)
      if (packed !== null) this.attractivenessPacked.set(packed, value)
    })
    this.state.visitors.forEach((visitor) => {
      const cellKey = this.cellKey(
        visitor.cellX,
        visitor.cellZ,
        visitor.cellElevation,
      )
      visitor.localAttractiveness =
        this.attractivenessValues.get(cellKey) ?? 0
      visitor.localPartyMood = this.partyMoodValues.get(cellKey) ?? 0
    })
  }

  private updateVisitorConversations(): void {
    const stationary = new Map<string, Visitor[]>()
    this.state.visitors.forEach((visitor) => {
      visitor.isConversing = false
      if (
        visitor.route.length > 0 ||
        (visitor.state !== 'relaxing' &&
          visitor.state !== 'socializing' &&
          visitor.state !== 'partying')
      ) {
        return
      }
      const cellKey = this.cellKey(
        visitor.cellX,
        visitor.cellZ,
        visitor.cellElevation,
      )
      const group = stationary.get(cellKey) ?? []
      group.push(visitor)
      stationary.set(cellKey, group)
    })
    stationary.forEach((visitors, cellKey) => {
      if (visitors.length < 2) return
      visitors.forEach((visitor) => {
        visitor.isConversing = true
      })
      stationary.set(cellKey, visitors)
    })
  }

  private updateStaff(minutes: number): void {
    this.staffSimulation.update(
      {
        staff: this.state.staff,
        visitors: this.state.visitors,
        seatedPassengerIds: collectSeatedPassengerIds(
          this.state.logistics.roadVehicles,
        ),
        incidents: this.state.incidents,
        medicalCells: this.state.medicalCells,
        wasteDumps: this.state.wasteDumpCells,
        wasteBins: this.state.buildings
          .filter((building) => isWasteBin(building.kind))
          .map((building) => ({
            id: building.id,
            x: building.x,
            z: building.z,
            elevation: building.elevation,
            stored: building.wasteFill ?? 0,
          })),
        sealedContainers: this.listSealedWasteContainers(),
        securityGates: this.state.buildings
          .filter((building) => building.kind === 'securityGate')
          .map((building) => ({
            id: building.id,
            x: building.x,
            z: building.z,
            elevation: building.elevation,
          })),
        findPath: (start, goals, allowGround) =>
          this.findPath(start, goals, false, true, allowGround, false, true, undefined, true),
        pathNeighbors: (cell) =>
          this.getPedestrianNeighbors(cell, {
            allowStaff: true,
            allowCamping: true,
            allowMedical: true,
            allowFestival: true,
          }),
        rng: this.rng,
        reserveBed: (visitorId, preferredCell) =>
          this.medical.reserveBed(
            this.state.medicalCells,
            visitorId,
            preferredCell,
          ),
        removeIncident: (id) => {
          const target = this.state.incidents.find((incident) => incident.id === id)
          this.state.incidents = this.state.incidents.filter(
            (incident) =>
              incident.id !== id &&
              !(
                target &&
                (target.kind === 'vomit' || target.kind === 'litter') &&
                incident.kind === target.kind &&
                incident.x === target.x &&
                incident.z === target.z &&
                Math.abs(incident.elevation - target.elevation) < 0.01
              ),
          )
        },
        depositWaste: (x, z, amount) => {
          const dump = this.getWasteDumpAt(x, z)
          if (!dump || amount <= 0) return 0
          return acceptWasteAtDump(dump, amount)
        },
        fillBin: (id, amount) => {
          const bin = this.state.buildings.find(b => b.id === id && isWasteBin(b.kind))
          if (!bin) return 0
          const added = Math.min(amount, Math.max(0, SIMULATION_CONFIG.waste.binCapacity - (bin.wasteFill ?? 0)))
          bin.wasteFill = (bin.wasteFill ?? 0) + added
          return added
        },
        fillSealedContainer: (id, amount) => {
          const container = this.state.buildings.find(
            (building) => building.id === id && isSealedWasteContainer(building.kind),
          )
          if (!container) return 0
          return acceptWasteAtSealedContainer(container, amount)
        },
        emptySealedContainer: (id, amount) => {
          const container = this.state.buildings.find(
            (building) => building.id === id && isSealedWasteContainer(building.kind),
          )
          if (!container) return 0
          return emptySealedContainerStored(container, amount)
        },
        emptyBin: (id, amount) => {
          const bin = this.state.buildings.find(
            (building) => building.id === id && isWasteBin(building.kind),
          )
          if (!bin || amount <= 0) return 0
          const taken = Math.min(bin.wasteFill ?? 0, amount)
          bin.wasteFill = (bin.wasteFill ?? 0) - taken
          return taken
        },
        abandonedCamps: this.collectibleAbandonedCamps(),
        removeAbandonedCamp: (id) => {
          const before = this.state.campInstallations.length
          this.state.campInstallations = this.state.campInstallations.filter(
            (installation) => installation.id !== id,
          )
          return this.state.campInstallations.length < before
        },
      },
      minutes,
    )
  }

  private collectibleAbandonedCamps(): Array<{
    id: string
    x: number
    z: number
    elevation: number
  }> {
    const living = new Set(this.state.visitors.map((visitor) => visitor.id))
    return this.state.campInstallations
      .filter((installation) => isCollectibleCamp(installation, living))
      .map((installation) => {
        const access = this.campCleanupAccess(installation.cell)
        return {
          id: `camp:${installation.id}`,
          x: access.x,
          z: access.z,
          elevation: access.elevation,
        }
      })
  }

  private campCleanupAccess(cell: { x: number; z: number; elevation: number }): {
    x: number
    z: number
    elevation: number
  } {
    const pitch = this.getCampingCellAt(cell.x, cell.z)
    const here = {
      x: cell.x,
      z: cell.z,
      elevation: pitch?.elevation ?? this.getTerrainHeight(cell.x, cell.z),
    }
    const adjacent = [
      { x: cell.x + 1, z: cell.z },
      { x: cell.x - 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x, z: cell.z - 1 },
    ]
    for (const neighbor of adjacent) {
      const path =
        this.getPathAt(neighbor.x, neighbor.z, this.getTerrainHeight(neighbor.x, neighbor.z)) ??
        this.getPathAt(neighbor.x, neighbor.z)
      if (path) {
        return { x: path.x, z: path.z, elevation: path.elevation }
      }
    }
    return here
  }

  private updateAbandonedCamps(minutes: number): void {
    const living = new Set(this.state.visitors.map((visitor) => visitor.id))
    this.state.campInstallations = decayUnclaimedInstallations(
      this.state.campInstallations,
      living,
      minutes,
    )
  }

  private leaveVisitorCampBehind(visitor: Visitor): void {
    this.state.campInstallations = abandonVisitorCamp(
      visitor,
      this.state.campInstallations,
      () => this.nextId('camp'),
    )
    visitor.campsite = null
    if (visitor.campingPhase !== 'packing') visitor.campingPhase = 'none'
  }

  private ensurePanicFleeRoute(visitor: Visitor): void {
    this.visitorCrowding.ensurePanicFleeRoute(visitor)
  }

  updateCrowdingAndMotivation(minutes: number): void {
    this.visitorCrowding.update(minutes)
  }

  save(): ActionResult {
    try {
      localStorage.setItem(SAVE_KEY, serializeSnapshot(this.state))
      return { ok: true, message: 'Spiel gespeichert' }
    } catch (error) {
      return { ok: false, message: storageErrorMessage(error, 'Schnellspeichern ist fehlgeschlagen') }
    }
  }

  saveSlot(name: string, id?: string): ActionResult {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!trimmed) return { ok: false, message: 'Bitte einen Namen für den Spielstand eingeben' }
    try {
      const slots = GameState.readSlotIndex()
      const target = id ? slots.find(slot => slot.id === id) : undefined
      if (!target && slots.length >= 20) return { ok: false, message: 'Maximal 20 lokale Spielstände möglich' }
      const savedAt = Date.now()
      const next: LocalSaveSlot = {
        id: target?.id ?? `slot-${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        savedAt,
      }
      const updated = target
        ? slots.map(slot => slot.id === target.id ? next : slot)
        : [...slots, next]
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(updated))
      try {
        localStorage.setItem(saveSlotDataKey(next.id), serializeSnapshot(this.state))
        return { ok: true, message: `Spielstand „${trimmed}“ gespeichert`, slotId: next.id }
      } catch (error) {
        return { ok: false, message: storageErrorMessage(error, 'Lokaler Spielstandsspeicher ist nicht verfügbar'), slotId: next.id }
      }
    } catch (error) {
      return { ok: false, message: storageErrorMessage(error, 'Lokaler Spielstandsspeicher ist nicht verfügbar') }
    }
  }

  static listSaveSlots(): LocalSaveSlot[] {
    return GameState.readSlotIndex().sort((a, b) => b.savedAt - a.savedAt)
  }

  static loadSlot(id: string): GameState | null {
    const raw = GameState.readSlotSnapshot(id)
    return raw ? GameState.fromJSON(raw) : null
  }

  static deleteSaveSlot(id: string): ActionResult {
    try {
      const slots = GameState.readSlotIndex()
      if (!slots.some(slot => slot.id === id)) return { ok: false, message: 'Spielstand nicht gefunden' }
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots.filter(slot => slot.id !== id)))
      try { localStorage.removeItem(saveSlotDataKey(id)) } catch { /* index already dropped the row */ }
      return { ok: true, message: 'Spielstand gelöscht' }
    } catch (error) {
      return { ok: false, message: storageErrorMessage(error, 'Lokaler Spielstandsspeicher ist nicht verfügbar') }
    }
  }

  /** Metadata only — never construct GameState while listing, or a heavy slot empties the archive. */
  private static readSlotIndex(): LocalSaveSlot[] {
    try {
      const raw = localStorage.getItem(SAVE_SLOTS_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const slots: LocalSaveSlot[] = []
      let migrated = false
      for (const slot of parsed) {
        if (!slot || typeof slot.id !== 'string' || typeof slot.name !== 'string' || typeof slot.savedAt !== 'number') continue
        slots.push({ id: slot.id, name: slot.name, savedAt: slot.savedAt })
        if (typeof slot.snapshot === 'string') {
          try {
            if (localStorage.getItem(saveSlotDataKey(slot.id)) == null) {
              localStorage.setItem(saveSlotDataKey(slot.id), slot.snapshot)
            }
            migrated = true
          } catch { /* loadSlot can still read the embedded legacy snapshot */ }
        }
      }
      if (migrated) {
        try { localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots)) } catch { /* keep the legacy blob */ }
      }
      return slots
    } catch {
      return []
    }
  }

  private static readSlotSnapshot(id: string): string | null {
    try {
      const side = localStorage.getItem(saveSlotDataKey(id))
      if (typeof side === 'string' && side) return side
    } catch { /* try the legacy index blob */ }
    try {
      const raw = localStorage.getItem(SAVE_SLOTS_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredSaveSlot[]
      if (!Array.isArray(parsed)) return null
      const slot = parsed.find(item => item && item.id === id)
      return typeof slot?.snapshot === 'string' ? slot.snapshot : null
    } catch {
      return null
    }
  }

  static load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? GameState.fromJSON(raw) : null
    } catch {
      return null
    }
  }

  static fromJSON(raw: string): GameState | null {
    try {
      const migrated = migrateSnapshot(JSON.parse(raw))
      if (!migrated) return null
      return new GameState(migrated)
    } catch {
      return null
    }
  }

  trySpawnVisitor(forcedTicketType?: 'day' | 'camping'): void {
    this.visitorSpawning.trySpawn(forcedTicketType)
  }

  spawnVisitorMember(
    forcedTicketType: 'day' | 'camping' | undefined,
    groupId: string,
    arrivalMode: 'car' | 'pedestrian',
    deferArrival: boolean,
  ): Visitor | null {
    return this.visitorSpawning.spawnMember(
      forcedTicketType,
      groupId,
      arrivalMode,
      deferArrival,
    )
  }

  sampleArrivalGroupSize(): number {
    return this.visitorSpawning.sampleArrivalGroupSize()
  }

  private listFreeRoadEntries(
    exceptVehicleId?: string,
    ingressOnly = true,
  ): RoadPosition[] {
    const northZ = -this.getWorldSize() / 2
    const occupied = (x: number, z: number) =>
      this.state.logistics.roadVehicles.some(
        (vehicle) =>
          vehicle.id !== exceptVehicleId &&
          vehicle.cell?.x === x &&
          vehicle.cell.z === z &&
          vehicle.state !== 'parked',
      )
    const entries: RoadPosition[] = []
    const seen = new Set<string>()
    const consider = (x: number, z: number) => {
      const key = roadCellKey(x, z)
      if (seen.has(key)) return
      const road = this.getRoadCellAt(x, z)
      if (!road || !isRoadDirectionAllowed(road, 0) || occupied(x, z)) return
      seen.add(key)
      entries.push({ x, z })
    }
    for (let x = -3; x <= 2; x += 1) consider(x, northZ)
    if (!ingressOnly) {
      for (const road of this.state.logistics.roadCells) {
        if (road.z !== northZ) continue
        consider(road.x, road.z)
      }
    }
    return entries
  }

  private findAvailableRoadEntry(): RoadPosition | null {
    return this.listFreeRoadEntries()[0] ?? null
  }

  private queueVisitorDecision(visitor: Visitor): void {
    this.visitorSimulation.queueDecision(visitor)
  }

  private runVisitorRouting(visitor: Visitor, kind: 'departure' | 'exit' | 'waste', action: () => void): boolean {
    return this.visitorSimulation.runRouting(visitor, kind, action)
  }

  private flushVisitorDecisions(limit = 2): void {
    this.visitorSimulation.flushDecisions(limit)
  }

  private updateCoasters(minutes: number, physicsSeconds: number): void {
    this.coasterSimulation.update(minutes, physicsSeconds)
  }

  integrateTrainPhysics(coaster: Coaster, elapsedSeconds: number): void {
    this.coasterSimulation.integratePhysics(coaster, elapsedSeconds)
  }

  private getCoasterQueueCells(coaster: Coaster): Cell[] {
    return this.getAccessQueueCells(coaster.entrance)
  }

  private getAccessQueueCells(entrance: {x:number;y:number;z:number} | null | undefined): Cell[] {
    if (!entrance) return []
    const fronts = this.getAccessPathNeighbors(entrance).filter((cell) => {
      const path = this.getPathAt(cell.x, cell.z, cell.elevation)
      const directionToEntrance = this.getDirectionIndex(
        entrance.x - cell.x,
        entrance.z - cell.z,
      )
      return path?.pathType === 'queue' && path.queueDirection === directionToEntrance
    })
    if (fronts.length === 0) return []
    const queueCells: Cell[] = []
    const visited = new Set<string>()
    const pending = [...fronts]
    while (pending.length > 0) {
      const current = pending.shift()
      if (!current) continue
      const key = this.cellKey(current.x, current.z, current.elevation)
      if (visited.has(key)) continue
      visited.add(key)
      queueCells.push(current)
      const currentPath = this.getPathAt(current.x, current.z, current.elevation)
      if (!currentPath) continue
      this.getAdjacentQueuePaths(currentPath).forEach((candidate) => {
        const directionToCurrent = this.getDirectionIndex(
          currentPath.x - candidate.x,
          currentPath.z - candidate.z,
        )
        if (candidate.queueDirection !== directionToCurrent) return
        pending.push({
          x: candidate.x,
          z: candidate.z,
          elevation: candidate.elevation,
        })
      })
    }
    return queueCells
  }

  private getBuildingQueueCells(building: PlacedBuilding): Cell[] {
    if (building.kind === 'ride') return this.getAccessQueueCells(building.rideEntrance)
    if (!isQueuedFacilityKind(building.kind)) return []
    const front = this.findBuildingQueueFront(building)
    if (!front) return []
    const queueCells: Cell[] = []
    const visited = new Set<string>()
    const pending: PlacedBuilding[] = [front]
    while (pending.length > 0) {
      const current = pending.shift()
      if (!current || visited.has(current.id)) continue
      visited.add(current.id)
      queueCells.push({
        x: current.x,
        z: current.z,
        elevation: current.elevation,
      })
      this.getAdjacentQueuePaths(current).forEach((candidate) => {
        const directionToCurrent = this.getDirectionIndex(
          current.x - candidate.x,
          current.z - candidate.z,
        )
        if (
          candidate.queueDirection === directionToCurrent &&
          !visited.has(candidate.id)
        ) {
          pending.push(candidate)
        }
      })
    }
    return queueCells
  }

  private getFacilityQueue(buildingId: string): string[] {
    let queue = this.facilityQueues.get(buildingId)
    if (!queue) {
      queue = this.state.visitors
        .filter(
          (visitor) =>
            visitor.targetId === buildingId &&
            (visitor.state === 'seeking' || visitor.state === 'queuing'),
        )
        .map((visitor) => visitor.id)
      this.facilityQueues.set(buildingId, queue)
    }
    this.prioritizeArrivedQueueVisitors(queue)
    return queue
  }

  /**
   * Destination reservations still count toward capacity, but must not hold a
   * physical place ahead of guests who have already reached the queue. This is
   * a stable O(n) partition because queue maintenance runs every simulation tick.
   */
  private prioritizeArrivedQueueVisitors(queue: string[]): void {
    const arrived: string[] = []
    const pending: string[] = []
    let pendingSeen = false
    let needsReorder = false
    queue.forEach((visitorId) => {
      if (this.getVisitor(visitorId)?.state === 'queuing') {
        arrived.push(visitorId)
        needsReorder ||= pendingSeen
      } else {
        pending.push(visitorId)
        pendingSeen = true
      }
    })
    if (needsReorder) queue.splice(0, queue.length, ...arrived, ...pending)
  }

  private updateFacilityQueues(minutes: number): void {
    const facilityIds = new Set(
      this.state.buildings
        .filter((building) =>
          isQueuedFacilityKind(building.kind),
        )
        .map((building) => building.id),
    )
    this.facilityQueues.forEach((queue, buildingId) => {
      if (facilityIds.has(buildingId)) return
      for (const visitorId of [...queue]) {
        const visitor = this.getVisitor(visitorId)
        if (!visitor || visitor.targetId !== buildingId) continue
        this.leaveQueueOnFoot(visitor, 'Dieses Angebot ist nicht mehr da.')
      }
      this.facilityQueues.delete(buildingId)
    })
    const usingCounts = new Map<string, number>()
    this.state.visitors.forEach((visitor) => {
      if (visitor.state !== 'using' || !visitor.targetId) return
      usingCounts.set(
        visitor.targetId,
        (usingCounts.get(visitor.targetId) ?? 0) + 1,
      )
    })
    this.state.buildings
      .filter((building) =>
        isQueuedFacilityKind(building.kind),
      )
      .forEach((building) => {
        const existingQueue = this.facilityQueues.get(building.id)
        if (!this.isBuildingCurrentlyActive(building)) {
          existingQueue?.forEach((visitorId) => {
            const visitor = this.getVisitor(visitorId)
            if (!visitor || visitor.targetId !== building.id) return
            this.leaveQueueOnFoot(visitor, 'Dieses Angebot hat inzwischen geschlossen.')
          })
          this.facilityQueues.delete(building.id)
          return
        }
        const queueCells = this.getBuildingQueueCells(building)
        if (queueCells.length === 0) {
          if (building.rideType === 'bungee') {
            const queue = this.getFacilityQueue(building.id)
            while (queue.length && (usingCounts.get(building.id) ?? 0) < 1) {
              const visitor = this.getVisitor(queue.shift()!)
              if (visitor?.state !== 'queuing' || visitor.targetId !== building.id) continue
              this.startFacilityInteraction(visitor, building)
              usingCounts.set(building.id, 1)
            }
            return
          }
          existingQueue?.forEach((visitorId) => {
            const visitor = this.getVisitor(visitorId)
            if (visitor?.state === 'queuing' && visitor.targetId === building.id) {
              this.startFacilityInteraction(visitor, building)
            }
          })
          this.facilityQueues.delete(building.id)
          return
        }
        const queue = this.getFacilityQueue(building.id)
        const valid = queue.filter((visitorId) => {
          const visitor = this.getVisitor(visitorId)
          return (
            visitor?.targetId === building.id &&
            (visitor.state === 'seeking' || visitor.state === 'queuing')
          )
        })
        queue.splice(0, queue.length, ...valid)
        this.prioritizeArrivedQueueVisitors(queue)
        const supply = shopSupplyKind(building.kind)
        if (supply && supply !== 'water' && localStock(this.state, building.id, supply) < 1) {
          const wait = SIMULATION_CONFIG.needs.interactionMinutes.stockout
          const waitingThought = stockoutThought(building.kind, true)
          for (const visitorId of [...queue]) {
            const visitor = this.getVisitor(visitorId)
            if (visitor?.state !== 'queuing' || visitor.targetId !== building.id) continue
            visitor.interactionRemaining = Math.min(0, visitor.interactionRemaining) - minutes
            if (visitor.interactionRemaining <= -wait) {
              this.state.festival.metrics.stockouts++
              visitor.emotion = 'sad'
              visitor.emotionMinutes = 45
              this.leaveQueueOnFoot(visitor, 'Ausverkauft! Hier fehlt Nachschub.')
              continue
            }
            visitor.thought = waitingThought
          }
          return
        }
        for (const id of queue) {
          const visitor = this.getVisitor(id)
          if (visitor?.state === 'queuing') visitor.interactionRemaining = 0
        }
        const splitStallQueue = isStallQueueKind(building.kind)
        this.positionFacilityQueue(queue, queueCells, minutes, splitStallQueue)

        let free =
          (building.rideType === 'bungee' ? 1 : BUILDINGS[building.kind].capacity) -
          (usingCounts.get(building.id) ?? 0)
        while (free > 0 && queue.length > 0) {
          const visitor = this.getVisitor(queue[0]!)
          const front = queueCells[0]
          const frontPath = front
            ? this.getPathAt(front.x, front.z, front.elevation)
            : undefined
          const frontDirection = QUEUE_CARDINALS[frontPath?.queueDirection ?? 0] ?? QUEUE_CARDINALS[0]!
          const frontStand = this.queueStandOffset(0, frontDirection, true, splitStallQueue)
          if (
            !visitor ||
            visitor.state !== 'queuing' ||
            !front ||
            visitor.cellX !== front.x ||
            visitor.cellZ !== front.z ||
            Math.hypot(
              visitor.x - (front.x + 0.5 + frontStand.x),
              visitor.z - (front.z + 0.5 + frontStand.z),
            ) > 0.58
          ) {
            break
          }
          queue.shift()
          this.startFacilityInteraction(visitor, building)
          free--
        }
      })
  }

  private queueStandOffset(
    index: number,
    direction: { x: number; z: number },
    packed: boolean,
    split = false,
  ): { x: number; z: number } {
    return computeQueueStandOffset(index, direction, packed, split)
  }

  private positionFacilityQueue(
    queue: readonly string[],
    queueCells: readonly Cell[],
    minutes: number,
    split = false,
  ): void {
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    queue.forEach((visitorId, index) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor || visitor.state !== 'queuing') return
      const desiredCellIndex = Math.min(
        queueCells.length - 1,
        Math.floor(index / SIMULATION_CONFIG.coasters.queueSlotsPerCell),
      )
      const currentCellIndex = queueCells.findIndex(
        (cell) =>
          cell.x === visitor.cellX &&
          cell.z === visitor.cellZ &&
          cell.elevation === visitor.cellElevation,
      )
      const targetCellIndex =
        currentCellIndex > desiredCellIndex ? currentCellIndex - 1 : desiredCellIndex
      const cell = queueCells[targetCellIndex]
      if (!cell) return
      const path = this.getPathAt(cell.x, cell.z, cell.elevation)
      const direction = directions[path?.queueDirection ?? 0] ?? directions[0]!
      const stand = this.queueStandOffset(
        index,
        direction,
        targetCellIndex === desiredCellIndex,
        split,
      )
      const targetX = cell.x + 0.5 + stand.x
      const targetZ = cell.z + 0.5 + stand.z
      visitor.tileOffsetX = 0.5 + stand.x
      visitor.tileOffsetZ = 0.5 + stand.z
      const deltaX = targetX - visitor.x
      const deltaZ = targetZ - visitor.z
      const distance = Math.hypot(deltaX, deltaZ)
      const movement = minutes * SIMULATION_CONFIG.coasters.queueMovementPerMinute
      visitor.facing = Math.atan2(deltaX || direction.x, deltaZ || direction.z)
      if (distance <= movement || distance < 0.001) {
        visitor.x = targetX
        visitor.z = targetZ
        visitor.y = this.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          path,
          cell.elevation,
        )
        visitor.cellX = cell.x
        visitor.cellZ = cell.z
        visitor.cellElevation = cell.elevation
      } else {
        visitor.x += (deltaX / distance) * movement
        visitor.z += (deltaZ / distance) * movement
        visitor.y = this.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          path,
          cell.elevation,
        )
      }
    })
  }

  private startFacilityInteraction(
    visitor: Visitor,
    target: PlacedBuilding,
  ): void {
    if (isShopServiceKind(target.kind) && !this.isVisitorAtShopCounter(visitor, target)) {
      this.leaveQueueOnFoot(visitor, 'Ich gehe zur Vorderseite des Ladens.')
      return
    }
    if (target.kind === 'ride' && this.getRideAccessIssue(target)) {
      visitor.state = 'exploring'; visitor.targetId = null; visitor.route = []
      this.queueVisitorDecision(visitor); return
    }
    const supply = shopSupplyKind(target.kind)
    if (supply && supply !== 'water' && localStock(this.state, target.id, supply) < 1) {
      visitor.state = 'using'
      visitor.interactionRemaining = SIMULATION_CONFIG.needs.interactionMinutes.stockout
      visitor.thought = stockoutThought(target.kind, false)
      return
    }
    if (target.rideType === 'bungee') {
      const active = target.bungeeVisitorId ? this.getVisitor(target.bungeeVisitorId) : undefined
      if (active?.state === 'using' && active.targetId === target.id && active.id !== visitor.id) {
        const queue = this.facilityQueues.get(target.id) ?? []
        if (!queue.includes(visitor.id)) queue.push(visitor.id)
        this.facilityQueues.set(target.id, queue)
        visitor.state = 'queuing'; visitor.thought = 'Ich warte auf meinen Bungeesprung.'
        return
      }
      target.bungeeVisitorId = visitor.id
      visitor.bungeeNude = rollsBungeeNude(
        visitor.id,
        this.rng.next(),
        SIMULATION_CONFIG.atmosphere.bungeeNudeChance,
      )
    }
    visitor.state = 'using'
    const interaction = SIMULATION_CONFIG.needs.interactionMinutes
    visitor.interactionRemaining =
      target.kind === 'ride'
        ? interaction.ride
        : target.kind === 'alcohol'
          ? interaction.alcohol
          : target.kind === 'toilet'
            ? interaction.toilet
            : target.kind === 'mascot'
              ? interaction.mascot
              : target.kind === 'shirt'
                ? interaction.shirt
                : interaction.food
    visitor.thought = target.rideType === 'bungee' ? 'Jetzt geht es hoch zum Bungeesprung!' : `Ich besuche ${BUILDINGS[target.kind].name}.`
  }

  private recallCoasterTrainInternal(coaster: Coaster): void {
    this.coasterSimulation.recall(coaster)
  }

  private groundWetBucket = -1

  private findPath(
    start: Cell,
    goals: Cell[],
    allowQueue = false,
    allowCamping = false,
    allowMedical = false,
    ignoreDirectionalRestrictions = false,
    allowFestival = false,
    maxVisited?: number,
    allowStaff = false,
    allowBackstage = false,
  ): Cell[] | null {
    const revalidate = this.lastNavRevision !== this.worldRevision
    const result = this.pedestrianNavigation.findPath(start, goals, {
      revalidate,
      allowQueue,
      allowCamping,
      allowMedical,
      ignoreDirectionalRestrictions,
      allowFestival,
      maxVisited,
      allowStaff,
      allowBackstage,
    })
    if (revalidate) this.lastNavRevision = this.worldRevision
    return result
  }

  /**
   * What an hour of simply existing costs the park: the upkeep of everything standing
   * on it, the wages of everyone employed, the generator when it runs. The economy
   * tick charges this, and the forecast column multiplies it out to a day, so both
   * read from the same calculation.
   */

  /** Compatibility facade for deterministic visitor-decision tests. */
  decideNextAction(visitor: Visitor): void {
    this.visitorBehavior.decideNextAction(visitor)
  }

  /** Compatibility facade for detailed visitor-action tests. */
  chooseNextVisitorAction(visitor: Visitor): void {
    this.visitorBehavior.chooseNextVisitorAction(visitor)
  }

  /** Compatibility facade for interaction regression tests. */
  finishInteraction(visitor: Visitor): void {
    this.visitorBehavior.finishInteraction(visitor)
  }

  /** Compatibility facade for need-decay regression tests. */
  decayNeeds(visitor: Visitor, minutes: number): void {
    this.visitorBehavior.decayNeeds(visitor, minutes)
  }

  updateVisitors(minutes: number): void {
    this.visitorBehavior.updateVisitors(minutes)
  }

  walkVisitors(minutes: number): void {
    this.visitorBehavior.walkVisitors(minutes)
  }

  moveVisitor(visitor: Visitor, distance: number, decideOnArrival = true): void {
    this.visitorBehavior.moveVisitor(visitor, distance, decideOnArrival)
  }

  arriveOrDecide(visitor: Visitor): void {
    this.visitorBehavior.arriveOrDecide(visitor)
  }

  giveWaste(visitor: Visitor, amount: number): void {
    this.visitorBehavior.giveWaste(visitor, amount)
  }

  findReachableFacility(
    visitor: Visitor,
    kind: BuildingKind,
  ): { building: PlacedBuilding; route: Cell[] } | null {
    return this.visitorBehavior.findReachableFacility(visitor, kind)
  }

  visitorTravelSpeed(visitor: Visitor): number {
    return this.visitorBehavior.visitorTravelSpeed(visitor)
  }

  get movementOccupancy(): Map<number, number> {
    return this.visitorBehavior.movementOccupancy
  }

  reviewVisitorRoutes(): void {
    this.visitorBehavior.reviewVisitorRoutes()
  }

  tryVisitConcert(visitor: Visitor): boolean {
    return this.visitorBehavior.tryVisitConcert(visitor)
  }

  avoidsConcertAt(visitor: Visitor, cell: { x: number; z: number }): boolean {
    return this.visitorBehavior.avoidsConcertAt(visitor, cell)
  }

  updateConcertTopless(
    visitor: Visitor,
    minutes: number,
    concert: { booking: Booking },
  ): void {
    this.visitorBehavior.updateConcertTopless(visitor, minutes, concert)
  }

  private hourlyRunningCosts(): { upkeep: number; staff: number } {
    const upkeep = this.state.buildings.reduce(
      (total, item) => total + BUILDINGS[item.kind].upkeep + (item.stageDesign ? stageStats(item.stageDesign).upkeep : 0),
      0,
    )
    const staff = this.state.staff.reduce(
      (total, member) => total + STAFF_DEFINITIONS[member.role].hourlyWage,
      0,
    )
    return {
      upkeep: upkeep + (this.state.power.backupActive ? SIMULATION_CONFIG.power.backupFuelPerHour : 0),
      // Carriers are paid by the minute while they walk, not by the hour like the rest.
      staff: staff + this.state.festival.infrastructure.routes.length * CARRIER_WAGE_PER_MINUTE * 60,
    }
  }

  private runEconomy(hours: number): void {
    const running = this.hourlyRunningCosts()
    const carriers = this.state.festival.infrastructure.routes.length * CARRIER_WAGE_PER_MINUTE * 60
    bookFinance(this.state, 'upkeep', -running.upkeep * hours)
    // The carriers' own wages are already booked minute by minute as they walk.
    bookFinance(this.state, 'staff', -(running.staff - carriers) * hours)
    bookFinance(this.state, 'interest', -loanInterest(this.state.finance.loan, hours / 24))
    this.recalculatePark()
  }

  /** The forecast column of the finance window: tomorrow's running costs exactly, everything the visitors decide carried over from the last full day. */
  financeForecast(): FinanceEntries {
    const running = this.hourlyRunningCosts()
    return financeForecast(this.state.finance, {
      upkeep: -running.upkeep * 24,
      staff: -running.staff * 24,
      interest: -loanInterest(this.state.finance.loan, 1),
    })
  }

  private recalculatePark(): void {
    if (this.state.visitors.length === 0) {
      this.state.reputation = Math.min(
        100,
        SIMULATION_CONFIG.economy.emptyParkBaseReputation +
          this.getTotalAppeal(),
      )
      return
    }
    const averageSatisfaction =
      this.state.visitors.reduce((total, visitor) => {
        const needs = Object.values(visitor.needs)
        return total + needs.reduce((sum, need) => sum + need, 0) / needs.length
      }, 0) / this.state.visitors.length
    this.state.reputation = Math.round(Math.min(100, averageSatisfaction))
  }

  private getTotalAppeal(): number {
    const buildingAppeal = this.state.buildings.reduce(
      (total, building) => total + BUILDINGS[building.kind].appeal,
      0,
    )
    return (
      buildingAppeal +
      this.state.coasters.length * SIMULATION_CONFIG.economy.coasterAppeal
    )
  }

  private getPedestrianNeighbors(
    cell: Cell,
    options: PedestrianNeighborOptions = {},
  ): Cell[] {
    return this.pedestrianNavigation.neighbors(cell, options)
  }

  private ensurePedestrianNav(revalidate: boolean): void {
    this.pedestrianNavigation.ensure(revalidate)
    if (revalidate) this.lastNavRevision = this.worldRevision
  }

  rebuildPedestrianNav(): void {
    this.pedestrianNavigation.rebuildNow()
    this.lastNavRevision = this.worldRevision
  }

  private isPedestrianSolidAt(x: number, z: number, elevation: number): boolean {
    if (this.getRideAccessAt(x,z,elevation)) return true
    if (this.state.festival.infrastructure.depots.some(d => d.x === x && d.z === z) && elevation < this.getTerrainHeight(x, z) + 1) return true
    for (const building of this.getBuildingsAtCell(x, z)) {
      const catalogSolid =
        isPedestrianSolidKind(building.kind) &&
        (building.decorationSlot === undefined || building.decorationSlot === 4)
      if (
        (catalogSolid || pedestrianBarrierOccupancy(building) === 'solid') &&
        !isStageAudienceCell(building,x,z) &&
        this.volumesOverlap(building, elevation, 0.28)
      ) {
        return true
      }
    }
    return (
      this.state.coasters.length > 0 &&
      this.coasterOccupiesVolume(x, z, elevation, 0.28)
    )
  }

  private isPedestrianEdgeBlocked(from: Cell, to: Cell): boolean {
    const direction = this.getDirectionIndex(to.x - from.x, to.z - from.z) as Direction
    if (this.closedPathEdges.has(accessEdgeKey(from.x, from.z, direction))) {
      return true
    }
    const opposite = oppositeDirection(direction)
    const fromRoad = this.getRoadCellAt(from.x, from.z)
    const toRoad = this.getRoadCellAt(to.x, to.z)
    if (
      fromRoad &&
      this.isAtTerrainLevel(from.x, from.z, from.elevation) &&
      (fromRoad.blockedEdges & directionBit(direction)) !== 0
    ) {
      return true
    }
    if (
      toRoad &&
      this.isAtTerrainLevel(to.x, to.z, to.elevation) &&
      (toRoad.blockedEdges & directionBit(opposite)) !== 0
    ) {
      return true
    }
    return (
      this.hasFenceToward(from.x, from.z, from.elevation, direction) ||
      this.hasFenceToward(to.x, to.z, to.elevation, opposite)
    )
  }

  private hasFenceToward(
    x: number,
    z: number,
    elevation: number,
    direction: Direction,
  ): boolean {
    for (const building of this.getBuildingsAtCell(x, z)) {
      if (
        pedestrianBarrierOccupancy(building) === direction &&
        Math.abs(building.elevation - elevation) < WAY_LEVEL_MATCH
      ) {
        return true
      }
    }
    return false
  }

  private getPedestrianSurfaceCost(cell: Cell): number {
    const speed = cell.elevation > this.getTerrainHeight(cell.x, cell.z) ? 1 : wayInfo(this.state, cell.x, cell.z, 'foot', this.getPathAt(cell.x, cell.z, cell.elevation)?.wayType).speed
    return this.getBasePedestrianSurfaceCost(cell) / Math.min(1, speed)
  }

  private getBasePedestrianSurfaceCost(cell: Cell): number {
    const path = this.getPathAt(cell.x, cell.z, cell.elevation)
    const height = this.getTerrainHeight(cell.x, cell.z)
    if (isWaterHeight(height, this.getWaterLevel()) && !path) {
      return SIMULATION_CONFIG.terrain.swimPathCostMultiplier
    }
    const mud = isMudHeight(height)
    const road = this.getRoadCellAt(cell.x, cell.z)
    if (path && road) {
      return mud ? SIMULATION_CONFIG.terrain.mudPavedCostMultiplier : 1
    }
    if (road) {
      const roadCost = road.crosswalk
        ? SIMULATION_CONFIG.logistics.crosswalkRoadCostMultiplier
        : SIMULATION_CONFIG.logistics.pedestrianRoadCostMultiplier
      return mud
        ? roadCost * SIMULATION_CONFIG.terrain.mudPavedCostMultiplier
        : roadCost
    }
    if (path) {
      return mud ? SIMULATION_CONFIG.terrain.mudPavedCostMultiplier : 1
    }
    if (this.getStageForecourtCellAt(cell.x, cell.z)) {
      return mud ? SIMULATION_CONFIG.terrain.mudPavedCostMultiplier : 1
    }
    if (this.activeBackstagePacked.has(this.packXZ(cell.x, cell.z))) {
      return mud ? SIMULATION_CONFIG.terrain.mudPavedCostMultiplier : 1
    }
    if (this.hasParkingAt(cell.x, cell.z)) {
      return mud
        ? SIMULATION_CONFIG.terrain.mudPathCostMultiplier
        : SIMULATION_CONFIG.pathfinding.parkingCostMultiplier
    }
    return mud
      ? SIMULATION_CONFIG.terrain.mudPathCostMultiplier
      : SIMULATION_CONFIG.pathfinding.grassCostMultiplier
  }

  private canTraversePath(
    from: PlacedBuilding | undefined,
    to: PlacedBuilding,
    fromX: number,
    fromZ: number,
    allowQueue: boolean,
    ignoreDirectionalRestrictions = false,
    fromElevation = from?.elevation ?? to.elevation,
  ): boolean {
    const fromIsQueue = from?.pathType === 'queue'
    const toIsQueue = to.pathType === 'queue'
    if (!allowQueue && toIsQueue && !fromIsQueue) return false
    const direction = this.getDirectionIndex(to.x - fromX, to.z - fromZ)
    if (fromIsQueue && from && toIsQueue) {
      if (!this.isQueueChainStep(from, to, direction)) return false
      if (!allowQueue && from.queueDirection === direction) return false
    } else if (fromIsQueue && from && !toIsQueue) {
      if (from.queueEntryDirection !== (direction + 2) % 4) return false
    } else if (!fromIsQueue && toIsQueue && !ignoreDirectionalRestrictions) {
      if (to.queueEntryDirection !== direction) return false
    }
    if (!ignoreDirectionalRestrictions && !allowsPathFlow(from, to, direction)) return false
    const fromGate = this.getSecurityGateAt(fromX, fromZ, from?.elevation)
    const toGate = this.getSecurityGateAt(to.x, to.z, to.elevation)
    if (
      !ignoreDirectionalRestrictions &&
      ((fromGate && fromGate.rotation !== direction) ||
        (toGate && toGate.rotation !== direction))
    ) {
      return false
    }
    const ramped = canTraverseWayElevation(
      from?.elevation ?? fromElevation,
      from?.pathSlope ?? 0,
      from?.pathSlopeDirection,
      to.elevation,
      to.pathSlope ?? 0,
      to.pathSlopeDirection,
      direction,
    )
    if (ramped) return true
    // Ground may step onto a way across a land slope (≤ 0.5). Path-to-path
    // still needs a real ramp so people cannot skip the way polyline.
    return !from && canStepPedestrianHeight(fromElevation, to.elevation)
  }

  private isQueueChainStep(
    from: PlacedBuilding,
    to: PlacedBuilding,
    direction: number,
  ): boolean {
    if (from.queueDirection === direction) return true
    return (
      to.queueDirection ===
      this.getDirectionIndex(from.x - to.x, from.z - to.z)
    )
  }

  private queueBuildOrder(path: PlacedBuilding): number {
    const match = path.id.match(/(\d+)$/)
    return match ? Number(match[1]) : 0
  }

  private recalculateQueueDirections(): void {
    const queuePaths = this.state.buildings.filter(
      (building) => building.kind === 'path' && building.pathType === 'queue',
    )
    queuePaths.forEach((path) => {
      path.queueDirection = undefined
      path.queueEntryDirection = undefined
      path.queueSplit = false
    })
    const claimed = new Set<string>()

    const claimQueue = (
      seeds: Array<{ path: PlacedBuilding; target: { x: number; z: number } }>,
      split = false,
    ): void => {
      const orderedSeeds = [...seeds].sort(
        (left, right) => this.queueBuildOrder(left.path) - this.queueBuildOrder(right.path),
      )
      for (const seed of orderedSeeds) {
        if (claimed.has(seed.path.id)) continue
        let current = seed.path
        let target = seed.target
        while (current && !claimed.has(current.id)) {
          current.queueDirection = this.getDirectionIndex(
            target.x - current.x,
            target.z - current.z,
          )
          current.queueSplit = split
          claimed.add(current.id)
          const neighbors = this.getAdjacentQueuePaths(current).filter(
            (neighbor) => !claimed.has(neighbor.id),
          )
          if (neighbors.length === 0) break
          const currentOrder = this.queueBuildOrder(current)
          neighbors.sort((left, right) => {
            const leftDelta = Math.abs(this.queueBuildOrder(left) - currentOrder)
            const rightDelta = Math.abs(this.queueBuildOrder(right) - currentOrder)
            return leftDelta - rightDelta || this.queueBuildOrder(left) - this.queueBuildOrder(right)
          })
          const next = neighbors[0]!
          target = { x: current.x, z: current.z }
          current = next
        }
      }
    }

    this.state.coasters.forEach((coaster) => {
      if (!coaster.entrance) return
      claimQueue(
        this.getAccessPathNeighbors(coaster.entrance)
          .map((cell) => this.getPathAt(cell.x, cell.z, cell.elevation))
          .filter(
            (path): path is PlacedBuilding =>
              Boolean(path && path.pathType === 'queue' && !claimed.has(path.id)),
          )
          .map((path) => ({
            path,
            target: { x: coaster.entrance!.x, z: coaster.entrance!.z },
          })),
      )
    })

    this.state.buildings
      .filter((building) =>
        isQueuedFacilityKind(building.kind),
      )
      .forEach((building) => {
        if (building.kind === 'ride') {
          if (building.rideEntrance) claimQueue(this.getAccessPathNeighbors(building.rideEntrance)
            .map(c=>this.getPathAt(c.x,c.z,c.elevation))
            .filter((p): p is PlacedBuilding=>Boolean(p && p.pathType==='queue' && !claimed.has(p.id)))
            .map(path=>({path,target:building.rideEntrance!})))
          return
        }
        const seeds = this.getFacilityAccessCells(building)
          .map((access) => this.getPathAt(access.x, access.z, access.elevation))
          .filter(
            (path): path is PlacedBuilding =>
              Boolean(path && path.pathType === 'queue' && !claimed.has(path.id)),
          )
          .map((path) => ({ path, target: { x: building.x, z: building.z } }))
        claimQueue(seeds, isStallQueueKind(building.kind))
      })

    this.state.stageForecourtCells.forEach((cell) => {
      const seeds = queuePaths
        .filter(
          (path): path is PlacedBuilding =>
            !claimed.has(path.id) &&
            Math.abs(path.x - cell.x) + Math.abs(path.z - cell.z) === 1 &&
            Math.abs(path.elevation - cell.elevation) < 0.01,
        )
        .map((path) => ({ path, target: { x: cell.x, z: cell.z } }))
      claimQueue(seeds)
    })

    queuePaths.forEach((path) => {
      if (!claimed.has(path.id) || path.queueDirection === undefined) return
      const hasIncomingQueue = this.getAdjacentQueuePaths(path).some((candidate) => {
        const directionToPath = this.getDirectionIndex(
          path.x - candidate.x,
          path.z - candidate.z,
        )
        return candidate.queueDirection === directionToPath
      })
      if (hasIncomingQueue) return

      const normalNeighbors = this.state.buildings
        .filter(
          (candidate) =>
            candidate.kind === 'path' &&
            candidate.pathType !== 'queue' &&
            Math.abs(candidate.x - path.x) + Math.abs(candidate.z - path.z) === 1 &&
            this.pathsShareEdge(candidate, path),
        )
        .map((candidate) => ({
          candidate,
          entryDirection: this.getDirectionIndex(
            path.x - candidate.x,
            path.z - candidate.z,
          ),
          queueToPathDirection: this.getDirectionIndex(
            candidate.x - path.x,
            candidate.z - path.z,
          ),
        }))
        .filter((entry) => entry.queueToPathDirection !== path.queueDirection)
        .sort((left, right) => {
          const preferred = (path.queueDirection! + 2) % 4
          return (
            Number(right.queueToPathDirection === preferred) -
            Number(left.queueToPathDirection === preferred)
          )
        })
      path.queueEntryDirection = normalNeighbors[0]?.entryDirection
    })
  }

  private getAdjacentQueuePaths(path: PlacedBuilding): PlacedBuilding[] {
    return this.state.buildings.filter(
      (candidate) =>
        candidate.kind === 'path' &&
        candidate.pathType === 'queue' &&
        Math.abs(candidate.x - path.x) + Math.abs(candidate.z - path.z) === 1 &&
        this.pathsShareEdge(path, candidate),
    )
  }

  private pathsShareEdge(from: PlacedBuilding, to: PlacedBuilding): boolean {
    const direction = this.getDirectionIndex(to.x - from.x, to.z - from.z)
    return canTraverseWayElevation(
      from.elevation,
      from.pathSlope ?? 0,
      from.pathSlopeDirection,
      to.elevation,
      to.pathSlope ?? 0,
      to.pathSlopeDirection,
      direction,
    )
  }

  private getDirectionIndex(deltaX: number, deltaZ: number): number {
    if (deltaZ > 0) return 0
    if (deltaX > 0) return 1
    if (deltaZ < 0) return 2
    return 3
  }

  private getAccessPathNeighbors(access: { x: number; y: number; z: number }): Cell[] {
    const positions = [
      { x: access.x - 1, z: access.z },
      { x: access.x + 1, z: access.z },
      { x: access.x, z: access.z - 1 },
      { x: access.x, z: access.z + 1 },
    ]
    return positions.map(p=>this.getPathAt(p.x,p.z,access.y))
      .filter((building): building is PlacedBuilding => Boolean(building && !building.staffOnly))
      .map((building) => ({
        x: building.x,
        z: building.z,
        elevation: building.elevation,
      }))
  }

  private relocateVisitorsFromPath(path: PlacedBuilding): void {
    const nearestPath = this.state.buildings
      .filter(
        (building) =>
          building.kind === 'path' &&
          building.id !== path.id &&
          building.pathType !== 'queue',
      )
      .sort(
        (left, right) =>
          Math.hypot(
            left.x - path.x,
            left.z - path.z,
            left.elevation - path.elevation,
          ) -
          Math.hypot(
            right.x - path.x,
            right.z - path.z,
            right.elevation - path.elevation,
          ),
      )[0]
    const fallback: Cell = nearestPath
      ? { x: nearestPath.x, z: nearestPath.z, elevation: nearestPath.elevation }
      : this.getEntrance()
    this.state.visitors.forEach((visitor) => {
      if (
        visitor.cellX !== path.x ||
        visitor.cellZ !== path.z ||
        visitor.cellElevation !== path.elevation
      ) {
        return
      }
      if (visitor.state === 'riding') return
      this.state.coasters.forEach((coaster) => {
        coaster.queue = coaster.queue.filter((visitorId) => visitorId !== visitor.id)
      })
      visitor.route = [fallback]
      visitor.targetId = null
      visitor.state = 'exiting'
      visitor.movementBoostMinutes =
        SIMULATION_CONFIG.visitors.movement.evacuationBoostMinutes
      visitor.thought = 'Der Weg ist weg – ich suche schnell sicheren Boden!'
    })
  }

  private removeVisitorFromCoasterQueues(visitorId: string): void {
    this.state.coasters.forEach((coaster) => {
      coaster.queue = coaster.queue.filter((queuedId) => queuedId !== visitorId)
    })
    this.facilityQueues.forEach((queue) => {
      const index = queue.indexOf(visitorId)
      if (index >= 0) queue.splice(index, 1)
    })
  }

  private buildQueueExitRoute(from: Cell, queueCells: readonly Cell[]): Cell[] {
    if (queueCells.length === 0) return []
    const index = queueCells.findIndex(
      (cell) =>
        cell.x === from.x &&
        cell.z === from.z &&
        Math.abs(cell.elevation - from.elevation) < 0.01,
    )
    const route: Cell[] = []
    for (let i = index >= 0 ? index + 1 : 0; i < queueCells.length; i += 1) {
      const cell = queueCells[i]!
      route.push({ x: cell.x, z: cell.z, elevation: cell.elevation })
    }
    const tail = queueCells[queueCells.length - 1]
    if (!tail) return route
    const tailPath = this.getPathAt(tail.x, tail.z, tail.elevation)
    if (tailPath?.queueEntryDirection === undefined) return route
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const entry = directions[tailPath.queueEntryDirection]
    if (!entry) return route
    const exit = {
      x: tail.x - entry.x,
      z: tail.z - entry.z,
      elevation: tail.elevation,
    }
    const exitPath = this.getPathAt(exit.x, exit.z, exit.elevation)
    if (!exitPath || exitPath.pathType === 'queue') return route
    if (
      !route.some(
        (cell) =>
          cell.x === exit.x &&
          cell.z === exit.z &&
          Math.abs(cell.elevation - exit.elevation) < 0.01,
      )
    ) {
      route.push(exit)
    }
    return route
  }

  private leaveQueueOnFoot(visitor: Visitor, thought: string): void {
    const target = visitor.targetId
      ? this.state.buildings.find((building) => building.id === visitor.targetId)
      : undefined
    const coaster = visitor.targetId ? this.getCoaster(visitor.targetId) : undefined
    const cells = target
      ? this.getBuildingQueueCells(target)
      : coaster
        ? this.getCoasterQueueCells(coaster)
        : []
    const route = this.buildQueueExitRoute(
      { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
      cells,
    )
    this.removeVisitorFromCoasterQueues(visitor.id)
    visitor.targetId = null
    visitor.state = 'exploring'
    visitor.thought = thought
    visitor.route = route
    if (route.length === 0) this.queueVisitorDecision(visitor)
    else if (target && isStallQueueKind(target.kind)) this.beginStallQueueReturn(visitor, route[0])
    else this.applyQueueLaneOffset(visitor, route[0])
  }

  private getAccessCell(
    x: number,
    z: number,
    elevation: number,
    rotation: number,
  ): Cell {
    const direction = CARDINAL_OFFSETS[rotation % CARDINAL_OFFSETS.length] ?? CARDINAL_OFFSETS[0]
    if (!direction) return { x, z: z + 1, elevation }
    return { x: x + direction[0], z: z + direction[1], elevation }
  }

  private getFacilityAccessCells(building: PlacedBuilding): Cell[] {
    const access = this.getAccessCell(
      building.x,
      building.z,
      building.elevation,
      building.rotation,
    )
    return this.isWalkableServiceCell(access) ? [access] : []
  }

  private isVisitorAtShopCounter(visitor: Visitor, building: PlacedBuilding): boolean {
    return this.getFacilityAccessCells(building).some(cell =>
      cell.x === visitor.cellX && cell.z === visitor.cellZ &&
      Math.abs(cell.elevation - visitor.cellElevation) < 0.01)
  }

  private isWalkableServiceCell(cell: Cell): boolean {
    return Boolean(
      this.getPathAt(cell.x, cell.z, cell.elevation) ||
        this.getStageForecourtCellAt(cell.x, cell.z),
    )
  }

  private findBuildingQueueFront(building: PlacedBuilding): PlacedBuilding | undefined {
    const accesses = [
          this.getAccessCell(
            building.x,
            building.z,
            building.elevation,
            building.rotation,
          ),
        ]
    for (const access of accesses) {
      const front = this.getPathAt(access.x, access.z, access.elevation)
      const directionToCounter = front
        ? this.getDirectionIndex(building.x - front.x, building.z - front.z)
        : -1
      if (
        front?.pathType === 'queue' &&
        front.queueDirection === directionToCounter
      ) {
        return front
      }
    }
    return undefined
  }

  private findBenchRotation(x: number, z: number, preferredRotation?: number): number | null {
    return pathFurnitureRotation(this.state, x, z, this.getPlaceElevation(x, z), preferredRotation)
  }

  private isAtEntrance(visitor: Visitor): boolean {
    return this.isAtParkExit(visitor)
  }

  private isAtParkExit(visitor: Visitor): boolean {
    const entrance = this.getEntrance()
    if (visitor.cellX === entrance.x && visitor.cellZ === entrance.z) return true
    const path =
      this.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation) ??
      this.getPathAt(visitor.cellX, visitor.cellZ)
    if (path?.id === ENTRANCE_PATH_ID) return true
    return Boolean(path) && visitor.cellZ === -this.getWorldSize() / 2
  }

  private packXZ(x: number, z: number): number {
    return ((x + 128) & 255) | (((z + 128) & 255) << 8)
  }

  private packCell(cell: { x: number; z: number; elevation: number }): number {
    return this.packXZ(cell.x, cell.z) | ((packWayElevation(cell.elevation) + 16) << 16)
  }

  private occupancyLaneBit(path: PlacedBuilding | undefined, localX: number, localZ: number): number {
    if (!path?.queueSplit) return 0
    return stallQueueLaneFromLocal(path.queueDirection ?? 0, localX, localZ) === 'outbound' ? 1 : 0
  }

  private occupancyKeyForCell(
    cell: { x: number; z: number; elevation: number },
    path: PlacedBuilding | undefined,
    localX: number,
    localZ: number,
  ): number {
    return this.packCell(cell) | (this.occupancyLaneBit(path, localX, localZ) << 24)
  }

  private visitorOccupancyKey(visitor: Visitor): number {
    const cell = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    return this.occupancyKeyForCell(
      cell,
      this.getPathAt(cell.x, cell.z, cell.elevation),
      visitor.x - cell.x,
      visitor.z - cell.z,
    )
  }

  private beginStallQueueReturn(
    visitor: Visitor,
    next: { x: number; z: number; elevation: number } | undefined,
  ): void {
    this.stallQueueReturnIds.add(visitor.id)
    this.applyQueueLaneOffset(visitor, next)
  }

  private continueAfterStallQueueReturn(visitor: Visitor): void {
    this.stallQueueReturnIds.delete(visitor.id)
    if (
      visitor.state === 'leaving' ||
      visitor.isPanicking ||
      visitor.state === 'panicking'
    ) {
      return
    }
    this.visitorSimulation.clearAwaiting(visitor.id)
    this.visitorBehavior.chooseNextVisitorAction(visitor)
  }

  private applyQueueLaneOffset(
    visitor: Visitor,
    next: { x: number; z: number; elevation: number } | undefined,
  ): void {
    if (!next) return
    const to = this.getPathAt(next.x, next.z, next.elevation)
    if (to?.pathType !== 'queue' || !to.queueSplit) return
    const from = this.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)
    const moveDirection = this.getDirectionIndex(next.x - visitor.cellX, next.z - visitor.cellZ)
    const lane = queueTravelLane(from?.queueDirection, to.queueDirection, moveDirection)
    const along = 0.35 + ((visitor.pathSeed >>> 0) % 31) / 100
    const offset = stallQueueTileOffset(to.queueDirection ?? 0, lane, along)
    visitor.tileOffsetX = offset.x
    visitor.tileOffsetZ = offset.z
  }

  private getBuildingsAtCell(x: number, z: number): readonly PlacedBuilding[] {
    this.ensureSpatialIndexes()
    return this.buildingCellIndex.get(this.packXZ(x, z)) ?? []
  }

  private hasParkingAt(x: number, z: number): boolean {
    this.ensureSpatialIndexes()
    return this.parkingIndex.has(this.packXZ(x, z))
  }

  private ensureParkingIndex(): void {
    const cells = this.state.logistics.parkingCells
    if (this.indexedParkingRef === cells && this.indexedParkingCount === cells.length) return
    this.indexedParkingRef = cells
    this.indexedParkingCount = cells.length
    this.parkingIndex.clear()
    for (const cell of cells) {
      const key = this.packXZ(cell.x, cell.z)
      const bucket = this.parkingIndex.get(key)
      if (bucket) bucket.push(cell)
      else this.parkingIndex.set(key, [cell])
    }
  }

  private getAdjacentParkingCells(position: RoadPosition): ParkingCell[] {
    this.ensureParkingIndex()
    return CARDINAL_OFFSETS.flatMap(([dx, dz]) =>
      (this.parkingIndex.get(this.packXZ(position.x + dx, position.z + dz)) ?? [])
        .filter((cell) => cell.x === position.x + dx && cell.z === position.z + dz),
    )
  }

  private ensureSpatialIndexes(): void {
    if (this.indexedBuildingCount !== this.state.buildings.length) {
      this.buildingCellIndex.clear()
      this.rideAccessIndex.clear()
      this.pathExactIndex.clear()
      this.state.buildings.forEach((building) => {
        if (building.kind === 'ride') for (const type of ['entrance','exit'] as const) {
          const point=building[type==='entrance'?'rideEntrance':'rideExit']
          if (point) {
            const key=this.packXZ(point.x,point.z), entries=this.rideAccessIndex.get(key) ?? []
            entries.push({building,type,point}); this.rideAccessIndex.set(key,entries)
          }
        }
        for(const cell of buildingFootprint(building)) {
          const key = this.packXZ(cell.x, cell.z)
          const bucket = this.buildingCellIndex.get(key)
          if (bucket) bucket.push(building)
          else this.buildingCellIndex.set(key, [building])
        }
        if (building.kind === 'path') {
          this.pathExactIndex.set(
            this.packCell({
              x: building.x,
              z: building.z,
              elevation: building.elevation,
            }),
            building,
          )
        }
      })
      this.indexedBuildingCount = this.state.buildings.length
    }
    this.ensureParkingIndex()
    if (this.indexedMedicalRef !== this.state.medicalCells) {
      this.indexedMedicalRef = this.state.medicalCells
      this.medicalIndex.clear()
      this.state.medicalCells.forEach((cell) => {
        this.medicalIndex.set(this.packXZ(cell.x, cell.z), cell)
      })
    }
    if (this.indexedWasteDumpRef !== this.state.wasteDumpCells) {
      this.indexedWasteDumpRef = this.state.wasteDumpCells
      this.wasteDumpIndex.clear()
      this.state.wasteDumpCells.forEach((cell) => {
        this.wasteDumpIndex.set(this.packXZ(cell.x, cell.z), cell)
      })
    }
    if (this.indexedForecourtRef !== this.state.stageForecourtCells) {
      this.indexedForecourtRef = this.state.stageForecourtCells
      this.forecourtIndex.clear()
      this.state.stageForecourtCells.forEach((cell) => {
        this.forecourtIndex.set(this.packXZ(cell.x, cell.z), cell)
      })
    }
    if (this.indexedBackstageRef !== this.state.backstageCells) {
      this.indexedBackstageRef = this.state.backstageCells
      this.backstageIndex.clear()
      this.state.backstageCells.forEach((cell) => {
        this.backstageIndex.set(this.packXZ(cell.x, cell.z), cell)
      })
    }
  }

  private rebuildTerrainCache(): void {
    const size = this.getScenario().worldSize
    this.cachedWorldSize = size
    this.cachedWorldHalf = size / 2
    const heights = new Int8Array(size * size)
    const half = size / 2
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) {
        heights[(z + half) * size + (x + half)] = Math.round(
          readTerrainHeight(this.state.terrain, x, z) * 2,
        )
      }
    }
    this.terrainHeights = heights
  }

  private getPlaceElevation(x: number, z: number): number {
    return this.getTerrainHeight(x, z) + this.state.buildElevation
  }

  private isAtTerrainLevel(x: number, z: number, elevation: number): boolean {
    return Math.abs(elevation - this.getTerrainHeight(x, z)) < WAY_LEVEL_MATCH
  }

  private isTerrainProtected(x: number, z: number): boolean {
    if (this.getRideAccessAt(x,z)) return true
    const entrance = this.getEntrance()
    if (x === entrance.x && z === entrance.z) return true
    if (
      this.state.buildings.some(
        (building) =>
          building.x === x &&
          building.z === z &&
          building.kind !== 'tree',
      )
    ) {
      return true
    }
    return (
      Boolean(this.getRoadCellAt(x, z)) ||
      this.state.logistics.parkingCells.some(
        (cell) => cell.x === x && cell.z === z,
      ) ||
      this.isLogisticsBuildingCell(x, z) ||
      Boolean(this.getCampingCellAt(x, z)) ||
      Boolean(this.getMedicalCellAt(x, z)) ||
      Boolean(this.getWasteDumpAt(x, z)) ||
      Boolean(this.getStageForecourtCellAt(x, z)) ||
      this.coasterOccupiesVolume(x, z, this.getTerrainHeight(x, z), 0.8)
    )
  }

  private getOverlappingTrees(
    x: number,
    z: number,
    elevation: number,
    height = 0.4,
  ): PlacedBuilding[] {
    return this.state.buildings.filter(
      (building) =>
        building.kind === 'tree' &&
        occupiesBuildingCell(building,x,z) &&
        this.volumesOverlap(building, elevation, height),
    )
  }

  private getTreeClearCost(
    x: number,
    z: number,
    elevation = this.getPlaceElevation(x, z),
    height = 0.4,
  ): number {
    return (
      this.getOverlappingTrees(x, z, elevation, height).length *
      SIMULATION_CONFIG.economy.treeClearCost
    )
  }

  private clearTreesAt(
    x: number,
    z: number,
    elevation = this.getPlaceElevation(x, z),
    height = 1.8,
  ): number {
    const trees = this.getOverlappingTrees(x, z, elevation, height)
    if (trees.length === 0) return 0
    const ids = new Set(trees.map((tree) => tree.id))
    this.state.buildings = this.state.buildings.filter(
      (building) => !ids.has(building.id),
    )
    const cost = trees.length * SIMULATION_CONFIG.economy.treeClearCost
    bookFinance(this.state, 'landscaping', -cost)
    return cost
  }

  private isInWorld(x: number, z: number): boolean {
    if (this.cachedWorldSize === 0) this.rebuildTerrainCache()
    const half = this.cachedWorldHalf
    return x >= -half && x < half && z >= -half && z < half
  }

  private packAtmosphereKey(key: string): number | null {
    const first = key.indexOf(',')
    const second = key.indexOf(',', first + 1)
    if (first < 0 || second < 0) return null
    const x = Number(key.slice(0, first))
    const z = Number(key.slice(first + 1, second))
    const elevation = Number(key.slice(second + 1))
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(elevation)) {
      return null
    }
    return this.packCell({ x, z, elevation })
  }

  private cellKey(x: number, z: number, elevation: number): string {
    return `${x},${z},${elevation}`
  }

  private getAtmosphereValue(
    values: Map<string, number>,
    x: number,
    z: number,
    elevation: number,
  ): number {
    const terrain = this.getTerrainHeight(x, z)
    return (
      values.get(this.cellKey(x, z, elevation)) ??
      values.get(this.cellKey(x, z, terrain)) ??
      values.get(this.cellKey(x, z, 0)) ??
      0
    )
  }

  private ensureEntrancePath(): void {
    const planned = createScenarioEntrance(this.getWorldSize())
    const elevation = this.getTerrainHeight(planned.x, planned.z)
    const existing =
      this.state.buildings.find((building) => building.id === ENTRANCE_PATH_ID) ??
      this.getPathAt(planned.x, planned.z, planned.elevation) ??
      this.getPathAt(planned.x, planned.z)
    if (existing) {
      const liftLegacy =
        existing.x === planned.x &&
        existing.z === planned.z &&
        (existing.elevation === 0 || existing.elevation === planned.elevation) &&
        existing.elevation !== elevation
      existing.id = ENTRANCE_PATH_ID
      existing.kind = 'path'
      existing.x = planned.x
      existing.z = planned.z
      if (liftLegacy) existing.elevation = elevation
      existing.pathType = 'normal'
      existing.pathSlope = 0
      if (liftLegacy) this.indexedBuildingCount = -1
      return
    }
    this.state.buildings.unshift({
      id: ENTRANCE_PATH_ID,
      kind: 'path',
      x: planned.x,
      z: planned.z,
      rotation: 0,
      elevation,
      pathType: 'normal',
      pathSlope: 0,
      pathSlopeDirection: 0,
      price: 0,
    })
  }

  private migrateWayElevations(): void {
    for (const building of this.state.buildings) {
      if (building.kind !== 'path') continue
      building.elevation = snapWayElevation(building.elevation)
      building.pathSlope = snapWayElevation(building.pathSlope ?? 0)
    }
    for (const road of this.state.logistics.roadCells) {
      if (road.elevation === undefined) {
        road.elevation = this.getTerrainHeight(road.x, road.z)
      } else {
        road.elevation = snapWayElevation(road.elevation)
      }
      road.roadSlope = snapWayElevation(road.roadSlope ?? 0)
      road.roadSlopeDirection = (((road.roadSlopeDirection ?? 0) % 4) + 4) % 4 as Direction
    }
    this.invalidateRoadGraph()
  }

  private ensureRoadIngress(): void {
    for (let x = -3; x <= 2; x += 1) {
      if (this.getRoadCellAt(x, -this.getWorldSize() / 2)) continue
      this.state.logistics.roadCells.push({
        x,
        z: -this.getWorldSize() / 2,
        allowedDirections: null,
        blockedEdges: 0,
        speedLimit: SIMULATION_CONFIG.logistics.defaultSpeedLimit,
        crosswalk: false,
        elevation: this.getTerrainHeight(x, -this.getWorldSize() / 2),
        roadSlope: 0,
        roadSlopeDirection: 0,
      })
      this.invalidateRoadGraph()
    }
  }

  private migrateLegacyBusStopsToRoadside(): void {
    this.state.logistics.busStops.forEach((stop) => {
      if (!this.getRoadCellAt(stop.x, stop.z)) return
      const sidewalk = [
        { x: stop.x, z: stop.z + 1 },
        { x: stop.x + 1, z: stop.z },
        { x: stop.x, z: stop.z - 1 },
        { x: stop.x - 1, z: stop.z },
      ].find(
        (cell) => {
          const path = this.getPathAt(cell.x, cell.z, 0)
          return (
          path?.pathType === 'normal' &&
          !this.getRoadCellAt(cell.x, cell.z) &&
          !this.state.logistics.busStops.some(
            (other) =>
              other.id !== stop.id &&
              other.x === cell.x &&
              other.z === cell.z,
          )
          )
        },
      )
      if (!sidewalk) return
      stop.roadCell = { x: stop.x, z: stop.z }
      stop.x = sidewalk.x
      stop.z = sidewalk.z
      this.state.visitors
        .filter(
          (visitor) =>
            visitor.state === 'bus-waiting' &&
            visitor.targetId === stop.id,
        )
        .forEach((visitor) => {
          visitor.route =
            this.findPath(
              {
                x: visitor.cellX,
                z: visitor.cellZ,
                elevation: visitor.cellElevation,
              },
              [{ ...sidewalk, elevation: 0 }],
            ) ?? []
        })
    })
  }

  private findCollision(
    kind: BuildingKind,
    x: number,
    z: number,
    elevation: number,
    decorationSlot?: number,
  ): PlacedBuilding | undefined {
    const height = BUILDINGS[kind].height
    if (wallSpec(kind)) {
      const transform = sceneryTransform({ kind, rotation: this.state.buildRotation, decorationSlot })
      const duplicate = this.state.buildings.find(building => {
        if (!wallSpec(building.kind) || !this.volumesOverlap(building, elevation, height)) return false
        const other = sceneryTransform(building)
        return Math.abs(building.x + other.x - x - transform.x) < .001 &&
          Math.abs(building.z + other.z - z - transform.z) < .001 && other.rotation % 2 === transform.rotation % 2
      })
      if (duplicate) return duplicate
    }
    const collisions = this.state.buildings.filter(
      (building) =>
        occupiesBuildingCell(building,x,z) &&
        !((kind === 'bench' || isWasteBin(kind)) && (building.kind === 'bench' || isWasteBin(building.kind)) && kind !== building.kind) &&
        sceneryOverlaps({ kind, rotation: this.state.buildRotation, decorationSlot }, building) &&
        this.volumesOverlap(building, elevation, height),
    )
    return collisions.find(building => building.kind !== 'tree') ?? collisions[0]
  }

  private recalculateCoasterTrackState(coaster: Coaster): void {
    const first = coaster.pieces[0]
    const last = coaster.pieces.at(-1)
    if (first && last && trackAnchorsAlign(last.end, first.start)) {
      snapTrackPieceToAnchor(last, first.start)
    }
    coaster.closed = isCoasterCircuitClosed(coaster)
    this.coasterIndexKey = ''
  }

  private canBuildTrackPiece(
    piece: TrackPiece,
    context: { coasterId?: string; attachPieceIndex?: number } = {},
  ): boolean {
    const points = context.coasterId ? piece.points.slice(1) : piece.points
    return points.every((point, index) => {
      const previous = points[Math.max(0, index - 1)] ?? point
      const next = points[Math.min(points.length - 1, index + 1)] ?? point
      const frame = computeTrackFrame(
        { x: next.x - previous.x, y: next.y - previous.y, z: next.z - previous.z },
        point.bank ?? 0,
        point.pitch ?? 0,
        point.frameHeading,
      )
      return [-0.28, 0, 0.28].every((offset) => {
        const x = Math.round(point.x + frame.right.x * offset)
        const y = point.y + frame.right.y * offset
        const z = Math.round(point.z + frame.right.z * offset)
        if (this.getRideAccessAt(x,z,y)) return false
        if (y < 1.2 && this.getCampingCellAt(x, z)) return false
        if (
          this.state.buildings.some(
            (building) =>
              occupiesBuildingCell(building,x,z) &&
              this.volumesOverlap(building, y, 0.28),
          )
        ) {
          return false
        }
        return !this.trackVolumeBlocked(x, z, y, 0.28, piece, context)
      })
    })
  }

  private trackVolumeBlocked(
    x: number,
    z: number,
    elevation: number,
    height: number,
    newPiece: TrackPiece,
    context: { coasterId?: string; attachPieceIndex?: number },
  ): boolean {
    return this.state.coasters.some((coaster) =>
      coaster.pieces.some((piece, pieceIndex) => {
        const first = coaster.pieces[0]
        const closesOwnCircuit =
          Boolean(context.coasterId) &&
          coaster.id === context.coasterId &&
          first &&
          trackAnchorsAlign(newPiece.end, first.start)
        return piece.points.some((point) => {
          if (Math.round(point.x) !== x || Math.round(point.z) !== z) return false
          if (!(point.y < elevation + height && elevation < point.y + 0.22)) {
            return false
          }
          if (coaster.id !== context.coasterId) return true
          if (
            pieceIndex === context.attachPieceIndex &&
            this.nearTrackAnchor(point, piece.end)
          ) {
            return false
          }
          if (
            closesOwnCircuit &&
            pieceIndex === 0 &&
            this.nearTrackAnchor(point, first!.start)
          ) {
            return false
          }
          return true
        })
      }),
    )
  }

  private nearTrackAnchor(
    point: { x: number; y: number; z: number },
    anchor: { x: number; z: number; elevation: number },
  ): boolean {
    return (
      Math.hypot(point.x - anchor.x, point.z - anchor.z) < 0.7 &&
      Math.abs(point.y - anchor.elevation) < 0.4
    )
  }

  private ensureCoasterIndex(): void {
    const key = this.state.coasters
      .map((coaster) => `${coaster.id}:${coaster.pieces.length}:${coaster.pieces.at(-1)?.id ?? ''}`)
      .join('|')
    if (key === this.coasterIndexKey) return
    this.coasterIndexKey = key
    this.coasterOccupancyIndex.clear()
    this.state.coasters.forEach((coaster) => {
      coaster.pieces.forEach((piece) => {
        piece.points.forEach((point) => {
          const cellKey = this.packXZ(Math.round(point.x), Math.round(point.z))
          const bucket = this.coasterOccupancyIndex.get(cellKey)
          const entry = { y: point.y, coasterId: coaster.id }
          if (bucket) bucket.push(entry)
          else this.coasterOccupancyIndex.set(cellKey, [entry])
        })
      })
    })
  }

  private coasterOccupiesVolume(
    x: number,
    z: number,
    elevation: number,
    height: number,
    ignoreCoasterId?: string,
  ): boolean {
    if (this.state.coasters.length === 0) return false
    this.ensureCoasterIndex()
    const hits = this.coasterOccupancyIndex.get(this.packXZ(x, z))
    if (!hits) return false
    const top = elevation + height
    for (const hit of hits) {
      if (ignoreCoasterId && hit.coasterId === ignoreCoasterId) continue
      if (hit.y < top && elevation < hit.y + 0.22) return true
    }
    return false
  }

  private volumesOverlap(
    building: PlacedBuilding,
    elevation: number,
    height: number,
  ): boolean {
    const bounds = this.getBuildingVerticalBounds(building)
    const candidateTop = elevation + height
    return bounds.base < candidateTop && elevation < bounds.top
  }

  private getBuildingVerticalBounds(
    building: PlacedBuilding,
  ): { base: number; top: number } {
    if (building.kind === 'path' && building.pathSlope) {
      const startElevation = building.elevation - building.pathSlope
      return {
        base: Math.min(building.elevation, startElevation),
        top:
          Math.max(building.elevation, startElevation) +
          BUILDINGS.path.height,
      }
    }
    return {
      base: building.elevation,
      top: building.elevation + (building.rideType === 'bungee' ? (building.bungeeHeight ?? 20) / 4 + .4 : BUILDINGS[building.kind].height),
    }
  }

  private getPathSurfaceElevation(
    path: PlacedBuilding | undefined,
    x?: number,
    z?: number,
  ): number {
    if (!path) return 0
    if (x === undefined || z === undefined) {
      return waySurfaceY(path.elevation, path.pathSlope ?? 0)
    }
    return waySurfaceYAt(
      path.elevation,
      path.pathSlope ?? 0,
      path.pathSlopeDirection ?? 0,
      x - path.x,
      z - path.z,
    )
  }

  private samplePedestrianSurfaceY(
    x: number,
    z: number,
    path: PlacedBuilding | undefined,
    fallback: number,
  ): number {
    if (path) return this.getPathSurfaceElevation(path, x, z)
    const cellX = Math.floor(x)
    const cellZ = Math.floor(z)
    if (!this.isInWorld(cellX, cellZ)) return fallback
    return sampleTerrainSurface(
      this.state.terrain,
      x,
      z,
      this.getWaterLevel(),
      (cx, cz) => this.isInWorld(cx, cz),
    )
  }

  private normalizePrice(price: number): number {
    return Math.round(
      Math.max(
        0,
        Math.min(
          SIMULATION_CONFIG.economy.maximumPrice,
          Number.isFinite(price) ? price : 0,
        ),
      ),
    )
  }

  private recordComplaint(
    visitor: Visitor,
    topic: ComplaintTopic,
  ): void {
    if (visitor.complaintsFiled.includes(topic)) return
    visitor.complaintsFiled.push(topic)
    this.state.complaints.currentSession[topic] += 1
  }

  private rotateComplaintSession(): void {
    this.state.complaints.previousSession = {
      ...this.state.complaints.currentSession,
    }
    this.state.complaints.currentSession = createComplaintCounts()
    this.state.complaints.sessionNumber += 1
    this.state.visitors.forEach((visitor) => {
      visitor.complaintsFiled = []
    })
  }

  private refundEntryFee(visitor: Visitor): void {
    const refund = Math.max(0, visitor.entryFeePaid)
    if (refund <= 0) return
    visitor.entryFeePaid = 0
    visitor.budget += refund
    bookFinance(this.state, 'tickets', -refund)
    this.state.cashEffects.push({
      id: this.nextId('refund'),
      amount: -refund,
      x: visitor.x,
      y: visitor.y + 0.9,
      z: visitor.z,
      age: 0,
    })
  }

  private chargeVisitor(
    visitor: Visitor,
    amount: number,
    position: { x: number; y: number; z: number },
    category: FinanceCategory = 'sales',
  ): boolean {
    const price = this.normalizePrice(amount)
    if (visitor.budget < price) return false
    visitor.budget -= price
    if (price > 0) {
      bookFinance(this.state, category, price)
      this.state.cashEffects.push({
        id: this.nextId('cash'),
        amount: price,
        ...position,
        age: 0,
      })
    }
    return true
  }

  private refreshBandSupplyGraph(): void {
    this.ensureSpatialIndexes()
    this.bandSupplyComponents = buildBandSupplyGraph(this.state)
    this.activeBackstagePacked.clear()
    for (const component of this.bandSupplyComponents) {
      if (!component.active) continue
      for (const cell of component.cells) {
        this.activeBackstagePacked.add(this.packXZ(cell.x, cell.z))
      }
    }
    this.state.bandSupply = collectBandSupplySnapshot(
      this.state,
      this.bandSupplyComponents,
      (component) => ({
        fansOnActiveTiles: this.countFansOnComponent(component.id),
        usableSlots: this.usableTourBusParkingIds(component).length,
      }),
    )
  }

  private countFansOnComponent(componentId: string): number {
    const component = this.bandSupplyComponents.find((item) => item.id === componentId)
    if (!component?.active) return 0
    const keys = new Set(component.cells.map((cell) => this.packXZ(cell.x, cell.z)))
    let count = 0
    for (const visitor of this.state.visitors) {
      if (!visitor.backstageIntrusion) continue
      if (keys.has(this.packXZ(visitor.cellX, visitor.cellZ))) count += 1
    }
    return count
  }

  private isTourBusParkingReachable(building: PlacedBuilding): boolean {
    if (this.tourBusReachRevision !== this.worldRevision) {
      this.tourBusReachCache.clear()
      this.tourBusReachRevision = this.worldRevision
    }
    const cached = this.tourBusReachCache.get(building.id)
    if (cached !== undefined) return cached
    const approaches = this.getAdjacentRoadPositions(building)
    if (approaches.length === 0) {
      this.tourBusReachCache.set(building.id, false)
      return false
    }
    const entry = this.getRoadEntry()
    const start = this.getRoadCellAt(entry.x, entry.z)
    if (!start) {
      this.tourBusReachCache.set(building.id, false)
      return false
    }
    const route = this.routePreferringOpenLights({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      start: { x: start.x, z: start.z, elevation: start.elevation },
      targets: approaches,
    })
    const reachable = Boolean(route)
    this.tourBusReachCache.set(building.id, reachable)
    return reachable
  }

  private usableTourBusParkingIds(component: BandSupplyComponent): string[] {
    if (!component.active) return []
    const keys = new Set(component.cells.map((cell) => this.packXZ(cell.x, cell.z)))
    return this.state.buildings
      .filter(
        (building) =>
          building.kind === 'tourBusParking' &&
          keys.has(this.packXZ(building.x, building.z)) &&
          this.isTourBusParkingReachable(building),
      )
      .map((building) => building.id)
  }

  private staffGateSpawn(): Cell {
    const gate = this.state.buildings.find(
      (building) => building.kind === 'path' && building.staffOnly,
    )
    if (gate) {
      return { x: gate.x, z: gate.z, elevation: gate.elevation }
    }
    return this.getEntrance()
  }

  private activeBackstageGoals(componentId: string): Cell[] {
    const component = this.bandSupplyComponents.find((item) => item.id === componentId)
    if (!component?.active) return []
    return component.cells
      .filter(
        (cell) => !this.isPedestrianSolidAt(cell.x, cell.z, cell.elevation),
      )
      .map((cell) => ({
        x: cell.x,
        z: cell.z,
        elevation: cell.elevation,
      }))
  }

  private syncBandActors(): void {
    if (!this.state.festival.enabled || this.state.festival.finished) {
      this.state.bandActors = []
      this.state.logistics.roadVehicles = this.state.logistics.roadVehicles.filter(
        (vehicle) => vehicle.kind !== 'tourBus',
      )
      return
    }
    const parkingByComponent = new Map<string, string[]>()
    for (const component of this.bandSupplyComponents) {
      parkingByComponent.set(component.id, this.usableTourBusParkingIds(component))
    }
    const planned = planBandPresence({
      enabled: true,
      day: this.state.day,
      minute: this.state.minute,
      bookings: this.state.festival.bookings,
      components: this.bandSupplyComponents,
      usableParkingIdsByComponent: parkingByComponent,
    })
    const keep = new Set(planned.map((item) => item.bandId))
    for (const actor of this.state.bandActors) {
      if (!keep.has(actor.bandId)) actor.state = 'leaving'
    }
    this.state.bandActors = this.state.bandActors.filter(
      (actor) => keep.has(actor.bandId) || actor.state === 'leaving',
    )
    this.state.logistics.roadVehicles = this.state.logistics.roadVehicles.filter((vehicle) => {
      if (vehicle.kind !== 'tourBus') return true
      return this.state.bandActors.some(
        (actor) =>
          actor.vehicleId === vehicle.id ||
          (actor.parkingId !== null && actor.parkingId === vehicle.reservedParkingId),
      )
    })
    for (const plan of planned) {
      const roster = this.state.bandActors.filter((item) => item.bandId === plan.bandId)
      for (const actor of roster) {
        actor.stageId = plan.stageId
        actor.componentId = plan.componentId
        actor.arrivalMode = plan.arrivalMode
        actor.parkingId = plan.parkingId
        actor.costumeId = bandCostumeId(plan.bandId)
      }
      if (roster.length > 0) continue
      this.spawnBandRoster(plan)
    }
  }

  private spawnBandRoster(plan: PlannedBandPresence): void {
    const roles = bandRoles(plan.bandId)
    const spawn =
      plan.arrivalMode === 'staffGate'
        ? this.staffGateSpawn()
        : this.activeBackstageGoals(plan.componentId)[0] ?? this.staffGateSpawn()
    const actors: BandActor[] = roles.map((role, memberIndex) => {
      const actor = createBandActor(
        this.nextId('band'),
        plan.bandId,
        plan.stageId,
        plan.componentId,
        plan.arrivalMode,
        spawn,
        memberIndex,
        role,
      )
      actor.parkingId = plan.parkingId
      return actor
    })
    if (plan.arrivalMode === 'tourBus' && plan.parkingId) {
      const existing = this.state.logistics.roadVehicles.find(
        (vehicle) =>
          vehicle.kind === 'tourBus' && vehicle.reservedParkingId === plan.parkingId,
      )
      const entry = this.getRoadEntry()
      const start = this.getRoadCellAt(entry.x, entry.z)
      const position = start
        ? { x: start.x, z: start.z, elevation: start.elevation }
        : { x: entry.x, z: entry.z }
      const vehicle =
        existing ??
        createTourBusVehicle(
          this.nextId('tourbus'),
          position,
          plan.parkingId,
          actors.map((actor) => actor.id),
        )
      if (!existing) {
        const parking = this.state.buildings.find((building) => building.id === plan.parkingId)
        if (parking) {
          vehicle.parkingCell = {
            x: parking.x,
            z: parking.z,
            elevation: parking.elevation,
          }
        }
        this.state.logistics.roadVehicles.push(vehicle)
      } else {
        vehicle.passengerIds = actors.map((actor) => actor.id)
      }
      for (const actor of actors) {
        actor.vehicleId = vehicle.id
        actor.arrivalMode = 'tourBus'
      }
    } else {
      const goals = this.activeBackstageGoals(plan.componentId)
      for (const actor of actors) {
        actor.arrivalMode = 'staffGate'
        if (goals.length > 0) {
          actor.route =
            this.findPath(spawn, goals, false, false, false, false, true, undefined, true) ?? []
        }
      }
    }
    this.state.bandActors.push(...actors)
  }

  private tourBusParkingBuilding(vehicle: RoadVehicle): PlacedBuilding | undefined {
    const parkingId =
      vehicle.target?.kind === 'tourBusParking'
        ? vehicle.target.buildingId
        : vehicle.reservedParkingId
    if (!parkingId) return undefined
    return this.state.buildings.find((building) => building.id === parkingId)
  }

  private dispatchTourBuses(): void {
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'tourBus') continue
      if (vehicle.state === 'parked') {
        const leaving = this.state.bandActors.some(
          (actor) => actor.vehicleId === vehicle.id && actor.state === 'leaving',
        )
        if (leaving && vehicle.route.length === 0) {
          const parking = this.tourBusParkingBuilding(vehicle)
          const entry = this.getRoadEntry()
          const here = vehicle.cell ?? vehicle.position
          const onPad =
            parking && here.x === parking.x && here.z === parking.z
          const approach = parking ? this.getAdjacentRoadPositions(parking)[0] : undefined
          const start = onPad && approach ? approach : here
          const route = this.routePreferringOpenLights({
            roadCells: this.state.logistics.roadCells,
            graph: this.getRoadGraph(),
            start,
            target: { x: entry.x, z: entry.z },
            initialDirection: this.getVehicleDirection(vehicle),
          })
          if (route) {
            vehicle.route = [
              ...(onPad && approach ? [approach] : []),
              ...route.map((cell) => ({
                x: cell.x,
                z: cell.z,
                elevation: cell.elevation,
              })),
            ]
            vehicle.state = 'returning'
            vehicle.target = { kind: 'cell', x: entry.x, z: entry.z, elevation: entry.elevation }
          }
        }
        continue
      }
      if (vehicle.route.length > 0 || vehicle.state === 'returning' || vehicle.state === 'parking') {
        continue
      }
      if (vehicle.target?.kind !== 'tourBusParking') continue
      const parking = this.tourBusParkingBuilding(vehicle)
      if (!parking) continue
      const approaches = this.getAdjacentRoadPositions(parking)
      if (approaches.length === 0) continue
      const here = vehicle.cell ?? vehicle.position
      const onApproach = approaches.some(
        (cell) => cell.x === here.x && cell.z === here.z,
      )
      if (onApproach) {
        vehicle.parkingCell = { x: parking.x, z: parking.z, elevation: parking.elevation }
        vehicle.route = [{ x: parking.x, z: parking.z, elevation: parking.elevation }]
        vehicle.state = 'parking'
        continue
      }
      const route = this.routePreferringOpenLights({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: here,
        targets: approaches,
        initialDirection: this.getVehicleDirection(vehicle),
      })
      if (!route) continue
      vehicle.route = route.map((cell) => ({
        x: cell.x,
        z: cell.z,
        elevation: cell.elevation,
      }))
      vehicle.state = 'driving'
    }
  }

  private finishTourBusLeg(vehicle: RoadVehicle, removedVehicles: Set<string>): void {
    if (vehicle.state === 'returning') {
      for (const actor of this.state.bandActors) {
        if (actor.vehicleId === vehicle.id) actor.vehicleId = null
      }
      this.state.bandActors = this.state.bandActors.filter(
        (actor) => actor.vehicleId !== vehicle.id && actor.state !== 'leaving',
      )
      removedVehicles.add(vehicle.id)
      return
    }
    const parking = this.tourBusParkingBuilding(vehicle)
    const here = vehicle.cell ?? vehicle.position
    const onPad = parking && here.x === parking.x && here.z === parking.z
    const onApproach =
      parking &&
      this.getAdjacentRoadPositions(parking).some(
        (cell) => cell.x === here.x && cell.z === here.z,
      )
    if (parking && !onPad && (onApproach || vehicle.state === 'driving')) {
      vehicle.parkingCell = { x: parking.x, z: parking.z, elevation: parking.elevation }
      vehicle.route = [{ x: parking.x, z: parking.z, elevation: parking.elevation }]
      vehicle.state = 'parking'
      return
    }
    vehicle.state = 'parked'
    vehicle.waitMinutes = 0
    if (parking) {
      vehicle.position = { x: parking.x, z: parking.z, elevation: parking.elevation }
      vehicle.cell = { x: parking.x, z: parking.z, elevation: parking.elevation }
      vehicle.parkingCell = { x: parking.x, z: parking.z, elevation: parking.elevation }
    }
    const componentId =
      this.bandSupplyComponents.find((component) =>
        parking
          ? component.cells.some((cell) => cell.x === parking.x && cell.z === parking.z)
          : false,
      )?.id ?? ''
    const drops = this.activeBackstageGoals(componentId)
    const fallback = parking
      ? { x: parking.x, z: parking.z, elevation: parking.elevation }
      : null
    if (drops.length === 0 && !fallback) return
    let index = 0
    for (const actor of this.state.bandActors) {
      if (actor.vehicleId !== vehicle.id) continue
      actor.vehicleId = null
      actor.state = 'idle'
      placeActorOnCell(actor, drops[index % Math.max(drops.length, 1)] ?? fallback!)
      index += 1
    }
    vehicle.passengerIds = []
  }

  private updateBandActors(minutes: number): void {
    if (!this.state.festival.enabled) return
    for (const actor of this.state.bandActors) {
      if (actor.vehicleId) continue
      const performing = bandActorShouldPerform(
        actor,
        this.state.festival.bookings,
        this.state.day,
        this.state.minute,
      )
      if (performing) {
        const stage = this.state.buildings.find((building) => building.id === actor.stageId)
        if (stage) {
          actor.state = 'performing'
          placeActorOnCell(actor, {
            x: stage.x,
            z: stage.z,
            elevation: stage.elevation,
          })
        }
        continue
      }
      if (actor.state === 'performing') actor.state = 'idle'
      const leaving = !isBandOnSiteMinute(
        this.state.festival.bookings,
        actor.bandId,
        this.state.day,
        this.state.minute,
      )
      if (leaving) {
        actor.state = 'leaving'
        if (actor.parkingId) {
          const bus = this.state.logistics.roadVehicles.find(
            (vehicle) =>
              vehicle.kind === 'tourBus' &&
              (vehicle.reservedParkingId === actor.parkingId ||
                (vehicle.target?.kind === 'tourBusParking' &&
                  vehicle.target.buildingId === actor.parkingId)),
          )
          if (bus && bus.state === 'parked') {
            actor.vehicleId = bus.id
            if (!bus.passengerIds.includes(actor.id)) bus.passengerIds.push(actor.id)
            continue
          }
        }
        if (actor.route.length === 0 && this.decisionBudget > 0) {
          this.decisionBudget -= 1
          actor.route =
            this.findPath(
              {
                x: actor.cellX,
                z: actor.cellZ,
                elevation: actor.cellElevation,
              },
              [this.staffGateSpawn()],
              false,
              false,
              false,
              false,
              true,
              undefined,
              true,
            ) ?? []
        }
      } else if (idleWanderReady(actor) && this.decisionBudget > 0) {
        const goals = this.activeBackstageGoals(actor.componentId)
        if (goals.length > 0) {
          this.decisionBudget -= 1
          actor.route =
            this.findPath(
              {
                x: actor.cellX,
                z: actor.cellZ,
                elevation: actor.cellElevation,
              },
              goals,
              false,
              false,
              false,
              false,
              true,
              undefined,
              true,
            ) ?? []
          actor.wanderMinutes = nextWanderDelay(this.state.simTick, actor.id)
        }
      }
      stepBandActor(actor, minutes)
      if (
        actor.state === 'leaving' &&
        !actor.vehicleId &&
        actor.route.length === 0 &&
        actor.cellX === this.staffGateSpawn().x &&
        actor.cellZ === this.staffGateSpawn().z
      ) {
        actor.wanderMinutes = -1
      }
    }
    this.state.bandActors = this.state.bandActors.filter(
      (actor) =>
        actor.wanderMinutes !== -1 &&
        (actor.state !== 'leaving' || actor.vehicleId !== null || actor.route.length > 0),
    )
  }

  private updateFanIntrusion(minutes: number): void {
    if (!this.state.festival.enabled || this.activeBackstagePacked.size === 0) return
    const activeTiles = this.bandSupplyComponents.flatMap((component) =>
      component.active
        ? component.cells.map((cell) => ({
            ...cell,
            componentId: component.id,
          }))
        : [],
    )
    if (activeTiles.length === 0) return
    const range = SIMULATION_CONFIG.bandSupply.fanIntrusionRange
    for (const visitor of this.state.visitors) {
      if (visitor.backstageIntrusion) {
        visitor.backstageLingerMinutes = (visitor.backstageLingerMinutes ?? 0) - minutes
        if ((visitor.backstageLingerMinutes ?? 0) <= 0 && visitor.route.length === 0) {
          if (this.decisionBudget <= 0) continue
          this.decisionBudget -= 1
          const exit =
            this.findPath(
              {
                x: visitor.cellX,
                z: visitor.cellZ,
                elevation: visitor.cellElevation,
              },
              [this.getEntrance()],
            ) ?? []
          visitor.route = exit
          visitor.backstageIntrusion = false
          visitor.state = visitor.state === 'partying' ? visitor.state : 'exploring'
        }
        continue
      }
      if (!isFanIntrusionEligible(visitor)) continue
      if (this.decisionBudget <= 0) continue
      let nearest = Number.POSITIVE_INFINITY
      let componentId = ''
      for (const tile of activeTiles) {
        const distance =
          Math.abs(tile.x - visitor.cellX) + Math.abs(tile.z - visitor.cellZ)
        if (distance < nearest) {
          nearest = distance
          componentId = tile.componentId
        }
      }
      if (nearest > range) continue
      if (
        this.rng.next() >=
        minutes * SIMULATION_CONFIG.bandSupply.fanIntrusionChancePerMinute
      ) {
        continue
      }
      this.decisionBudget -= 1
      const goals = this.activeBackstageGoals(componentId)
      if (goals.length === 0) continue
      const route = this.findPath(
        {
          x: visitor.cellX,
          z: visitor.cellZ,
          elevation: visitor.cellElevation,
        },
        goals,
        false,
        false,
        false,
        false,
        false,
        undefined,
        false,
        true,
      )
      if (!route) continue
      visitor.route = route
      visitor.backstageIntrusion = true
      visitor.backstageLingerMinutes = SIMULATION_CONFIG.bandSupply.fanLingerMinutes
      visitor.targetId = null
      visitor.thought = 'Ich schaue mal hinter die Bühne – nur ganz kurz.'
    }
  }

  private wayBatch = false
  private emit(reason: 'mutate' | 'tick' | 'local' = 'mutate'): void {
    if (reason === 'mutate' && this.networkMode !== 'client') {
      this.worldRevision += 1
    }
    if (!this.wayBatch) this.listeners.forEach((listener) => listener(this.state))
  }
}

