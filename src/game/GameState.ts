import { pathFurnitureRotation } from './pathFurniture'
import { isWasteBin, THEMED_BIN_KINDS } from './decorationWalls'
import { wallSpec } from './decorationWalls'
import { musicTaste, musicAppeal, type MusicGenre } from './musicTaste'
import { isScenery, isLargeScenery, isEdgeScenery, sceneryOverlaps, sceneryTransform } from './scenery'
import { syncStageAudience } from './stageAudience'
import { stageSiteIssue } from './stageSite'
import { isStageAudienceCell, stageDistance, stageSize, buildingFootprint, occupiesBuildingCell, stageDesignIssue, stageStats, migrateStageDesign, type StageDesign } from './stageDesign'
import { WAY_TYPES, wayInfo, wayIssue } from './wayTypes'
import type { WayType } from './wayTypes'
import { groundRectangle } from './ground'
import { createInfrastructure, updateSupplyChain, localStock, consumeLocal, normalizeInfrastructure, normalizeStock } from './supplyChain'
import { CARDINAL_OFFSETS, isShopServiceKind } from './shopAccess'
import {
  defaultShirtSettings,
  isPricedShopKind,
  isQueuedFacilityKind,
  normalizeShirtColor,
  normalizeShirtStyle,
  normalizeWornShirt,
  shopSupplyKind,
  souvenirPurchaseThought,
  souvenirSeekThought,
  stockoutThought,
  type ShirtStyle,
  type WornShirt,
} from './shopGoods'
import {
  QUEUE_CARDINALS,
  isStallQueueKind,
  queueStandOffset as computeQueueStandOffset,
  queueTravelLane,
  stallQueueLaneFromLocal,
  stallQueueTileOffset,
} from './queueLanes'
import { groundInfo, groundKey, buildingEfficiency, roadGroundLimit } from './ground'
import { BUILDING_KINDS, BUILDINGS, SAVE_KEY, SAVE_SLOTS_KEY } from './catalog'
import { bookFinance, createFinanceState, financeEdition, financeForecast, loanInterest, loanLimit, rollFinanceDay, LOAN, CARRIER_WAGE_PER_MINUTE, type FinanceCategory, type FinanceEntries, type FinanceState } from './finance'
import { createScenarioProgress, updateScenarioProgress, type ScenarioProgress } from './scenarioGoals'
import { createFestivalManagement, festivalAction, updateFestival, assignAudience, activeBookings, watchableBookings, showIssue, BANDS } from './festivalManagement'
import type { FestivalManagement, FestivalAction, Audience, Booking } from './festivalManagement'
import {
  createDefaultScenarioSettings,
  createScenarioEntrance,
  createScenarioRoadEntry,
  normalizeScenarioSettings,
  sampleBiasedPreference,
} from './scenario'
import type { ScenarioSettings } from './scenario'
import type { BuildingKind, Tool } from './catalog'
import {
  TRACK_PIECES,
  createCoasterTelemetry,
  createTrackPiece,
  computeTrackFrame,
  getCoasterType,
  isCoasterCircuitClosed,
  migrateTrackPiece,
  resolveCoasterTypeId,
  sampleCoasterTrack,
  snapTrackPieceToAnchor,
  trackAnchorsAlign,
} from './coasters'
import { describeTrackAppendIssue, isTrackChainLiftEligible } from './coasterConnections'
import type {
  Coaster,
  CoasterOperationMode,
  CoasterTypeId,
  DispatchMode,
  TrackSample,
  TrackBuildOptions,
  TrackPiece,
  TrackPieceKind,
} from './coasters'
import {
  abandonVisitorCamp,
  CampingSystem,
  decayUnclaimedInstallations,
  installationIsClaimed,
  isCollectibleCamp,
} from './camping'
import type {
  CampingCell,
  CampingPhase,
  CampInstallation,
  CampSetupKind,
} from './camping'
import {
  createFestivalInventory,
  addItem,
  consumeItem,
  getItemQuantity,
  INVENTORY_ITEMS,
  normalizeInventory,
} from './inventory'
import type { InventoryItem } from './inventory'
import { FireworksSystem } from './fireworks'
import type { FireworkEffect } from './fireworks'
import { CrowdingSystem } from './crowding'
import type { CrowdingSnapshot } from './crowding'
import {
  denseClusterSize,
  neighborhoodPeople,
  panicSpreadChance,
  spontaneousPanicChance,
} from './visitorBubbles'
import { CONCERT_TOPLESS_CROWD_THOUGHT, CONCERT_TOPLESS_THOUGHT } from './visitorThoughts'
import {
  createPathScratch,
  createSeededRng,
  findWeightedPath,
} from './pathfinding'
import { DeterministicRng, hashStringSeed, rollsBungeeNude, visitorLooksFemale } from './rng'
import { applyGameCommand } from '../net/commands'
import { allowsPathFlow, normalizeFlowDirection } from './pathFlow'
import { createStaffMember, STAFF_DEFINITIONS } from './staff'
import type { StaffMember, StaffRole } from './staff'
import { isInAnyZone, setAssignedWorkZones, zonePaintActive } from './staffZones'
import { StaffSimulation } from './staffSimulation'
import { MedicalSystem, normalizeMedicalCell } from './medical'
import type { MedicalCell } from './medical'
import { IncidentSystem } from './incidents'
import type {
  GroundIncident,
  GroundIncidentKind,
} from './incidents'
import { DEFAULT_SECURITY_CONFIG, SecuritySystem } from './security'
import type { SecurityGateConfig } from './security'
import { SIMULATION_CONFIG } from './simulationConfig'
import {
  circadianEnergyDecayMultiplier,
  isMinuteInSleepWindow,
  remapLegacySleepRhythm,
  sampleFestivalSleepRhythm,
  sleepRhythmFromVisitorId,
} from './visitorSleep'
import type { GameCommand, SimSnapshot, WorldSnapshot } from '../net/protocol'
import { applySim, applyWorld } from '../net/codec'
import { AtmosphereSystem } from './atmosphere'
import type { AtmosphereSnapshot } from './atmosphere'
import { FestivalAreaSystem } from './festivalAreas'
import type { StageForecourtCell } from './festivalAreas'
import {
  acceptWasteAtDump,
  clampWasteDumpStored,
  designateWasteDumps,
  findNearestWasteBin,
  findNearestWasteBinInRange,
  normalizeWasteDumpCell,
  wasteBinHasRoom,
  wasteBinManhattan,
  wasteDumpRemaining,
} from './waste'
import type { WasteBinInfo, WasteDumpCell } from './waste'
import {
  bandSupplyAt,
  bandSupplyForStage,
  buildBandSupplyGraph,
  collectBandSupplySnapshot,
  designateBackstageAreas,
  emptyBandSupplySnapshot,
  isBandSupplyKind,
  isFanIntrusionEligible,
  normalizeBackstageCell,
  showQualityForStage,
  type BackstageCell,
  type BandSupplyComponent,
  type BandSupplySnapshot,
  type BandSupplyStats,
} from './bandSupply'
import {
  bandActorShouldPerform,
  createBandActor,
  createTourBusVehicle,
  idleWanderReady,
  isBandOnSiteMinute,
  nextWanderDelay,
  normalizeBandActor,
  placeActorOnCell,
  planBandPresence,
  stepBandActor,
  type BandActor,
  type PlannedBandPresence,
} from './bandActors'
import { bandCostumeId, bandRoles } from './bandLooks'
import {
  consumesPower,
  createEmptyPower,
  normalizePower,
  PowerSystem,
} from './power'
import type { PowerCableCell, PowerSnapshot } from './power'
import {
  createDefaultDayPlan,
  getFestivalCycleStatus,
  getOpenWindowHours,
  isDayVisitorAdmissionOpen,
  isFestivalOfferActive,
  normalizeDayPlan,
} from './dayPlan'
import type { DayPlan, DayPlanOffer } from './dayPlan'
import {
  createComplaintCounts,
  createComplaintSnapshot,
  normalizeComplaintSnapshot,
} from './complaints'
import type {
  ComplaintSnapshot,
  ComplaintTopic,
} from './complaints'
import {
  cellKey as roadCellKey,
  chooseParkingDisembarkPath,
  collectSeatedPassengerIds,
  createDefaultLogisticsSnapshot,
  createRoadGraph,
  DIRECTION_OFFSETS,
  DIRECTIONS,
  directionBit,
  directionFromDelta,
  findRoadRoute,
  isPlayerOwnedFleetVehicle,
  isRoadDirectionAllowed,
  isVehicleReversing,
  normalizeLogisticsSnapshot,
  oppositeDirection,
  resolveRoadLayer,
  roadLayerElevation,
  roadLayerKey,
  toRoadPosition,
} from './logistics'
import {
  MAX_PATH_ELEVATION,
  WAY_ELEVATION_EPSILON,
  WAY_LEVEL_MATCH,
  canTraverseWayElevation,
  elevationsMatch,
  maxRoadElevation,
  wayOverlapsRoadGrade,
  packWayElevation,
  snapWayElevation,
} from './wayElevation'
import { snapBuildElevation, stepBuildElevation } from './placementPreview'
import type {
  ArrivalGroup,
  Direction,
  FindRoadRouteOptions,
  LogisticsSnapshot,
  ParkingCell,
  ParkingDisembarkCandidate,
  RoadCell,
  RoadPosition,
  RoadGraph,
  RoadVehicle,
  SpeedLimit,
} from './logistics'
import {
  accessCellKey,
  accessEdgeKey,
  closedAccessEdges,
  createAccessControlSnapshot,
  createPathBarrier,
  createTrafficLight,
  evaluateAccessSignal,
  statsForArea,
  stepUsesClosedEdge,
  toggleAreaCells,
  normalizeAccessControls,
  normalizeScheduleHours,
  normalizeScheduleOffer,
  normalizeSchedulePhases,
  normalizeScheduleTime,
  normalizeStaffGateDirection,
  type AccessAreaCell,
  type AccessAreaIndexes,
  type AccessAreaStats,
  type AccessControl,
  type AccessControlKind,
  type AccessControlPatch,
  type AccessControlSnapshot,
  type AccessScheduleContext,
} from './accessControl'
import {
  applyTerrainChanges,
  createEmptyTerrain,
  generateTerrain,
  getTerrainHeight as readTerrainHeight,
  isMudHeight,
  isWaterHeight,
  normalizeTerrain,
  planTerrainEdit,
  scatterWildTrees,
  WATER_HEIGHT,
} from './terrain'
import type { TerrainEditMode, TerrainSnapshot } from './terrain'

export type Cell = { x: number; z: number; elevation: number }

export type PlacedBuilding = {
  rideEntrance?: { x: number; y: number; z: number }
  rideExit?: { x: number; y: number; z: number }
  rideType?: 'bungee'
  bungeeHeight?: number
  bungeeVisitorId?: string
  decorationSlot?: number
  id: string
  kind: BuildingKind
  x: number
  z: number
  rotation: number
  elevation: number
  stageDesign?: StageDesign
  staffOnly?: boolean
  staffGateDirection?: Direction
  wayType?: WayType
  pathType?: 'normal' | 'queue'
  queueDirection?: number
  queueEntryDirection?: number
  /** Stall queues only: derived 50/50 inbound (wait) / outbound (return) lanes. */
  queueSplit?: boolean
  pathSlope?: number
  pathSlopeDirection?: number
  price: number
  flowDirection?: number | null
  securityConfig?: SecurityGateConfig
  bandName?: string
  wasteFill?: number
  shirtColor?: number
  shirtStyle?: ShirtStyle
}

export type VisitorNeeds = {
  hunger: number
  toilet: number
  fun: number
  energy: number
}

export type VisitorState =
  | 'entering'
  | 'exploring'
  | 'seeking'
  | 'using'
  | 'queuing'
  | 'riding'
  | 'sleeping'
  | 'camping'
  | 'socializing'
  | 'vomiting'
  | 'security-check'
  | 'medical-transport'
  | 'medical'
  | 'partying'
  | 'bench-resting'
  | 'relaxing'
  | 'camp-waiting'
  | 'vehicle-arrival'
  | 'bus-waiting'
  | 'bus-riding'
  | 'injured'
  | 'exiting'
  | 'leaving'
  | 'panicking'

export type VisitorEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'excited'

export type Visitor = {
  musicTaste?: MusicGenre
  audience?: Audience
  concertId?: string | null
  id: string
  name: string
  x: number
  y: number
  z: number
  cellX: number
  cellZ: number
  cellElevation: number
  color: number
  state: VisitorState
  thought: string
  needs: VisitorNeeds
  route: Cell[]
  targetId: string | null
  interactionRemaining: number
  walkSpeed: number
  movementBoostMinutes: number
  avoidedCoasterId: string | null
  avoidanceMinutes: number
  facing: number
  emotion: VisitorEmotion
  emotionMinutes: number
  budget: number
  alcoholLevel: number
  alcoholDisposition: 'calm' | 'aggressive'
  alcoholDesire: number
  campsite: Cell | null
  campingPhase: CampingPhase
  hasHandcart: boolean
  inventory: InventoryItem[]
  motivation: number
  crowding: number
  crowdStress: number
  isPanicking: boolean
  panicRecoverMinutes: number
  tileOffsetX: number
  tileOffsetZ: number
  campActivityTarget: Cell | null
  campActivity: 'standing' | 'sitting'
  campActivityKind: CampSetupKind | null
  campActivitySlot: number
  campActivityCapacity: number
  nausea: number
  nauseaCooldown: number
  medicalCell: Cell | null
  medicalSlot: number | null
  securityGateId: string | null
  securityResumeState: VisitorState | null
  beautyPreference: number
  partyPreference: number
  localAttractiveness: number
  localPartyMood: number
  activityTarget: Cell | null
  activitySlot: number
  activityCapacity: number
  isDancing: boolean
  preferredBedtime: number
  preferredWakeTime: number
  ticketType: 'day' | 'camping'
  consumptionCooldown: number
  isConversing: boolean
  campingWaitMinutes: number
  campingWaitRetryMinutes: number
  entryFeePaid: number
  complaintsFiled: ComplaintTopic[]
  arrivalGroupId: string | null
  arrivalMode: 'car' | 'pedestrian'
  injuryVehicleId: string | null
  rescueVehicleId: string | null
  busWaitMinutes: number
  busLineId: string | null
  busDestination: Cell | null
  busDestinationStopId: string | null
  busResumeState: VisitorState | null
  busResumeTargetId: string | null
  walkingToCampDistance: number
  pendingWaste: number
  streakingMinutes: number
  streakingCooldownMinutes: number
  toplessMinutes: number
  bungeeNude: boolean
  ownedMascot?: boolean
  heldMascot?: boolean
  wornShirt?: WornShirt
  backstageIntrusion?: boolean
  backstageLingerMinutes?: number
  pathSeed: number
  wanderNonce: number
  netX?: number
  netY?: number
  netZ?: number
  netFacing?: number
}

export type CashEffect = {
  id: string
  amount: number
  x: number
  y: number
  z: number
  age: number
}

export type SimTurn = {
  tick: number
  commands: GameCommand[]
  step: boolean
  hash: number
}

export type GameSnapshot = {
  festival: FestivalManagement
  version: 29
  simTick: number
  rngState: number
  money: number
  entryPrice: number
  campingTicketPrice: number
  parkOpen: boolean
  guests: number
  reputation: number
  day: number
  minute: number
  speed: number
  selectedTool: Tool
  buildElevation: number
  buildRotation: number
  buildings: PlacedBuilding[]
  campingCells: CampingCell[]
  campInstallations: CampInstallation[]
  visitors: Visitor[]
  coasters: Coaster[]
  cashEffects: CashEffect[]
  fireworkEffects: FireworkEffect[]
  crowding: CrowdingSnapshot
  staff: StaffMember[]
  medicalCells: MedicalCell[]
  wasteDumpCells: WasteDumpCell[]
  incidents: GroundIncident[]
  stageForecourtCells: StageForecourtCell[]
  backstageCells: BackstageCell[]
  bandActors: BandActor[]
  bandSupply: BandSupplySnapshot
  attractiveness: AtmosphereSnapshot
  partyMood: AtmosphereSnapshot
  dayPlan: DayPlan
  complaints: ComplaintSnapshot
  logistics: LogisticsSnapshot
  accessControls: AccessControlSnapshot
  scenario: ScenarioSettings
  finance: FinanceState
  scenarioProgress: ScenarioProgress
  terrain: TerrainSnapshot
  power: PowerSnapshot
}

export type ActionResult = {
  ok: boolean
  message: string
  placedId?: string
}

export type LocalSaveSlot = {
  id: string
  name: string
  savedAt: number
}

type StoredSaveSlot = LocalSaveSlot & { snapshot: string }

type Listener = (snapshot: Readonly<GameSnapshot>) => void

const ENTRANCE_PATH_ID = 'entrance-path'
const SIMULATION_SPEED_MULTIPLIERS = SIMULATION_CONFIG.time.speedMultipliers
const VISITOR_SPAWN_INTERVAL_MINUTES =
  SIMULATION_CONFIG.visitors.spawnIntervalMinutes
const BOARDING_MINUTES_PER_PERSON =
  SIMULATION_CONFIG.coasters.boardingMinutesPerPerson
export const FEMALE_VISITOR_NAMES = [
  'Mia',
  'Emma',
  'Lea',
  'Lina',
  'Sofia',
  'Mila',
  'Nina',
  'Marie',
  'Hannah',
  'Clara',
  'Ida',
  'Greta',
  'Lara',
  'Pia',
  'Anna',
  'Luisa',
]
export const MALE_VISITOR_NAMES = [
  'Noah',
  'Finn',
  'Ben',
  'Elias',
  'Jonas',
  'Paul',
  'Leon',
  'Max',
  'Theo',
  'Otto',
  'Jan',
  'Felix',
  'Luis',
  'Oskar',
  'Karl',
  'Tim',
]

export function visitorGivenName(id: string, salt = 0): string {
  const names = visitorLooksFemale(id) ? FEMALE_VISITOR_NAMES : MALE_VISITOR_NAMES
  return names[(hashStringSeed(id) + salt) % names.length]!
}
const BAND_NAMES = ['Neon Echo', 'Festival Riot', 'Moonlight Avenue', 'Bassgarten']
const PEDESTRIAN_SOLID_KINDS = new Set<BuildingKind>([
  'food',
  'toilet',
  'ride',
  'alcohol',
  'tree',
  'hedge',
  'stage',
  'directionalSpeaker',
  'omniSpeaker',
  'ambulanceGarage',
  'busDepot',
  'wasteDepot',
  'specialDepot',
  'generator',
  'backupGenerator',
  'foh',
  'delayTower',
  'videoWall',
  'laserShow',
  'fireworkBattery',
  'tourBusParking',
])
const PEDESTRIAN_OFFSETS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const

const NAV_PATH = 1
const NAV_ROAD = 2
const NAV_CAMPING = 4
const NAV_MEDICAL = 8
const NAV_FORECOURT = 16
const NAV_PARKING = 32
const NAV_WATER = 64
const NAV_GROUND = 128
const NAV_SOLID = 256
const NAV_PAVED = 512
const NAV_BACKSTAGE = 1024

type PedestrianNavLink = {
  node: PedestrianNavNode
  toPath?: PlacedBuilding
}

type PedestrianNavNode = {
  cell: Cell
  packed: number
  flags: number
  cost: number
  fenceMask: number
  roadBlocked: number
  path?: PlacedBuilding
  links: PedestrianNavLink[]
}

const PATH_COMPATIBLE_KINDS = new Set<BuildingKind>([
  'path',
  'fence',
  'bench',
  'lighting',
  'lightBalloon',
  'securityGate',
  'busStop',
  'wasteBin', ...THEMED_BIN_KINDS,
])

function createBlankSnapshot(
  scenario: ScenarioSettings = createDefaultScenarioSettings(),
): GameSnapshot {
  const settings = normalizeScenarioSettings(scenario)
  const entrance = createScenarioEntrance(settings.worldSize)
  return {
    festival: createFestivalManagement(),
    version: 29,
    simTick: 0,
    rngState: hashStringSeed(
      `festival-${settings.worldSize}-${settings.startingMoney}`,
    ),
    money: settings.startingMoney,
    finance: createFinanceState(settings.startingLoan),
    scenarioProgress: createScenarioProgress(settings.goals),
    entryPrice: SIMULATION_CONFIG.economy.defaultEntryPrice,
    campingTicketPrice: SIMULATION_CONFIG.economy.defaultCampingTicketPrice,
    parkOpen: true,
    guests: 0,
    reputation: SIMULATION_CONFIG.economy.startingReputation,
    day: 1,
    minute: SIMULATION_CONFIG.time.startMinute,
    speed: 1,
    selectedTool: 'inspect',
    buildElevation: 0,
    buildRotation: 0,
    buildings: [
      {
        id: ENTRANCE_PATH_ID,
        kind: 'path',
        x: entrance.x,
        z: entrance.z,
        rotation: 0,
        elevation: 0,
        pathType: 'normal',
        pathSlope: 0,
        pathSlopeDirection: 0,
        price: 0,
      },
    ],
    campingCells: [],
    campInstallations: [],
    visitors: [],
    coasters: [],
    cashEffects: [],
    fireworkEffects: [],
    crowding: { average: 0, maximum: 0, cells: [] },
    staff: [],
    medicalCells: [],
    wasteDumpCells: [],
    incidents: [],
    stageForecourtCells: [],
    backstageCells: [],
    bandActors: [],
    bandSupply: emptyBandSupplySnapshot(),
    attractiveness: { average: 0, maximum: 0, minimum: 0, cells: [] },
    partyMood: { average: 0, maximum: 0, minimum: 0, cells: [] },
    dayPlan: createDefaultDayPlan(),
    complaints: createComplaintSnapshot(),
    logistics: createDefaultLogisticsSnapshot(),
    accessControls: createAccessControlSnapshot(),
    scenario: settings,
    terrain: createEmptyTerrain(),
    power: createEmptyPower(),
  }
}

function createInitialSnapshot(
  scenario: ScenarioSettings = createDefaultScenarioSettings(),
): GameSnapshot {
  const snapshot = createBlankSnapshot(scenario)
  snapshot.parkOpen = false
  snapshot.festival.planning = true
  snapshot.festival.tickets = {day:150,camping:0,usedDay:{},usedCamping:0}
  const entrance = createScenarioEntrance(snapshot.scenario.worldSize)
  const rng = new DeterministicRng(snapshot.rngState)
  snapshot.terrain = generateTerrain(snapshot.scenario.worldSize, rng, snapshot.scenario.unevenness, snapshot.scenario.environment)
  snapshot.buildings.push(
    ...scatterWildTrees(
      snapshot.terrain,
      snapshot.scenario.worldSize,
      [entrance, createScenarioRoadEntry(snapshot.scenario.worldSize)],
      rng,
      snapshot.scenario.environment,
    ),
  )
  snapshot.rngState = rng.getState()
  return snapshot
}

export class GameState {
  private concertToplessVisitorId: string | null = null
  private state: GameSnapshot
  private listeners = new Set<Listener>()
  private idCounter = 0
  private simulatedMinutes = 0
  private spawnMinutes = 0
  private uiRefreshSeconds = 0
  private crowdingMinutes = 0
  private camping: CampingSystem
  private fireworks = new FireworksSystem()
  private crowding = new CrowdingSystem()
  private crowdingCosts = new Map<string, number>()
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
  private visitorWasteBinTick = -1
  private visitorWasteBinBuildings: PlacedBuilding[] = []
  private indexedForecourtRef: readonly StageForecourtCell[] | null = null
  private terrainHeights: Int8Array | null = null
  private cachedWorldSize = 0
  private cachedWorldHalf = 0
  private crowdingCostPacked = new Map<number, number>()
  private attractivenessPacked = new Map<number, number>()
  private readonly neighborScratch: Cell[] = []
  private readonly neighborSeen = new Set<number>()
  private readonly pedestrianPathScratch = createPathScratch<Cell>()
  private readonly sweeperPathScratch = createPathScratch<Cell>()
  private readonly pedestrianPathCache = new Map<string, { path: readonly Cell[] | null; expires: number }>()
  private pedestrianNav = new Map<number, PedestrianNavNode>()
  private pedestrianNavKey = ''
  private accessSignalRevision = 0
  private accessEmergency = false
  private closedTrafficEdges = new Set<string>()
  private closedPathEdges = new Set<string>()
  private visitorIndex = new Map<string, Visitor>()
  private facilityQueues = new Map<string, string[]>()
  private indexedVisitorCount = -1
  private occupancyTick = -1
  private activityHeadcount = new Map<string, number>()
  private activitySlotBits = new Map<string, number>()
  private benchHeadcount = new Map<string, number>()
  private benchSlotBits = new Map<string, number>()
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
  private readonly roadExitRoutes = new WeakMap<RoadGraph, Map<string,
    { position: RoadPosition; route: RoadCell[] } | null>>()
  private visitorsAwaitingDecision = new Set<string>()
  /** Guests walking a stall return lane; full speed, then an immediate next goal. */
  private stallQueueReturnIds = new Set<string>()
  private processingSimulationStep = false
  private decisionBudget = 0
  private decidedThisTick = new Set<string>()
  private activeVisitorDecision: string | null = null
  private pendingVisitorRouting = new Map<string, 'departure' | 'exit' | 'waste'>()
  private concertChoiceKey = ''
  private concertChoices:Array<{booking:Booking;band:(typeof BANDS)[number];stage:GameSnapshot['buildings'][number]}>=[]
  private concertSlotTick = -1
  private concertSlots = new Map<number, Set<number>>()
  private concertForecourtByStage = new Map<string, StageForecourtCell[]>()
  private concertForecourtStageIds = new Map<number, string>()
  private danceFloorFocusByStage = new Map<string, { x: number; z: number }>()
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
  private claimedTentCellsCache: Set<string> | null = null
  private visitorsOnCellsThisTick: Set<string> | null = null

  constructor(snapshot?: GameSnapshot) {
    this.state = snapshot
      ? structuredClone(snapshot)
      : createInitialSnapshot()
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
    this.state.simTick ??= 0
    this.state.rngState ??= hashStringSeed('festival')
    this.rng.setState(this.state.rngState)
    this.state.entryPrice ??= SIMULATION_CONFIG.economy.defaultEntryPrice
    this.state.campingTicketPrice ??=
      this.state.entryPrice ?? SIMULATION_CONFIG.economy.defaultCampingTicketPrice
    this.state.parkOpen ??= true
    this.state.campingCells ??= []
    this.state.campInstallations ??= []
    this.state.campInstallations.forEach((installation) => {
      installation.decay ??= 0
      installation.contributorIds ??= installation.ownerId ? [installation.ownerId] : []
    })
    this.state.staff ??= []
    this.state.medicalCells ??= []
    this.state.wasteDumpCells = (this.state.wasteDumpCells ?? []).map((cell) =>
      clampWasteDumpStored({ ...cell }),
    )
    this.state.incidents ??= []
    this.state.incidents = this.mergeIncidentStacks(this.state.incidents)
    this.state.stageForecourtCells ??= []
    this.state.backstageCells = (this.state.backstageCells ?? [])
      .map(normalizeBackstageCell)
      .filter((cell): cell is BackstageCell => cell !== null)
    this.state.bandActors = (this.state.bandActors ?? [])
      .map(normalizeBandActor)
      .filter((actor): actor is BandActor => actor !== null)
    this.state.bandSupply ??= emptyBandSupplySnapshot()
    this.state.version = 29
    syncStageAudience(this.state)
    this.state.attractiveness ??= {
      average: 0,
      maximum: 0,
      minimum: 0,
      cells: [],
    }
    this.state.partyMood ??= {
      average: 0,
      maximum: 0,
      minimum: 0,
      cells: [],
    }
    this.state.dayPlan = normalizeDayPlan(this.state.dayPlan)
    this.state.complaints = normalizeComplaintSnapshot(
      this.state.complaints,
    )
    this.state.logistics = normalizeLogisticsSnapshot(
      this.state.logistics,
    )
    this.state.logistics.wasteDepots ??= []
    this.state.logistics.specialDepots ??= []
    this.state.accessControls = normalizeAccessControls(this.state.accessControls)
    this.state.finance ??= createFinanceState()
    this.state.finance.periods ??= []
    this.state.finance.today ??= {}
    this.state.finance.previousDay ??= {}
    this.state.scenarioProgress ??= createScenarioProgress(this.state.scenario.goals)
    this.state.terrain = normalizeTerrain(this.state.terrain)
    this.state.power = normalizePower(this.state.power)
    this.rebuildTerrainCache()
    this.state.coasters ??= []
    this.state.cashEffects = []
    this.state.fireworkEffects = []
    this.state.crowding = { average: 0, maximum: 0, cells: [] }
    this.state.coasters.forEach((coaster) => {
      coaster.typeId = resolveCoasterTypeId(coaster.typeId)
      const type = getCoasterType(coaster.typeId)
      const track = sampleCoasterTrack(coaster, 0)
      coaster.train.distance ??= (coaster.train.progress ?? 0) * (track?.totalLength ?? 0)
      coaster.train.speed ??= 0
      coaster.train.passengerIds ??= []
      coaster.train.passengers = coaster.train.passengerIds.length
      coaster.queue ??= []
      coaster.operationMode ??= 'closed'
      coaster.ticketPrice ??= type.defaultTicketPrice
      coaster.pieces.forEach((piece) => migrateTrackPiece(piece))
      this.recalculateCoasterTrackState(coaster)
      coaster.telemetry ??= createCoasterTelemetry()
      coaster.telemetry.samples = Array.isArray(coaster.telemetry.samples)
        ? coaster.telemetry.samples
        : []
      coaster.telemetry.durationSeconds ??= 0
      coaster.telemetry.airtimeSeconds ??= 0
      coaster.telemetry.maxSpeedKmh ??= 0
      coaster.telemetry.minVerticalG =
        typeof coaster.telemetry.minVerticalG === 'number' &&
        Number.isFinite(coaster.telemetry.minVerticalG)
          ? coaster.telemetry.minVerticalG
          : Number.POSITIVE_INFINITY
      coaster.telemetry.maxVerticalG =
        typeof coaster.telemetry.maxVerticalG === 'number' &&
        Number.isFinite(coaster.telemetry.maxVerticalG)
          ? coaster.telemetry.maxVerticalG
          : Number.NEGATIVE_INFINITY
      coaster.telemetry.maxAbsLateralG ??= 0
      coaster.telemetry.maxAbsLongitudinalG ??= 0
      coaster.telemetry.completedRuns ??= 0
      coaster.telemetry.measuring ??= false
      coaster.telemetry.cumulativeDistanceMeters ??= 0
    })
    this.state.buildElevation ??= 0
    this.state.buildRotation ??= 0
    this.state.buildings = this.state.buildings.filter((building) =>
      (BUILDING_KINDS as readonly string[]).includes(building.kind),
    )
    this.state.buildings.forEach((building) => {
      building.elevation ??= 0
      building.price ??= BUILDINGS[building.kind].defaultPrice
      if (building.kind === 'path') {
        building.pathType ??= 'normal'
        building.queueDirection ??= building.rotation
        building.queueEntryDirection ??= undefined
        building.queueSplit ??= false
        building.pathSlope = snapWayElevation(building.pathSlope ?? 0)
        building.pathSlopeDirection ??= building.rotation
        building.elevation = snapWayElevation(building.elevation)
        building.flowDirection ??= null
        if (building.staffOnly) {
          const direction = normalizeStaffGateDirection(building.staffGateDirection)
          if (direction === undefined) delete building.staffGateDirection
          else building.staffGateDirection = direction
        } else if (building.staffGateDirection !== undefined) {
          delete building.staffGateDirection
        }
      }
      if (building.kind === 'securityGate') {
        building.securityConfig ??= structuredClone(DEFAULT_SECURITY_CONFIG)
        building.securityConfig.flowShare ??= DEFAULT_SECURITY_CONFIG.flowShare
      }
      if (building.kind === 'stage') {
        building.bandName ??=
          BAND_NAMES[Math.abs(building.x + building.z) % BAND_NAMES.length]
      }
      if (isWasteBin(building.kind)) {
        building.wasteFill ??= 0
      }
      if (building.kind === 'shirt') {
        const fallback = defaultShirtSettings()
        building.shirtColor = normalizeShirtColor(building.shirtColor ?? fallback.color)
        building.shirtStyle = normalizeShirtStyle(building.shirtStyle ?? fallback.style)
      }
    })
    if (this.state.campInstallations.length === 0) {
      const legacyVisitors = this.state.visitors as Array<
        Visitor & { campSetup?: Array<{ cell: Cell; kind: CampSetupKind }> }
      >
      legacyVisitors.forEach((visitor) => {
        visitor.campSetup?.forEach((setup, index) => {
          const sharedChairs = this.state.campInstallations.find(
            (installation) =>
              installation.kind === 'chairs' &&
              installation.cell.x === setup.cell.x &&
              installation.cell.z === setup.cell.z,
          )
          if (sharedChairs) {
            if (!sharedChairs.contributorIds.includes(visitor.id)) {
              sharedChairs.contributorIds.push(visitor.id)
            }
            return
          }
          this.state.campInstallations.push({
            id: `legacy-camp-installation-${visitor.id}-${index}`,
            cell: { ...setup.cell },
            kind: setup.kind,
            ownerId: visitor.id,
            contributorIds: [visitor.id],
          })
        })
      })
    }
    this.state.visitors.forEach((visitor) => {
      visitor.y ??= this.getAt(visitor.cellX, visitor.cellZ)?.elevation ?? 0
      visitor.cellElevation ??= visitor.y
      visitor.walkSpeed ??=
        SIMULATION_CONFIG.visitors.walkSpeedMinimum +
        this.rng.next() * SIMULATION_CONFIG.visitors.walkSpeedRandomRange
      visitor.movementBoostMinutes ??= 0
      visitor.avoidedCoasterId ??= null
      visitor.avoidanceMinutes ??= 0
      visitor.facing ??= 0
      visitor.emotion ??= 'neutral'
      visitor.emotionMinutes ??= 0
      visitor.budget ??= SIMULATION_CONFIG.visitors.budget
      visitor.alcoholLevel ??= 0
      visitor.alcoholDisposition ??=
        this.rng.next() < SIMULATION_CONFIG.visitors.aggressiveProbability
          ? 'aggressive'
          : 'calm'
      visitor.alcoholDesire ??= 25 + this.rng.next() * 60
      visitor.campsite ??= null
      if ((visitor.campingPhase as string | undefined) === 'socializing') {
        visitor.state = 'socializing'
        visitor.campingPhase = visitor.campsite ? 'ready' : 'none'
      }
      visitor.campingPhase ??= visitor.campsite ? 'ready' : 'none'
      visitor.hasHandcart ??=
        visitor.campingPhase === 'seeking' ||
        visitor.campingPhase === 'building' ||
        visitor.campingPhase === 'packing'
      visitor.inventory = visitor.inventory
        ? normalizeInventory(visitor.inventory, Boolean(visitor.campsite))
        : normalizeInventory(createFestivalInventory(this.rng), Boolean(visitor.campsite))
      visitor.motivation ??= 100
      visitor.crowding ??= 0
      visitor.crowdStress ??= 0
      visitor.isPanicking ??= false
      visitor.panicRecoverMinutes ??= 0
      visitor.tileOffsetX ??= 0.1 + this.rng.next() * 0.8
      visitor.tileOffsetZ ??= 0.1 + this.rng.next() * 0.8
      visitor.campActivityTarget ??= null
      visitor.campActivity ??= 'standing'
      visitor.campActivityKind ??= null
      visitor.campActivitySlot ??= 0
      visitor.campActivityCapacity ??= 1
      visitor.nausea ??= 0
      visitor.nauseaCooldown ??= 0
      visitor.medicalCell ??= null
      visitor.medicalSlot ??= null
      visitor.securityGateId ??= null
      visitor.securityResumeState ??= null
      visitor.beautyPreference ??=
        SIMULATION_CONFIG.atmosphere.preferenceMinimum +
        this.rng.next() * SIMULATION_CONFIG.atmosphere.preferenceRandomRange
      visitor.partyPreference ??=
        SIMULATION_CONFIG.atmosphere.preferenceMinimum +
        this.rng.next() * SIMULATION_CONFIG.atmosphere.preferenceRandomRange
      visitor.localAttractiveness ??= 0
      visitor.localPartyMood ??= 0
      visitor.activityTarget ??= null
      visitor.activitySlot ??= 0
      visitor.activityCapacity ??= 1
      visitor.isDancing ??= false
      this.restoreVisitorSleepRhythm(visitor)
      visitor.ticketType ??=
        getItemQuantity(visitor.inventory, 'tent') > 0
          ? 'camping'
          : 'day'
      visitor.consumptionCooldown ??= 0
      visitor.isConversing ??= false
      visitor.campingWaitMinutes ??= 0
      visitor.campingWaitRetryMinutes ??= 0
      visitor.entryFeePaid ??= this.state.entryPrice
      visitor.complaintsFiled ??= []
      visitor.arrivalGroupId ??= null
      visitor.arrivalMode ??= 'pedestrian'
      visitor.injuryVehicleId ??= null
      visitor.rescueVehicleId ??= null
      visitor.busWaitMinutes ??= 0
      visitor.busLineId ??= null
      visitor.busDestination ??= null
      visitor.busDestinationStopId ??= null
      visitor.busResumeState ??= null
      visitor.busResumeTargetId ??= null
      visitor.walkingToCampDistance ??= 0
      visitor.pendingWaste ??= 0
      visitor.streakingMinutes ??= 0
      visitor.streakingCooldownMinutes ??= 0
      visitor.toplessMinutes ??= 0
      visitor.bungeeNude ??= false
      visitor.ownedMascot = Boolean(visitor.ownedMascot)
      visitor.heldMascot = Boolean(visitor.heldMascot)
      visitor.wornShirt = normalizeWornShirt(visitor.wornShirt)
      visitor.pathSeed ??= hashStringSeed(visitor.id)
      const given = visitor.name.split(' ')[0] ?? ''
      const female = visitorLooksFemale(visitor.id)
      if (
        (female && !FEMALE_VISITOR_NAMES.includes(given)) ||
        (!female && !MALE_VISITOR_NAMES.includes(given))
      ) {
        const suffix = visitor.name.split(' ').slice(1).join(' ')
        visitor.name = `${visitorGivenName(visitor.id)} ${suffix}`.trim()
      }
      visitor.wanderNonce ??= 0
      visitor.route = visitor.route.map((cell) => ({
        ...cell,
        elevation:
          cell.elevation ?? this.getPathAt(cell.x, cell.z)?.elevation ?? visitor.cellElevation,
      }))
    })
    this.state.staff.forEach((member) => {
      member.route ??= []
      member.targetId ??= null
      member.assignedBuildingId ??= null
      member.medicalCell ??= null
      member.medicalSlot ??= null
      member.workMinutes ??= 0
      member.carryingWaste ??= 0
    })
    this.repairDesignatedOccupancyReservations()
    this.ensureEntrancePath()
    this.ensureRoadIngress()
    this.migrateWayElevations()
    this.migrateLegacyBusStopsToRoadside()
    this.recalculateQueueDirections()
    this.refreshPower()
    this.refreshBandSupplyGraph()
    this.state.guests = this.state.visitors.length
    this.idCounter =
      this.state.buildings.length +
      this.state.visitors.length +
      this.state.campInstallations.length +
      this.state.accessControls.trafficLights.length +
      this.state.accessControls.pathBarriers.length +
      this.state.coasters.reduce((total, coaster) => total + coaster.pieces.length + 1, 0)
    this.evaluateAccessSignals()
  }

  static startNew(settings: ScenarioSettings): GameState {
    return new GameState(createInitialSnapshot(settings))
  }

  get snapshot(): Readonly<GameSnapshot> {
    return this.state
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
    if (this.networkMode === 'client' && this.isOptimisticConstruction(command)) {
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

  private isOptimisticConstruction(command: GameCommand): boolean {
    if (command.type === 'festival') {
      return ['ground', 'groundArea', 'depot', 'removeDepot', 'staffGate', 'wayArea', 'stageDesign'].includes(command.action.type)
    }
    return [
      'place', 'placeBungee', 'setBungeeHeight', 'placeSceneryLine', 'placePath', 'undoPath', 'placeRoad', 'undoRoad', 'bulldoze', 'bulldozeArea', 'editTerrain',
      'designateRoad', 'designateParking', 'designateCampingCell',
      'designateCampingArea', 'designateMedicalArea', 'designateWasteDump',
      'designateStageForecourt', 'designateBackstageArea', 'designatePowerCable', 'designatePowerCableArea',
      'setRoadDirection', 'toggleRoadSeparator', 'toggleCrosswalk', 'setRoadSpeed',
      'placeTrafficLight', 'placePathBarrier', 'configureAccessControl',
      'toggleAccessControlArea', 'clearAccessControlArea',
      'setPathFlow', 'startCoaster', 'appendCoasterPiece', 'undoCoasterPiece',
      'deleteCoasterPiece', 'removeCoaster', 'setCoasterAccess', 'setRideAccess',
    ].includes(command.type)
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
    if (action.type === 'depot' && (this.getRideAccessAt(action.x, action.z) || this.isLogisticsBuildingCell(action.x, action.z) || this.coasterOccupiesVolume(action.x, action.z, this.getTerrainHeight(action.x, action.z), 1))) return { ok: false, message: 'Diese Fläche ist bereits bebaut' }
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
    return heights[(iz * size + ix) | 0]!
  }

  isWaterTerrain(x: number, z: number): boolean {
    return isWaterHeight(this.getTerrainHeight(x, z))
  }

  isMudTerrain(x: number, z: number): boolean {
    return isMudHeight(this.getTerrainHeight(x, z))
  }

  editTerrain(x: number, z: number, mode: TerrainEditMode): ActionResult {
    const planned = planTerrainEdit(
      this.state.terrain,
      this.getWorldSize(),
      x,
      z,
      mode,
      (cellX, cellZ) => this.isTerrainProtected(cellX, cellZ),
    )
    if (!planned.ok) return planned
    const cost = planned.changes.length * SIMULATION_CONFIG.terrain.editCost
    if (this.state.money < cost) {
      return {
        ok: false,
        message: `Nicht genug Geld (${cost} € für ${planned.changes.length} Felder)`,
      }
    }
    bookFinance(this.state, 'landscaping', -cost)
    applyTerrainChanges(this.state.terrain, planned.changes)
    for (const c of planned.changes) delete this.state.festival.infrastructure.ground[groundKey(c.x, c.z)]
    this.terrainHeights = null
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
      mode === 'raise' ? 'erhöht' : mode === 'lower' ? 'abgesenkt' : 'eingeebnet'
    return {
      ok: true,
      message: `Gelände ${verb} (${planned.changes.length} Feld${
        planned.changes.length === 1 ? '' : 'er'
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
    this.pendingVisitorRouting.set(visitor.id, 'departure')
    this.visitorsAwaitingDecision.add(visitor.id)
    this.clearVisitorForDeparture(visitor)
    visitor.state = 'leaving'
    visitor.route = []
    visitor.targetId = null
  }

  private planVisitorDeparture(visitor: Visitor): void {
    if ((visitor.pendingWaste ?? 0) > 0 && visitor.campingPhase !== 'packing') {
      this.tryDisposeWaste(visitor)
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
    this.clearVisitorActivity(visitor)
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
    if (this.pendingVisitorRouting.get(visitor.id) === 'departure' ||
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
      (x, z) =>
        this.isInWorld(x, z) &&
        !this.isWaterTerrain(x, z) &&
        (!this.getAt(x, z) || this.getAt(x, z)?.kind === 'tree') &&
        !this.getCampingCellAt(x, z) &&
        !this.getWasteDumpAt(x, z) &&
        !this.getCoasterAt(x, z),
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
    this.pedestrianNav.clear()
    this.pedestrianNavKey = ''
    this.pedestrianPathCache.clear()
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

  private hasLiveMedicalOccupancy(x: number, z: number): boolean {
    const medical = this.state.medicalCells.find(
      (cell) => cell.x === x && cell.z === z,
    )
    return Boolean(
      medical?.occupants.some((occupant) => occupant && this.getVisitor(occupant)),
    )
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
        this.decideNextAction(visitor)
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

  private clearDesignatedOccupancyAt(
    x: number,
    z: number,
    evict: boolean,
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
      (x, z) =>
        this.isInWorld(x, z) &&
        !this.isWaterTerrain(x, z) &&
        (!this.getAt(x, z) || this.getAt(x, z)?.kind === 'tree') &&
        !this.getCampingCellAt(x, z) &&
        !this.getMedicalCellAt(x, z) &&
        !this.getStageForecourtCellAt(x, z) &&
        !this.getWasteDumpAt(x, z) &&
        !this.getRoadCellAt(x, z) &&
        !this.hasParkingAt(x, z) &&
        !this.getCoasterAt(x, z),
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
      (x, z) =>
        this.isInWorld(x, z) &&
        !this.isWaterTerrain(x, z) &&
        !this.getCampingCellAt(x, z) &&
        !this.getMedicalCellAt(x, z) &&
        !this.getWasteDumpAt(x, z) &&
        !this.getStageForecourtCellAt(x, z),
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
      this.pedestrianPathCache.clear()
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
      if (current) this.decideNextAction(current)
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

  startCoaster(typeId: CoasterTypeId, x: number, z: number): ActionResult & { id?: string } {
    const type = getCoasterType(typeId)
    typeId = type.id
    const piece = createTrackPiece(
      this.nextId('track'),
      'station',
      {
        x,
        z,
        elevation: this.getPlaceElevation(x, z),
        heading: this.state.buildRotation,
        pitch: 0,
        bank: 0,
      },
      false,
    )
    if (!this.canBuildTrackPiece(piece)) {
      return { ok: false, message: 'Für die Startplattform ist nicht genug Platz' }
    }
    if (this.state.money < TRACK_PIECES.station.cost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }

    const id = this.nextId('coaster')
    bookFinance(this.state, 'construction', -TRACK_PIECES.station.cost)
    this.state.coasters.push({
      id,
      typeId,
      name: `${type.name} ${this.state.coasters.length + 1}`,
      pieces: [piece],
      entrance: null,
      exit: null,
      settings: {
        dispatchMode: 'full-or-timed',
        dispatchIntervalMinutes:
          SIMULATION_CONFIG.coasters.defaultDispatchIntervalMinutes,
      },
      operationMode: 'closed',
      ticketPrice: type.defaultTicketPrice,
      train: {
        state: 'boarding',
        cars: 1,
        passengers: 0,
        passengerIds: [],
        capacity: type.carCapacity,
        waitMinutes: 0,
        boardingProgress: 0,
        progress: 0,
        distance: 0,
        speed: 0,
        x,
        y: this.state.buildElevation,
        z,
      },
      telemetry: createCoasterTelemetry(),
      queue: [],
      closed: false,
    })
    this.emit()
    return { ok: true, message: 'Startplattform gebaut', id }
  }

  appendCoasterPiece(
    coasterId: string,
    kind: TrackPieceKind,
    chainLift: boolean,
    afterPieceIndex?: number,
    options: TrackBuildOptions = {},
  ): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
    const anchorIndex = Math.max(
      0,
      Math.min(coaster.pieces.length - 1, afterPieceIndex ?? coaster.pieces.length - 1),
    )
    const anchorPiece = coaster.pieces[anchorIndex]
    if (!anchorPiece) return { ok: false, message: 'Startplattform fehlt' }
    const appendIssue = describeTrackAppendIssue(anchorPiece.end, kind, options, coaster.typeId)
    if (appendIssue) return { ok: false, message: appendIssue }
    if (chainLift && !isTrackChainLiftEligible(kind, anchorPiece.end.pitch, options.targetPitch ?? anchorPiece.end.pitch, coaster.typeId)) {
      chainLift = false
    }
    const piece = createTrackPiece(
      this.nextId('track'),
      kind,
      anchorPiece.end,
      chainLift,
      options,
    )
    if (
      piece.points.some(
        (point) => point.y < 0 || point.y > 10 || !this.isInWorld(point.x, point.z),
      )
    ) {
      return { ok: false, message: 'Das Schienenelement liegt außerhalb des Baubereichs' }
    }
    if (
      !this.canBuildTrackPiece(piece, {
        coasterId: coaster.id,
        attachPieceIndex: anchorIndex,
      })
    ) {
      return { ok: false, message: 'Das Schienenelement kollidiert mit einem Bauwerk' }
    }
    const cost =
      TRACK_PIECES[kind].cost +
      (piece.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0)
    if (this.state.money < cost) return { ok: false, message: 'Nicht genug Geld' }

    bookFinance(this.state, 'construction', -cost)
    coaster.pieces.splice(anchorIndex + 1, 0, piece)
    const stations = coaster.pieces.filter((item) => item.kind === 'station').length
    coaster.train.cars = stations
    coaster.train.capacity = stations * getCoasterType(coaster.typeId).carCapacity
    this.recalculateCoasterTrackState(coaster)
    coaster.telemetry = createCoasterTelemetry()
    coaster.operationMode = 'closed'
    this.recallCoasterTrainInternal(coaster)
    this.emit()
    return {
      ok: true,
      message: coaster.closed
        ? `${TRACK_PIECES[kind].name} gebaut – Strecke geschlossen`
        : piece.chainLift
          ? `${TRACK_PIECES[kind].name} mit Kettenzug gebaut`
          : `${TRACK_PIECES[kind].name} gebaut`,
    }
  }

  undoCoasterPiece(coasterId: string): ActionResult {
    const coaster = this.getCoaster(coasterId)
    if (!coaster || coaster.pieces.length <= 1) {
      return { ok: false, message: 'Die Startplattform kann nicht entfernt werden' }
    }
    const piece = coaster.pieces.pop()
    if (!piece) return { ok: false, message: 'Kein Element vorhanden' }
    bookFinance(this.state, 'construction', TRACK_PIECES[piece.kind].cost + (piece.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0))
    this.recalculateCoasterTrackState(coaster)
    coaster.telemetry = createCoasterTelemetry()
    coaster.operationMode = 'closed'
    const stations = coaster.pieces.filter((item) => item.kind === 'station').length
    coaster.train.cars = stations
    coaster.train.capacity = stations * getCoasterType(coaster.typeId).carCapacity
    this.recallCoasterTrainInternal(coaster)
    this.emit()
    return { ok: true, message: 'Letztes Schienenelement entfernt' }
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
    this.enforceDayPlan()
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
    this.enforceDayPlan()
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
    if (!Number.isInteger(height) || height < 4 || height > 200) return { ok: false, message: 'Turmhöhe: 4 bis 200 Meter in Meterschritten' }
    const elevation = this.getPlaceElevation(x, z)
    const top = height / 4 + .4
    if (this.coasterOccupiesVolume(x, z, elevation, top) || this.state.buildings.some(b => b.x === x && b.z === z && this.volumesOverlap(b, elevation, top))) return { ok: false, message: 'Über der Turmfläche muss Platz frei bleiben' }
    if (this.state.money < BUILDINGS.ride.cost + height * 25) return { ok: false, message: 'Nicht genug Geld für diese Turmhöhe' }
    const result = this.place('ride', x, z)
    if (!result.ok) return result
    const tower = this.state.buildings.at(-1)!
    tower.rideType = 'bungee'; tower.bungeeHeight = height
    bookFinance(this.state, 'construction', -(height * 25))
    this.emit()
    return { ok: true, message: `Bungee-Turm (${height} m) gebaut` }
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
    for (const b of this.state.buildings) if (isWasteBin(b.kind)) b.wasteFill = 0
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

  placeRoadSegment(
    x: number,
    z: number,
    elevation: number,
    slope = 0,
    slopeDirection = 0,
    wayType?: WayType,
  ): ActionResult {
    if (wayType && WAY_TYPES[wayType]?.mode !== 'road') {
      return { ok: false, message: 'Gültigen Straßenbelag wählen' }
    }
    if (!this.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    const terrain = this.getTerrainHeight(x, z)
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
    if (this.isWaterTerrain(x, z) && elevation <= WATER_HEIGHT) {
      return { ok: false, message: 'Im Wasser kann keine Straße gebaut werden' }
    }
    if (this.getRideAccessAt(x, z) || this.isLogisticsBuildingCell(x, z) || this.getCampingCellAt(x, z) || this.getMedicalCellAt(x, z) || this.getStageForecourtCellAt(x, z)) {
      return { ok: false, message: 'Hier konnte keine Straße gebaut werden' }
    }
    const candidateBase = Math.min(elevation, rampStart)
    const candidateTop = Math.max(elevation, rampStart) + 0.28
    if (
      this.state.buildings.some((building) => {
        if (!occupiesBuildingCell(building, x, z) || building.kind === 'tree') return false
        const bounds = this.getBuildingVerticalBounds(building)
        return bounds.base < candidateTop && candidateBase < bounds.top
      }) ||
      this.coasterOccupiesVolume(x, z, candidateBase, candidateTop - candidateBase)
    ) {
      return { ok: false, message: 'Auf dieser Höhe ist nicht genug Platz' }
    }
    const offsets = DIRECTION_OFFSETS[direction]
    const layersHere = this.getRoadCellsAt(x, z)
    const existing = layersHere.find((layer) =>
      wayOverlapsRoadGrade(elevation, slope, layer.elevation ?? terrain),
    )
    const hasLowerRoad = layersHere.some(
      (layer) => (layer.elevation ?? terrain) + WAY_LEVEL_MATCH < Math.min(elevation, rampStart),
    )
    if (slope !== 0) {
      const previous = this.getRoadCellsAt(x - offsets.x, z - offsets.z).find((layer) =>
        elevationsMatch(layer.elevation ?? this.getTerrainHeight(layer.x, layer.z), rampStart),
      )
      if (!previous && !existing) {
        return { ok: false, message: 'Eine Rampe muss an eine bestehende Straße anschließen' }
      }
    } else if (!this.isAtTerrainLevel(x, z, elevation)) {
      const hasNeighbor = DIRECTIONS.some((neighborDirection) => {
        const offset = DIRECTION_OFFSETS[neighborDirection]
        return this.getRoadCellsAt(x + offset.x, z + offset.z).some((neighbor) =>
          elevationsMatch(
            neighbor.elevation ?? this.getTerrainHeight(neighbor.x, neighbor.z),
            elevation,
          ),
        )
      })
      if (!hasNeighbor && !existing && !hasLowerRoad) {
        return { ok: false, message: 'Eine erhöhte Straße muss anschließen' }
      }
    }
    if (wayType && elevation <= terrain) {
      const issue = wayIssue(this.state, x, z, wayType)
      if (issue) return { ok: false, message: issue }
    }
    const clearCost = this.getTreeClearCost(x, z, candidateBase, candidateTop - candidateBase)
    const roadCost = wayType ? WAY_TYPES[wayType].cost : SIMULATION_CONFIG.logistics.roadBuildCost
    const extra = existing && wayType ? Math.max(0, roadCost - SIMULATION_CONFIG.logistics.roadBuildCost) : existing ? 0 : roadCost
    if (this.state.money < extra + clearCost) return { ok: false, message: 'Nicht genug Geld' }
    this.clearTreesAt(x, z, candidateBase, candidateTop - candidateBase)
    if (extra) bookFinance(this.state, 'construction', -extra)
    const crossingPath = this.state.buildings.find((building) => {
      if (building.kind !== 'path' || building.x !== x || building.z !== z) return false
      return wayOverlapsRoadGrade(building.elevation, building.pathSlope ?? 0, elevation)
    })
    if (existing) {
      existing.roadSlope = slope
      existing.roadSlopeDirection = direction
      if (wayType) existing.speedLimit = WAY_TYPES[wayType].limit as SpeedLimit
      if (crossingPath) existing.crosswalk = true
    } else {
      this.state.logistics.roadCells.push({
        x,
        z,
        allowedDirections: null,
        blockedEdges: 0,
        speedLimit: wayType ? (WAY_TYPES[wayType].limit as SpeedLimit) : SIMULATION_CONFIG.logistics.defaultSpeedLimit,
        crosswalk: Boolean(crossingPath),
        elevation,
        roadSlope: slope,
        roadSlopeDirection: direction,
      })
    }
    if (wayType) {
      const cell = this.state.festival.infrastructure.ground[groundKey(x, z)] ??= {}
      cell.roadway = wayType
    }
    this.invalidateRoadGraph()
    this.emit()
    return {
      ok: true,
      message:
        existing
          ? 'Straße aktualisiert'
          : hasLowerRoad
            ? 'Straße über die Autostraße gebaut'
          : slope === 0
            ? `Straße auf Ebene ${elevation} gebaut`
            : `${slope > 0 ? 'Aufwärts-' : 'Abwärts-'}Rampe gebaut`,
    }
  }

  undoRoadSegment(x: number, z: number, previousRoad?: RoadCell, elevation?: number): ActionResult {
    const layerElevation = previousRoad
      ? roadLayerElevation(previousRoad, this.getTerrainHeight(x, z))
      : elevation
    const road = this.getRoadCellAt(x, z, layerElevation)
    if (!road) return { ok: false, message: 'Dieses Straßenstück kann nicht zurückgenommen werden' }
    if (previousRoad) {
      Object.assign(road, structuredClone(previousRoad))
    } else {
      this.state.logistics.roadCells = this.state.logistics.roadCells.filter(
        (cell) => cell !== road,
      )
      bookFinance(this.state, 'construction', SIMULATION_CONFIG.logistics.roadBuildCost)
    }
    this.invalidateRoadGraph()
    this.emit()
    return { ok: true, message: previousRoad ? 'Vorheriges Straßenfeld' : 'Straße zurückgenommen' }
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
    this.enforceDayPlan()
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
    const offer = this.getBuildingDayPlanOffer(building.kind)
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
    const coaster = this.getCoaster(coasterId)
    if (!coaster) return { ok: false, message: 'Achterbahn nicht gefunden' }
    if (pieceIndex <= 0 || pieceIndex >= coaster.pieces.length) {
      return { ok: false, message: 'Die erste Startplattform kann nicht gelöscht werden' }
    }
    const removed = coaster.pieces.splice(pieceIndex, 1)[0]
    if (!removed) return { ok: false, message: 'Schienenelement nicht gefunden' }
    const refund =
      TRACK_PIECES[removed.kind].cost +
      (removed.chainLift ? SIMULATION_CONFIG.economy.chainLiftCost : 0)
    bookFinance(this.state, 'construction', refund)
    this.recalculateCoasterTrackState(coaster)
    coaster.telemetry = createCoasterTelemetry()
    coaster.operationMode = 'closed'
    const stations = coaster.pieces.filter((piece) => piece.kind === 'station').length
    coaster.train.cars = stations
    coaster.train.capacity = stations * getCoasterType(coaster.typeId).carCapacity
    this.recallCoasterTrainInternal(coaster)
    this.emit()
    return {
      ok: true,
      message: `${TRACK_PIECES[removed.kind].name} entfernt`,
    }
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

  canPlace(kind: BuildingKind, x: number, z: number, decorationSlot?: number): ActionResult {
    if (this.getRideAccessAt(x,z,this.getPlaceElevation(x,z))) return {ok:false,message:'Hier befindet sich ein Fahrgeschäft-Zugang'}
    if (isScenery(kind)) {
      decorationSlot ??= isLargeScenery(kind) ? 4 : isEdgeScenery(kind) ? this.state.buildRotation : 0
      if (!Number.isInteger(decorationSlot) || decorationSlot < 0 || decorationSlot > (isLargeScenery(kind) ? 4 : 3)) return { ok: false, message: 'Ungültige Dekoposition' }
    } else if (decorationSlot !== undefined) return { ok: false, message: 'Dieses Objekt benötigt ein ganzes Feld' }
    const selected = kind==='stage' ? this.state.festival.stageTemplates?.find(t=>t.name===this.state.festival.selectedStageTemplate) : undefined
    if(selected){const issue=this.checkStageSite(selected,x,z,this.state.buildRotation,this.getPlaceElevation(x,z));if(issue)return {ok:false,message:issue}}

    if (!this.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    if (this.state.festival.infrastructure.depots.some(d => d.x === x && d.z === z)) return { ok: false, message: 'Hier steht ein Warendepot' }
    if (kind === 'stage' && groundInfo(this.state, x, z).bearing < 2) return { ok: false, message: 'Bühnen brauchen tragfähigen Untergrund: zuerst verdichten' }
    if (kind === 'ride' && groundInfo(this.state, x, z).bearing < 3) return { ok: false, message: 'Große Fahrgeschäfte brauchen ein entwässertes, gepflastertes Fundament' }
    if (
      (this.getRoadCellAt(x, z) && kind !== 'path' && kind !== 'bench') ||
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
    if (
      this.hasLiveMedicalOccupancy(x, z) &&
      this.state.buildElevation < 1.2 &&
      kind !== 'fence'
    ) {
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
    if (this.isWaterTerrain(x, z) && placeElevation <= WATER_HEIGHT) {
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
    const furnitureRoad = kind === 'bench' && Boolean(this.getRoadCellAt(x, z, placeElevation))
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
        isWasteBin(kind)) &&
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

  place(kind: BuildingKind, x: number, z: number, decorationSlot?: number): ActionResult {
    if (isScenery(kind)) decorationSlot ??= isLargeScenery(kind) ? 4 : isEdgeScenery(kind) ? this.state.buildRotation : 0
    if (kind === 'ambulanceGarage') {
      return this.placeAmbulanceGarage(x, z)
    }
    if (kind === 'busDepot') return this.placeBusDepot(x, z)
    if (kind === 'wasteDepot') return this.placeWasteDepot(x, z)
    if (kind === 'specialDepot') return this.placeSpecialDepot(x, z)
    if (kind === 'busStop') return this.placeBusStop(x, z)
    const result = this.canPlace(kind, x, z, decorationSlot)
    if (!result.ok) return result
    this.clearDesignatedOccupancyAt(x, z, false)

    const placeElevation = this.getPlaceElevation(x, z)
    if (!isScenery(kind)) this.clearTreesAt(x, z, placeElevation, BUILDINGS[kind].height)
    const design = kind === 'stage' ? this.state.festival.stageTemplates?.find(t=>t.name===this.state.festival.selectedStageTemplate) : undefined
    bookFinance(this.state, 'construction', -(BUILDINGS[kind].cost + (design ? stageStats(design).cost : 0)))
    this.state.buildings.push({
      stageDesign: design ? structuredClone(design) : undefined,
      decorationSlot,
      id: this.nextId('building'),
      kind,
      x,
      z,
      rotation:
        kind === 'bench'
          ? (this.findBenchRotation(x, z) ?? this.state.buildRotation)
          : isWasteBin(kind)
            ? (this.findBenchRotation(x, z, this.state.buildRotation) ?? this.state.buildRotation)
          : this.state.buildRotation,
      elevation: placeElevation,
      pathType: kind === 'path' ? 'normal' : undefined,
      pathSlope: kind === 'path' ? 0 : undefined,
      pathSlopeDirection: kind === 'path' ? this.state.buildRotation : undefined,
      price: BUILDINGS[kind].defaultPrice,
      securityConfig:
        kind === 'securityGate' ? structuredClone(DEFAULT_SECURITY_CONFIG) : undefined,
      bandName:
        kind === 'stage'
          ? BAND_NAMES[this.idCounter % BAND_NAMES.length]
          : undefined,
      wasteFill: isWasteBin(kind) ? 0 : undefined,
      ...(kind === 'shirt'
        ? {
            shirtColor: defaultShirtSettings().color,
            shirtStyle: defaultShirtSettings().style,
          }
        : {}),
    })
    // A delay tower standing in the crowd clears the audience ground under its own feet; the sync
    // leaves it clear from then on, since it skips cells a building occupies.
    if (kind === 'delayTower') this.state.stageForecourtCells = this.state.stageForecourtCells.filter(cell => cell.x !== x || cell.z !== z)
    if(design)syncStageAudience(this.state)
    if (isQueuedFacilityKind(kind) || kind === 'stage') {
      this.recalculateQueueDirections()
    }
    this.recalculatePark()
    this.refreshPower()
    this.emit()
    return { ok: true, message: `${BUILDINGS[kind].name} gebaut` }
  }

  private placeAmbulanceGarage(x: number, z: number): ActionResult {
    const footprint = this.createFootprint(x, z, 2)
    const result = this.canPlaceLogisticsFootprint(
      footprint,
      BUILDINGS.ambulanceGarage.cost,
    )
    if (!result.ok) return result
    footprint.forEach((cell) => {
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false)
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
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false)
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
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false)
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
      this.clearDesignatedOccupancyAt(cell.x, cell.z, false)
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
          this.hasLiveMedicalOccupancy(cell.x, cell.z) ||
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
        this.decideNextAction(visitor)
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
      )
    }
    return Boolean(this.getStageForecourtCellAt(to.x, to.z))
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
    elevation = snapWayElevation(elevation)
    slope = snapWayElevation(slope)
    if (wayType && WAY_TYPES[wayType]?.mode !== 'foot') return { ok: false, message: 'Gültigen Fußwegbelag wählen' }
    if (wayType && elevation <= this.getTerrainHeight(x, z)) { const issue = wayIssue(this.state, x, z, wayType); if (issue) return { ok: false, message: issue } }
    const pathCost = wayType ? WAY_TYPES[wayType].cost : BUILDINGS.path.cost
    if (!this.isInWorld(x, z)) return { ok: false, message: 'Außerhalb des Geländes' }
    if (this.hasLiveParkingOccupancy(x, z) || this.isLogisticsBuildingCell(x, z)) {
      return { ok: false, message: 'Hier liegt bereits eine Logistikfläche' }
    }
    const road = this.getRoadCellsAt(x, z).find((layer) =>
      wayOverlapsRoadGrade(
        elevation,
        slope,
        layer.elevation ?? this.getTerrainHeight(x, z),
      ),
    )
    if (road && pathType === 'queue') {
      return { ok: false, message: 'Eine Warteschlange kann nicht auf der Autostraße liegen' }
    }
    if (this.getCampingCellAt(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch einen Zeltplatz kann kein Weg führen' }
    }
    if (this.hasLiveMedicalOccupancy(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch den Krankenbereich kann kein Weg führen' }
    }
    if (this.getStageForecourtCellAt(x, z) && elevation < 1.2) {
      return { ok: false, message: 'Durch den Bühnenvorplatz kann kein Weg führen' }
    }
    const rampStartElevation = elevation - slope
    const candidateBase = Math.min(elevation, rampStartElevation)
    const candidateTop =
      Math.max(elevation, rampStartElevation) + BUILDINGS.path.height
    const gate = this.getRideAccessAt(x, z)
    if (gate && gate.point.y < candidateTop && candidateBase < gate.point.y + .8) {
      return { ok: false, message: 'Hier steht ein Ein- oder Ausgang – den Weg daneben anschließen' }
    }
    const occupants = this.state.buildings.filter((building) => {
      if (!occupiesBuildingCell(building,x,z)) return false
      const bounds = this.getBuildingVerticalBounds(building)
      return bounds.base < candidateTop && candidateBase < bounds.top
    })
    const existingPath = occupants.find((building) => building.kind === 'path')
    const blocking = occupants.find(
      (building) =>
        building.kind !== 'tree' && !PATH_COMPATIBLE_KINDS.has(building.kind) &&
        !(building.decorationSlot !== undefined && isEdgeScenery(building.kind) && slope === 0),
    )
    if (
      blocking ||
      this.coasterOccupiesVolume(
        x,
        z,
        candidateBase,
        candidateTop - candidateBase,
      )
    ) {
      return { ok: false, message: 'Auf dieser Höhe ist nicht genug Platz' }
    }
    if (this.isWaterTerrain(x, z) && elevation <= WATER_HEIGHT) {
      return { ok: false, message: 'Im Wasser kann kein Weg gebaut werden' }
    }
    if (elevation < WATER_HEIGHT || elevation > MAX_PATH_ELEVATION) {
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
        !this.getPathAt(
          x - direction.x,
          z - direction.z,
          elevation - slope,
        ))
    ) {
      return { ok: false, message: 'Eine Rampe muss an einen bestehenden Weg anschließen' }
    }
    const clearCost = this.getTreeClearCost(x, z, candidateBase, candidateTop - candidateBase)
    if (this.state.money < pathCost + clearCost) {
      return { ok: false, message: 'Nicht genug Geld' }
    }

    this.clearTreesAt(x, z, candidateBase, candidateTop - candidateBase)
    this.clearDesignatedOccupancyAt(x, z, false)
    bookFinance(this.state, 'construction', -pathCost)
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
    if (existingPath) {
      Object.assign(existingPath, pathData)
    } else {
      this.state.buildings.push({
        id: this.nextId('building'),
        ...pathData,
      })
    }
    if (wayType && elevation === this.getTerrainHeight(x, z)) {
      const cell = this.state.festival.infrastructure.ground[groundKey(x, z)] ??= {}
      cell.footway = wayType
    }
    // Replacing a tree or moving an existing path can leave the count unchanged.
    // Invalidate before queue recalculation and any immediate path lookup.
    this.indexedBuildingCount = -1
    const roadElevation = road ? (road.elevation ?? this.getTerrainHeight(x, z)) : this.getTerrainHeight(x, z)
    const crossing = Boolean(road && wayOverlapsRoadGrade(elevation, slope, roadElevation))
    if (crossing && road && !road.crosswalk) {
      road.crosswalk = true
      this.invalidateRoadGraph()
    }
    const overRoad =
      !crossing &&
      this.getRoadCellsAt(x, z).some(
        (layer) =>
          (layer.elevation ?? this.getTerrainHeight(x, z)) + WAY_LEVEL_MATCH <
          Math.min(elevation, elevation - slope),
      )
    this.recalculateQueueDirections()
    this.emit()
    return {
      ok: true,
      message:
        existingPath
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
    const path = this.getPathAt(x, z, elevation)
    if (
      !path ||
      path.kind !== 'path' ||
      (path.id === ENTRANCE_PATH_ID && !previousPath)
    ) {
      return { ok: false, message: 'Dieses Wegstück kann nicht zurückgenommen werden' }
    }
    if (previousPath) {
      const index = this.state.buildings.findIndex((building) => building.id === path.id)
      if (index >= 0) this.state.buildings[index] = structuredClone(previousPath)
    } else {
      this.relocateVisitorsFromPath(path)
      this.state.buildings = this.state.buildings.filter((building) => building.id !== path.id)
    }
    bookFinance(this.state, 'construction', BUILDINGS.path.cost)
    this.recalculateQueueDirections()
    if (elevation === this.getTerrainHeight(x, z)) {
      const ground = this.state.festival.infrastructure.ground[groundKey(x, z)]
      if (ground) { if (previousPath?.wayType) ground.footway = previousPath.wayType; else delete ground.footway }
    }
    this.emit()
    return {
      ok: true,
      message: previousPath ? 'Vorheriger Weg wiederhergestellt' : 'Letztes Wegstück zurückgenommen',
    }
  }

  bulldoze(x: number, z: number, buildingId?: string): ActionResult {
    const gate = this.getRideAccessAt(x,z)
    if (gate && (!buildingId || gate.building.id === buildingId)) {
      if (this.state.visitors.some(v=>v.targetId===gate.building.id && v.state==='using')) return {ok:false,message:'Bitte die laufende Fahrt abwarten'}
      delete gate.building[gate.type==='entrance'?'rideEntrance':'rideExit']
      this.indexedBuildingCount=-1; this.recalculateQueueDirections(); this.emit()
      return {ok:true,message:'Zugang entfernt'}
    }
    if (!buildingId) {
      const occupying = this.getRemovableCoasterAt(x, z)
      if (occupying) return this.removeCoaster(occupying.id)
    }
    if (buildingId && !this.state.buildings.some(b => b.id === buildingId && occupiesBuildingCell(b, x, z))) {
      const cleared = this.clearDesignatedOccupancyAt(x, z, true)
      if (cleared) {
        this.emit()
        return cleared
      }
      return { ok: false, message: 'Objekt nicht mehr vorhanden' }
    }
    const result = this.bulldozeAt(x, z, buildingId)
    const cell = this.state.festival.infrastructure.ground[groundKey(x, z)]
    if (result.ok && cell) {
      if (!this.state.buildings.some(b => b.kind === 'path' && b.x === x && b.z === z)) delete cell.footway
      if (!this.state.logistics.roadCells.some(b => b.x === x && b.z === z)) delete cell.roadway
      this.emit()
    }
    return result
  }

  bulldozeArea(cells: ReadonlyArray<{ x: number; z: number }>): ActionResult {
    const unique = new Map(cells.map(cell => [`${cell.x},${cell.z}`, cell]))
    let removed = 0
    let lastIssue = 'Auf der Fläche gibt es nichts abzureißen'
    for (const cell of unique.values()) {
      const limit = this.getBuildingsAtCell(cell.x, cell.z).length + 1
      for (let i = 0; i < limit; i++) {
        const result = this.bulldoze(cell.x, cell.z)
        if (result.ok) removed += 1
        else { if (result.message !== 'Hier gibt es nichts abzureißen') lastIssue = result.message; break }
      }
    }
    return removed > 0
      ? {
          ok: true,
          message: `${removed} ${removed === 1 ? 'Element' : 'Elemente'} entfernt`,
        }
      : { ok: false, message: lastIssue }
  }

  private bulldozeAt(x: number, z: number, buildingId?: string): ActionResult {
    if (!buildingId && this.removeAccessControlsAt(x, z) > 0) {
      this.evaluateAccessSignals()
      this.emit()
      return { ok: true, message: 'Kontrolle entfernt' }
    }
    const busStop = this.state.logistics.busStops.find(
      (stop) => stop.x === x && stop.z === z,
    )
    if (busStop && (!buildingId || busStop.id === buildingId)) {
      this.state.logistics.busStops =
        this.state.logistics.busStops.filter(
          (stop) => stop.id !== busStop.id,
        )
      this.state.logistics.busLines =
        this.state.logistics.busLines.filter(
          (line) => !line.stopIds.includes(busStop.id),
        )
      this.emit()
      return { ok: true, message: 'Bushaltestelle entfernt' }
    }
    const building = buildingId ? this.state.buildings.find(b => b.id === buildingId) : this.getAt(x, z)
    if (!building) {
      const cleared = this.clearDesignatedOccupancyAt(x, z, true)
      if (cleared) {
        this.emit()
        return cleared
      }
      const layers = this.getRoadCellsAt(x, z)
      const road =
        layers.length > 1
          ? [...layers].sort(
              (a, b) =>
                roadLayerElevation(b, this.getTerrainHeight(x, z)) -
                roadLayerElevation(a, this.getTerrainHeight(x, z)),
            )[0]
          : layers[0]
      if (road) {
        if (
          z === -this.getWorldSize() / 2 &&
          x >= -3 &&
          x <= 2 &&
          layers.length === 1
        ) {
          return { ok: false, message: 'Die Einfahrtsstraße kann nicht entfernt werden' }
        }
        if (
          this.state.logistics.roadVehicles.some((vehicle) => {
            if (vehicle.cell?.x !== x || vehicle.cell.z !== z) return false
            if (vehicle.cell.elevation === undefined) return layers.length === 1
            return elevationsMatch(
              vehicle.cell.elevation,
              roadLayerElevation(road, this.getTerrainHeight(x, z)),
            )
          })
        ) {
          return { ok: false, message: 'Auf der Straße befindet sich ein Fahrzeug' }
        }
        this.state.logistics.roadCells =
          this.state.logistics.roadCells.filter((cell) => cell !== road)
        this.invalidateRoadGraph()
        if (this.getRoadCellsAt(x, z).length === 0) this.removeAccessControlsAt(x, z)
        this.emit()
        return { ok: true, message: 'Straße entfernt' }
      }
      if (this.getCampingCellAt(x, z)) return this.designateCampingCell(x, z, false)
      if (this.getPowerCableAt(x, z)) {
        this.state.power.cableCells = this.state.power.cableCells.filter(
          (cell) => cell.x !== x || cell.z !== z,
        )
        this.refreshPower()
        this.emit()
        return { ok: true, message: 'Kabel entfernt' }
      }
      const wasteDump = this.getWasteDumpAt(x, z)
      if (wasteDump) {
        if (wasteDump.stored > 0) {
          return {
            ok: false,
            message: 'Die Müllablage ist noch beladen und kann nicht aufgehoben werden',
          }
        }
        this.state.wasteDumpCells = this.state.wasteDumpCells.filter(
          (cell) => cell.x !== x || cell.z !== z,
        )
        this.emit()
        return { ok: true, message: 'Müllablage aufgehoben' }
      }
      const forecourt = this.getStageForecourtCellAt(x, z)
      if (forecourt) {
        // A stage's own audience ground comes with the stage and goes with it — see
        // syncStageAudience, which would lay it straight back down anyway.
        if (forecourt.stageId) {
          return {
            ok: false,
            message: 'Die Zuschauerfläche gehört zur Bühne und lässt sich nicht einzeln entfernen',
          }
        }
        this.state.stageForecourtCells =
          this.state.stageForecourtCells.filter(
            (cell) => cell.x !== x || cell.z !== z,
          )
        this.state.visitors.forEach((visitor) => {
          if (
            visitor.activityTarget?.x === x &&
            visitor.activityTarget.z === z
          ) {
            this.clearVisitorActivity(visitor)
            this.decideNextAction(visitor)
          }
        })
        this.recalculateQueueDirections()
        this.emit()
        return { ok: true, message: 'Bühnenvorplatz aufgehoben' }
      }
      return { ok: false, message: 'Hier gibt es nichts abzureißen' }
    }
    if (building.id === ENTRANCE_PATH_ID) {
      return { ok: false, message: 'Der Parkeingang kann nicht abgerissen werden' }
    }
    if (
      building.kind === 'tree' &&
      this.state.money < SIMULATION_CONFIG.economy.treeClearCost
    ) {
      return { ok: false, message: 'Nicht genug Geld, um den Baum zu entfernen' }
    }

    if (building.kind === 'path') {
      this.relocateVisitorsFromPath(building)
      this.removeAccessControlsAt(x, z)
    }
    if (building.kind === 'ambulanceGarage') {
      const garage = this.state.logistics.ambulanceGarages.find(
        (candidate) => candidate.id === building.id,
      )
      if (garage?.bays.some(Boolean)) {
        return { ok: false, message: 'Vor dem Abriss müssen alle Krankenwagen entfernt werden' }
      }
      this.state.logistics.ambulanceGarages =
        this.state.logistics.ambulanceGarages.filter(
          (candidate) => candidate.id !== building.id,
        )
    }
    if (building.kind === 'busDepot') {
      const depot = this.state.logistics.busDepots.find(
        (candidate) => candidate.id === building.id,
      )
      if (depot?.busIds.length) {
        return { ok: false, message: 'Vor dem Abriss müssen alle Busse entfernt werden' }
      }
      this.state.logistics.busDepots =
        this.state.logistics.busDepots.filter(
          (candidate) => candidate.id !== building.id,
        )
    }
    if (building.kind === 'wasteDepot') {
      const depot = this.state.logistics.wasteDepots.find(
        (candidate) => candidate.id === building.id,
      )
      if (depot?.truckIds.length) {
        return { ok: false, message: 'Vor dem Abriss müssen alle Müllfahrzeuge entfernt werden' }
      }
      this.state.logistics.wasteDepots =
        this.state.logistics.wasteDepots.filter(
          (candidate) => candidate.id !== building.id,
        )
    }
    if (building.kind === 'specialDepot') {
      const depot = this.state.logistics.specialDepots.find(
        (candidate) => candidate.id === building.id,
      )
      if (depot?.vehicleIds.length) {
        return { ok: false, message: 'Vor dem Abriss müssen alle Spezialfahrzeuge entfernt werden' }
      }
      this.state.logistics.specialDepots =
        this.state.logistics.specialDepots.filter(
          (candidate) => candidate.id !== building.id,
        )
    }
    this.state.buildings = this.state.buildings.filter((item) => item.id !== building.id)
    if(building.stageDesign)syncStageAudience(this.state)
    if (
      building.kind === 'path' ||
      isQueuedFacilityKind(building.kind) || building.kind === 'stage'
    ) {
      this.recalculateQueueDirections()
    }
    if (building.kind === 'tree') {
      bookFinance(this.state, 'landscaping', -SIMULATION_CONFIG.economy.treeClearCost)
    } else {
      bookFinance(this.state, 'construction', Math.floor(
        BUILDINGS[building.kind].cost *
          SIMULATION_CONFIG.economy.demolitionRefundRate,
      ))
    }
    this.state.visitors.forEach((visitor) => {
      if (visitor.targetId === building.id) {
        visitor.targetId = null
        visitor.route = []
        visitor.state = 'exploring'
        visitor.thought = 'Mein Ziel ist verschwunden.'
      }
    })
    this.recalculatePark()
    this.refreshPower()
    this.emit()
    return { ok: true, message: `${BUILDINGS[building.kind].name} abgerissen` }
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
    this.walkVisitors(this.toSimulationMinutes(realSeconds))
    const minutes = this.toSimulationMinutes(realSeconds)
    this.state.minute += minutes
    this.simulatedMinutes += minutes
    this.spawnMinutes += minutes

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
    this.enforceDayPlan()
    this.syncBandSupply()
    updateFestival(this.state)
    updateSupplyChain(this.state, (start, goals) => this.findPath(start, goals, false, false, false, false, true, undefined, true), (a, b) => this.canCarrierStep(a, b))

    while (this.spawnMinutes >= VISITOR_SPAWN_INTERVAL_MINUTES) {
      this.spawnMinutes -= VISITOR_SPAWN_INTERVAL_MINUTES
      const hour = Math.floor(this.state.minute / 60) % 24
      const baseArrivals =
        (SIMULATION_CONFIG.visitors.arrivalsPerIntervalByHour[hour] ?? 0) *
        (this.state.festival.enabled ? 0.7 + Math.min(2, this.state.festival.bookings
          .filter(b => b.day === this.state.day)
          .reduce((sum, b) => sum + (BANDS.find(band => band.id === b.bandId)?.draw ?? 0), 0) / 100) +
          Object.values(this.state.festival.reputation).reduce((a, b) => a + b, 0) / 800 : 1)
      const phase = getFestivalCycleStatus(
        this.state.dayPlan,
        this.state.day,
      )
      const tuning = SIMULATION_CONFIG.visitors.festivalArrivals
      if (phase.phase === 'lead') {
        const campers = this.samplePoisson(
          baseArrivals * tuning.leadDayCamperMultiplier,
        )
        for (let index = 0; index < campers; index += 1) {
          this.trySpawnVisitor('camping')
        }
      } else if (phase.phase === 'festival') {
        const dayGuests = this.samplePoisson(
          baseArrivals * tuning.festivalDayGuestMultiplier,
        )
        for (let index = 0; index < dayGuests; index += 1) {
          this.trySpawnVisitor('day')
        }
        const camperMultiplier = phase.firstFestivalDay
          ? tuning.firstFestivalDayCamperMultiplier
          : tuning.laterFestivalDayCamperMultiplier
        const campers = this.samplePoisson(baseArrivals * camperMultiplier)
        for (let index = 0; index < campers; index += 1) {
          this.trySpawnVisitor('camping')
        }
      }
    }

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
      this.updateCrowdingAndMotivation(this.crowdingMinutes)
      this.crowdingMinutes = 0
    }
    this.updateVisitors(minutes)
    this.updateFanIntrusion(minutes)
    this.updateBandActors(minutes)
    this.updateFacilityQueues(minutes)
    this.updateVisitorFireworks(minutes)
    this.updateCoastersForCurrentTick()

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
    this.evaluateAccessSignals()
    this.syncFreightToVehicles()
    this.restoreMissingGarbageTrucks()
    this.claimedTentCellsCache = null
    this.visitorsOnCellsThisTick = null
    const logistics = this.state.logistics
    const occupied = new Map<string, string>()
    for (const vehicle of logistics.roadVehicles) {
      if (vehicle.cell && vehicle.state !== 'parked' && vehicle.kind !== 'sweeper') {
        occupied.set(this.roadPositionKey(vehicle.cell), vehicle.id)
        if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning' && vehicle.route[0] &&
          !this.getRoadCellAt(vehicle.cell.x, vehicle.cell.z, vehicle.cell.elevation)) {
          occupied.set(this.roadPositionKey(vehicle.route[0]), vehicle.id)
        }
      }
    }
    const removedVehicles = new Set<string>()
    const removedGroups = new Set<string>()
    const removedVisitors = new Set<string>()
    const vehicleIds = new Set(
      logistics.roadVehicles.map((vehicle) => vehicle.id),
    )
    const vehiclesById = new Map(
      logistics.roadVehicles.map((vehicle) => [vehicle.id, vehicle]),
    )
    const pedestriansByCell = new Map<string, Visitor[]>()
    const seatedPassengers = collectSeatedPassengerIds(logistics.roadVehicles)
    let parkingSearches = 0
    this.state.visitors.forEach((visitor) => {
      if (
        this.isVisitorSeatedInVehicle(visitor, seatedPassengers) ||
        visitor.state === 'riding' ||
        visitor.state === 'medical'
      ) {
        return
      }
      const key = roadCellKey(visitor.cellX, visitor.cellZ)
      const pedestrians = pedestriansByCell.get(key) ?? []
      pedestrians.push(visitor)
      pedestriansByCell.set(key, pedestrians)
    })
    this.visitorsOnCellsThisTick = new Set(pedestriansByCell.keys())
    logistics.parkingCells.forEach((parking) => {
      if (parking.occupiedBy && !vehicleIds.has(parking.occupiedBy)) {
        parking.occupiedBy = null
      }
    })
    logistics.roadVehicles.forEach((vehicle) => {
      if (
        vehicle.kind === 'visitorCar' &&
        vehicle.state === 'parked'
      ) {
        const group = logistics.arrivalGroups.find(
          (candidate) => candidate.id === vehicle.groupId,
        )
        if (!group) {
          if (vehicle.parkingCell) {
            const parking = logistics.parkingCells.find(
              (cell) =>
                cell.x === vehicle.parkingCell?.x &&
                cell.z === vehicle.parkingCell?.z,
            )
            if (parking) parking.occupiedBy = null
          }
          removedVehicles.add(vehicle.id)
          return
        }
        this.normalizeCarManifest(group)
        if (this.hasArrivalPassengersStillSeated(vehicle, group)) {
          this.finishVehicleParking(vehicle)
        }
        if (this.canParkedCarDepart(vehicle, group)) {
          const departure = this.startParkedCarDeparture(vehicle, group, occupied)
          vehicle.waitMinutes = departure === 'no-route'
            ? Math.min(vehicle.waitMinutes + minutes, 2)
            : 0
          if (departure === 'started' && vehicle.route[0]) {
            occupied.set(this.roadPositionKey(vehicle.route[0]), vehicle.id)
          }
        } else {
          vehicle.waitMinutes = 0
        }
      }
      if (vehicle.cell && vehicle.state !== 'parked' && vehicle.kind !== 'sweeper') {
        occupied.set(
          this.roadPositionKey(vehicle.cell),
          vehicle.id,
        )
      }
    })

    this.dispatchIdleAmbulances()
    this.dispatchTourBuses()
    logistics.roadVehicles.forEach((vehicle) => {
      if (removedVehicles.has(vehicle.id)) return
      if (vehicle.kind === 'bus') {
        this.updateBusAtStop(vehicle, minutes)
        if (vehicle.state === 'idle') this.dispatchBus(vehicle)
      }
      if (vehicle.kind === 'garbageTruck') {
        if (vehicle.state === 'idle') {
          this.dispatchGarbageTruck(vehicle)
          if (vehicle.state === 'idle' && !this.isGarbageTruckAtHome(vehicle)) {
            this.continueGarbageTruck(vehicle)
          }
        }
        if (vehicle.state === 'waiting') {
          if (this.isAccidentVictimBlockingVehicle(vehicle)) return
          if (
            this.isOffMapRoadExit(vehicle.cell ?? vehicle.position) &&
            vehicle.cargo <= 0
          ) {
            vehicle.waitMinutes += minutes
            if (vehicle.waitMinutes < SIMULATION_CONFIG.waste.truckUnloadMinutes) {
              return
            }
            if (this.reenterGarbageTruck(vehicle)) return
            if (
              vehicle.waitMinutes >=
              SIMULATION_CONFIG.waste.truckUnloadMinutes +
                SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
            ) {
              this.returnGarbageTruckToDepot(vehicle)
            }
            return
          }
          if (this.resumeVehicleAfterIncident(vehicle)) {
            // continue into movement below
          } else {
            vehicle.waitMinutes -= minutes
            if (vehicle.waitMinutes <= 0) {
              this.continueGarbageTruck(vehicle)
            }
            return
          }
        }
      }
      if (vehicle.kind === 'sweeper') {
        this.updateSweeper(vehicle, minutes)
        return
      }
      if (vehicle.state === 'waiting' && this.isAccidentVictimBlockingVehicle(vehicle)) {
        return
      }
      if (
        vehicle.kind !== 'visitorCar' &&
        vehicle.state === 'waiting' &&
        this.resumeVehicleAfterIncident(vehicle)
      ) {
        // continue into movement below
      }
      if (vehicle.kind === 'visitorCar' && vehicle.state === 'waiting') {
        if (this.resumeVehicleAfterIncident(vehicle)) {
          // continue into movement or parking pull-in
        } else if (vehicle.parkingCell && vehicle.target?.kind === 'parking') {
          vehicle.state = 'parking'
          vehicle.resumeState = null
          vehicle.waitMinutes = 0
        } else {
          const canSearch = parkingSearches < 2
          this.assignVisitorCarParking(
            vehicle,
            minutes,
            removedVisitors,
            removedGroups,
            removedVehicles,
            canSearch,
          )
          if (canSearch) parkingSearches += 1
          if (vehicle.state === 'waiting') return
        }
      }
      if (this.claimAdjacentFreeParking(vehicle)) {
        // pull into the first free bay beside this cell
      }

      if (
        vehicle.state !== 'driving' &&
        vehicle.state !== 'responding' &&
        vehicle.state !== 'returning' &&
        vehicle.state !== 'parking'
      ) {
        return
      }
      const mudSlowdown = vehicle.cell && this.isMudTerrain(vehicle.cell.x, vehicle.cell.z)
        ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
        : 1
      if ((vehicle.stuckMinutes ?? 0) > 0) { vehicle.stuckMinutes = Math.max(0, vehicle.stuckMinutes! - minutes); return }
      const ground = vehicle.cell ? groundInfo(this.state, vehicle.cell.x, vehicle.cell.z) : null
      const groundCell = vehicle.cell ? groundKey(vehicle.cell.x, vehicle.cell.z) : ''
      if (vehicle.testedGroundCell !== groundCell) {
        vehicle.testedGroundCell = groundCell
        if (ground && ground.wet > .5 && hashStringSeed(`${vehicle.id}:${groundCell}`) % 100 < ground.wet * wayInfo(this.state, vehicle.cell!.x, vehicle.cell!.z, 'road').stuck * 100) { vehicle.stuckMinutes = 8; return }
      }
      vehicle.speed += minutes * mudSlowdown * (vehicle.cell ? wayInfo(this.state, vehicle.cell.x, vehicle.cell.z, 'road').speed : 1)
      const currentRoad = vehicle.cell
        ? this.getRoadCellAt(vehicle.cell.x, vehicle.cell.z, vehicle.cell.elevation)
        : undefined
      if (currentRoad?.allowedDirections != null) {
        const facing = this.getVehicleDirection(vehicle)
        if (!isRoadDirectionAllowed(currentRoad, facing) &&
            isRoadDirectionAllowed(currentRoad, oppositeDirection(facing))) {
          vehicle.facing = oppositeDirection(facing) * Math.PI / 2
          this.rebuildVehicleRouteFromHere(vehicle)
        }
      }
      const interval =
        SIMULATION_CONFIG.logistics.vehicleMoveIntervalMinutes *
        (30 / Math.min(currentRoad?.speedLimit ?? 30, vehicle.cell ? roadGroundLimit(this.state, vehicle.cell.x, vehicle.cell.z) : 30))
      const next = vehicle.route[0]
      if (!next) {
        if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning' &&
          !this.isVisitorCarExit(vehicle.cell ?? vehicle.position)) {
          this.rebuildVehicleRouteFromHere(vehicle)
          if (vehicle.route.length === 0) vehicle.waitMinutes += minutes
          return
        }
        if (vehicle.kind === 'tourBus') {
          this.finishTourBusLeg(vehicle, removedVehicles)
        } else if (vehicle.kind === 'ambulance') {
          this.finishAmbulanceLeg(vehicle)
        } else if (vehicle.kind === 'garbageTruck') {
          this.finishGarbageTruckLeg(vehicle)
        } else if (vehicle.kind === 'deliveryTruck') {
          this.finishDeliveryTruckLeg(vehicle, removedVehicles)
        } else if (
          vehicle.kind === 'bus' &&
          vehicle.target?.kind === 'busStop'
        ) {
          vehicle.state = 'at-stop'
          vehicle.waitMinutes = 0
        } else if (
          vehicle.state === 'returning' &&
          !isPlayerOwnedFleetVehicle(vehicle)
        ) {
          vehicle.passengerIds.forEach((visitorId) => {
            removedVisitors.add(visitorId)
          })
          removedVehicles.add(vehicle.id)
          if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        } else if (vehicle.kind === 'visitorCar') {
          this.completeVisitorCarArrival(vehicle)
        } else {
          vehicle.state = 'idle'
        }
        return
      }
      const nextKey = this.roadPositionKey(next)
      const here = vehicle.cell ?? vehicle.position
      if (!this.isLegalRoadStep(here, next)) {
        vehicle.route = []
        this.rebuildVehicleRouteFromHere(vehicle)
        return
      }
      if (this.isIllegalParkingPullIn(vehicle, here, next)) {
        this.releaseVisitorCarParking(vehicle)
        vehicle.route = []
        vehicle.state = 'waiting'
        vehicle.waitMinutes = 0
        return
      }
      if (stepUsesClosedEdge(here.x, here.z, next.x, next.z, this.closedTrafficEdges)) {
        if (this.rerouteAwayFromRedLight(vehicle, next)) return
        vehicle.waitMinutes += minutes
        return
      }
      const truckBlocks = this.state.festival.infrastructure.trucks.some(
        (truck) =>
          !this.state.logistics.roadVehicles.some(
            (candidate) =>
              candidate.kind === 'deliveryTruck' &&
              (candidate.deliveryId === truck.id || candidate.id === truck.id),
          ) &&
          truck.x === next.x &&
          truck.z === next.z &&
          this.roadPositionKey(truck) === nextKey,
      )
      const blocker = occupied.get(nextKey)
      if (truckBlocks || (blocker && blocker !== vehicle.id)) {
        if (this.replanOffMapDelivery(vehicle, occupied)) return
        if (this.replanBlockedReverse(vehicle, occupied)) return
        if (this.replanBlockedTurn(vehicle, occupied)) return
        vehicle.waitMinutes += minutes
        if (
          vehicle.waitMinutes >=
          SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
        ) {
          this.unstickVehicle(vehicle, occupied, removedVehicles, removedGroups, removedVisitors)
        }
        return
      }
      if (
        vehicle.waitMinutes < 2 &&
        this.mustYieldToVehicleFromRight(
          vehicle,
          next,
          occupied,
          vehiclesById,
        )
      ) {
        vehicle.waitMinutes += minutes
        return
      }
      const road = this.getRoadCellAt(next.x, next.z, next.elevation)
      const pedestrians = (pedestriansByCell.get(roadCellKey(next.x, next.z)) ?? []).filter(
        (visitor) =>
          elevationsMatch(visitor.cellElevation,
            road ? roadLayerElevation(road) : this.getTerrainHeight(next.x, next.z)),
      )
      if (
        pedestrians.length > 0 &&
        vehicle.kind !== 'ambulance'
      ) {
        const blockingInjured = pedestrians.some(
          (visitor) =>
            visitor.state === 'injured' ||
            visitor.state === 'medical-transport',
        )
        const brakingChance = road?.crosswalk
          ? 1
          : SIMULATION_CONFIG.logistics.brakingChanceBySpeed[
              road?.speedLimit ?? 30
            ]
        if (blockingInjured) {
          vehicle.waitMinutes += minutes
          if (
            vehicle.waitMinutes >=
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
          ) {
            this.unstickVehicle(vehicle, occupied, removedVehicles, removedGroups, removedVisitors)
          }
          return
        }
        if (
          vehicle.waitMinutes <
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes &&
          this.rng.next() < brakingChance
        ) {
          vehicle.waitMinutes += minutes
          return
        }
        if (
          vehicle.waitMinutes <
            SIMULATION_CONFIG.logistics.vehicleUnstickMinutes
        ) {
          const victim = pedestrians[0]!
          if (this.isVisitorSeatedInVehicle(victim, seatedPassengers)) {
            return
          }
          victim.needs.energy = 0
          victim.state = 'injured'
          victim.route = []
          victim.streakingMinutes = 0
          victim.toplessMinutes = 0
          victim.injuryVehicleId = vehicle.id
          victim.thought = 'Ich wurde von einem Fahrzeug angefahren!'
          this.recordComplaint(victim, 'traffic-accident')
          vehicle.resumeState = vehicle.state
          vehicle.state = 'waiting'
          vehicle.speed = 0
          return
        }
      }
      if (vehicle.speed < interval) return
      vehicle.speed %= interval
      const reversing = isVehicleReversing(vehicle)
      if (vehicle.cell) {
        occupied.delete(this.roadPositionKey(vehicle.cell))
      }
      vehicle.cell = { ...next }
      if (!reversing) {
        vehicle.facing = Math.atan2(
          next.x - vehicle.position.x,
          next.z - vehicle.position.z,
        )
      }
      vehicle.position = { ...next }
      if (road?.allowedDirections != null) {
        const facing = this.getVehicleDirection(vehicle)
        if (!isRoadDirectionAllowed(road, facing) && isRoadDirectionAllowed(road, oppositeDirection(facing))) {
          vehicle.facing = oppositeDirection(facing) * Math.PI / 2
        }
      }
      vehicle.passengerIds.forEach((visitorId) => {
        const passenger = this.getVisitor(visitorId)
        if (!passenger) return
        passenger.x = next.x + 0.5
        passenger.z = next.z + 0.5
        passenger.cellX = next.x
        passenger.cellZ = next.z
        passenger.cellElevation = next.elevation ?? this.getTerrainHeight(next.x, next.z)
        passenger.y = passenger.cellElevation
      })
      vehicle.route.shift()
      vehicle.waitMinutes = 0
      occupied.set(nextKey, vehicle.id)
      if (this.claimAdjacentFreeParking(vehicle)) {
        return
      }
      if (vehicle.route.length === 0 && vehicle.kind === 'visitorCar') {
        if (vehicle.state === 'returning') {
          if (!this.isVisitorCarExit(vehicle.cell ?? vehicle.position)) return
          vehicle.passengerIds.forEach((visitorId) => {
            removedVisitors.add(visitorId)
          })
          removedVehicles.add(vehicle.id)
          if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        } else {
          this.completeVisitorCarArrival(vehicle)
        }
      }
    })

    if (removedVisitors.size > 0) {
      this.state.visitors.forEach((visitor) => {
        if (removedVisitors.has(visitor.id)) this.leaveVisitorCampBehind(visitor)
      })
      this.state.visitors = this.state.visitors.filter(
        (visitor) => !removedVisitors.has(visitor.id),
      )
      this.indexedVisitorCount = -1
      this.state.guests = this.state.visitors.length
      this.state.logistics.arrivalGroups.forEach((group) => {
        this.normalizeCarManifest(group)
      })
    }
    logistics.roadVehicles = logistics.roadVehicles.filter(
      (vehicle) => !removedVehicles.has(vehicle.id),
    )
    logistics.arrivalGroups = logistics.arrivalGroups.filter(
      (group) => !removedGroups.has(group.id),
    )
    this.syncVehiclesToFreight()
  }

  private mustYieldToVehicleFromRight(
    vehicle: RoadVehicle,
    target: RoadPosition,
    occupied: ReadonlyMap<string, string>,
    vehiclesById: ReadonlyMap<string, RoadVehicle>,
  ): boolean {
    if (!vehicle.cell) return false
    const neighbors = this.getAdjacentRoadPositions(target)
    if (neighbors.length < 3) return false
    const direction = this.getDirectionIndex(
      target.x - vehicle.cell.x,
      target.z - vehicle.cell.z,
    ) as Direction
    const rightSide = (direction + 3) % 4
    const offset = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ][rightSide]!
    return this.getRoadCellsAt(target.x + offset.x, target.z + offset.z).some((road) => {
      const candidateId = occupied.get(this.roadPositionKey(road))
      const candidate = candidateId ? vehiclesById.get(candidateId) : undefined
      const next = candidate?.route[0]
      return Boolean(candidate && candidate.id !== vehicle.id && next &&
        this.roadPositionKey(next) === this.roadPositionKey(target) &&
        this.isLegalRoadStep(road, target))
    })
  }

  private getVehicleDirection(vehicle: RoadVehicle): Direction {
    return ((Math.round(vehicle.facing / (Math.PI / 2)) % 4 + 4) %
      4) as Direction
  }

  private isAccidentVictimBlockingVehicle(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    const next = vehicle.route[0]
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    return this.state.visitors.some((visitor) => {
      if (
        visitor.state !== 'injured' ||
        visitor.injuryVehicleId !== vehicle.id ||
        this.isVisitorSeatedInVehicle(visitor, seated)
      ) {
        return false
      }
      if (visitor.cellX === here.x && visitor.cellZ === here.z) return true
      return Boolean(next && visitor.cellX === next.x && visitor.cellZ === next.z)
    })
  }

  private resumeVehicleAfterIncident(vehicle: RoadVehicle): boolean {
    if (vehicle.state !== 'waiting' || vehicle.route.length === 0) return false
    vehicle.state =
      vehicle.resumeState === 'returning' ||
      vehicle.resumeState === 'responding' ||
      vehicle.resumeState === 'parking'
        ? vehicle.resumeState
        : vehicle.target?.kind === 'parking'
          ? 'driving'
          : vehicle.resumeState ?? 'driving'
    vehicle.resumeState = null
    vehicle.waitMinutes = 0
    return true
  }

  private assignVisitorCarParking(
    vehicle: RoadVehicle,
    minutes: number,
    removedVisitors: Set<string>,
    removedGroups: Set<string>,
    removedVehicles: Set<string>,
    canSearch: boolean,
  ): void {
    const group = this.state.logistics.arrivalGroups.find(
      (candidate) => candidate.id === vehicle.groupId,
    )
    if (!group) {
      removedVehicles.add(vehicle.id)
      return
    }
    if (!canSearch) {
      if (this.isVisitorCarOnIngress(vehicle) && vehicle.route.length === 0) {
        this.sendVisitorCarCirculating(vehicle)
      }
      return
    }
    if (group.state === 'waiting-for-parking') {
      group.parkingWaitMinutes += minutes
      vehicle.waitMinutes += minutes
      if (
        group.parkingWaitMinutes >=
        SIMULATION_CONFIG.logistics.parkingSearchTimeoutMinutes
      ) {
        group.memberIds.forEach((visitorId) => {
          const visitor = this.getVisitor(visitorId)
          if (!visitor) return
          this.refundEntryFee(visitor)
          this.recordComplaint(visitor, 'no-parking')
          removedVisitors.add(visitor.id)
        })
        removedGroups.add(group.id)
        removedVehicles.add(vehicle.id)
        return
      }
      if (
        vehicle.waitMinutes <
        SIMULATION_CONFIG.logistics.parkingRetryMinutes
      ) {
        return
      }
      vehicle.waitMinutes = 0
    }
    if (this.claimAdjacentFreeParking(vehicle)) {
      group.state = 'approaching'
      return
    }
    const freeBays = this.state.logistics.parkingCells.some(
      (cell) => cell.occupiedBy === null,
    )
    if (!freeBays) {
      group.state = 'waiting-for-parking'
      group.memberIds.forEach((visitorId) => {
        const visitor = this.getVisitor(visitorId)
        if (visitor) {
          visitor.motivation = Math.max(
            0,
            visitor.motivation - minutes * 0.018,
          )
          visitor.thought = this.isVisitorCarHoldingNearParking(vehicle)
            ? 'Wir warten vor dem Parkplatz, bis einer frei wird.'
            : 'Wir fahren erstmal weiter und suchen einen freien Parkplatz.'
        }
      })
    }
    const plan =
      this.findRouteTowardParking(vehicle) ??
      this.findVisitorCarCirculation(vehicle)
    if (plan) {
      this.applyVisitorCarSearchRoute(vehicle, plan)
      if (freeBays) group.state = 'approaching'
      return
    }
    group.state = 'waiting-for-parking'
    vehicle.waitMinutes = 0
    if (
      this.isVisitorCarOnIngress(vehicle) ||
      !this.isVisitorCarHoldingNearParking(vehicle)
    ) {
      this.sendVisitorCarCirculating(vehicle)
    }
  }

  private dispatchIncomingVisitorCar(vehicle: RoadVehicle): void {
    const unused = new Set<string>()
    this.assignVisitorCarParking(vehicle, 0, unused, unused, unused, true)
    if (vehicle.state === 'waiting' && vehicle.route.length === 0) {
      this.sendVisitorCarCirculating(vehicle)
    }
  }

  private isVisitorCarOnIngress(vehicle: RoadVehicle): boolean {
    const cell = vehicle.cell ?? vehicle.position
    return cell.z === -this.getWorldSize() / 2 && cell.x >= -3 && cell.x <= 2
  }

  private isVisitorCarHoldingNearParking(vehicle: RoadVehicle): boolean {
    const cell = vehicle.cell ?? vehicle.position
    return this.state.logistics.parkingCells.some((parking) =>
      this.getParkingApproachRoads(parking).some(
        (approach) => this.roadPositionKey(approach) === this.roadPositionKey(cell),
      ),
    )
  }

  private releaseVisitorCarParking(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) return
    const parking = this.state.logistics.parkingCells.find(
      (cell) =>
        cell.x === vehicle.parkingCell?.x &&
        cell.z === vehicle.parkingCell?.z &&
        cell.occupiedBy === vehicle.id,
    )
    if (parking) parking.occupiedBy = null
    vehicle.parkingCell = null
    if (vehicle.target?.kind === 'parking') vehicle.target = null
  }

  private isVisitorCarSeekingParking(vehicle: RoadVehicle): boolean {
    return (
      vehicle.kind === 'visitorCar' &&
      vehicle.state !== 'returning' &&
      vehicle.state !== 'parked' &&
      vehicle.state !== 'parking' &&
      !vehicle.parkingCell
    )
  }

  private forgetDistantParkingReservation(vehicle: RoadVehicle): void {
    if (!vehicle.parkingCell) return
    if (vehicle.state === 'parking' || vehicle.state === 'parked') return
    if (
      this.isVehicleOnItsParkingCell(vehicle) ||
      this.isVehicleAtParkingAccess(vehicle)
    ) {
      return
    }
    this.releaseVisitorCarParking(vehicle)
  }

  private claimAdjacentFreeParking(vehicle: RoadVehicle): boolean {
    if (vehicle.kind !== 'visitorCar' || vehicle.state === 'returning') return false
    if (vehicle.state === 'parked' || vehicle.state === 'parking') return false
    this.forgetDistantParkingReservation(vehicle)
    if (vehicle.parkingCell) return false
    const here = vehicle.cell ?? vehicle.position
    const bay = this.getAdjacentParkingCells(here)
      .filter(
        (cell) =>
          cell.occupiedBy === null &&
          this.getOpenParkingApproachRoads(cell).some(
            (access) => this.roadPositionKey(access) === this.roadPositionKey(here),
          ),
      )
      .sort((left, right) => left.x - right.x || left.z - right.z)[0]
    if (!bay) return false
    bay.occupiedBy = vehicle.id
    vehicle.parkingCell = { x: bay.x, z: bay.z }
    this.beginVehiclePullIn(vehicle)
    return true
  }

  private applyVisitorCarSearchRoute(
    vehicle: RoadVehicle,
    plan: { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> },
  ): void {
    this.forgetDistantParkingReservation(vehicle)
    vehicle.route = plan.route.map(toRoadPosition)
    vehicle.target = plan.target
    vehicle.state = plan.route.length > 0 ? 'driving' : 'waiting'
    vehicle.waitMinutes = 0
  }

  private routePreferringOpenLights(
    options: FindRoadRouteOptions,
  ): RoadCell[] | null {
    return (
      findRoadRoute({
        ...options,
        blockedEdges: this.closedTrafficEdges,
      }) ?? findRoadRoute({ ...options, blockedEdges: undefined })
    )
  }

  private findRouteTowardParking(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> } | null {
    const start = vehicle.cell ?? vehicle.position
    const freeApproaches: RoadPosition[] = []
    const allApproaches: RoadPosition[] = []
    const seenFree = new Set<string>()
    const seenAll = new Set<string>()
    const nearbyParking = new Map<string, RoadPosition>()
    for (const parking of this.state.logistics.parkingCells) {
      for (const approach of this.getParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (!seenAll.has(key)) {
          seenAll.add(key)
          allApproaches.push(approach)
        }
        if (!nearbyParking.has(key)) nearbyParking.set(key, { x: parking.x, z: parking.z })
      }
      if (parking.occupiedBy !== null) continue
      for (const approach of this.getOpenParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (!seenFree.has(key)) {
          seenFree.add(key)
          freeApproaches.push(approach)
        }
      }
    }
    const tryTargets = (targets: RoadPosition[]): RoadCell[] | null => {
      if (!targets.length) return null
      return this.routePreferringOpenLights({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start,
        targets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells,
        allowUTurn: false,
      })
    }
    const route = tryTargets(freeApproaches) ?? tryTargets(allApproaches)
    if (!route?.length) return null
    const last = route.at(-1)!
    const parking = nearbyParking.get(roadCellKey(last.x, last.z))
    return {
      route: route.map(toRoadPosition),
      target: parking
        ? { kind: 'hold', parkingCell: { ...parking } }
        : { kind: 'cruise' },
    }
  }

  private rerouteAwayFromRedLight(
    vehicle: RoadVehicle,
    blockedNext: RoadPosition,
  ): boolean {
    if (vehicle.kind === 'sweeper') return false
    const waited =
      vehicle.waitMinutes >=
      SIMULATION_CONFIG.logistics.accessRerouteMinutes
    const allowUTurn =
      waited &&
      (vehicle.kind === 'deliveryTruck' || vehicle.kind === 'garbageTruck')
    if (this.isVisitorCarSeekingParking(vehicle)) {
      const plan =
        this.findRouteTowardParking(vehicle) ??
        this.findVisitorCarCirculation(vehicle)
      if (!plan?.route.length) return false
      if (!this.adoptOpenLightDetour(vehicle, plan.route, blockedNext, allowUTurn)) {
        return false
      }
      vehicle.target = plan.target
      return true
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (!targets.length) return false
    const here = vehicle.cell ?? vehicle.position
    const route = this.routePreferringOpenLights({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      start: here,
      targets,
      initialDirection: this.getVehicleDirection(vehicle),
      allowUTurn,
    })
    if (!route?.length) return false
    return this.adoptOpenLightDetour(vehicle, route, blockedNext, allowUTurn)
  }

  private adoptOpenLightDetour(
    vehicle: RoadVehicle,
    route: readonly RoadPosition[],
    blockedNext: RoadPosition,
    allowUTurn: boolean,
  ): boolean {
    const first = route[0]
    if (!first) return false
    if (first.x === blockedNext.x && first.z === blockedNext.z) return false
    const here = vehicle.cell ?? vehicle.position
    if (
      stepUsesClosedEdge(
        here.x,
        here.z,
        first.x,
        first.z,
        this.closedTrafficEdges,
      )
    ) {
      return false
    }
    const facing = this.getVehicleDirection(vehicle)
    const step = directionFromDelta(first.x - here.x, first.z - here.z)
    if (step === oppositeDirection(facing) && !allowUTurn) return false
    if (step !== null) vehicle.facing = step * (Math.PI / 2)
    vehicle.route = route.map(toRoadPosition)
    vehicle.waitMinutes = 0
    if (vehicle.state === 'waiting') {
      vehicle.state = vehicle.resumeState ?? 'driving'
      vehicle.resumeState = null
    }
    const truck = this.getDeliveryFreight(vehicle)
    if (truck) {
      truck.path = vehicle.route.map(toRoadPosition)
    }
    return true
  }

  private sendVisitorCarCirculating(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): boolean {
    const plan = this.findVisitorCarCirculation(vehicle, blockedCells)
    if (plan) {
      vehicle.route = plan.route
      vehicle.target = plan.target
      vehicle.state = plan.route.length > 0 ? 'driving' : 'waiting'
      vehicle.waitMinutes = 0
      return plan.route.length > 0 || vehicle.state === 'waiting'
    }
    return this.nudgeVehicleAlongRoad(vehicle, blockedCells)
  }

  private findVisitorCarCirculation(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): { route: RoadPosition[]; target: NonNullable<RoadVehicle['target']> } | null {
    const start = vehicle.cell ?? vehicle.position
    const edgeZ = -this.getWorldSize() / 2
    const taken = new Set(
      this.state.logistics.roadVehicles
        .filter(
          (other) =>
            other.id !== vehicle.id &&
            other.cell &&
            other.state !== 'parked',
        )
        .map((other) => this.roadPositionKey(other.cell!)),
    )
    blockedCells?.forEach((key) => taken.add(key))
    const holdFor = new Map<string, { x: number; z: number }>()
    const holds: RoadPosition[] = []
    for (const parking of this.state.logistics.parkingCells) {
      for (const approach of this.getParkingApproachRoads(parking)) {
        const key = roadCellKey(approach.x, approach.z)
        if (approach.x === start.x && approach.z === start.z) continue
        if (taken.has(this.roadPositionKey(approach)) || taken.has(key) || holdFor.has(key)) continue
        holdFor.set(key, { x: parking.x, z: parking.z })
        holds.push(approach)
      }
    }
    holds.sort(
      (left, right) =>
        Math.abs(left.x - start.x) +
        Math.abs(left.z - start.z) -
        (Math.abs(right.x - start.x) + Math.abs(right.z - start.z)),
    )
    const holdTargets = holds.slice(0, 8)
    if (holdTargets.length) {
      const route = findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start,
        targets: holdTargets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells,
        allowUTurn: false,
      })
      if (route && route.length) {
        const last = route.at(-1)!
        const parking = holdFor.get(roadCellKey(last.x, last.z))
        return {
          route: route.map(toRoadPosition),
          target: parking
            ? { kind: 'hold', parkingCell: { ...parking } }
            : { kind: 'cruise' },
        }
      }
    }
    const inland = this.state.logistics.roadCells
      .filter((cell) => {
        if (cell.x === start.x && cell.z === start.z) return false
        const distance = Math.abs(cell.x - start.x) + Math.abs(cell.z - start.z)
        return cell.z >= edgeZ + 2 && distance >= 3 && !taken.has(this.roadPositionKey(cell)) && !taken.has(roadCellKey(cell.x, cell.z))
      })
      .sort(
        (left, right) =>
          right.z - left.z ||
          Math.abs(left.x - start.x) +
            Math.abs(left.z - start.z) -
            (Math.abs(right.x - start.x) + Math.abs(right.z - start.z)),
      )
      .slice(0, 8)
    const cruiseTargets = inland.length
      ? inland
      : this.state.logistics.roadCells
          .filter(
            (cell) =>
              !(cell.x === start.x && cell.z === start.z) && cell.z > edgeZ,
          )
          .slice(0, 8)
    if (!cruiseTargets.length) return null
    const cruise = findRoadRoute({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      start,
      targets: cruiseTargets,
      initialDirection: this.getVehicleDirection(vehicle),
      blockedCells,
      allowUTurn: false,
    })
    if (!cruise?.length) return null
    return {
      route: cruise.map(toRoadPosition),
      target: { kind: 'cruise' },
    }
  }

  private nudgeVehicleAlongRoad(
    vehicle: RoadVehicle,
    blockedCells?: ReadonlySet<string>,
  ): boolean {
    const start = vehicle.cell
    if (!start) return false
    const here = this.getRoadCellAt(start.x, start.z, start.elevation)
    if (!here) return false
    const facing = this.getVehicleDirection(vehicle)
    const order: Direction[] = [
      facing,
      ((facing + 1) % 4) as Direction,
      ((facing + 3) % 4) as Direction,
    ]
    const neighbors = this.getRoadGraph().neighbors.get(this.roadPositionKey(here)) ?? []
    const next = order.flatMap((direction) => neighbors.filter((cell) =>
      directionFromDelta(cell.x - start.x, cell.z - start.z) === direction,
    )).find((cell) => !blockedCells?.has(this.roadPositionKey(cell)) &&
      !blockedCells?.has(roadCellKey(cell.x, cell.z)))
    if (!next) return false
    vehicle.route = [toRoadPosition(next)]
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    if (vehicle.kind === 'visitorCar' && !vehicle.target) vehicle.target = { kind: 'cruise' }
    vehicle.waitMinutes = 0
    return true
  }

  private unstickVehicle(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    removedVehicles: Set<string>,
    removedGroups: Set<string>,
    removedVisitors: Set<string>,
  ): void {
    const blockedCells = this.collectRouteBlockedCells(vehicle, occupied)
    if (vehicle.state === 'returning') {
      if (
        this.isQueueTail(vehicle, occupied) &&
        this.reverseQueueTail(vehicle, occupied, blockedCells)
      ) {
        return
      }
      if (
        vehicle.waitMinutes >=
        SIMULATION_CONFIG.logistics.vehicleAbandonMinutes
      ) {
        if (isPlayerOwnedFleetVehicle(vehicle) ||
          (vehicle.kind === 'visitorCar' && vehicle.passengerIds.length > 0)) {
          if (!this.isQueueTail(vehicle, occupied)) vehicle.waitMinutes = 0
          return
        }
        vehicle.passengerIds.forEach((visitorId) => {
          removedVisitors.add(visitorId)
        })
        removedVehicles.add(vehicle.id)
        if (vehicle.groupId) removedGroups.add(vehicle.groupId)
        return
      }
      if (!this.isQueueTail(vehicle, occupied)) vehicle.waitMinutes = 0
      return
    }
    if (!this.isQueueTail(vehicle, occupied)) {
      vehicle.waitMinutes = 0
      return
    }
    if (this.reverseQueueTail(vehicle, occupied, blockedCells)) return
    vehicle.waitMinutes = 0
  }

  private collectRouteBlockedCells(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    keepOpen: readonly RoadPosition[] = [],
  ): Set<string> {
    const blocked = new Set(
      [...occupied.entries()]
        .filter(([, id]) => id !== vehicle.id)
        .map(([key]) => key),
    )
    this.state.festival.infrastructure.trucks.forEach((truck) => {
      if (this.state.logistics.roadVehicles.some((other) => other.kind === 'deliveryTruck' &&
        (other.deliveryId === truck.id || other.id === truck.id))) return
      blocked.add(this.roadPositionKey(truck))
    })
    if (vehicle.cell) blocked.delete(this.roadPositionKey(vehicle.cell))
    keepOpen.forEach((cell) => blocked.delete(this.roadPositionKey(cell)))
    return blocked
  }

  private isSideTurn(vehicle: RoadVehicle, next: RoadPosition): boolean {
    const here = vehicle.cell
    if (!here) return false
    const move = directionFromDelta(next.x - here.x, next.z - here.z)
    if (move === null) return false
    const facing = this.getVehicleDirection(vehicle)
    return move !== facing && move !== oppositeDirection(facing)
  }

  private adoptVehicleRoute(
    vehicle: RoadVehicle,
    route: readonly RoadPosition[],
    blockedNext: RoadPosition,
  ): boolean {
    const here = vehicle.cell
    const first = route[0]
    if (!here || !first) return false
    if (first.x === blockedNext.x && first.z === blockedNext.z) return false
    const firstDir = directionFromDelta(first.x - here.x, first.z - here.z)
    if (firstDir === oppositeDirection(this.getVehicleDirection(vehicle))) {
      return false
    }
    vehicle.route = route.map(toRoadPosition)
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    vehicle.waitMinutes = 0
    return true
  }

  private replanBlockedTurn(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next || !this.isSideTurn(vehicle, next)) return false
    const destination = vehicle.route.at(-1)
    const keepOpen =
      destination &&
      (destination.x !== next.x || destination.z !== next.z)
        ? [destination]
        : []
    const blocked = this.collectRouteBlockedCells(vehicle, occupied, keepOpen)
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state !== 'parking') {
        const plan =
          this.findRouteTowardParking(vehicle, blocked) ??
          this.findVisitorCarCirculation(vehicle, blocked)
        if (plan && this.adoptVehicleRoute(vehicle, plan.route, next)) {
          vehicle.target = plan.target
          return true
        }
      }
    }
    if (vehicle.state === 'returning') {
      const exit = this.findReachableRoadExit(
        here,
        this.getVehicleDirection(vehicle),
        blocked,
        false,
      )
      if (exit && this.adoptVehicleRoute(vehicle, exit.route, next)) return true
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    const searchTargets = [
      ...targets,
      ...(destination &&
      this.getRoadCellAt(destination.x, destination.z) &&
      !targets.some(
        (cell) => cell.x === destination.x && cell.z === destination.z,
      )
        ? [destination]
        : []),
    ]
    if (searchTargets.length) {
      const rebuilt = findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: here,
        targets: searchTargets,
        initialDirection: this.getVehicleDirection(vehicle),
        blockedCells: blocked,
        allowUTurn: false,
      })
      if (
        rebuilt &&
        this.adoptVehicleRoute(
          vehicle,
          rebuilt.map(toRoadPosition),
          next,
        )
      ) {
        return true
      }
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      const plan = this.findVisitorCarCirculation(vehicle, blocked)
      if (plan && this.adoptVehicleRoute(vehicle, plan.route, next)) {
        vehicle.target = plan.target
        return true
      }
    }
    return false
  }

  private realignVehiclesOnRoad(
    x: number,
    z: number,
    facing: Direction | null,
    elevation: number,
  ): void {
    this.state.logistics.roadVehicles.forEach((vehicle) => {
      if (vehicle.state === 'parked') return
      const here = vehicle.cell ?? vehicle.position
      const onTile =
        this.roadPositionKey(here) === roadLayerKey(x, z, elevation)
      if (!onTile) return
      if (facing !== null) vehicle.facing = facing * (Math.PI / 2)
      this.rebuildVehicleRouteFromHere(vehicle)
    })
    this.state.festival.infrastructure.trucks.forEach((truck) => {
      if (truck.x !== x || truck.z !== z) return
      const vehicle = this.state.logistics.roadVehicles.find((candidate) =>
        candidate.kind === 'deliveryTruck' && (candidate.deliveryId === truck.id || candidate.id === truck.id))
      if (this.roadPositionKey(vehicle?.cell ?? vehicle?.position ?? truck) !== roadLayerKey(x, z, elevation)) return
      this.rebuildFreightTruckPath(truck)
    })
  }

  private collectMapExitTargets(): RoadPosition[] {
    const edgeZ = -this.getWorldSize() / 2
    return this.state.logistics.roadCells.filter(
      (road) =>
        road.z === edgeZ &&
        road.x >= -3 &&
        road.x <= 2 &&
        isRoadDirectionAllowed(road, 2),
    )
  }

  private collectRoadOrAccessTargets(position: RoadPosition): RoadPosition[] {
    if (this.getRoadCellAt(position.x, position.z)) {
      return [{ x: position.x, z: position.z }]
    }
    return this.getAdjacentRoadPositions(position)
  }

  private collectGarbageTruckTargets(vehicle: RoadVehicle): RoadPosition[] {
    const target = vehicle.target
    if (vehicle.cargo > 0) return this.collectMapExitTargets()
    if (target?.kind === 'wasteDump') {
      return this.collectRoadOrAccessTargets({ x: target.x, z: target.z })
    }
    if (target?.kind === 'depot') {
      const depot = this.state.logistics.wasteDepots.find(
        (candidate) => candidate.id === target.depotId,
      )
      const access = depot ? this.getLogisticsBuildingAccess(depot, 2) : null
      return access ? [access] : []
    }
    if (target?.kind === 'cell') {
      if (this.isRoadExitCell(target) || this.isOffMapRoadExit(target)) {
        return this.collectMapExitTargets()
      }
      return this.collectRoadOrAccessTargets(target)
    }
    const last = vehicle.route.at(-1)
    return last ? this.collectRoadOrAccessTargets(last) : []
  }

  private collectVehicleRouteTargets(vehicle: RoadVehicle): RoadPosition[] {
    if (vehicle.kind === 'deliveryTruck') {
      return this.collectDeliveryTruckTargets(vehicle)
    }
    if (vehicle.kind === 'garbageTruck') {
      return this.collectGarbageTruckTargets(vehicle)
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning') {
      return this.collectMapExitTargets()
    }
    const target = vehicle.target
    if (!target) {
      const last = vehicle.route.at(-1)
      return last ? this.collectRoadOrAccessTargets(last) : []
    }
    if (target.kind === 'wasteDump') {
      return this.collectRoadOrAccessTargets({ x: target.x, z: target.z })
    }
    if (target.kind === 'cell') {
      if (this.isRoadExitCell(target) || this.isOffMapRoadExit(target)) {
        return this.collectMapExitTargets()
      }
      return this.collectRoadOrAccessTargets(target)
    }
    if (target.kind === 'parking' || target.kind === 'hold') {
      const parking = target.parkingCell ?? vehicle.parkingCell
      return parking ? this.getParkingApproachRoads(parking) : []
    }
    if (target.kind === 'cruise') {
      const last = vehicle.route.at(-1)
      return last ? [last] : []
    }
    if (target.kind === 'busStop') {
      const stop = this.state.logistics.busStops.find(
        (candidate) => candidate.id === target.stopId,
      )
      return stop ? [stop.roadCell] : []
    }
    if (target.kind === 'garage') {
      const garage = this.state.logistics.ambulanceGarages.find(
        (candidate) => candidate.id === target.garageId,
      )
      const access = garage
        ? this.getLogisticsBuildingAccess(garage, 2)
        : null
      return access ? [access] : []
    }
    if (target.kind === 'depot') {
      const depot =
        this.state.logistics.wasteDepots.find(
          (candidate) => candidate.id === target.depotId,
        ) ??
        this.state.logistics.busDepots.find(
          (candidate) => candidate.id === target.depotId,
        )
      const access = depot
        ? this.getLogisticsBuildingAccess(depot, 2)
        : null
      return access ? [access] : []
    }
    if (target.kind === 'tourBusParking') {
      const parking = this.state.buildings.find(
        (building) => building.id === target.buildingId,
      )
      if (!parking) return []
      if (vehicle.state === 'parking') {
        return [{ x: parking.x, z: parking.z, elevation: parking.elevation }]
      }
      return this.getAdjacentRoadPositions(parking)
    }
    return []
  }

  private rebuildVehicleRouteFromHere(vehicle: RoadVehicle): void {
    if (
      vehicle.state === 'idle' ||
      vehicle.state === 'parked' ||
      vehicle.state === 'at-stop'
    ) {
      return
    }
    const start = vehicle.cell ?? vehicle.position
    const occupied = new Map(
      this.state.logistics.roadVehicles
        .filter(
          (other) =>
            other.id !== vehicle.id &&
            other.cell &&
            other.state !== 'parked',
        )
        .map((other) => [
          this.roadPositionKey(other.cell!),
          other.id,
        ]),
    )
    const blocked = this.collectRouteBlockedCells(vehicle, occupied)
    const facing = this.getVehicleDirection(vehicle)
    const applyRoute = (route: readonly RoadPosition[]): boolean => {
      if (!route.length) return false
      const first = route[0]!
      const step = directionFromDelta(first.x - start.x, first.z - start.z)
      if (step === oppositeDirection(facing)) {
        if (
          vehicle.kind !== 'deliveryTruck' &&
          vehicle.kind !== 'garbageTruck'
        ) {
          return false
        }
        vehicle.facing = step * (Math.PI / 2)
      }
      vehicle.route = route.map(toRoadPosition)
      vehicle.waitMinutes = 0
      if (vehicle.state === 'waiting') {
        vehicle.state = vehicle.resumeState ?? 'driving'
        vehicle.resumeState = null
      }
      return true
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state === 'returning') {
      const exit =
        this.findReachableRoadExit(start, facing, blocked, false) ??
        this.findReachableRoadExit(start, facing, undefined, false)
      if (exit && applyRoute(exit.route)) return
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state === 'parking' && vehicle.parkingCell) {
        if (this.isVehicleAtParkingAccess(vehicle)) {
          this.beginVehiclePullIn(vehicle)
          return
        }
        const accesses = this.getParkingApproachRoads(vehicle.parkingCell)
        const reserved = accesses.length
          ? this.routePreferringOpenLights({
              roadCells: this.state.logistics.roadCells,
              graph: this.getRoadGraph(),
              start,
              targets: accesses,
              initialDirection: facing,
              blockedCells: blocked,
              allowUTurn: false,
            })
          : null
        if (reserved && applyRoute(reserved)) return
        this.releaseVisitorCarParking(vehicle)
      }
      const plan =
        this.findRouteTowardParking(vehicle, blocked) ??
        this.findVisitorCarCirculation(vehicle, blocked)
      if (plan && applyRoute(plan.route)) {
        vehicle.target = plan.target
        return
      }
    }
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (targets.length) {
      const rebuilt =
        this.routePreferringOpenLights({
          roadCells: this.state.logistics.roadCells,
          graph: this.getRoadGraph(),
          start,
          targets,
          initialDirection: facing,
          blockedCells: blocked,
          allowUTurn: false,
        }) ??
        findRoadRoute({
          roadCells: this.state.logistics.roadCells,
          graph: this.getRoadGraph(),
          start,
          targets,
          initialDirection: facing,
          allowUTurn: false,
        }) ??
        findRoadRoute({
          roadCells: this.state.logistics.roadCells,
          graph: this.getRoadGraph(),
          start,
          targets,
          allowUTurn: false,
        })
      if (rebuilt && applyRoute(rebuilt)) return
    }
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (this.sendVisitorCarCirculating(vehicle, blocked)) return
    }
    const next = vehicle.route[0]
    if (!next) return
    const step = directionFromDelta(next.x - start.x, next.z - start.z)
    const here = this.getRoadCellAt(start.x, start.z, start.elevation)
    if (
      step !== null &&
      here &&
      !isRoadDirectionAllowed(here, step)
    ) {
      vehicle.route = []
    }
  }

  private rebuildFreightTruckPath(truck: {
    id?: string
    x: number
    z: number
    path: Array<{ x: number; z: number }>
    phase: 'inbound' | 'return'
    depotId: string
  }): void {
    const northZ = -this.getWorldSize() / 2
    const edges = this.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const depot = this.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck.depotId,
    )
    const targets =
      truck.phase === 'return'
        ? edges
        : depot
          ? this.getAdjacentRoadPositions(depot)
          : []
    if (!targets.length) return
    const blocked = this.collectRouteBlockedCells(
      {
        id: `freight:${truck.x}:${truck.z}`,
        cell: { x: truck.x, z: truck.z },
      } as RoadVehicle,
      new Map(
        this.state.logistics.roadVehicles
          .filter((vehicle) => vehicle.cell && vehicle.state !== 'parked')
          .map((vehicle) => [
            this.roadPositionKey(vehicle.cell!),
            vehicle.id,
          ]),
      ),
      targets,
    )
    const vehicle = this.state.logistics.roadVehicles.find(
      (candidate) =>
        candidate.kind === 'deliveryTruck' &&
        (candidate.deliveryId === truck.id || candidate.id === truck.id),
    )
    if (vehicle) {
      const rebuilt = this.findServiceVehicleRoute(vehicle, targets, blocked)
      if (rebuilt?.length) {
        this.adoptServiceRoute(vehicle, rebuilt)
        if (vehicle.state === 'waiting') {
          vehicle.state = vehicle.resumeState ?? 'driving'
          vehicle.resumeState = null
        }
        truck.path = rebuilt.map(toRoadPosition)
      }
      return
    }
    const route =
      findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: truck,
        targets,
        blockedCells: blocked,
        allowUTurn: false,
      }) ??
      findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: truck,
        targets,
        allowUTurn: false,
      })
    if (route?.length) {
      truck.path = route.map(toRoadPosition)
    }
  }

  private cellBehindVehicle(vehicle: RoadVehicle): RoadPosition | null {
    const here = vehicle.cell
    if (!here) return null
    const back = oppositeDirection(this.getVehicleDirection(vehicle))
    const road = (this.getRoadGraph().neighbors.get(this.roadPositionKey(here)) ?? []).find(
      (cell) => directionFromDelta(cell.x - here.x, cell.z - here.z) === back,
    )
    return road ? toRoadPosition(road) : null
  }

  private isQueueTail(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next) return false
    const blocker = occupied.get(this.roadPositionKey(next))
    if (!blocker || blocker === vehicle.id) return false
    const behind = this.cellBehindVehicle(vehicle)
    return !this.state.logistics.roadVehicles.some((other) => {
      if (other.id === vehicle.id || other.state === 'parked') return false
      if (other.route[0] && this.roadPositionKey(other.route[0]) === this.roadPositionKey(here)) {
        return true
      }
      return Boolean(
        behind && other.cell && this.roadPositionKey(other.cell) === this.roadPositionKey(behind),
      )
    })
  }

  private reverseQueueTail(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
    blockedCells: ReadonlySet<string>,
  ): boolean {
    const here = vehicle.cell
    if (!here) return false
    const behind = this.cellBehindVehicle(vehicle)
    if (!behind || !this.getRoadCellAt(behind.x, behind.z)) return false
    if (!this.isLegalRoadStep(here, behind)) return false
    if (occupied.has(this.roadPositionKey(behind))) return false
    const searchBlocked = new Set(blockedCells)
    searchBlocked.add(this.roadPositionKey(here))
    const fromBehind = {
      ...vehicle,
      cell: behind,
      position: behind,
    }
    let continuation: RoadPosition[] = []
    if (vehicle.kind === 'visitorCar' && vehicle.state !== 'returning') {
      if (vehicle.state !== 'parking') {
        const plan =
          this.findRouteTowardParking(fromBehind, searchBlocked) ??
          this.findVisitorCarCirculation(fromBehind, searchBlocked)
        if (plan?.route.length) {
          continuation = plan.route
          vehicle.target = plan.target
        }
      }
    }
    if (!continuation.length && vehicle.state === 'returning') {
      const exit = this.findReachableRoadExit(
        behind,
        this.getVehicleDirection(vehicle),
        searchBlocked,
        false,
      )
      if (exit?.route.length) {
        continuation = exit.route.map(toRoadPosition)
      }
    }
    if (!continuation.length) {
      const destination = vehicle.route.at(-1)
      if (destination) {
        const rebuilt = findRoadRoute({
          roadCells: this.state.logistics.roadCells,
          graph: this.getRoadGraph(),
          start: behind,
          targets: [destination],
          initialDirection: this.getVehicleDirection(vehicle),
          blockedCells: searchBlocked,
          allowUTurn: false,
        })
        if (rebuilt?.length) {
          continuation = rebuilt.map(toRoadPosition)
        }
      }
    }
    if (
      !continuation.length &&
      vehicle.kind === 'visitorCar' &&
      vehicle.state !== 'returning'
    ) {
      const plan = this.findVisitorCarCirculation(fromBehind, searchBlocked)
      if (plan?.route.length) {
        continuation = plan.route
        vehicle.target = plan.target
      }
    }
    const planned = [toRoadPosition(behind), ...continuation]
    vehicle.route = this.roadRouteIsConnected(here, planned)
      ? planned
      : [toRoadPosition(behind)]
    if (vehicle.state === 'waiting') vehicle.state = 'driving'
    vehicle.waitMinutes = 0
    return true
  }

  private roadRouteIsConnected(
    start: RoadPosition,
    route: readonly RoadPosition[],
  ): boolean {
    let previous = start
    for (const cell of route) {
      if (Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z) !== 1) {
        return false
      }
      previous = cell
    }
    return route.length > 0
  }

  private isLegalRoadStep(from: RoadPosition, to: RoadPosition): boolean {
    const road = this.getRoadCellAt(from.x, from.z, from.elevation)
    const next = this.getRoadCellAt(to.x, to.z, to.elevation)
    // Parking and off-map access have their own checks.
    if (!road || !next) return true
    const fromKey = roadLayerKey(from.x, from.z, roadLayerElevation(road))
    return (this.getRoadGraph().neighbors.get(fromKey) ?? []).some(
      (neighbor) =>
        neighbor.x === to.x &&
        neighbor.z === to.z &&
        (to.elevation === undefined ||
          elevationsMatch(roadLayerElevation(neighbor), to.elevation)),
    )
  }

  private replanBlockedReverse(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    if (!isVehicleReversing(vehicle)) return false
    const here = vehicle.cell
    const next = vehicle.route[0]
    if (!here || !next) return false
    const blocker = occupied.get(this.roadPositionKey(next))
    if (!blocker || blocker === vehicle.id) return false
    const targets = this.collectVehicleRouteTargets(vehicle)
    if (!targets.length) {
      vehicle.route = []
      vehicle.waitMinutes = 0
      return true
    }
    const facing = this.getVehicleDirection(vehicle)
    const blocked = this.collectRouteBlockedCells(vehicle, occupied)
    const forward =
      findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: here,
        targets,
        initialDirection: facing,
        blockedCells: blocked,
        allowUTurn: false,
      }) ??
      findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: here,
        targets,
        initialDirection: facing,
        allowUTurn: false,
      })
    if (!forward?.length) return false
    vehicle.route = forward.map(toRoadPosition)
    vehicle.waitMinutes = 0
    return true
  }

  private parkingApproachStarts(parking: RoadPosition): RoadPosition[] {
    return this.getParkingApproachRoads(parking).map((approach) => {
      const road = this.getRoadCellAt(approach.x, approach.z)
      return road ? toRoadPosition(road) : approach
    })
  }

  private startParkedCarDeparture(
    vehicle: RoadVehicle,
    group: ArrivalGroup,
    occupied: ReadonlyMap<string, string>,
  ): 'started' | 'blocked' | 'no-route' {
    if (!vehicle.parkingCell) return 'no-route'
    const approaches = this.parkingApproachStarts(vehicle.parkingCell)
    const free = approaches.filter(
      (cell) => !occupied.has(this.roadPositionKey(cell)),
    )
    const departure =
      this.findDepartureFromAccesses(vehicle, free, true) ??
      this.findDepartureFromAccesses(vehicle, approaches, true)
    if (!departure) return 'no-route'
    const { access, exit, initialDirection } = departure
    if (occupied.has(this.roadPositionKey(access))) return 'blocked'
    const parking = this.state.logistics.parkingCells.find(
      (cell) =>
        cell.x === vehicle.parkingCell?.x &&
        cell.z === vehicle.parkingCell?.z,
    )
    if (parking) parking.occupiedBy = null
    const parkedAt = { ...vehicle.parkingCell }
    vehicle.cell = parkedAt
    vehicle.position = parkedAt
    // Cars are parked nose-in. Keep the nose toward the bay while the first
    // route step backs onto the adjacent road, then turn along the exit route.
    vehicle.facing = oppositeDirection(initialDirection) * (Math.PI / 2)
    vehicle.parkingCell = null
    vehicle.route = [
      { ...access },
      ...exit.route.map((cell) => toRoadPosition(cell)),
    ]
    vehicle.state = 'returning'
    vehicle.waitMinutes = 0
    group.state = 'leaving'
    return 'started'
  }

  private findDepartureFromAccesses(
    vehicle: RoadVehicle,
    accesses: readonly RoadPosition[],
    allowUTurn: boolean,
  ): {
    access: RoadPosition
    exit: { position: RoadPosition; route: RoadCell[] }
    initialDirection: Direction
  } | null {
    for (const access of accesses) {
      const initialDirection = this.getDirectionIndex(
        access.x - vehicle.parkingCell!.x,
        access.z - vehicle.parkingCell!.z,
      ) as Direction
      const exit = this.findReachableRoadExit(
        access,
        initialDirection,
        undefined,
        allowUTurn,
      )
      if (exit) return { access, exit, initialDirection }
    }
    return null
  }

  private findReachableRoadExit(
    start: RoadPosition,
    initialDirection: Direction,
    blockedCells?: ReadonlySet<string>,
    allowUTurn = false,
  ): { position: RoadPosition; route: RoadCell[] } | null {
    // Occupancy-dependent detours must always use the current blocking cells.
    if (blockedCells?.size) {
      return this.searchReachableRoadExit(start, initialDirection, blockedCells, allowUTurn)
    }
    const graph = this.getRoadGraph()
    const road = this.getRoadCellAt(start.x, start.z, start.elevation)
    if (!road) return null
    let cache = this.roadExitRoutes.get(graph)
    if (!cache) {
      cache = new Map()
      this.roadExitRoutes.set(graph, cache)
    }
    const key = `${roadLayerKey(road.x, road.z, roadLayerElevation(road))}:${initialDirection}:${Number(allowUTurn)}`
    if (!cache.has(key)) {
      cache.set(key, this.searchReachableRoadExit(start, initialDirection, undefined, allowUTurn))
    }
    const result = cache.get(key)
    return result ? {
      position: { ...result.position },
      route: result.route.map((cell) => ({ ...cell })),
    } : null
  }

  private searchReachableRoadExit(
    start: RoadPosition,
    initialDirection: Direction,
    blockedCells?: ReadonlySet<string>,
    allowUTurn = false,
  ): { position: RoadPosition; route: RoadCell[] } | null {
    const search = (targets: RoadPosition[]) => {
      if (targets.length === 0) return null
      return findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start,
        targets,
        initialDirection,
        blockedCells,
        allowUTurn,
      })
    }
    const exits = this.collectMapExitTargets()
    const route =
      search(exits) ??
      search(
        this.state.logistics.roadCells.filter(
          (road) =>
            road.z === -this.getWorldSize() / 2 &&
            isRoadDirectionAllowed(road, 2),
        ),
      )
    if (!route) return null
    const last = route.at(-1) ?? start
    return {
      position: { x: last.x, z: last.z },
      route,
    }
  }

  private dispatchGarbageTruck(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const claimed = new Set(
      this.state.logistics.roadVehicles
        .filter(
          (candidate) =>
            candidate.kind === 'garbageTruck' &&
            candidate.id !== vehicle.id &&
            candidate.state !== 'idle',
        )
        .map((candidate) =>
          candidate.target?.kind === 'wasteDump'
            ? `${candidate.target.x}:${candidate.target.z}`
            : '',
        ),
    )
    const dumps = this.state.wasteDumpCells.filter(
      (cell) =>
        cell.stored > 0 && !claimed.has(`${cell.x}:${cell.z}`),
    )
    const totalStored = dumps.reduce((sum, cell) => sum + cell.stored, 0)
    if (totalStored < SIMULATION_CONFIG.waste.truckDispatchThreshold) return
    const accesses = this.getWasteDumpRoadAccesses(dumps)
    if (accesses.length === 0) return
    const alreadyThere = accesses.some(
      (access) =>
        access.road.x === vehicle.cell?.x && access.road.z === vehicle.cell.z,
    )
    if (alreadyThere) {
      const dump =
        accesses.find(
          (access) =>
            access.road.x === vehicle.cell?.x &&
            access.road.z === vehicle.cell.z,
        )?.dump ?? dumps[0]
      if (!dump) return
      vehicle.target = { kind: 'wasteDump', x: dump.x, z: dump.z }
      vehicle.route = []
      vehicle.state = 'responding'
      this.finishGarbageTruckLeg(vehicle)
      return
    }
    const route = this.findGarbageTruckRoute(
      vehicle,
      accesses.map((access) => access.road),
    )
    if (!route) return
    const last = route.at(-1) ?? vehicle.cell
    const dump =
      accesses.find(
        (access) => access.road.x === last.x && access.road.z === last.z,
      )?.dump ?? dumps[0]
    if (!dump) return
    vehicle.target = { kind: 'wasteDump', x: dump.x, z: dump.z }
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'responding'
  }

  private getWasteDumpRoadAccesses(
    dumps: readonly { x: number; z: number; stored: number }[],
  ): Array<{ dump: { x: number; z: number; stored: number }; road: RoadPosition }> {
    const dumpArea =
      dumps.length > 0
        ? this.state.wasteDumpCells
        : []
    const seeds = dumps.length > 0 ? dumpArea : dumps
    const seen = new Set<string>()
    const accesses: Array<{
      dump: { x: number; z: number; stored: number }
      road: RoadPosition
    }> = []
    seeds.forEach((dump) => {
      this.getAdjacentRoadPositions(dump).forEach((road) => {
        const key = `${road.x}:${road.z}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dump, road })
      })
    })
    return accesses.sort((left, right) => right.dump.stored - left.dump.stored)
  }

  private getDeliveryFreight(vehicle: RoadVehicle) {
    return this.state.festival.infrastructure.trucks.find(
      (truck) =>
        truck.id === vehicle.deliveryId || truck.id === vehicle.id,
    )
  }

  private collectDeliveryTruckTargets(vehicle: RoadVehicle): RoadPosition[] {
    const truck = this.getDeliveryFreight(vehicle)
    const northZ = -this.getWorldSize() / 2
    const edges = this.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    if (vehicle.state === 'returning' || truck?.phase === 'return') {
      return edges
    }
    const depot = this.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck?.depotId,
    )
    return depot ? this.getAdjacentRoadPositions(depot) : []
  }

  private findServiceVehicleRoute(
    vehicle: RoadVehicle,
    targets: readonly RoadPosition[],
    blockedCells?: ReadonlySet<string>,
  ): RoadPosition[] | null {
    if (targets.length === 0) return null
    const northZ = -this.getWorldSize() / 2
    let start = vehicle.cell ?? vehicle.position
    const prefix: RoadPosition[] = []
    if (start.z < northZ) {
      prefix.push({ x: start.x, z: northZ })
      start = { x: start.x, z: northZ }
    }
    if (!this.getRoadCellAt(start.x, start.z)) return null
    const facing = this.getVehicleDirection(vehicle)
    const hereRoad = this.getRoadCellAt(start.x, start.z)
    const exits = hereRoad
      ? DIRECTIONS.filter((direction) =>
          isRoadDirectionAllowed(hereRoad, direction),
        )
      : []
    const graph = this.getRoadGraph()
    const search = (
      blocked?: ReadonlySet<string>,
      direction?: Direction,
    ) =>
      this.routePreferringOpenLights({
        roadCells: this.state.logistics.roadCells,
        graph,
        start,
        targets,
        blockedCells: blocked,
        initialDirection: direction,
        allowUTurn: false,
      })
    for (const direction of [facing, ...exits, undefined]) {
      const route = search(blockedCells, direction) ?? search(undefined, direction)
      if (!route?.length) continue
      if (direction !== undefined && direction !== facing) {
        vehicle.facing = direction * (Math.PI / 2)
      }
      return [
        ...prefix,
        ...route.map(toRoadPosition),
      ]
    }
    return null
  }

  private adoptServiceRoute(
    vehicle: RoadVehicle,
    route: RoadPosition[],
  ): void {
    vehicle.route = route
    const here = vehicle.cell ?? vehicle.position
    const first = route[0]
    const step = first
      ? directionFromDelta(first.x - here.x, first.z - here.z)
      : null
    if (step !== null) vehicle.facing = step * (Math.PI / 2)
    vehicle.waitMinutes = 0
  }

  private deliverySpawnFacing(truck: {
    x: number
    z: number
    path: Array<{ x: number; z: number }>
    phase: 'inbound' | 'return'
  }): number {
    const inbound = truck.phase === 'return' ? 2 : 0
    const next = truck.path[0]
    const step = next
      ? directionFromDelta(next.x - truck.x, next.z - truck.z)
      : null
    if (step === inbound || step === oppositeDirection(inbound as Direction)) {
      return step * (Math.PI / 2)
    }
    return inbound * (Math.PI / 2)
  }

  private syncFreightToVehicles(): void {
    const trucks = this.state.festival.infrastructure.trucks
    const vehicles = this.state.logistics.roadVehicles
    const byId = new Map<string, RoadVehicle>()
    for (const vehicle of vehicles) {
      if (vehicle.kind !== 'deliveryTruck') continue
      byId.set(vehicle.id, vehicle)
      if (vehicle.deliveryId) byId.set(vehicle.deliveryId, vehicle)
    }
    const keep = new Set<string>()
    for (const truck of trucks) {
      let vehicle = byId.get(truck.id)
      if (!vehicle) {
        vehicle = this.createRoadVehicle(truck.id, 'deliveryTruck', {
          x: truck.x,
          z: truck.z,
        })
        vehicle.deliveryId = truck.id
        vehicle.route = truck.path.map(toRoadPosition)
        vehicle.cargo = truck.cargo
        vehicle.stuckMinutes = truck.stuck
        vehicle.testedGroundCell = truck.testedCell
        vehicle.state = truck.phase === 'return' ? 'returning' : 'driving'
        vehicle.target =
          truck.phase === 'return'
            ? {
                kind: 'cell',
                x: truck.path.at(-1)?.x ?? truck.x,
                z: truck.path.at(-1)?.z ?? truck.z,
              }
            : { kind: 'depot', depotId: truck.depotId }
        vehicle.facing = this.deliverySpawnFacing(truck)
        vehicles.push(vehicle)
      }
      keep.add(vehicle.id)
    }
    this.state.logistics.roadVehicles = vehicles.filter(
      (vehicle) =>
        vehicle.kind !== 'deliveryTruck' || keep.has(vehicle.id),
    )
  }

  private syncVehiclesToFreight(): void {
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'deliveryTruck') continue
      const truck = this.getDeliveryFreight(vehicle)
      if (!truck) continue
      const here = vehicle.cell ?? vehicle.position
      truck.x = here.x
      truck.z = here.z
      truck.path = vehicle.route.map(toRoadPosition)
      truck.phase = vehicle.state === 'returning' ? 'return' : 'inbound'
      truck.cargo = vehicle.cargo
      truck.stuck = vehicle.stuckMinutes ?? 0
      truck.testedCell = vehicle.testedGroundCell ?? ''
      truck.progress = 0
    }
  }

  private finishDeliveryTruckLeg(
    vehicle: RoadVehicle,
    removedVehicles: Set<string>,
  ): void {
    const truck = this.getDeliveryFreight(vehicle)
    if (!truck) {
      removedVehicles.add(vehicle.id)
      return
    }
    const here = vehicle.cell ?? vehicle.position
    truck.x = here.x
    truck.z = here.z
    const northZ = -this.getWorldSize() / 2
    const edges = this.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const depot = this.state.festival.infrastructure.depots.find(
      (candidate) => candidate.id === truck.depotId,
    )
    const atBay = Boolean(
      depot &&
        this.getAdjacentRoadPositions(depot).some(
          (cell) => cell.x === here.x && cell.z === here.z,
        ),
    )
    const atEdge = edges.some((edge) => edge.x === here.x && edge.z === here.z)
    const leaveMap = () => {
      this.state.festival.infrastructure.trucks =
        this.state.festival.infrastructure.trucks.filter(
          (candidate) => candidate.id !== truck.id,
        )
      removedVehicles.add(vehicle.id)
    }
    if (vehicle.state === 'returning' || truck.phase === 'return') {
      if (atEdge || here.z < northZ) {
        leaveMap()
        return
      }
      const route = this.findServiceVehicleRoute(vehicle, edges)
      vehicle.state = 'returning'
      truck.phase = 'return'
      if (route?.length) {
        this.adoptServiceRoute(vehicle, route)
        vehicle.target = { kind: 'cell', ...(route.at(-1) ?? here) }
        truck.path = route
      } else if (atEdge) {
        leaveMap()
      }
      return
    }
    if (depot && atBay) {
      depot.stock[truck.kind] += truck.cargo
      truck.cargo = 0
      vehicle.cargo = 0
      this.state.festival.deliveries = this.state.festival.deliveries.filter(
        (delivery) => delivery.id !== truck.deliveryId,
      )
      truck.deliveryId = null
      truck.phase = 'return'
      this.state.festival.infrastructure.status =
        'Ware im Depot entladen – Träger verteilen sie an die Stände'
      vehicle.state = 'returning'
      const route = this.findServiceVehicleRoute(vehicle, edges)
      if (route?.length) {
        this.adoptServiceRoute(vehicle, route)
        vehicle.target = { kind: 'cell', ...(route.at(-1) ?? here) }
        truck.path = route
      }
      return
    }
    const bays = depot ? this.getAdjacentRoadPositions(depot) : []
    const route = this.findServiceVehicleRoute(vehicle, bays)
    if (route?.length) {
      this.adoptServiceRoute(vehicle, route)
      vehicle.state = 'driving'
      vehicle.target = { kind: 'depot', depotId: truck.depotId }
      truck.path = route
    }
  }

  private replanOffMapDelivery(
    vehicle: RoadVehicle,
    occupied: ReadonlyMap<string, string>,
  ): boolean {
    if (vehicle.kind !== 'deliveryTruck') return false
    const northZ = -this.getWorldSize() / 2
    const here = vehicle.cell ?? vehicle.position
    if (here.z >= northZ) return false
    const edges = this.state.logistics.roadCells.filter(
      (road) => road.z === northZ,
    )
    const targets = this.collectDeliveryTruckTargets(vehicle)
    if (!targets.length) return false
    for (const edge of edges) {
      if (occupied.has(this.roadPositionKey(edge))) continue
      const rest = findRoadRoute({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: edge,
        targets,
        initialDirection: 0,
        allowUTurn: false,
        blockedCells: this.collectRouteBlockedCells(vehicle, occupied, targets),
      })
      if (!rest) continue
      vehicle.cell = { x: edge.x, z: northZ - 1 }
      vehicle.position = { ...vehicle.cell }
      vehicle.facing = 0
      vehicle.route = [
        { x: edge.x, z: edge.z },
        ...rest.map(toRoadPosition),
      ]
      vehicle.waitMinutes = 0
      const truck = this.getDeliveryFreight(vehicle)
      if (truck) {
        truck.x = vehicle.cell.x
        truck.z = vehicle.cell.z
        truck.path = vehicle.route.map(toRoadPosition)
      }
      return true
    }
    return false
  }

  private findGarbageTruckRoute(
    vehicle: RoadVehicle,
    targets: readonly RoadPosition[],
    blockedCells?: ReadonlySet<string>,
  ): RoadPosition[] | null {
    return this.findServiceVehicleRoute(vehicle, targets, blockedCells)
  }

  private finishGarbageTruckLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding') {
      let room = Math.max(
        0,
        SIMULATION_CONFIG.logistics.garbageTruckCapacity - vehicle.cargo,
      )
      const dumps = this.state.wasteDumpCells
        .filter((cell) => cell.stored > 0)
        .sort((left, right) => {
          const truck = vehicle.cell ?? vehicle.position
          return (
            Math.abs(left.x - truck.x) +
            Math.abs(left.z - truck.z) -
            (Math.abs(right.x - truck.x) + Math.abs(right.z - truck.z))
          )
        })
      dumps.forEach((dump) => {
        if (room <= 0) return
        const taken = Math.min(dump.stored, room)
        dump.stored -= taken
        vehicle.cargo += taken
        room -= taken
      })
      vehicle.state = 'waiting'
      vehicle.waitMinutes = SIMULATION_CONFIG.waste.truckLoadMinutes
      vehicle.resumeState = 'returning'
      return
    }
    if (vehicle.state === 'returning' && vehicle.cargo > 0) {
      if (!this.isOffMapRoadExit(vehicle.cell ?? vehicle.position)) {
        const offMap = this.getOffMapRoadExit(vehicle.cell ?? vehicle.position)
        vehicle.route = [offMap]
        vehicle.target = { kind: 'cell', ...offMap }
        vehicle.facing = Math.PI
        return
      }
      vehicle.cargo = 0
      vehicle.state = 'waiting'
      vehicle.waitMinutes = 0
      vehicle.resumeState = 'returning'
      return
    }
    if (this.isOffMapRoadExit(vehicle.cell ?? vehicle.position)) {
      if (!this.reenterGarbageTruck(vehicle)) {
        this.holdGarbageTruckOffMap(vehicle)
      }
      return
    }
    vehicle.state = 'idle'
    vehicle.target = null
    vehicle.route = []
    vehicle.resumeState = null
  }

  private continueGarbageTruck(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    if (vehicle.cargo > 0) {
      if (
        this.isRoadExitCell(vehicle.cell) ||
        this.isOffMapRoadExit(vehicle.cell)
      ) {
        const offMap = this.getOffMapRoadExit(vehicle.cell)
        vehicle.route = this.isOffMapRoadExit(vehicle.cell) ? [] : [offMap]
        vehicle.target = { kind: 'cell', ...offMap }
        vehicle.state = 'returning'
        vehicle.resumeState = null
        vehicle.facing = Math.PI
        if (vehicle.route.length === 0) this.finishGarbageTruckLeg(vehicle)
        return
      }
      const exit = this.findReachableRoadExit(
        vehicle.cell,
        this.getVehicleDirection(vehicle),
        undefined,
        true,
      )
      if (!exit) {
        vehicle.state = 'idle'
        return
      }
      const offMap = this.getOffMapRoadExit(exit.position)
      vehicle.route = [
        ...exit.route.map(toRoadPosition),
        offMap,
      ]
      vehicle.target = { kind: 'cell', ...offMap }
      vehicle.state = 'returning'
      vehicle.resumeState = null
      return
    }
    if (this.isOffMapRoadExit(vehicle.cell)) {
      if (!this.reenterGarbageTruck(vehicle)) {
        this.holdGarbageTruckOffMap(vehicle)
      }
      return
    }
    const depot = this.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.getLogisticsBuildingAccess(depot, 2) : null
    if (!depot || !access) {
      vehicle.state = 'idle'
      return
    }
    if (access.x === vehicle.cell.x && access.z === vehicle.cell.z) {
      vehicle.state = 'idle'
      vehicle.target = { kind: 'depot', depotId: depot.id }
      vehicle.route = []
      vehicle.resumeState = null
      return
    }
    const route = this.findGarbageTruckRoute(vehicle, [access])
    if (!route?.length) {
      if (this.isRoadExitCell(vehicle.cell) || this.isOffMapRoadExit(vehicle.cell)) {
        this.holdGarbageTruckOffMap(vehicle)
        return
      }
      vehicle.state = 'idle'
      return
    }
    vehicle.route = route
    vehicle.target = { kind: 'depot', depotId: depot.id }
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  private restoreMissingGarbageTrucks(): void {
    const existing = new Set(
      this.state.logistics.roadVehicles.map((vehicle) => vehicle.id),
    )
    for (const depot of this.state.logistics.wasteDepots) {
      for (const id of depot.truckIds) {
        if (existing.has(id)) continue
        const access =
          this.getLogisticsBuildingAccess(depot, 2) ??
          this.findAvailableRoadEntry() ??
          this.getRoadEntry()
        this.state.logistics.roadVehicles.push(
          this.createRoadVehicle(id, 'garbageTruck', access),
        )
        existing.add(id)
      }
    }
  }

  private returnGarbageTruckToDepot(vehicle: RoadVehicle): void {
    const depot = this.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.getLogisticsBuildingAccess(depot, 2) : null
    const here = access ?? this.findAvailableRoadEntry() ?? this.getRoadEntry()
    vehicle.cell = { ...here }
    vehicle.position = { ...here }
    vehicle.facing = 0
    vehicle.cargo = 0
    vehicle.route = []
    vehicle.waitMinutes = 0
    vehicle.resumeState = null
    vehicle.target = depot ? { kind: 'depot', depotId: depot.id } : null
    vehicle.state = 'idle'
  }

  private isGarbageTruckAtHome(vehicle: RoadVehicle): boolean {
    const here = vehicle.cell ?? vehicle.position
    if (this.isOffMapRoadExit(here)) return false
    const depot = this.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.getLogisticsBuildingAccess(depot, 2) : null
    return Boolean(access && access.x === here.x && access.z === here.z)
  }

  private holdGarbageTruckOffMap(vehicle: RoadVehicle): void {
    const offMap = this.getOffMapRoadExit(vehicle.cell ?? vehicle.position)
    vehicle.cell = { ...offMap }
    vehicle.position = { ...offMap }
    vehicle.facing = Math.PI
    vehicle.route = []
    vehicle.target = { kind: 'cell', ...offMap }
    vehicle.state = 'waiting'
    vehicle.resumeState = 'returning'
  }

  private reenterGarbageTruck(vehicle: RoadVehicle): boolean {
    const depot = this.state.logistics.wasteDepots.find((candidate) =>
      candidate.truckIds.includes(vehicle.id),
    )
    const access = depot ? this.getLogisticsBuildingAccess(depot, 2) : null
    const entries = this.listFreeRoadEntries(vehicle.id, false)
    if (entries.length === 0) {
      this.holdGarbageTruckOffMap(vehicle)
      return false
    }
    for (const entry of entries) {
      vehicle.cell = { ...entry }
      vehicle.position = { ...entry }
      vehicle.facing = 0
      vehicle.cargo = 0
      if (!depot || !access) {
        vehicle.target = null
        vehicle.route = []
        vehicle.waitMinutes = 0
        vehicle.state = 'idle'
        vehicle.resumeState = null
        return true
      }
      if (access.x === entry.x && access.z === entry.z) {
        vehicle.target = { kind: 'depot', depotId: depot.id }
        vehicle.route = []
        vehicle.waitMinutes = 0
        vehicle.state = 'idle'
        vehicle.resumeState = null
        return true
      }
      const route = this.findGarbageTruckRoute(vehicle, [access])
      if (!route?.length) continue
      vehicle.target = { kind: 'depot', depotId: depot.id }
      vehicle.route = route
      vehicle.waitMinutes = 0
      vehicle.state = 'returning'
      vehicle.resumeState = null
      return true
    }
    this.holdGarbageTruckOffMap(vehicle)
    return false
  }

  private claimedTentCellKeys(): Set<string> {
    if (this.claimedTentCellsCache) return this.claimedTentCellsCache
    const living = new Set(this.state.visitors.map((visitor) => visitor.id))
    const keys = new Set<string>()
    this.state.campInstallations.forEach((installation) => {
      if (installation.kind !== 'tent') return
      if (!installationIsClaimed(installation, living)) return
      keys.add(roadCellKey(installation.cell.x, installation.cell.z))
    })
    this.claimedTentCellsCache = keys
    return keys
  }

  private updateSweeper(vehicle: RoadVehicle, minutes: number): void {
    if (vehicle.state === 'waiting') {
      vehicle.waitMinutes -= minutes
      if (vehicle.waitMinutes <= 0) this.continueSweeper(vehicle)
      return
    }
    if (vehicle.state === 'idle') this.dispatchSweeper(vehicle)
    if (!vehicle.route.length) {
      if (vehicle.state !== 'idle') this.finishSweeperLeg(vehicle)
      return
    }
    const path = vehicle.cell
      ? this.getPathAt(
          vehicle.cell.x,
          vehicle.cell.z,
          this.getTerrainHeight(vehicle.cell.x, vehicle.cell.z),
        ) ?? this.getPathAt(vehicle.cell.x, vehicle.cell.z)
      : undefined
    const mudSlowdown =
      vehicle.cell && this.isMudTerrain(vehicle.cell.x, vehicle.cell.z)
        ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
        : 1
    const footSpeed = vehicle.cell
      ? wayInfo(
          this.state,
          vehicle.cell.x,
          vehicle.cell.z,
          'foot',
          path?.wayType,
        ).speed
      : 1
    vehicle.speed += minutes * mudSlowdown * Math.min(1, footSpeed)
    const interval = SIMULATION_CONFIG.logistics.sweeperMoveIntervalMinutes
    if (vehicle.speed < interval) return
    vehicle.speed %= interval
    const next = vehicle.route[0]
    if (!next) {
      this.finishSweeperLeg(vehicle)
      return
    }
    if (this.claimedTentCellKeys().has(roadCellKey(next.x, next.z))) {
      vehicle.route = []
      vehicle.state = 'idle'
      this.dispatchSweeper(vehicle)
      return
    }
    if (this.visitorsOnCellsThisTick?.has(roadCellKey(next.x, next.z))) {
      vehicle.speed = 0
      return
    }
    if (!this.isSweeperDriveCell(next.x, next.z)) {
      vehicle.route = []
      return
    }
    vehicle.facing = Math.atan2(
      next.x - (vehicle.cell?.x ?? vehicle.position.x),
      next.z - (vehicle.cell?.z ?? vehicle.position.z),
    )
    vehicle.cell = { x: next.x, z: next.z }
    vehicle.position = { x: next.x, z: next.z }
    vehicle.route.shift()
    vehicle.waitMinutes = 0
    this.sweepAround(vehicle)
    if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
      vehicle.route = []
      this.sendSweeperToDump(vehicle)
    }
  }

  private sweeperCell(vehicle: RoadVehicle): Cell {
    const x = vehicle.cell?.x ?? vehicle.position.x
    const z = vehicle.cell?.z ?? vehicle.position.z
    const path =
      this.getPathAt(x, z, this.getTerrainHeight(x, z)) ?? this.getPathAt(x, z)
    return {
      x,
      z,
      elevation: path?.elevation ?? this.getTerrainHeight(x, z),
    }
  }

  private findSweeperRoute(
    vehicle: RoadVehicle,
    goals: readonly Cell[],
  ): RoadPosition[] | null {
    const start = this.sweeperCell(vehicle)
    const usable = goals.filter(
      (goal) => !this.claimedTentCellKeys().has(roadCellKey(goal.x, goal.z)),
    )
    if (usable.length === 0) return null
    this.ensurePedestrianNav(this.lastNavRevision !== this.worldRevision)
    const goalKeys = new Set(usable.map((goal) => this.packCell(goal)))
    const path = findWeightedPath(
      {
        start,
        key: (cell) => this.packCell(cell),
        isGoal: (cell) => goalKeys.has(this.packCell(cell)),
        maxVisited: 4000,
        neighbors: (cell) =>
          this.getPedestrianNeighbors(cell, {
            allowQueue: false,
            allowCamping: true,
            allowMedical: true,
            allowFestival: true,
            allowGrass: false,
            // Same staff-only access as walking staff so robots can use Personaleingang.
            allowStaff: true,
          }).filter((next) => this.isSweeperDriveCell(next.x, next.z, next.elevation)),
        movementCost: (_from, to) =>
          this.pedestrianNav.get(this.packCell(to))?.cost ??
          this.getPedestrianSurfaceCost(to),
        heuristic: (cell) => {
          let nearest = Number.POSITIVE_INFINITY
          for (const goal of usable) {
            const distance =
              Math.abs(goal.x - cell.x) + Math.abs(goal.z - cell.z)
            if (distance < nearest) nearest = distance
          }
          return nearest
        },
      },
      this.sweeperPathScratch,
    )
    if (!path?.length) return null
    return path.map(toRoadPosition)
  }

  private dispatchSweeper(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
      this.sendSweeperToDump(vehicle)
      return
    }
    const accesses = this.getSweeperDirtAccesses(vehicle.workZones)
    if (accesses.length === 0) {
      if (vehicle.cargo > 0) {
        this.sendSweeperToDump(vehicle)
        return
      }
      this.sendSweeperToDepot(vehicle)
      return
    }
    const here = accesses.find(
      (access) =>
        access.path.x === vehicle.cell?.x && access.path.z === vehicle.cell?.z,
    )
    if (here) {
      vehicle.target = { kind: 'cell', x: here.dirt.x, z: here.dirt.z }
      vehicle.route = []
      vehicle.state = 'responding'
      return
    }
    const route = this.findSweeperRoute(
      vehicle,
      accesses.map((access) => access.path),
    )
    if (!route?.length) return
    const last = route.at(-1) ?? vehicle.cell
    const dirt =
      accesses.find(
        (access) => access.path.x === last.x && access.path.z === last.z,
      )?.dirt ?? accesses[0]?.dirt
    if (!dirt) return
    vehicle.target = { kind: 'cell', x: dirt.x, z: dirt.z }
    vehicle.route = route
    vehicle.state = 'responding'
  }

  private getSweeperDirtAccesses(zones?: string[]): Array<{
    dirt: { x: number; z: number }
    path: Cell
  }> {
    const blocked = this.claimedTentCellKeys()
    const accesses: Array<{ dirt: { x: number; z: number }; path: Cell }> = []
    const seen = new Set<string>()
    this.state.incidents.forEach((incident) => {
      if (incident.kind !== 'litter' && incident.kind !== 'vomit') return
      if (incident.severity <= 0) return
      if (!isInAnyZone(zones, incident.x, incident.z)) return
      if (blocked.has(roadCellKey(incident.x, incident.z))) return
      const paths: Cell[] = []
      this.getSweeperAccessCells(incident).forEach((path) => {
        if (!blocked.has(roadCellKey(path.x, path.z))) paths.push(path)
      })
      paths.forEach((path) => {
        const key = `${path.x}:${path.z}:${incident.x}:${incident.z}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dirt: { x: incident.x, z: incident.z }, path })
      })
    })
    return accesses
  }

  private finishSweeperLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding') {
      if (vehicle.cell && vehicle.target?.kind === 'cell') {
        vehicle.facing = Math.atan2(
          vehicle.target.x - vehicle.cell.x,
          vehicle.target.z - vehicle.cell.z,
        )
      }
      this.sweepAround(vehicle)
      if (vehicle.cargo >= SIMULATION_CONFIG.logistics.sweeperCapacity) {
        this.sendSweeperToDump(vehicle)
        return
      }
      const remaining = this.getSweeperDirtAccesses(vehicle.workZones).filter(
        (access) =>
          access.path.x !== vehicle.cell?.x || access.path.z !== vehicle.cell?.z,
      )
      if (remaining.length > 0) {
        const route = this.findSweeperRoute(
          vehicle,
          remaining.map((access) => access.path),
        )
        if (route?.length) {
          const last = route.at(-1) ?? vehicle.cell
          const dirt = last
            ? remaining.find(
                (access) =>
                  access.path.x === last.x && access.path.z === last.z,
              )?.dirt
            : undefined
          if (dirt) {
            vehicle.target = { kind: 'cell', x: dirt.x, z: dirt.z }
            vehicle.route = route
            vehicle.state = 'responding'
            return
          }
        }
      }
      if (vehicle.cargo > 0) {
        this.sendSweeperToDump(vehicle)
        return
      }
      this.sendSweeperToDepot(vehicle)
      return
    }
    if (vehicle.state === 'returning' && vehicle.cargo > 0) {
      this.depositSweeperCargo(vehicle)
      vehicle.state = 'waiting'
      vehicle.waitMinutes = SIMULATION_CONFIG.waste.truckUnloadMinutes
      vehicle.resumeState = 'idle'
      return
    }
    if (vehicle.target?.kind === 'depot') {
      vehicle.state = 'idle'
      vehicle.route = []
      vehicle.resumeState = null
      return
    }
    vehicle.state = 'idle'
    vehicle.target = null
    vehicle.route = []
    vehicle.resumeState = null
  }

  private continueSweeper(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    if (vehicle.cargo > 0) {
      this.sendSweeperToDump(vehicle)
      return
    }
    if (this.getSweeperDirtAccesses(vehicle.workZones).length > 0) {
      vehicle.state = 'idle'
      this.dispatchSweeper(vehicle)
      return
    }
    this.sendSweeperToDepot(vehicle)
  }

  private sendSweeperToDump(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const accesses = this.getWasteDumpPathAccesses(true)
    if (accesses.length === 0) {
      vehicle.state = 'idle'
      vehicle.route = []
      return
    }
    const here = accesses.find(
      (access) =>
        access.path.x === vehicle.cell?.x && access.path.z === vehicle.cell?.z,
    )
    if (here) {
      vehicle.target = { kind: 'wasteDump', x: here.dump.x, z: here.dump.z }
      vehicle.route = []
      vehicle.state = 'returning'
      return
    }
    const route = this.findSweeperRoute(
      vehicle,
      accesses.map((access) => access.path),
    )
    if (!route?.length) {
      vehicle.state = 'idle'
      return
    }
    const last = route.at(-1) ?? vehicle.cell
    const dump =
      accesses.find(
        (access) => access.path.x === last.x && access.path.z === last.z,
      )?.dump ?? accesses[0]?.dump
    if (!dump) return
    vehicle.target = { kind: 'wasteDump', x: dump.x, z: dump.z }
    vehicle.route = route
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  private getWasteDumpPathAccesses(requireRoom = false): Array<{
    dump: WasteDumpCell
    path: Cell
  }> {
    const seen = new Set<string>()
    const accesses: Array<{ dump: WasteDumpCell; path: Cell }> = []
    this.state.wasteDumpCells.forEach((dump) => {
      if (requireRoom && wasteDumpRemaining(dump) <= 0) return
      this.getSweeperAccessCells(dump).forEach((path) => {
        const key = `${path.x}:${path.z}:${path.elevation}`
        if (seen.has(key)) return
        seen.add(key)
        accesses.push({ dump, path })
      })
    })
    return accesses
  }

  private sendSweeperToDepot(vehicle: RoadVehicle): void {
    if (!vehicle.cell) {
      vehicle.state = 'idle'
      return
    }
    const depot = this.state.logistics.specialDepots.find((candidate) =>
      candidate.vehicleIds.includes(vehicle.id),
    )
    const access = depot ? this.getLogisticsPathAccess(depot, 3) : null
    if (!depot || !access) {
      vehicle.state = 'idle'
      vehicle.target = null
      vehicle.route = []
      return
    }
    if (access.x === vehicle.cell.x && access.z === vehicle.cell.z) {
      vehicle.state = 'idle'
      vehicle.target = { kind: 'depot', depotId: depot.id }
      vehicle.route = []
      vehicle.resumeState = null
      return
    }
    const route = this.findSweeperRoute(vehicle, [access])
    if (!route?.length) {
      vehicle.state = 'idle'
      return
    }
    vehicle.route = route
    vehicle.target = { kind: 'depot', depotId: depot.id }
    vehicle.state = 'returning'
    vehicle.resumeState = null
  }

  private depositSweeperCargo(vehicle: RoadVehicle): void {
    if (vehicle.cargo <= 0) return
    const truck = vehicle.cell ?? vehicle.position
    const dump = [...this.state.wasteDumpCells]
      .filter((cell) => wasteDumpRemaining(cell) > 0)
      .sort((left, right) => {
        return (
          Math.abs(left.x - truck.x) +
          Math.abs(left.z - truck.z) -
          (Math.abs(right.x - truck.x) + Math.abs(right.z - truck.z))
        )
      })[0]
    if (!dump) return
    vehicle.cargo -= acceptWasteAtDump(dump, vehicle.cargo)
  }

  private sweepAround(vehicle: RoadVehicle): void {
    if (!vehicle.cell) return
    const blocked = this.claimedTentCellKeys()
    const direction = this.getVehicleDirection(vehicle)
    const forward = DIRECTION_OFFSETS[direction]
    const right = DIRECTION_OFFSETS[(((direction + 1) % 4) as Direction)]
    const width = SIMULATION_CONFIG.logistics.sweeperCleanWidth
    const depth = SIMULATION_CONFIG.logistics.sweeperCleanDepth
    const half = Math.floor(width / 2)
    const cells = new Set<string>()
    for (let step = 0; step <= depth; step += 1) {
      for (let lateral = -half; lateral <= half; lateral += 1) {
        const x = vehicle.cell.x + forward.x * step + right.x * lateral
        const z = vehicle.cell.z + forward.z * step + right.z * lateral
        if (blocked.has(roadCellKey(x, z))) continue
        cells.add(roadCellKey(x, z))
      }
    }
    const room = () =>
      Math.max(0, SIMULATION_CONFIG.logistics.sweeperCapacity - vehicle.cargo)
    this.state.incidents.forEach((incident) => {
      if (incident.kind !== 'litter' && incident.kind !== 'vomit') return
      if (!isInAnyZone(vehicle.workZones, incident.x, incident.z)) return
      if (!cells.has(roadCellKey(incident.x, incident.z))) return
      const taken = Math.min(incident.severity, room())
      if (taken <= 0) return
      incident.severity -= taken
      vehicle.cargo += taken
    })
    this.state.incidents = this.state.incidents.filter(
      (incident) =>
        (incident.kind !== 'litter' && incident.kind !== 'vomit') ||
        incident.severity > 0,
    )
  }

  private getWorldSouthEdge(): number {
    return -this.getWorldSize() / 2
  }

  private isRoadExitCell(position: RoadPosition): boolean {
    return (
      position.z === this.getWorldSouthEdge() &&
      position.x >= -3 &&
      position.x <= 2
    )
  }

  private isVisitorCarExit(position: RoadPosition): boolean {
    if (this.isOffMapRoadExit(position)) return true
    if (position.z !== this.getWorldSouthEdge()) return false
    const road = this.getRoadCellAt(position.x, position.z, position.elevation)
    return Boolean(road && isRoadDirectionAllowed(road, 2))
  }

  private isOffMapRoadExit(position: RoadPosition): boolean {
    return position.z < this.getWorldSouthEdge()
  }

  private getOffMapRoadExit(position: RoadPosition): RoadPosition {
    return {
      x: Math.max(-3, Math.min(2, position.x)),
      z: this.getWorldSouthEdge() - 1,
    }
  }

  private dispatchIdleAmbulances(): void {
    const idle: RoadVehicle[] = []
    const claimed = new Set<string>()
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    for (const vehicle of this.state.logistics.roadVehicles) {
      if (vehicle.kind !== 'ambulance') continue
      for (const passengerId of vehicle.passengerIds) claimed.add(passengerId)
      if (vehicle.state === 'idle' && vehicle.cell) idle.push(vehicle)
    }
    if (idle.length === 0) return
    for (const visitor of this.state.visitors) {
      if (visitor.rescueVehicleId) claimed.add(visitor.id)
    }
    const victims = this.state.visitors.filter(
      (visitor) =>
        visitor.state === 'injured' &&
        !claimed.has(visitor.id) &&
        !this.isVisitorSeatedInVehicle(visitor, seated),
    )
    if (victims.length === 0) return
    const pairs: Array<{
      vehicle: RoadVehicle
      victim: Visitor
      distance: number
    }> = []
    for (const vehicle of idle) {
      const cell = vehicle.cell
      if (!cell) continue
      for (const victim of victims) {
        pairs.push({
          vehicle,
          victim,
          distance:
            Math.abs(victim.cellX - cell.x) + Math.abs(victim.cellZ - cell.z),
        })
      }
    }
    pairs.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.vehicle.id.localeCompare(right.vehicle.id) ||
        left.victim.id.localeCompare(right.victim.id),
    )
    const usedVehicles = new Set<string>()
    const usedVictims = new Set<string>()
    for (const pair of pairs) {
      if (usedVehicles.has(pair.vehicle.id) || usedVictims.has(pair.victim.id)) {
        continue
      }
      if (this.sendAmbulanceToVictim(pair.vehicle, pair.victim)) {
        usedVehicles.add(pair.vehicle.id)
        usedVictims.add(pair.victim.id)
      }
    }
  }

  private sendAmbulanceToVictim(vehicle: RoadVehicle, victim: Visitor): boolean {
    if (!vehicle.cell) return false
    const target = { x: victim.cellX, z: victim.cellZ }
    const route = this.routePreferringOpenLights({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      start: vehicle.cell,
      target,
      initialDirection: this.getVehicleDirection(vehicle),
    })
    if (!route) return false
    vehicle.target = { kind: 'cell', ...target }
    victim.rescueVehicleId = vehicle.id
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = 'responding'
    return true
  }

  private finishAmbulanceLeg(vehicle: RoadVehicle): void {
    if (vehicle.state === 'responding' && vehicle.cell) {
      const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
      const victims = this.state.visitors
        .filter(
          (visitor) =>
            visitor.state === 'injured' &&
            visitor.cellX === vehicle.cell?.x &&
            visitor.cellZ === vehicle.cell?.z &&
            !this.isVisitorSeatedInVehicle(visitor, seated),
        )
        .slice(0, SIMULATION_CONFIG.logistics.ambulanceCapacity)
      victims.forEach((visitor) => {
        visitor.state = 'medical-transport'
        visitor.injuryVehicleId = null
        visitor.rescueVehicleId = null
        vehicle.passengerIds.push(visitor.id)
      })
      const garage = this.state.logistics.ambulanceGarages.find((candidate) =>
        candidate.bays.includes(vehicle.id),
      )
      const access = garage
        ? this.getLogisticsBuildingAccess(garage, 2)
        : null
      if (!access || vehicle.passengerIds.length === 0) {
        vehicle.state = 'idle'
        return
      }
      const route = this.routePreferringOpenLights({
        roadCells: this.state.logistics.roadCells,
        graph: this.getRoadGraph(),
        start: vehicle.cell,
        target: access,
        initialDirection: this.getVehicleDirection(vehicle),
      })
      if (!route) {
        vehicle.state = 'idle'
        return
      }
      vehicle.route = route.map(toRoadPosition)
      vehicle.state = 'returning'
      vehicle.target = garage
        ? { kind: 'garage', garageId: garage.id }
        : null
      return
    }
    if (vehicle.state === 'returning') {
      vehicle.passengerIds.forEach((visitorId) => {
        const visitor = this.getVisitor(visitorId)
        if (!visitor || !vehicle.cell) return
        visitor.state = 'sleeping'
        visitor.x = vehicle.cell.x + visitor.tileOffsetX
        visitor.z = vehicle.cell.z + visitor.tileOffsetZ
        visitor.cellX = vehicle.cell.x
        visitor.cellZ = vehicle.cell.z
        visitor.thought =
          'Der Krankenwagen hat mich an der Garage an die Sanitäter übergeben.'
      })
      vehicle.passengerIds = []
      vehicle.state = 'idle'
      vehicle.target = null
    }
  }

  private dispatchBus(vehicle: RoadVehicle): void {
    const line = this.state.logistics.busLines.find(
      (candidate) => candidate.id === vehicle.lineId && candidate.active,
    )
    if (!line || !vehicle.cell || line.stopIds.length < 2) return
    const absoluteMinute = this.state.day * 1440 + this.state.minute
    if (
      line.lastDepartureMinute !== null &&
      absoluteMinute - line.lastDepartureMinute < line.headway
    ) {
      return
    }
    vehicle.nextStopIndex = 0
    if (this.routeBusToStop(vehicle, line, 0)) {
      line.lastDepartureMinute = absoluteMinute
    }
  }

  private updateBusAtStop(vehicle: RoadVehicle, minutes: number): void {
    if (vehicle.kind !== 'bus' || vehicle.state !== 'at-stop') return
    const line = this.state.logistics.busLines.find(
      (candidate) => candidate.id === vehicle.lineId,
    )
    const stopId =
      vehicle.target?.kind === 'busStop'
        ? vehicle.target.stopId
        : null
    const stop =
      stopId
        ? this.state.logistics.busStops.find(
            (candidate) => candidate.id === stopId,
          )
        : undefined
    if (!line || !stop) {
      vehicle.state = 'idle'
      return
    }
    if (vehicle.waitMinutes > 0) {
      vehicle.waitMinutes += minutes
      if (vehicle.waitMinutes < 2) return
      const nextIndex =
        (vehicle.nextStopIndex + 1) % line.stopIds.length
      this.routeBusToStop(vehicle, line, nextIndex)
      return
    }
    const disembarkingIds = new Set(
      vehicle.passengerIds.filter((visitorId) => {
        const visitor = this.getVisitor(visitorId)
        return (
          !visitor?.busDestinationStopId ||
          visitor.busDestinationStopId === stop.id
        )
      }),
    )
    disembarkingIds.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor) return
      visitor.x = stop.x + visitor.tileOffsetX
      visitor.z = stop.z + visitor.tileOffsetZ
      visitor.cellX = stop.x
      visitor.cellZ = stop.z
      visitor.cellElevation = 0
      visitor.busLineId = null
      visitor.busWaitMinutes = 0
      const destination = visitor.busDestination
      const resumeState = visitor.busResumeState
      const resumeTargetId = visitor.busResumeTargetId
      visitor.busDestination = null
      visitor.busDestinationStopId = null
      visitor.busResumeState = null
      visitor.busResumeTargetId = null
      const route = destination
        ? this.findPath(
            { x: stop.x, z: stop.z, elevation: 0 },
            [destination],
          )
        : null
      if (destination && route) {
        visitor.state = resumeState ?? 'exploring'
        visitor.targetId = resumeTargetId
        visitor.route = route
        visitor.thought = 'Nach der Busfahrt gehe ich den Rest des Weges zu Fuß.'
      } else {
        visitor.state = resumeState ?? 'exploring'
        visitor.targetId = resumeTargetId
        visitor.route = []
      }
    })
    vehicle.passengerIds = vehicle.passengerIds.filter(
      (visitorId) => !disembarkingIds.has(visitorId),
    )
    disembarkingIds.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor || visitor.route.length > 0) return
      this.decideNextAction(visitor)
    })
    const waiting = this.state.visitors.filter(
      (visitor) =>
        visitor.state === 'bus-waiting' &&
        visitor.busLineId === line.id &&
        visitor.cellX === stop.x &&
        visitor.cellZ === stop.z,
    )
    const freeSeats =
      SIMULATION_CONFIG.logistics.busCapacity - vehicle.passengerIds.length
    waiting.slice(0, freeSeats).forEach((visitor) => {
      visitor.state = 'bus-riding'
      visitor.route = []
      vehicle.passengerIds.push(visitor.id)
    })
    waiting.slice(freeSeats).forEach((visitor) => {
      this.recordComplaint(visitor, 'bus-full')
      visitor.emotion = 'angry'
    })
    vehicle.waitMinutes += minutes
    if (vehicle.waitMinutes < 2) return
    const nextIndex = (vehicle.nextStopIndex + 1) % line.stopIds.length
    this.routeBusToStop(vehicle, line, nextIndex)
  }

  private routeBusToStop(
    vehicle: RoadVehicle,
    line: { stopIds: string[] },
    stopIndex: number,
  ): boolean {
    const stop = this.state.logistics.busStops.find(
      (candidate) => candidate.id === line.stopIds[stopIndex],
    )
    if (!stop || !vehicle.cell) return false
    const route = this.routePreferringOpenLights({
      roadCells: this.state.logistics.roadCells,
      graph: this.getRoadGraph(),
      start: vehicle.cell,
      target: stop.roadCell,
      initialDirection: this.getVehicleDirection(vehicle),
    })
    if (!route) return false
    vehicle.nextStopIndex = stopIndex
    vehicle.target = { kind: 'busStop', stopId: stop.id }
    vehicle.route = route.map(toRoadPosition)
    vehicle.state = route.length > 0 ? 'driving' : 'at-stop'
    vehicle.waitMinutes = 0
    return true
  }

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
      this.decideNextAction(visitor)
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
    visitor.y = path ? this.getPathSurfaceElevation(path) : cell.elevation
    visitor.route = []
    visitor.targetId = null
  }

  private snapToPedestrianNavCell(cell: Cell): Cell {
    if (this.pedestrianNav.has(this.packCell(cell))) return { ...cell }
    const path =
      this.getPathAt(cell.x, cell.z, cell.elevation) ?? this.getPathAt(cell.x, cell.z)
    if (path) {
      const snapped = { x: path.x, z: path.z, elevation: path.elevation }
      if (this.pedestrianNav.has(this.packCell(snapped))) return snapped
    }
    const ground = {
      x: cell.x,
      z: cell.z,
      elevation: this.getTerrainHeight(cell.x, cell.z),
    }
    if (this.pedestrianNav.has(this.packCell(ground))) return ground
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
    visitor.route = this.pickSeededWalk(
      {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      },
      SIMULATION_CONFIG.pathfinding.wanderMinSteps,
      this.visitorDecisionRng(visitor),
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
        this.giveWaste(visitor, 1)
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

  private updateCrowdingAndMotivation(minutes: number): void {
    const config = SIMULATION_CONFIG.crowding
    const danceFloorKeys = new Set<string>()
    for (const cell of this.state.stageForecourtCells) {
      danceFloorKeys.add(`${cell.x}:${cell.z}:${cell.elevation}`)
    }
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    const result = this.crowding.calculate(
      this.state.visitors.filter(
        (visitor) => !this.isVisitorSeatedInVehicle(visitor, seated),
      ),
      danceFloorKeys,
    )
    this.state.crowding = result.snapshot
    this.crowdingCosts = new Map(
      result.snapshot.cells.map((cell) => [
        this.cellKey(cell.x, cell.z, cell.elevation),
        cell.value,
      ]),
    )
    this.crowdingCostPacked.clear()
    result.snapshot.cells.forEach((cell) => {
      this.crowdingCostPacked.set(this.packCell(cell), cell.value)
    })
    const vomitCells = new Set(
      this.state.incidents
        .filter((incident) => incident.kind === 'vomit')
        .map((incident) =>
          this.cellKey(incident.x, incident.z, incident.elevation),
        ),
    )
    const peopleByCell = new Map<string, number>()
    const panicByCell = new Map<string, number>()
    for (const visitor of this.state.visitors) {
      if (this.isVisitorSeatedInVehicle(visitor, seated)) continue
      const key = this.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation)
      peopleByCell.set(key, (peopleByCell.get(key) ?? 0) + 1)
      if (visitor.isPanicking || visitor.state === 'panicking') {
        panicByCell.set(key, (panicByCell.get(key) ?? 0) + 1)
      }
    }
    this.state.visitors.forEach((visitor) => {
      if (this.isVisitorSeatedInVehicle(visitor, seated)) {
        visitor.crowding = 0
        return
      }
      visitor.crowding = result.visitorValues.get(visitor.id) ?? 0
      if (visitor.state === 'medical' || visitor.state === 'medical-transport') {
        visitor.motivation = Math.min(
          100,
          visitor.motivation +
            minutes * config.medicalMotivationRecoveryPerMinute,
        )
        return
      }
      this.updateCrowdPanicStress(visitor, minutes, this.countOnTouchingCells(visitor, peopleByCell))
      const crowdingPressure = Math.max(
        0,
        (visitor.crowding - config.pressureStart) / config.pressureRange,
      )
      const hungerPressure = Math.max(
        0,
        (config.lowNeedThreshold - visitor.needs.hunger) /
          config.lowNeedThreshold,
      )
      const toiletPressure = Math.max(
        0,
        (config.lowNeedThreshold - visitor.needs.toilet) /
          config.lowNeedThreshold,
      )
      const energyPressure =
        visitor.campsite || visitor.state === 'sleeping'
          ? 0
          : Math.max(
              0,
              (config.lowEnergyThreshold - visitor.needs.energy) /
                config.lowEnergyThreshold,
            )
      const litterPressure = vomitCells.has(
        this.cellKey(
          visitor.cellX,
          visitor.cellZ,
          visitor.cellElevation,
        ),
      )
        ? config.vomitPressure
        : 0
      const atmosphere = SIMULATION_CONFIG.atmosphere
      const beautyDeficit =
        Math.max(
          0,
          atmosphere.preferenceDeficitThreshold -
            visitor.localAttractiveness,
        ) / atmosphere.preferenceDeficitThreshold
      const partyDeficit =
        Math.max(
          0,
          atmosphere.preferenceDeficitThreshold - visitor.localPartyMood,
        ) / atmosphere.preferenceDeficitThreshold
      const atmospherePressure =
        (beautyDeficit * visitor.beautyPreference +
          partyDeficit * visitor.partyPreference) *
        atmosphere.preferenceMotivationLossPerMinute /
        config.motivationLossPerMinute
      const forecourtOvercrowding =
        this.getStageForecourtCellAt(visitor.cellX, visitor.cellZ) &&
        visitor.crowding >= atmosphere.danceFloorOvercrowdingStart
          ? atmosphere.overcrowdingMotivationLossPerMinute /
            config.motivationLossPerMinute
          : 0
      if (beautyDeficit + partyDeficit > 0.7) {
        visitor.needs.fun = Math.max(
          0,
          visitor.needs.fun -
            minutes * atmosphere.preferenceFunLossPerMinute,
        )
      }
      const badConditions = Math.min(
        config.maximumBadConditions,
        crowdingPressure +
          hungerPressure * config.hungerPressureWeight +
          toiletPressure * config.toiletPressureWeight +
          energyPressure * config.energyPressureWeight +
          litterPressure +
          atmospherePressure +
          forecourtOvercrowding,
      )
      const needsFulfilled =
        visitor.needs.hunger >= config.fulfilledNeedThreshold &&
        visitor.needs.toilet >= config.fulfilledNeedThreshold &&
        visitor.needs.fun >= config.fulfilledNeedThreshold &&
        visitor.needs.energy >= config.fulfilledEnergyThreshold
      const recoveryPerMinute =
        (badConditions === 0 ? config.motivationRecoveryPerMinute : 0) +
        (needsFulfilled ? config.fulfilledNeedsRecoveryPerMinute : 0)
      visitor.motivation = Math.min(
        100,
        Math.max(
          0,
          visitor.motivation +
            minutes *
              (recoveryPerMinute -
                config.motivationLossPerMinute * badConditions),
        ),
      )
      if (
        visitor.motivation === 0 &&
        !visitor.isPanicking &&
        visitor.state !== 'riding' &&
        visitor.state !== 'sleeping' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.campingPhase !== 'packing'
      ) {
        visitor.emotion = 'sad'
        visitor.emotionMinutes = 60
        visitor.thought = 'Unter diesen Bedingungen habe ich keine Lust mehr.'
        if (visitor.crowding >= 70) {
          this.recordComplaint(visitor, 'overcrowding')
        }
        if (litterPressure > 0 || visitor.localAttractiveness < -20) {
          this.recordComplaint(visitor, 'dirty-grounds')
        }
        this.beginVisitorDeparture(visitor)
      }
    })
    this.resolveCrowdPanic(minutes, peopleByCell, panicByCell)
  }

  private canEnterCrowdPanic(visitor: Visitor): boolean {
    return (
      !visitor.isPanicking &&
      visitor.state !== 'riding' &&
      visitor.state !== 'sleeping' &&
      visitor.state !== 'leaving' &&
      visitor.state !== 'vehicle-arrival' &&
      visitor.state !== 'bus-riding' &&
      visitor.state !== 'medical' &&
      visitor.state !== 'medical-transport' &&
      visitor.state !== 'injured' &&
      visitor.campingPhase !== 'packing' &&
      visitor.campingPhase !== 'resting'
    )
  }

  private updateCrowdPanicStress(visitor: Visitor, minutes: number, nearbyPeople: number): void {
    const crowd = SIMULATION_CONFIG.crowding
    if (visitor.crowding >= crowd.denseThreshold) {
      const intensity = Math.min(
        1,
        (visitor.crowding - crowd.denseThreshold) / Math.max(1, 100 - crowd.denseThreshold),
      )
      visitor.crowdStress = Math.min(
        100,
        visitor.crowdStress +
          minutes * crowd.stressGainPerMinute * (0.4 + intensity * 0.6) *
            (1 + Math.min(crowd.panicNearbyCap, nearbyPeople) / 80),
      )
      return
    }
    if (visitor.crowding <= crowd.calmThreshold) {
      visitor.crowdStress = Math.max(0, visitor.crowdStress - minutes * crowd.stressDecayPerMinute)
    }
  }

  private countOnTouchingCells(
    visitor: { cellX: number; cellZ: number; cellElevation: number },
    counts: Map<string, number>,
  ): number {
    const x = visitor.cellX
    const z = visitor.cellZ
    const elevation = visitor.cellElevation
    return (
      (counts.get(this.cellKey(x, z, elevation)) ?? 0) +
      (counts.get(this.cellKey(x + 1, z, elevation)) ?? 0) +
      (counts.get(this.cellKey(x - 1, z, elevation)) ?? 0) +
      (counts.get(this.cellKey(x, z + 1, elevation)) ?? 0) +
      (counts.get(this.cellKey(x, z - 1, elevation)) ?? 0)
    )
  }

  private markPanicCell(visitor: Visitor, panicByCell: Map<string, number>): void {
    const key = this.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation)
    panicByCell.set(key, (panicByCell.get(key) ?? 0) + 1)
  }

  private resolveCrowdPanic(
    minutes: number,
    peopleByCell: Map<string, number>,
    panicByCell: Map<string, number>,
  ): void {
    const crowd = SIMULATION_CONFIG.crowding
    const crowdingAt = (x: number, z: number, elevation: number) =>
      this.crowdingCosts.get(this.cellKey(x, z, elevation)) ?? 0
    const peopleAt = (x: number, z: number, elevation: number) =>
      peopleByCell.get(this.cellKey(x, z, elevation)) ?? 0
    this.state.visitors.forEach((visitor) => {
      if (!this.canEnterCrowdPanic(visitor) || visitor.crowding < crowd.denseThreshold) return
      const denseCells = denseClusterSize(visitor, crowdingAt, crowd.denseThreshold)
      const clusterPeople = neighborhoodPeople(visitor, peopleAt)
      const nearby = this.countOnTouchingCells(visitor, peopleByCell)
      const chance =
        spontaneousPanicChance(visitor.crowding, visitor.crowdStress, nearby, denseCells, clusterPeople) *
        minutes
      if (this.rng.next() < chance) {
        this.beginCrowdPanic(visitor)
        this.markPanicCell(visitor, panicByCell)
      }
    })
    this.state.visitors.forEach((visitor) => {
      if (!this.canEnterCrowdPanic(visitor) || visitor.crowding < crowd.denseThreshold) return
      const denseCells = denseClusterSize(visitor, crowdingAt, crowd.denseThreshold)
      const nearbyPanic = this.countOnTouchingCells(visitor, panicByCell)
      if (this.rng.next() < panicSpreadChance(visitor.crowding, nearbyPanic, denseCells) * minutes) {
        this.beginCrowdPanic(visitor)
        this.markPanicCell(visitor, panicByCell)
      }
    })
    this.state.visitors.forEach((visitor) => {
      if (!visitor.isPanicking) return
      const alcohol = visitor.alcoholLevel
      visitor.needs.hunger = Math.max(0, visitor.needs.hunger - minutes * crowd.panicNeedLossPerMinute)
      visitor.needs.toilet = Math.max(0, visitor.needs.toilet - minutes * crowd.panicNeedLossPerMinute)
      visitor.needs.fun = Math.max(0, visitor.needs.fun - minutes * crowd.panicNeedLossPerMinute)
      visitor.needs.energy = Math.max(0, visitor.needs.energy - minutes * crowd.panicNeedLossPerMinute)
      visitor.alcoholLevel = alcohol
      visitor.motivation = Math.max(0, visitor.motivation - minutes * crowd.panicMotivationLossPerMinute)
      visitor.emotion = 'angry'
      visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 8)
      if (visitor.crowding <= crowd.calmThreshold) {
        visitor.panicRecoverMinutes += minutes
        if (visitor.panicRecoverMinutes >= crowd.panicRecoverMinutes) {
          this.endCrowdPanic(visitor)
        }
        return
      }
      visitor.panicRecoverMinutes = 0
      this.ensurePanicFleeRoute(visitor)
      if (visitor.motivation === 0 && visitor.crowding >= crowd.denseThreshold) {
        this.recordComplaint(visitor, 'overcrowding')
        this.beginVisitorDeparture(visitor)
      }
    })
  }

  private beginCrowdPanic(visitor: Visitor): void {
    this.clearVisitorActivity(visitor)
    this.removeVisitorFromCoasterQueues(visitor.id)
    visitor.isPanicking = true
    visitor.panicRecoverMinutes = 0
    visitor.crowdStress = Math.max(visitor.crowdStress, 70)
    visitor.isConversing = false
    visitor.state = 'panicking'
    visitor.targetId = null
    visitor.concertId = null
    visitor.emotion = 'angry'
    visitor.emotionMinutes = 20
    visitor.thought = 'Massenpanik! Ich muss hier raus!'
    this.ensurePanicFleeRoute(visitor)
  }

  private endCrowdPanic(visitor: Visitor): void {
    visitor.isPanicking = false
    visitor.panicRecoverMinutes = 0
    visitor.crowdStress = Math.min(visitor.crowdStress, 24)
    visitor.motivation = Math.min(100, Math.max(visitor.motivation, 32))
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.route = []
    visitor.emotion = 'happy'
    visitor.emotionMinutes = 10
    visitor.thought = 'Das Gedränge lässt nach. Kurz durchatmen, dann geht es weiter.'
  }

  private ensurePanicFleeRoute(visitor: Visitor): void {
    if (this.isAtParkExit(visitor)) {
      visitor.route = []
      return
    }
    if (visitor.route.length > 0) return
    const current = this.crowdingCosts.get(
      this.cellKey(visitor.cellX, visitor.cellZ, visitor.cellElevation),
    ) ?? visitor.crowding
    const quieter = [...this.getPedestrianNeighbors(
      {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      },
      {
        allowQueue: true,
        allowCamping: true,
        allowMedical: true,
        allowFestival: true,
        allowGrass: true,
        ignoreDirectionalRestrictions: true,
      },
    )]
      .map((cell) => ({
        ...cell,
        path: this.getPathAt(cell.x, cell.z, cell.elevation),
        crowding: this.crowdingCosts.get(
          this.cellKey(cell.x, cell.z, cell.elevation),
        ) ?? 0,
      }))
      .filter((cell) => !cell.path?.staffOnly && cell.crowding < current - 2)
      .sort(
        (left, right) =>
          left.crowding - right.crowding ||
          Number(Boolean(left.path)) - Number(Boolean(right.path)),
      )
    if (quieter[0]) {
      visitor.route = [{
        x: quieter[0].x,
        z: quieter[0].z,
        elevation: quieter[0].elevation,
      }]
      return
    }
    visitor.route =
      this.findPath(
        { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
        [this.getEntrance()],
        true,
        true,
        true,
        true,
      ) ?? []
  }

  save(): ActionResult {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state))
    return { ok: true, message: 'Spiel gespeichert' }
  }

  saveSlot(name: string, id?: string): ActionResult {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!trimmed) return { ok: false, message: 'Bitte einen Namen für den Spielstand eingeben' }
    try {
      const slots = GameState.readSaveSlots()
      const target = id ? slots.find(slot => slot.id === id) : undefined
      if (!target && slots.length >= 20) return { ok: false, message: 'Maximal 20 lokale Spielstände möglich' }
      const savedAt = Date.now()
      const next: StoredSaveSlot = {
        id: target?.id ?? `slot-${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        savedAt,
        snapshot: JSON.stringify(this.state),
      }
      const updated = target
        ? slots.map(slot => slot.id === target.id ? next : slot)
        : [...slots, next]
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(updated))
      return { ok: true, message: `Spielstand „${trimmed}“ gespeichert` }
    } catch {
      return { ok: false, message: 'Lokaler Spielstandsspeicher ist nicht verfügbar' }
    }
  }

  static listSaveSlots(): LocalSaveSlot[] {
    return GameState.readSaveSlots()
      .map(({ id, name, savedAt }) => ({ id, name, savedAt }))
      .sort((a, b) => b.savedAt - a.savedAt)
  }

  static loadSlot(id: string): GameState | null {
    const slot = GameState.readSaveSlots().find(candidate => candidate.id === id)
    return slot ? GameState.fromJSON(slot.snapshot) : null
  }

  static deleteSaveSlot(id: string): ActionResult {
    try {
      const slots = GameState.readSaveSlots()
      if (!slots.some(slot => slot.id === id)) return { ok: false, message: 'Spielstand nicht gefunden' }
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots.filter(slot => slot.id !== id)))
      return { ok: true, message: 'Spielstand gelöscht' }
    } catch {
      return { ok: false, message: 'Lokaler Spielstandsspeicher ist nicht verfügbar' }
    }
  }

  private static readSaveSlots(): StoredSaveSlot[] {
    try {
      const raw = localStorage.getItem(SAVE_SLOTS_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((slot): slot is StoredSaveSlot =>
        slot && typeof slot.id === 'string' && typeof slot.name === 'string' &&
        typeof slot.savedAt === 'number' && typeof slot.snapshot === 'string' &&
        GameState.fromJSON(slot.snapshot) !== null,
      )
    } catch {
      return []
    }
  }

  static load(): GameState | null {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? GameState.fromJSON(raw) : null
  }

  static fromJSON(raw: string): GameState | null {
    try {
      const data = JSON.parse(raw) as Partial<GameSnapshot> & { version?: number }
      if (!Array.isArray(data.buildings)) return null
      const migrated: GameSnapshot = {
        ...createBlankSnapshot(),
        ...data,
        version: 29,
        terrain: normalizeTerrain(data.terrain),
        buildings: data.buildings.map(b => b.stageDesign ? { ...b, stageDesign: migrateStageDesign(b.stageDesign) } : b),
        campingCells: Array.isArray(data.campingCells) ? data.campingCells : [],
        campInstallations: Array.isArray(data.campInstallations)
          ? data.campInstallations
          : [],
        staff: Array.isArray(data.staff) ? data.staff : [],
        medicalCells: Array.isArray(data.medicalCells) ? data.medicalCells : [],
        wasteDumpCells: Array.isArray(data.wasteDumpCells)
          ? data.wasteDumpCells
              .map(normalizeWasteDumpCell)
              .filter((cell): cell is WasteDumpCell => cell !== null)
          : [],
        incidents: Array.isArray(data.incidents) ? data.incidents : [],
        logistics: normalizeLogisticsSnapshot(data.logistics),
        scenario: normalizeScenarioSettings(data.scenario),
        finance: data.finance && Array.isArray(data.finance.periods)
          ? {
              loan: Math.max(0, Number(data.finance.loan) || 0),
              periods: data.finance.periods,
              today: data.finance.today ?? {},
              previousDay: data.finance.previousDay ?? {},
            }
          : createFinanceState(),
        scenarioProgress: data.scenarioProgress && Array.isArray(data.scenarioProgress.status)
          ? data.scenarioProgress
          : createScenarioProgress(normalizeScenarioSettings(data.scenario).goals),
        stageForecourtCells: Array.isArray(data.stageForecourtCells)
          ? data.stageForecourtCells
          : [],
        backstageCells: Array.isArray(data.backstageCells)
          ? data.backstageCells
              .map(normalizeBackstageCell)
              .filter((cell): cell is BackstageCell => cell !== null)
          : [],
        bandActors: Array.isArray(data.bandActors)
          ? data.bandActors
              .map(normalizeBandActor)
              .filter((actor): actor is BandActor => actor !== null)
          : [],
        bandSupply: emptyBandSupplySnapshot(),
        visitors: Array.isArray(data.visitors) ? data.visitors : [],
        coasters: Array.isArray(data.coasters) ? data.coasters : [],
        power: normalizePower(data.power),
        campingTicketPrice:
          data.campingTicketPrice ??
          data.entryPrice ??
          SIMULATION_CONFIG.economy.defaultCampingTicketPrice,
      }
      if (migrated.festival.stageTemplates) migrated.festival.stageTemplates = migrated.festival.stageTemplates.map(migrateStageDesign)
      return new GameState(migrated)
    } catch {
      return null
    }
  }

  private trySpawnVisitor(forcedTicketType?: 'day' | 'camping'): void {
    if (!this.state.parkOpen) return
    const mode =
      this.rng.next() < this.getScenario().carArrivalShare
        ? 'car'
        : 'pedestrian'
    const roadEntry =
      mode === 'car' ? this.findAvailableRoadEntry() : this.getRoadEntry()
    if (mode === 'car' && !roadEntry) return
    const requestedSize =
      mode === 'car' ? this.sampleArrivalGroupSize() : 1
    const groupId = this.nextId('arrival')
    const members: Visitor[] = []
    for (let index = 0; index < requestedSize; index += 1) {
      const visitor = this.spawnVisitorMember(
        forcedTicketType,
        groupId,
        mode,
        mode === 'car',
      )
      if (visitor) members.push(visitor)
    }
    if (members.length === 0) return
    const group: ArrivalGroup = {
      id: groupId,
      memberIds: members.map((visitor) => visitor.id),
      vehicleId: null,
      mode,
      state: mode === 'car' ? 'approaching' : 'arrived',
      arrivedMinute: this.state.day * 1440 + this.state.minute,
      parkingWaitMinutes: 0,
      entryFeesPaid: members.every((visitor) => visitor.entryFeePaid > 0),
    }
    this.state.logistics.arrivalGroups.push(group)
    if (mode === 'car') {
      const vehicleEntry = roadEntry ?? this.getRoadEntry()
      const vehicle: RoadVehicle = {
        id: this.nextId('car'),
        kind: 'visitorCar',
        position: { ...vehicleEntry },
        cell: { ...vehicleEntry },
        route: [],
        state: 'waiting',
        speed: 0,
        passengerIds: [...group.memberIds],
        groupId,
        parkingCell: null,
        target: null,
        facing: 0,
        waitMinutes: 0,
        resumeState: null,
        lineId: null,
        nextStopIndex: 0,
        cargo: 0,
      }
      group.vehicleId = vehicle.id
      this.state.logistics.roadVehicles.push(vehicle)
      this.dispatchIncomingVisitorCar(vehicle)
      members.forEach((visitor) => {
        visitor.thought = vehicle.parkingCell
          ? 'Wir suchen mit dem Auto einen Parkplatz.'
          : 'Kein freier Parkplatz – wir fahren erstmal weiter.'
      })
    }
  }

  private spawnVisitorMember(
    forcedTicketType: 'day' | 'camping' | undefined,
    groupId: string,
    arrivalMode: 'car' | 'pedestrian',
    deferArrival: boolean,
  ): Visitor | null {
    if (!this.state.parkOpen) return null
    let inventory = createFestivalInventory(this.rng)
    if (forcedTicketType === 'camping' && getItemQuantity(inventory, 'tent') === 0) {
      addItem(inventory, 'tent')
    } else if (forcedTicketType === 'day') {
      inventory = inventory.filter(
        (item) =>
          item.kind !== 'tent' &&
          item.kind !== 'chairs' &&
          item.kind !== 'pavilion' &&
          item.kind !== 'musicBox',
      )
    }
    const ticketType =
      forcedTicketType ??
      (getItemQuantity(inventory, 'tent') > 0 ? 'camping' : 'day')
    const tickets = this.state.festival.enabled ? this.state.festival.tickets : undefined
    if (tickets && (ticketType === 'camping' ? tickets.usedCamping >= tickets.camping : (tickets.usedDay[this.state.day] ?? 0) >= tickets.day)) return null
    if (ticketType === 'camping') {
      const admittedCampers = this.state.visitors.filter(
        (visitor) => visitor.ticketType === 'camping',
      ).length
      if (admittedCampers >= this.getBookableCampingCapacity()) return null
    }
    if (
      ticketType === 'day' &&
      (getFestivalCycleStatus(this.state.dayPlan, this.state.day).phase !==
        'festival' ||
        !isDayVisitorAdmissionOpen(this.state.dayPlan, this.state.minute))
    ) {
      return null
    }

    const id = this.nextId('visitor')
    const tileOffsetX =
      SIMULATION_CONFIG.visitors.tileOffsetMinimum +
      this.rng.next() * SIMULATION_CONFIG.visitors.tileOffsetRandomRange
    const tileOffsetZ =
      SIMULATION_CONFIG.visitors.tileOffsetMinimum +
      this.rng.next() * SIMULATION_CONFIG.visitors.tileOffsetRandomRange
    const initialNeeds = SIMULATION_CONFIG.visitors.initialNeeds
    const visitor: Visitor = {
      id,
      name: `${visitorGivenName(id, this.state.day)} ${this.idCounter}`,
      x: this.getEntrance().x + tileOffsetX,
      y: this.getEntrance().elevation,
      z: this.getEntrance().z + tileOffsetZ,
      cellX: this.getEntrance().x,
      cellZ: this.getEntrance().z,
      cellElevation: this.getEntrance().elevation,
      color: Math.floor(this.rng.next() * 0xffffff),
      state: 'entering',
      thought: 'Ich bin gespannt auf den Park!',
      needs: {
        hunger: initialNeeds.hungerMinimum + this.rng.next() * initialNeeds.hungerRandomRange,
        toilet: initialNeeds.toiletMinimum + this.rng.next() * initialNeeds.toiletRandomRange,
        fun: initialNeeds.funMinimum + this.rng.next() * initialNeeds.funRandomRange,
        energy: initialNeeds.energyMinimum + this.rng.next() * initialNeeds.energyRandomRange,
      },
      route: [],
      targetId: null,
      interactionRemaining: 0,
      walkSpeed:
        SIMULATION_CONFIG.visitors.walkSpeedMinimum +
        this.rng.next() * SIMULATION_CONFIG.visitors.walkSpeedRandomRange,
      movementBoostMinutes: 0,
      avoidedCoasterId: null,
      avoidanceMinutes: 0,
      facing: 0,
      emotion: 'neutral',
      emotionMinutes: 0,
      budget: SIMULATION_CONFIG.visitors.budget,
      alcoholLevel: 0,
      alcoholDisposition:
        this.rng.next() < this.getScenario().aggressiveShare
          ? 'aggressive'
          : 'calm',
      alcoholDesire:
        SIMULATION_CONFIG.visitors.alcoholDesireMinimum +
        this.rng.next() * SIMULATION_CONFIG.visitors.alcoholDesireRandomRange,
      campsite: null,
      campingPhase: 'none',
      hasHandcart: ticketType === 'camping',
      inventory,
      motivation: 100,
      crowding: 0,
      crowdStress: 0,
      isPanicking: false,
      panicRecoverMinutes: 0,
      tileOffsetX,
      tileOffsetZ,
      campActivityTarget: null,
      campActivity: 'standing',
      campActivityKind: null,
      campActivitySlot: 0,
      campActivityCapacity: 1,
      nausea: 0,
      nauseaCooldown: 0,
      medicalCell: null,
      medicalSlot: null,
      securityGateId: null,
      securityResumeState: null,
      beautyPreference: sampleBiasedPreference(
        this.getScenario().beautyAffinity,
        this.rng,
      ),
      partyPreference: sampleBiasedPreference(
        this.getScenario().partyAffinity,
        this.rng,
      ),
      localAttractiveness: 0,
      localPartyMood: 0,
      activityTarget: null,
      activitySlot: 0,
      activityCapacity: 1,
      isDancing: false,
      ...this.createPreferredSleepRhythm(),
      ticketType,
      consumptionCooldown: 0,
      isConversing: false,
      campingWaitMinutes: 0,
      campingWaitRetryMinutes: 0,
      entryFeePaid: 0,
      complaintsFiled: [],
      arrivalGroupId: groupId,
      arrivalMode,
      injuryVehicleId: null,
      rescueVehicleId: null,
      busWaitMinutes: 0,
      busLineId: null,
      busDestination: null,
      busDestinationStopId: null,
      busResumeState: null,
      busResumeTargetId: null,
      walkingToCampDistance: 0,
      pendingWaste: 0,
      streakingMinutes: 0,
      streakingCooldownMinutes: 0,
      toplessMinutes: 0,
      bungeeNude: false,
      ownedMascot: false,
      heldMascot: false,
      pathSeed: hashStringSeed(id),
      wanderNonce: 0,
    }
    if (this.state.festival.enabled) assignAudience(visitor, this.state.festival)
    const admissionPrice = this.ticketPriceFor(ticketType)
    const paidEntry = this.chargeVisitor(visitor, admissionPrice, {
      x: (arrivalMode === 'car' ? this.getRoadEntry().x : this.getEntrance().x) + 0.5,
      y: 0.85,
      z: (arrivalMode === 'car' ? this.getRoadEntry().z : this.getEntrance().z) + 0.5,
    }, ticketType === 'camping' ? 'camping' : 'tickets')
    if (paidEntry) visitor.entryFeePaid = admissionPrice
    this.state.visitors.push(visitor)
    if (tickets) { if (ticketType === 'camping') tickets.usedCamping++; else tickets.usedDay[this.state.day] = (tickets.usedDay[this.state.day] ?? 0) + 1 }
    if (this.state.festival.enabled) { this.state.festival.admissions++; this.state.festival.metrics.guests++ }
    this.indexedVisitorCount = -1
    this.state.guests = this.state.visitors.length
    if (deferArrival) {
      visitor.state = 'vehicle-arrival'
      visitor.x = this.getRoadEntry().x + tileOffsetX
      visitor.z = this.getRoadEntry().z + tileOffsetZ
      visitor.cellX = this.getRoadEntry().x
      visitor.cellZ = this.getRoadEntry().z
      return visitor
    }
    if (getItemQuantity(visitor.inventory, 'tent') === 0) {
      visitor.hasHandcart = false
      this.queueVisitorDecision(visitor)
    } else if (!this.camping.assignCampsite(visitor)) {
      visitor.state = 'camp-waiting'
      visitor.route = []
      visitor.campingWaitMinutes = 0
      visitor.campingWaitRetryMinutes =
        SIMULATION_CONFIG.camping.unplacedRetryIntervalMinutes
      visitor.emotion = 'sad'
      visitor.thought =
        'Alle Campingflächen wirken belegt. Ich warte auf einen freien Platz.'
    }
    return visitor
  }

  private sampleArrivalGroupSize(): number {
    let roll = this.rng.next()
    const weights = SIMULATION_CONFIG.logistics.groupSizeWeights
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index] ?? 0
      if (roll <= 0) return index + 1
    }
    return 1
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
    // Camping arrivals belong to the camping state machine, not destination selection.
    if (visitor.state === 'camping') return
    this.visitorsAwaitingDecision.add(visitor.id)
  }

  private runVisitorRouting(visitor: Visitor, kind: 'departure' | 'exit' | 'waste', action: () => void): boolean {
    if (!this.processingSimulationStep || this.activeVisitorDecision === visitor.id) {
      action()
      return true
    }
    if (this.decisionBudget <= 0 || this.decidedThisTick.has(visitor.id) ||
        this.pendingVisitorRouting.has(visitor.id)) {
      const existing = this.pendingVisitorRouting.get(visitor.id)
      if (!existing || kind === 'departure') this.pendingVisitorRouting.set(visitor.id, kind)
      this.visitorsAwaitingDecision.add(visitor.id)
      return false
    }
    this.decisionBudget--
    this.decidedThisTick.add(visitor.id)
    this.activeVisitorDecision = visitor.id
    try { action() } finally { this.activeVisitorDecision = null }
    return true
  }

  private flushVisitorDecisions(limit = 2): void {
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    let decided = 0
    while (decided < limit && this.visitorsAwaitingDecision.size > 0) {
      const visitorId = this.visitorsAwaitingDecision.values().next().value
      if (!visitorId) break
      this.visitorsAwaitingDecision.delete(visitorId)
      decided += 1
      const visitor = this.getVisitor(visitorId)
      const routing = this.pendingVisitorRouting.get(visitorId)
      this.pendingVisitorRouting.delete(visitorId)
      if (visitor && routing) {
        if (routing === 'departure') this.beginVisitorDeparture(visitor)
        else if (routing === 'exit') this.ensureExitRoute(visitor)
        else this.tryDisposeWaste(visitor)
        continue
      }
      if (
        !visitor ||
        visitor.state === 'camping' ||
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'bus-riding' ||
        visitor.state === 'riding' ||
        visitor.state === 'leaving' ||
        this.isVisitorSeatedInVehicle(visitor, seated)
      ) {
        continue
      }
      if (visitor.route.length > 0 || visitor.targetId) continue
      this.decideNextAction(visitor)
    }
  }

  private updateVisitors(minutes: number): void {
    // Rebuild once per pass, also repairing older saves with mass events.
    this.concertToplessVisitorId = null
    for (const visitor of this.state.visitors) {
      if (visitor.toplessMinutes <= 0) continue
      if (this.concertToplessVisitorId === null) this.concertToplessVisitorId = visitor.id
      else visitor.toplessMinutes = 0
    }
    this.flushVisitorDecisions(SIMULATION_CONFIG.pathfinding.decisionsPerTick)
    const leavingIds = new Set<string>()
    const seatedPassengers = collectSeatedPassengerIds(
      this.state.logistics.roadVehicles,
    )

    this.state.visitors.forEach((visitor) => {
      if (this.isVisitorSeatedInVehicle(visitor, seatedPassengers)) return
      visitor.alcoholLevel = Math.max(
        0,
        visitor.alcoholLevel -
          minutes * SIMULATION_CONFIG.alcohol.decayPerMinute,
      )
      visitor.alcoholDesire = Math.min(
        100,
        visitor.alcoholDesire +
          minutes * SIMULATION_CONFIG.alcohol.desireGainPerMinute,
      )
      if (
        !this.state.parkOpen &&
        visitor.state !== 'riding' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding'
      ) {
        if (visitor.state === 'leaving') {
          this.ensureExitRoute(visitor)
        } else if (
          visitor.state !== 'camping' ||
          visitor.campingPhase !== 'packing'
        ) {
          this.beginVisitorDeparture(visitor)
        }
      }
      if (visitor.state === 'leaving') {
        this.ensureExitRoute(visitor)
      }
      if (visitor.state === 'leaving' && this.tryBoardDepartureCar(visitor)) {
        return
      }
      if (
        (visitor.state === 'leaving' || visitor.isPanicking || visitor.state === 'panicking') &&
        !(visitor.state === 'leaving' && ((visitor.campsite && visitor.campingPhase !== 'none') || visitor.pendingWaste > 0)) &&
        this.isAtParkExit(visitor) &&
        !this.getVisitorArrivalCar(visitor)
      ) {
        leavingIds.add(visitor.id)
        return
      }
      if (visitor.isPanicking || visitor.state === 'panicking') {
        if (visitor.state !== 'leaving') visitor.state = 'panicking'
        if (visitor.route.length === 0) this.ensurePanicFleeRoute(visitor)
      }
      if (visitor.state === 'medical') {
        const medical = SIMULATION_CONFIG.medical
        visitor.alcoholLevel = Math.max(
          0,
          visitor.alcoholLevel - minutes * medical.alcoholDecayPerMinute,
        )
        visitor.nausea = Math.max(
          0,
          visitor.nausea - minutes * medical.nauseaRecoveryPerMinute,
        )
        visitor.needs.energy = Math.min(
          100,
          visitor.needs.energy + minutes * medical.energyRecoveryPerMinute,
        )
        visitor.motivation = Math.min(
          100,
          visitor.motivation + minutes * medical.motivationRecoveryPerMinute,
        )
        if (
          visitor.alcoholLevel < medical.dischargeAlcoholBelow &&
          visitor.needs.energy >= medical.dischargeEnergy
        ) {
          this.medical.releaseBed(this.state.medicalCells, visitor.id)
          visitor.medicalCell = null
          visitor.medicalSlot = null
          visitor.thought = 'Mir geht es wieder besser.'
          if (this.shouldReturnToArrivalCar(visitor)) {
            visitor.state = 'leaving'
            this.ensureExitRoute(visitor)
          } else {
            visitor.state = 'exploring'
            this.decideNextAction(visitor)
          }
        }
        return
      }
      if (visitor.state === 'medical-transport') return
      if (visitor.state === 'sleeping') {
        const camping = SIMULATION_CONFIG.camping
        visitor.needs.energy = Math.min(
          100,
          visitor.needs.energy + minutes * camping.groundSleepEnergyPerMinute,
        )
        visitor.needs.hunger = Math.max(
          0,
          visitor.needs.hunger -
            minutes * camping.sleepingHungerDecayPerMinute,
        )
        visitor.needs.toilet = Math.max(
          0,
          visitor.needs.toilet -
            minutes * camping.sleepingToiletDecayPerMinute,
        )
        if (
          visitor.alcoholLevel < camping.wakeAlcoholBelow &&
          visitor.needs.energy >= camping.wakeEnergy
        ) {
          visitor.state = 'exploring'
          visitor.emotion = 'sad'
          visitor.emotionMinutes = 30
          visitor.thought = 'Ich bin wieder wach. Mein Kopf brummt.'
          this.decideNextAction(visitor)
        }
        return
      }
      this.decayNeeds(visitor, minutes)
      if (this.state.parkOpen && this.incidents.updateNausea(visitor, minutes)) {
        const path = this.getPathAt(
          visitor.cellX,
          visitor.cellZ,
          visitor.cellElevation,
        )
        if (path) {
          this.addGroundIncident('vomit', {
            x: visitor.cellX,
            z: visitor.cellZ,
            elevation: visitor.cellElevation,
          })
          visitor.state = 'vomiting'
          visitor.route = []
          visitor.targetId = null
          visitor.interactionRemaining =
            SIMULATION_CONFIG.needs.interactionMinutes.vomiting
          visitor.emotion = 'sad'
          visitor.emotionMinutes = 30
          visitor.thought = 'Mir ist richtig übel!'
        }
      }
      this.updateVisitorEmotion(visitor, minutes)
      if ((visitor.pendingWaste ?? 0) > 0) this.discardWasteIfCannotUseBin(visitor)
      if (this.state.parkOpen && this.updateAlcoholBehavior(visitor)) return
      if (this.state.parkOpen) this.updateStreaking(visitor, minutes)
      if (
        this.state.parkOpen &&
        visitor.campsite &&
        visitor.campingPhase === 'ready' &&
        visitor.needs.energy <=
          SIMULATION_CONFIG.visitors.decisions.exhaustedEnergy &&
        visitor.state !== 'riding' &&
        visitor.state !== 'camping' &&
        visitor.state !== 'bench-resting' &&
        !visitor.concertId &&
        !this.visitorsAwaitingDecision.has(visitor.id)
      ) {
        this.removeVisitorFromCoasterQueues(visitor.id)
        visitor.targetId = null
        visitor.route = []
        this.decideNextAction(visitor)
      } else if (
        this.state.parkOpen &&
        !visitor.campsite &&
        visitor.needs.energy <=
          SIMULATION_CONFIG.visitors.decisions.exhaustedEnergy &&
        visitor.state !== 'riding' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'bench-resting' &&
        !visitor.concertId &&
        !this.visitorsAwaitingDecision.has(visitor.id)
      ) {
        this.removeVisitorFromCoasterQueues(visitor.id)
        visitor.targetId = null
        visitor.route = []
        this.decideNextAction(visitor)
      }
      visitor.movementBoostMinutes = Math.max(0, visitor.movementBoostMinutes - minutes)
      visitor.avoidanceMinutes = Math.max(0, visitor.avoidanceMinutes - minutes)
      if (visitor.avoidanceMinutes === 0) visitor.avoidedCoasterId = null

      if (visitor.state === 'camp-waiting') {
        visitor.campingWaitMinutes += minutes
        visitor.campingWaitRetryMinutes -= minutes
        visitor.motivation = Math.max(
          0,
          visitor.motivation -
            minutes *
              SIMULATION_CONFIG.camping.unplacedMotivationLossPerMinute,
        )
        visitor.emotion = 'sad'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 20)
        if (visitor.campingWaitRetryMinutes <= 0) {
          visitor.campingWaitRetryMinutes =
            SIMULATION_CONFIG.camping.unplacedRetryIntervalMinutes
          if (this.camping.assignCampsite(visitor)) {
            visitor.thought =
              'Endlich ist ein Campingplatz frei geworden!'
            return
          }
        }
        if (
          visitor.campingWaitMinutes >=
          SIMULATION_CONFIG.camping.unplacedWaitMaximumMinutes
        ) {
          this.refundEntryFee(visitor)
          this.recordComplaint(visitor, 'no-campsite')
          this.beginVisitorDeparture(visitor)
          visitor.thought =
            'Ich habe einen Tag vergeblich gewartet. Ich verlange mein Geld zurück!'
          return
        }
        visitor.thought = `Ich warte seit ${Math.floor(visitor.campingWaitMinutes / 60)} Stunden auf einen Campingplatz.`
        return
      }

      if (visitor.state === 'camping' && visitor.route.length === 0) {
        if (visitor.campingPhase === 'seeking' || visitor.campingPhase === 'returning') {
          this.visitorsAwaitingDecision.delete(visitor.id)
          this.arriveOrDecide(visitor)
        }
        if (
          visitor.campingPhase === 'packing' &&
          visitor.interactionRemaining <= 0
        ) {
          visitor.interactionRemaining =
            SIMULATION_CONFIG.camping.tentPackMinutes
          visitor.thought = 'Ich packe Zelt und Campingsachen ein.'
        }
        if (
          (visitor.campingPhase === 'building' || visitor.campingPhase === 'packing') &&
          visitor.interactionRemaining > 0
        ) {
          visitor.interactionRemaining -= minutes
          if (visitor.interactionRemaining <= 0) {
            if (visitor.campingPhase === 'building') {
              visitor.campingPhase = 'ready'
              this.camping.createCampSetup(visitor)
              visitor.hasHandcart = false
              visitor.state = 'exploring'
              visitor.emotion = 'happy'
              visitor.emotionMinutes = 40
              visitor.thought = 'Mein Zelt steht – jetzt kann das Festival beginnen!'
              this.decideNextAction(visitor)
            } else {
              this.camping.removeVisitorInstallations(visitor.id)
              visitor.campsite = null
              visitor.campingPhase = 'none'
              visitor.hasHandcart = true
              if (this.rng.next() < SIMULATION_CONFIG.waste.tentPackLitterChance) {
                this.giveWaste(visitor, 1)
              }
              if (visitor.pendingWaste > 0 && visitor.route.length > 0) {
                visitor.thought =
                  'Vor dem Heimweg werfe ich den Zeltmüll noch in den Eimer.'
                return
              }
              visitor.state = 'leaving'
              visitor.thought = 'Alles eingepackt. Zeit für den Heimweg.'
              visitor.route = []
              this.ensureExitRoute(visitor)
            }
          }
          return
        }
        if (visitor.campingPhase === 'resting') {
          visitor.needs.energy = Math.min(
            100,
            visitor.needs.energy +
              minutes * SIMULATION_CONFIG.camping.restEnergyPerMinute,
          )
          if (
            visitor.needs.energy >=
              SIMULATION_CONFIG.camping.restCompleteEnergy &&
            !this.isVisitorSleepTime(visitor)
          ) {
            visitor.campingPhase = 'ready'
            visitor.state = 'exploring'
            visitor.thought = 'Im Zelt habe ich mich gut erholt.'
            this.decideNextAction(visitor)
          }
          return
        }
      }

      if (visitor.state === 'socializing' && visitor.route.length === 0) {
        visitor.interactionRemaining -= minutes
        this.consumeWhileStationary(visitor, minutes)
        if (visitor.pendingWaste > 0 && visitor.route.length > 0) return
        visitor.needs.fun = Math.min(
          100,
          visitor.needs.fun +
            minutes * SIMULATION_CONFIG.camping.socialFunPerMinute,
        )
        visitor.emotion = 'happy'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 10)
        if (visitor.interactionRemaining <= 0) {
          visitor.state = 'exploring'
          visitor.campActivityTarget = null
          visitor.campActivity = 'standing'
          visitor.campActivityKind = null
          visitor.campActivitySlot = 0
          visitor.campActivityCapacity = 1
          visitor.thought = 'Das Treffen am Zeltplatz war schön.'
          this.decideNextAction(visitor)
        }
        return
      }

      if (visitor.state === 'partying' && visitor.route.length === 0) {
        const atmosphere = SIMULATION_CONFIG.atmosphere
        visitor.interactionRemaining -= minutes
        const consumed = this.consumeWhileStationary(visitor, minutes)
        if (visitor.pendingWaste > 0 && visitor.route.length > 0) return
        visitor.isDancing = this.visitorShouldDance(visitor)
        visitor.needs.fun = Math.min(
          100,
          visitor.needs.fun + minutes * (atmosphere.partyFunPerMinute +
            (visitor.isDancing ? atmosphere.dancingFunBonusPerMinute : 0)),
        )
        visitor.needs.energy = Math.max(
          0,
          visitor.needs.energy -
            minutes * atmosphere.partyEnergyCostPerMinute,
        )
        visitor.emotion = 'excited'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 10)
        const concert = visitor.concertId
          ? this.availableConcerts().find((show) => show.booking.id === visitor.concertId)
          : undefined
        if (visitor.concertId) {
          if (concert) {
            this.updateConcertAttendance(visitor, minutes, concert, consumed)
            return
          }
          this.clearVisitorActivity(visitor)
          visitor.state = 'exploring'
          this.decideNextAction(visitor)
          return
        }
        if (!consumed) {
          visitor.thought = visitor.isDancing
            ? 'Die Stimmung ist großartig – ich tanze!'
            : 'Ich genieße die Musik und die Atmosphäre.'
        }
        if (
          visitor.interactionRemaining <= 0 ||
          visitor.localPartyMood < atmosphere.partyDestinationMinimumMood * 0.5 ||
          visitor.needs.energy <
            SIMULATION_CONFIG.visitors.decisions.lowEnergy
        ) {
          this.clearVisitorActivity(visitor)
          visitor.state = 'exploring'
          this.decideNextAction(visitor)
        }
        return
      }

      if (visitor.state === 'bench-resting' && visitor.route.length === 0) {
        visitor.interactionRemaining -= minutes
        const consumed = this.consumeWhileStationary(visitor, minutes)
        if (visitor.pendingWaste > 0 && visitor.route.length > 0) return
        visitor.needs.energy = Math.min(
          100,
          visitor.needs.energy +
            minutes *
              SIMULATION_CONFIG.atmosphere.benchRestEnergyPerMinute,
        )
        visitor.emotion = 'happy'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 10)
        if (!consumed) {
          visitor.thought = 'Auf der Bank kann ich mich kurz erholen.'
        }
        if (visitor.interactionRemaining <= 0) {
          this.clearVisitorActivity(visitor)
          visitor.state = 'exploring'
          this.decideNextAction(visitor)
        }
        return
      }

      if (visitor.state === 'relaxing' && visitor.route.length === 0) {
        const atmosphere = SIMULATION_CONFIG.atmosphere
        visitor.interactionRemaining -= minutes
        const consumed = this.consumeWhileStationary(visitor, minutes)
        if (visitor.pendingWaste > 0 && visitor.route.length > 0) return
        visitor.needs.fun = Math.min(
          100,
          visitor.needs.fun +
            minutes *
              (atmosphere.leisureFunPerMinute +
                (visitor.isConversing
                  ? atmosphere.conversationFunPerMinute
                  : 0)),
        )
        visitor.emotion = visitor.isConversing ? 'happy' : 'neutral'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 8)
        if (!consumed) {
          visitor.thought = visitor.isConversing
            ? 'Hier gefällt es mir – wir unterhalten uns.'
            : 'Hier ist es schön. Ich bleibe eine Weile.'
        }
        if (
          visitor.interactionRemaining <= 0 ||
          visitor.needs.energy <
            SIMULATION_CONFIG.visitors.decisions.lowEnergy
        ) {
          this.clearVisitorActivity(visitor)
          visitor.state = 'exploring'
          this.decideNextAction(visitor)
        }
        return
      }

      if (visitor.state === 'security-check') {
        visitor.interactionRemaining -= minutes
        if (visitor.interactionRemaining <= 0) {
          visitor.state = visitor.securityResumeState ?? 'exploring'
          visitor.securityResumeState = null
          if (visitor.route.length === 0) this.arriveOrDecide(visitor)
        }
        return
      }

      if (visitor.state === 'vomiting') {
        visitor.interactionRemaining -= minutes
        if (visitor.interactionRemaining <= 0) {
          visitor.state = 'exploring'
          this.decideNextAction(visitor)
        }
        return
      }

      if (visitor.state === 'using') {
        const facility = visitor.targetId ? this.state.buildings.find(b => b.id === visitor.targetId) : null
        visitor.interactionRemaining -= minutes * (facility ? buildingEfficiency(this.state, facility.x, facility.z) : 1)
        if (visitor.interactionRemaining <= 0) this.finishInteraction(visitor)
        return
      }
      if (visitor.state === 'bus-waiting') {
        visitor.busWaitMinutes += minutes
        if (
          visitor.busWaitMinutes >=
          SIMULATION_CONFIG.logistics.busMaximumWaitMinutes
        ) {
          this.recordComplaint(visitor, 'bus-wait')
          visitor.emotion = 'angry'
          visitor.thought = 'Ich warte schon viel zu lange auf den Bus.'
        }
        if (visitor.route.length === 0) return
      }
      if (
        visitor.state === 'queuing' ||
        visitor.state === 'riding' ||
        visitor.state === 'bus-riding' ||
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'injured'
      ) {
        return
      }

      if (visitor.route.length > 0) return
      if (
        visitor.state === 'leaving' &&
        this.tryBoardDepartureCar(visitor)
      ) {
        return
      }
      if (
        (visitor.state === 'leaving' || visitor.isPanicking || visitor.state === 'panicking') &&
        this.isAtParkExit(visitor) &&
        !this.getVisitorArrivalCar(visitor)
      ) {
        if (!(visitor.state === 'leaving' && ((visitor.campsite && visitor.campingPhase !== 'none') || visitor.pendingWaste > 0))) {
          leavingIds.add(visitor.id)
        }
      } else if (visitor.targetId) {
        this.arriveOrDecide(visitor)
      } else {
        this.queueVisitorDecision(visitor)
      }
    })

    if (leavingIds.size > 0) {
      this.state.visitors.forEach((visitor) => {
        if (leavingIds.has(visitor.id)) this.leaveVisitorCampBehind(visitor)
      })
      this.state.visitors = this.state.visitors.filter((visitor) => !leavingIds.has(visitor.id))
      this.indexedVisitorCount = -1
      this.state.guests = this.state.visitors.length
      this.state.logistics.arrivalGroups.forEach((group) => {
        this.normalizeCarManifest(group)
      })
    }
  }

  private updateCoasters(minutes: number, physicsSeconds: number): void {
    this.state.coasters.forEach((coaster) => {
      this.scrubCoasterQueue(coaster)
      const train = coaster.train
      const canRun =
        coaster.closed &&
        (coaster.operationMode === 'test' ||
          (coaster.operationMode === 'open' &&
            Boolean(coaster.entrance) &&
            Boolean(coaster.exit)))
      if (!canRun) {
        if (
          coaster.queue.length > 0 ||
          train.passengerIds.length > 0 ||
          train.state !== 'boarding' ||
          train.distance !== 0
        ) {
          this.recallCoasterTrainInternal(coaster)
        }
        this.positionTrain(coaster)
        return
      }

      if (coaster.operationMode === 'test') {
        if (train.state === 'boarding') {
          coaster.telemetry.measuring = false
          train.state = 'running'; train.photoPieces = []
          train.distance = 0
          train.progress = 0
          train.speed = getCoasterType(coaster.typeId).physics.stationLaunchSpeed
        } else if (train.state === 'unloading') {
          train.state = 'boarding'
        } else {
          this.integrateTrainPhysics(coaster, physicsSeconds)
        }
        this.positionTrain(coaster)
        return
      }

      if (
        !this.isOfferCurrentlyActive('rides') &&
        train.state === 'boarding'
      ) {
        if (train.passengerIds.length === 0) {
          this.positionTrain(coaster)
          return
        }
        coaster.telemetry.measuring = false
        train.state = 'running'; train.photoPieces = []
        train.progress = 0
        train.distance = 0
        train.speed =
          getCoasterType(coaster.typeId).physics.stationLaunchSpeed
      }

      this.positionCoasterQueue(coaster, minutes)

      if (train.state === 'boarding') {
        const frontVisitor = this.getVisitor(coaster.queue[0] ?? '')
        const frontQueueCell = this.getCoasterQueueCells(coaster)[0]
        const frontIsReady =
          frontVisitor?.state === 'queuing' &&
          frontQueueCell?.x === frontVisitor.cellX &&
          frontQueueCell?.z === frontVisitor.cellZ &&
          frontQueueCell?.elevation === frontVisitor.cellElevation
        train.boardingProgress =
          frontIsReady ? train.boardingProgress + minutes : 0
        while (
          train.boardingProgress >= BOARDING_MINUTES_PER_PERSON &&
          train.passengerIds.length < train.capacity
        ) {
          const visitorId = coaster.queue[0]
          const visitor = visitorId ? this.getVisitor(visitorId) : undefined
          if (
            !visitorId ||
            visitor?.state !== 'queuing' ||
            visitor.cellX !== frontQueueCell?.x ||
            visitor.cellZ !== frontQueueCell?.z ||
            visitor.cellElevation !== frontQueueCell?.elevation
          ) {
            break
          }
          coaster.queue.shift()
          train.boardingProgress -= BOARDING_MINUTES_PER_PERSON
          const paymentPosition = coaster.entrance ?? {
            x: coaster.pieces[0]?.start.x ?? 0,
            y: coaster.pieces[0]?.start.elevation ?? 0,
            z: coaster.pieces[0]?.start.z ?? 0,
          }
          const paid = this.chargeVisitor(visitor, coaster.ticketPrice, {
            x: paymentPosition.x + 0.5,
            y: paymentPosition.y + 0.85,
            z: paymentPosition.z + 0.5,
          }, 'rides')
          if (!paid) {
            visitor.state = 'exploring'
            visitor.targetId = null
            visitor.avoidedCoasterId = coaster.id
            visitor.avoidanceMinutes =
              SIMULATION_CONFIG.coasters.paymentAvoidanceMinutes
            visitor.emotion = 'sad'
            visitor.emotionMinutes = 45
            visitor.thought = 'Dafür reicht mein Budget nicht.'
            continue
          }
          train.passengerIds.push(visitor.id)
          train.passengers = train.passengerIds.length
          visitor.state = 'riding'
          visitor.thought = `Ich fahre mit ${coaster.name}!`
        }
        train.waitMinutes = train.passengers > 0 ? train.waitMinutes + minutes : 0
        const full = train.passengers >= train.capacity
        const timed = train.waitMinutes >= coaster.settings.dispatchIntervalMinutes
        const shouldDispatch =
          coaster.settings.dispatchMode === 'full-only'
            ? full
            : coaster.settings.dispatchMode === 'timed'
              ? timed
              : full || timed
        if (shouldDispatch && train.passengers > 0) {
          coaster.telemetry.measuring = false
          train.state = 'running'; train.photoPieces = []
          train.progress = 0
          train.distance = 0
          train.speed = getCoasterType(coaster.typeId).physics.stationLaunchSpeed
        }
      } else if (train.state === 'unloading') {
        train.boardingProgress += minutes
        while (
          train.boardingProgress >= BOARDING_MINUTES_PER_PERSON &&
          train.passengerIds.length > 0
        ) {
          train.boardingProgress -= BOARDING_MINUTES_PER_PERSON
          const visitorId = train.passengerIds.shift()
          if (!visitorId) continue
          const visitor = this.getVisitor(visitorId)
          if (visitor) this.releaseCoasterPassenger(coaster, visitor)
          train.passengers = train.passengerIds.length
        }
        if (train.passengerIds.length === 0) {
          train.state = 'boarding'
          train.waitMinutes = 0
          train.boardingProgress = 0
        }
      } else {
        this.integrateTrainPhysics(coaster, physicsSeconds)
      }
      this.positionTrain(coaster)
    })
  }

  private positionCoasterQueue(coaster: Coaster, minutes: number): void {
    if (!coaster.entrance || coaster.queue.length === 0) return
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const queueCells = this.getCoasterQueueCells(coaster)

    coaster.queue.forEach((visitorId, index) => {
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
      )
      const targetX = cell.x + 0.5 + stand.x
      const targetZ = cell.z + 0.5 + stand.z
      const deltaX = targetX - visitor.x
      const deltaZ = targetZ - visitor.z
      const distance = Math.hypot(deltaX, deltaZ)
      const movement =
        minutes * SIMULATION_CONFIG.coasters.queueMovementPerMinute
      visitor.facing = Math.atan2(deltaX || direction.x, deltaZ || direction.z)
      if (distance <= movement || distance < 0.001) {
        visitor.x = targetX
        visitor.y = this.getPathSurfaceElevation(path)
        visitor.z = targetZ
        visitor.cellX = cell.x
        visitor.cellZ = cell.z
        visitor.cellElevation = cell.elevation
      } else {
        visitor.x += (deltaX / distance) * movement
        visitor.y +=
          (this.getPathSurfaceElevation(path) - visitor.y) * (movement / distance)
        visitor.z += (deltaZ / distance) * movement
      }
    })
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
        visitor.y = this.getPathSurfaceElevation(path)
        visitor.z = targetZ
        visitor.cellX = cell.x
        visitor.cellZ = cell.z
        visitor.cellElevation = cell.elevation
      } else {
        visitor.x += (deltaX / distance) * movement
        visitor.y +=
          (this.getPathSurfaceElevation(path) - visitor.y) * (movement / distance)
        visitor.z += (deltaZ / distance) * movement
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

  private integrateTrainPhysics(coaster: Coaster, elapsedSeconds: number): void {
    const train = coaster.train
    const physics = getCoasterType(coaster.typeId).physics
    const tuning = SIMULATION_CONFIG.coasters.physicsSimulation
    const steps = Math.max(
      1,
      Math.ceil(elapsedSeconds / tuning.integrationStepSeconds),
    )
    const deltaSeconds = elapsedSeconds / steps

    for (let step = 0; step < steps && train.state === 'running'; step += 1) {
      const sample = sampleCoasterTrack(coaster, train.distance)
      if (!sample) return
      const carSamples = Array.from({ length: train.cars }, (_, index) =>
        sampleCoasterTrack(coaster, train.distance + index * physics.carSpacing),
      ).filter((carSample) => carSample !== null)
      const averageSlope =
        carSamples.reduce((total, carSample) => total + carSample.tangent.y, 0) /
        Math.max(1, carSamples.length)
      const chainEngaged = carSamples.some(
        (carSample) => carSample.chainLift && carSample.tangent.y > 0,
      )
      const stationDriveEngaged = carSamples.some((carSample) => carSample.stationDrive)
      const mass =
        train.cars * physics.carMassKg + train.passengers * physics.passengerMassKg
      const slopeCosine = Math.sqrt(Math.max(0, 1 - averageSlope ** 2))
      const gravityAcceleration = -tuning.gravity * averageSlope
      const direction = Math.abs(train.speed) < 0.01 ? 1 : Math.sign(train.speed)
      const rollingAcceleration =
        -direction * physics.rollingResistance * tuning.gravity * slopeCosine
      const aerodynamicAcceleration =
        -direction *
        (0.5 * tuning.airDensity * physics.dragArea * train.speed ** 2) /
        mass
      let acceleration =
        gravityAcceleration + rollingAcceleration + aerodynamicAcceleration
      if (sample.pieceKind === 'brakes' && Math.abs(train.speed) > 4) acceleration -= Math.sign(train.speed) * 4
      if (sample.pieceKind === 'splash' && Math.abs(train.speed) > 3) acceleration -= Math.sign(train.speed) * Math.min(5, train.speed * train.speed * .025)
      if (sample.pieceKind === 'photo' && !train.photoPieces?.includes(sample.pieceId)) {
        ;(train.photoPieces ??= []).push(sample.pieceId)
        for (const id of train.passengerIds) {
          const visitor = this.getVisitor(id)
          if (visitor && this.chargeVisitor(visitor, 2, sample.point, 'rides')) visitor.thought = 'Ein Erinnerungsfoto von der Achterbahn!'
        }
      }
      const remainingMeters =
        (sample.totalLength - train.distance) * physics.worldUnitMeters

      if (chainEngaged) {
        if (train.speed < 0) train.speed = 0
        if (train.speed <= physics.chainSpeed) {
          acceleration = Math.max(
            0,
            (physics.chainSpeed - train.speed) *
              tuning.chainAccelerationFactor,
          )
        }
      }

      if (stationDriveEngaged) {
        if (train.speed < 0) train.speed = 0
        const approachDistance =
          train.cars * physics.carSpacing * physics.worldUnitMeters +
          tuning.stationApproachBufferMeters
        const brakingDistance =
          (train.speed * train.speed) /
            (2 * tuning.stationBrakingDeceleration) +
          tuning.stationBrakingBufferMeters
        const targetSpeed =
          remainingMeters <= Math.max(approachDistance, brakingDistance)
            ? Math.min(
                physics.stationDriveSpeed,
                Math.sqrt(
                  Math.max(
                    0,
                    2 * tuning.stationBrakingDeceleration * remainingMeters,
                  ),
                ),
              )
            : physics.stationLaunchSpeed
        acceleration = Math.max(
          -tuning.stationDriveAccelerationLimit,
          Math.min(
            tuning.stationDriveAccelerationLimit,
            (targetSpeed - train.speed) * tuning.stationDriveResponse,
          ),
        )
      } else if (
        remainingMeters < tuning.endBrakeDistanceMeters &&
        train.speed > 0
      ) {
        const safeSpeed = Math.sqrt(
          Math.max(0, 2 * tuning.endBrakeDeceleration * remainingMeters),
        )
        if (train.speed > safeSpeed) {
          acceleration -= tuning.endBrakeDeceleration
        }
      }

      if (!coaster.telemetry.measuring && !stationDriveEngaged) {
        coaster.telemetry.measuring = true
      }
      if (coaster.telemetry.measuring) {
        this.recordCoasterTelemetry(coaster, sample, acceleration, deltaSeconds)
      }
      train.speed = Math.max(
        tuning.minimumSpeed,
        Math.min(
          tuning.maximumSpeed,
          train.speed + acceleration * deltaSeconds,
        ),
      )
      train.distance += (train.speed / physics.worldUnitMeters) * deltaSeconds

      if (
        train.distance >= sample.totalLength &&
        stationDriveEngaged &&
        Math.abs(train.speed) >= tuning.stationStopSpeed
      ) {
        train.distance =
          sample.totalLength - tuning.stationOvershootDistance
        train.speed *= tuning.stationOvershootDamping
      } else if (
        train.distance >= sample.totalLength ||
        (stationDriveEngaged &&
          remainingMeters < tuning.stationStopDistanceMeters &&
          Math.abs(train.speed) < tuning.stationStopSpeed)
      ) {
        this.finishTrainRide(coaster, true)
      } else if (train.distance < 0) {
        this.finishTrainRide(coaster, false)
      } else {
        train.progress = train.distance / sample.totalLength
      }
    }
  }

  private scrubCoasterQueue(coaster: Coaster): void {
    const seen = new Set<string>()
    coaster.queue = coaster.queue.filter((visitorId) => {
      if (seen.has(visitorId)) return false
      const visitor = this.getVisitor(visitorId)
      const valid =
        visitor?.targetId === coaster.id &&
        (visitor.state === 'seeking' ||
          visitor.state === 'queuing' ||
          visitor.state === 'security-check')
      if (!valid) return false
      seen.add(visitorId)
      return true
    })
    this.prioritizeArrivedQueueVisitors(coaster.queue)
  }

  private recordCoasterTelemetry(
    coaster: Coaster,
    sample: TrackSample,
    longitudinalAcceleration: number,
    elapsedSeconds: number,
  ): void {
    const telemetry = coaster.telemetry
    const physics = getCoasterType(coaster.typeId).physics
    const train = coaster.train
    const smoothingDistance = 0.35
    const before = sampleCoasterTrack(coaster, train.distance - smoothingDistance)
    const after = sampleCoasterTrack(coaster, train.distance + smoothingDistance)
    if (!before || !after) return

    const forward = sample.tangent
    const right = sample.right
    const up = sample.up
    const curvatureScale =
      (train.speed * train.speed) /
      (2 * smoothingDistance * physics.worldUnitMeters)
    const acceleration = {
      x:
        forward.x * longitudinalAcceleration +
        (after.tangent.x - before.tangent.x) * curvatureScale,
      y:
        forward.y * longitudinalAcceleration +
        (after.tangent.y - before.tangent.y) * curvatureScale,
      z:
        forward.z * longitudinalAcceleration +
        (after.tangent.z - before.tangent.z) * curvatureScale,
    }
    const properAcceleration = {
      x: acceleration.x,
      y: acceleration.y + 9.81,
      z: acceleration.z,
    }
    const verticalG = this.clampForce(this.dotVector(properAcceleration, up) / 9.81)
    const lateralG = this.clampForce(this.dotVector(properAcceleration, right) / 9.81)
    const longitudinalG = this.clampForce(
      this.dotVector(properAcceleration, forward) / 9.81,
    )
    const speedKmh = Math.abs(train.speed) * 3.6

    telemetry.durationSeconds += elapsedSeconds
    telemetry.cumulativeDistanceMeters += Math.abs(train.speed) * elapsedSeconds
    if (verticalG < 0.2) telemetry.airtimeSeconds += elapsedSeconds
    telemetry.maxSpeedKmh = Math.max(telemetry.maxSpeedKmh, speedKmh)
    telemetry.minVerticalG = Math.min(telemetry.minVerticalG, verticalG)
    telemetry.maxVerticalG = Math.max(telemetry.maxVerticalG, verticalG)
    telemetry.maxAbsLateralG = Math.max(
      telemetry.maxAbsLateralG,
      Math.abs(lateralG),
    )
    telemetry.maxAbsLongitudinalG = Math.max(
      telemetry.maxAbsLongitudinalG,
      Math.abs(longitudinalG),
    )

    const distance = train.distance * physics.worldUnitMeters
    const existingSampleIndex = telemetry.samples.findIndex(
      (existing) => Math.abs(existing.distance - distance) < 0.3,
    )
    if (existingSampleIndex >= 0) {
      const existing = telemetry.samples[existingSampleIndex]
      if (existing) {
        telemetry.samples[existingSampleIndex] = {
          distance,
          speedKmh: existing.speedKmh * 0.7 + speedKmh * 0.3,
          verticalG: existing.verticalG * 0.7 + verticalG * 0.3,
          lateralG: existing.lateralG * 0.7 + lateralG * 0.3,
          longitudinalG: existing.longitudinalG * 0.7 + longitudinalG * 0.3,
        }
      }
    } else {
      telemetry.samples.push({
        distance,
        speedKmh,
        verticalG,
        lateralG,
        longitudinalG,
      })
      telemetry.samples.sort((left, right) => left.distance - right.distance)
      if (telemetry.samples.length > 600) {
        telemetry.samples = telemetry.samples.filter((_, index) => index % 2 === 0)
      }
    }
  }

  private dotVector(
    left: { x: number; y: number; z: number },
    right: { x: number; y: number; z: number },
  ): number {
    return left.x * right.x + left.y * right.y + left.z * right.z
  }

  private clampForce(value: number): number {
    return Math.max(-8, Math.min(8, value))
  }

  private finishTrainRide(coaster: Coaster, _completed: boolean): void {
    const train = coaster.train
    if (_completed) coaster.telemetry.completedRuns += 1
    coaster.telemetry.measuring = false
    train.state = 'unloading'
    train.waitMinutes = 0
    train.boardingProgress = 0
    train.progress = 0
    train.distance = 0
    train.speed = 0
  }

  private recallCoasterTrainInternal(coaster: Coaster): void {
    coaster.telemetry.measuring = false
    coaster.queue.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor) return
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.avoidedCoasterId = coaster.id
      visitor.avoidanceMinutes =
        SIMULATION_CONFIG.coasters.recallAvoidanceMinutes
      visitor.thought = 'Die Achterbahn ist derzeit nicht verfügbar.'
    })
    coaster.queue = []

    coaster.train.passengerIds.forEach((visitorId) => {
      const visitor = this.getVisitor(visitorId)
      if (!visitor) return
      if (coaster.exit) {
        this.releaseCoasterPassenger(coaster, visitor)
      } else {
        visitor.state = 'exploring'
        visitor.targetId = null
        visitor.thought = 'Die Fahrt wurde sicher beendet.'
      }
    })
    coaster.train.passengerIds = []
    coaster.train.passengers = 0
    coaster.train.state = 'boarding'
    coaster.train.waitMinutes = 0
    coaster.train.boardingProgress = 0
    coaster.train.progress = 0
    coaster.train.distance = 0
    coaster.train.speed = 0
    this.positionTrain(coaster)
  }

  private releaseCoasterPassenger(coaster: Coaster, visitor: Visitor): void {
    const exit = coaster.exit
    if (!exit) return
    const nextPath =
      this.getAccessPathNeighbors(exit).find(
        (cell) => this.getPathAt(cell.x, cell.z, cell.elevation)?.pathType !== 'queue',
      ) ?? this.getEntrance()
    visitor.x = exit.x + 0.5
    visitor.y = exit.y
    visitor.z = exit.z + 0.5
    visitor.cellX = Math.round(exit.x)
    visitor.cellZ = Math.round(exit.z)
    visitor.cellElevation = exit.y
    visitor.route = [nextPath]
    visitor.targetId = null
    visitor.state = 'exiting'
    visitor.needs.fun = 100
    visitor.needs.energy = Math.max(
      0,
      visitor.needs.energy - SIMULATION_CONFIG.coasters.rideEnergyCost,
    )
    this.incidents.addRideNausea(
      visitor,
      SIMULATION_CONFIG.nausea.coasterIntensity,
    )
    visitor.emotion = 'excited'
    visitor.emotionMinutes = 90
    visitor.thought = `${coaster.name} war großartig!`
  }

  private positionTrain(coaster: Coaster): void {
    const sample = sampleCoasterTrack(coaster, coaster.train.distance)
    if (!sample) return
    coaster.train.x = sample.point.x
    coaster.train.y = sample.point.y
    coaster.train.z = sample.point.z
    coaster.train.progress =
      sample.totalLength === 0 ? 0 : coaster.train.distance / sample.totalLength
  }

  private visitorTravelSpeed(visitor: Visitor): number {
    const movement = SIMULATION_CONFIG.visitors.movement
    const emotionSpeed =
      visitor.emotion === 'angry'
        ? movement.angryMultiplier
        : visitor.emotion === 'sad'
          ? movement.sadMultiplier
          : visitor.emotion === 'excited'
            ? movement.excitedMultiplier
            : visitor.emotion === 'happy'
              ? movement.happyMultiplier
              : 1
    const speedMultiplier =
      movement.baseMultiplier *
      (visitor.streakingMinutes > 0
        ? SIMULATION_CONFIG.alcohol.streaking.speedMultiplier
        : (visitor.movementBoostMinutes > 0 ? movement.boostMultiplier : 1) *
          emotionSpeed *
          (visitor.alcoholLevel >= movement.veryDrunkThreshold
            ? movement.veryDrunkMultiplier
            : visitor.alcoholLevel >= movement.moderatelyDrunkThreshold
              ? movement.moderatelyDrunkMultiplier
              : 1)) *
      (this.isMudTerrain(visitor.cellX, visitor.cellZ)
        ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
        : 1)
    const ground = wayInfo(this.state, visitor.cellX, visitor.cellZ, 'foot', this.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)?.wayType)
    const surface = visitor.cellElevation > this.getTerrainHeight(visitor.cellX, visitor.cellZ) ? 1 : ground.speed
    const returningOnStallQueue = this.stallQueueReturnIds.has(visitor.id)
    const crowdSlowdown = returningOnStallQueue
      ? 1
      : visitor.isPanicking
        ? 1 + Math.max(0, visitor.crowding - 50) / 90
        : 1 + Math.max(0, visitor.crowding - 35) / 55
    return visitor.walkSpeed * speedMultiplier * (visitor.isPanicking ? SIMULATION_CONFIG.crowding.panicFleeBoost : 1) * surface / crowdSlowdown
  }

  private groundWetBucket = -1
  private movementOccupancy = new Map<number, number>()
  private pedestrianCongestionCosts = new Map<number, number>()

  private refreshPedestrianCongestion(): void {
    const costs = new Map<number, number>()
    const visited = new Set<number>()
    const consider = (x: number, z: number, elevation: number): void => {
      const key = this.packCell({ x, z, elevation })
      if (visited.has(key)) return
      visited.add(key)
      const count = this.movementOccupancy.get(key) ?? 0
      const capacity = wayInfo(this.state, x, z, 'foot', this.getPathAt(x, z, elevation)?.wayType).capacity
      const density = count / capacity
      const penalty = Math.min(24, Math.floor(7 * Math.pow(Math.max(0, density - 0.5) * 2, 2)))
      if (penalty > 0) costs.set(key, penalty)
    }
    for (const visitor of this.state.visitors) {
      consider(visitor.cellX, visitor.cellZ, visitor.cellElevation)
    }
    for (const route of this.state.festival.infrastructure.routes) {
      consider(route.position.x, route.position.z, route.position.elevation)
    }
    if (costs.size !== this.pedestrianCongestionCosts.size ||
      [...costs].some(([key, value]) => this.pedestrianCongestionCosts.get(key) !== value)) {
      this.pedestrianCongestionCosts = costs
      // Congestion actually changed: cached routes may no longer reflect it, so
      // invalidate immediately instead of waiting out their gradual expiry.
      this.pedestrianPathCache.clear()
    }
  }
  /** Keep the current segment and destination; only reconsider the journey between them.
   * The tick-based schedule survives saves and bounds searches even in large crowds. */
  private reviewVisitorRoutes(): void {
    const visitors = this.state.visitors
    const period = Math.max(100, Math.ceil(visitors.length / 4))
    const first = (this.state.simTick % period) * 4
    for (let index = first; index < Math.min(first + 4, visitors.length); index++) {
      const visitor = visitors[index]!
      if (this.stallQueueReturnIds.has(visitor.id)) continue
      if (visitor.route.length < 3 || ['security-check', 'vomiting', 'using', 'queuing', 'riding', 'bus-riding', 'vehicle-arrival', 'injured'].includes(visitor.state)) continue
      const next = visitor.route[0]!
      const goal = visitor.route.at(-1)!
      const atCellCenter = Math.hypot(visitor.x - visitor.cellX - visitor.tileOffsetX, visitor.z - visitor.cellZ - visitor.tileOffsetZ) < 0.001
      const start = atCellCenter ? { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation } : next
      this.ensurePedestrianNav(this.lastNavRevision !== this.worldRevision)
      let access = 0, allowQueue = false
      for (const cell of visitor.route) {
        access |= this.pedestrianNav.get(this.packCell(cell))?.flags ?? 0
        if (!allowQueue) allowQueue = this.getPathAt(cell.x, cell.z, cell.elevation)?.pathType === 'queue'
      }
      // Reuse indexed navigation flags rather than searching every area four times per route.
      const route = this.findPath(start, [goal],
        allowQueue,
        Boolean(access & NAV_CAMPING),
        Boolean(access & NAV_MEDICAL),
        false,
        Boolean(access & NAV_FORECOURT),
        512,
      )
      if (route) visitor.route = atCellCenter ? route : [{ ...next }, ...route]
    }
  }

  private walkVisitors(minutes: number): void {
    if (minutes <= 0) return
    this.movementOccupancy.clear()
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    for (const v of this.state.visitors) {
      if (
        this.isVisitorSeatedInVehicle(v, seated) ||
        v.state === 'riding'
      ) {
        continue
      }
      const key = this.visitorOccupancyKey(v)
      this.movementOccupancy.set(key, (this.movementOccupancy.get(key) ?? 0) + 1)
    }
    for (const route of this.state.festival.infrastructure.routes) {
      if (route.phase === 'idle' && !route.path.length) continue
      const key = this.packCell(route.position)
      this.movementOccupancy.set(key, (this.movementOccupancy.get(key) ?? 0) + (route.cargo > 0 ? 3 : 2))
    }
    // Occupancy for movement stays live; route costs update once per simulated second.
    // Keep the shared A* cache useful between updates instead of flushing every step.
    if (this.state.simTick % 10 === 0) this.refreshPedestrianCongestion()
    this.reviewVisitorRoutes()
    this.state.visitors.forEach((visitor) => {
      if (
        visitor.state === 'security-check' ||
        visitor.state === 'vomiting' ||
        visitor.state === 'using' ||
        visitor.state === 'queuing' ||
        visitor.state === 'riding' ||
        visitor.state === 'bus-riding' ||
        visitor.state === 'vehicle-arrival' ||
        visitor.state === 'injured' ||
        seated.has(visitor.id)
      ) {
        return
      }
      if (visitor.route.length === 0) return
      this.moveVisitor(
        visitor,
        minutes * this.visitorTravelSpeed(visitor),
        false,
      )
    })
  }

  private moveVisitor(
    visitor: Visitor,
    distance: number,
    decideOnArrival = true,
  ): void {
    while (distance > 0 && visitor.route.length > 0) {
      const next = visitor.route[0]
      const oldKey = this.visitorOccupancyKey(visitor)
      const nextPath = this.getPathAt(next.x, next.z, next.elevation)
      this.applyQueueLaneOffset(visitor, next)
      const nextKey = this.occupancyKeyForCell(next, nextPath, visitor.tileOffsetX, visitor.tileOffsetZ)
      const capacity = wayInfo(this.state, next.x, next.z, 'foot', nextPath?.wayType).capacity
      const density = Math.max(0, (this.movementOccupancy.get(nextKey) ?? 0) - (nextKey === oldKey ? 1 : 0)) / capacity
      // Destination occupancy controls flow: leaving a packed tile for a free one must stay easy.
      // At capacity retain 12.5% speed, and at least 4% even in extreme crowds.
      // Stall return lanes keep normal walking speed — only the inbound wait lane crawls.
      const returningOnStallQueue = this.stallQueueReturnIds.has(visitor.id)
      const crowdSpeed = returningOnStallQueue
        ? 1
        : Math.max(0.04, 1 / (1 + 7 * Math.pow(Math.max(0, density - 0.5) * 2, 2)))
      if (!returningOnStallQueue && density >= 1) visitor.thought = 'Hier ist es eng – ich komme nur langsam voran.'
      const nextCampingCell = this.getCampingCellAt(next.x, next.z)
      const nextMedicalCell = this.getMedicalCellAt(next.x, next.z)
      const nextFestivalCell = this.getStageForecourtCellAt(next.x, next.z)
      const currentCell = {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      }
      if (
        nextPath?.staffOnly ||
        !this.isInWorld(next.x, next.z) ||
        this.isPedestrianSolidAt(next.x, next.z, next.elevation) ||
        this.isPedestrianEdgeBlocked(currentCell, next)
      ) {
        this.removeVisitorFromCoasterQueues(visitor.id)
        visitor.route = []
        visitor.targetId = null
        visitor.state = 'exploring'
        visitor.thought = 'Der Weg ist versperrt.'
        return
      }

      const targetX = next.x + visitor.tileOffsetX
      const targetY = nextPath
        ? this.getPathSurfaceElevation(nextPath)
        : nextCampingCell?.elevation ??
          nextMedicalCell?.elevation ??
          nextFestivalCell?.elevation ??
          this.getTerrainHeight(next.x, next.z)
      const targetZ = next.z + visitor.tileOffsetZ
      const deltaX = targetX - visitor.x
      const deltaZ = targetZ - visitor.z
      const remaining = Math.hypot(deltaX, deltaZ)
      visitor.facing = Math.atan2(deltaX, deltaZ)

      if (remaining <= distance * crowdSpeed) {
        visitor.x = targetX
        visitor.y = targetY
        visitor.z = targetZ
        if (nextKey !== oldKey) {
          this.movementOccupancy.set(oldKey, Math.max(0, (this.movementOccupancy.get(oldKey) ?? 0) - 1))
          this.movementOccupancy.set(nextKey, (this.movementOccupancy.get(nextKey) ?? 0) + 1)
        }
        visitor.cellX = next.x
        visitor.cellZ = next.z
        visitor.cellElevation = next.elevation
        const atmosphereKey = this.cellKey(next.x, next.z, next.elevation)
        visitor.localAttractiveness =
          this.attractivenessValues.get(atmosphereKey) ?? 0
        visitor.localPartyMood =
          this.partyMoodValues.get(atmosphereKey) ?? 0
        visitor.route.shift()
        distance -= remaining / crowdSpeed
        this.applyCampWalkPenalty(visitor, remaining)
        const gate = this.getSecurityGateAt(next.x, next.z, next.elevation)
        if (!gate) visitor.securityGateId = null
        const staffed =
          gate &&
          this.state.staff.some(
            (member) =>
              member.role === 'security' && member.assignedBuildingId === gate.id,
          )
        if (gate && staffed && visitor.securityGateId !== gate.id) {
          const inspection = this.security.inspect(
            visitor.inventory,
            gate.securityConfig ?? DEFAULT_SECURITY_CONFIG,
            this.rng,
          )
          visitor.securityResumeState = visitor.state
          visitor.state = 'security-check'
          visitor.securityGateId = gate.id
          visitor.interactionRemaining = inspection.durationMinutes
          visitor.needs.fun = Math.max(0, visitor.needs.fun - inspection.funPenalty)
          visitor.motivation = Math.max(
            0,
            visitor.motivation - inspection.motivationPenalty,
          )
          visitor.emotion = inspection.confiscated.length > 0 ? 'angry' : 'sad'
          visitor.emotionMinutes = 35
          visitor.thought =
            inspection.confiscated.length > 0
              ? `Beschlagnahmt: ${inspection.confiscated.map((kind) => INVENTORY_ITEMS[kind].name).join(', ')}.`
              : 'Diese Kontrolle dauert ganz schön lange.'
          if (inspection.confiscated.length > 0) {
            this.recordComplaint(visitor, 'security-confiscation')
          }
          return
        }
      } else {
        distance *= crowdSpeed
        visitor.x += (deltaX / remaining) * distance
        visitor.y += (targetY - visitor.y) * (distance / remaining)
        visitor.z += (deltaZ / remaining) * distance
        this.applyCampWalkPenalty(visitor, distance)
        distance = 0
      }
    }

    if (visitor.route.length === 0) {
      if (this.stallQueueReturnIds.has(visitor.id)) {
        this.continueAfterStallQueueReturn(visitor)
        return
      }
      if (decideOnArrival) this.arriveOrDecide(visitor)
    }
  }

  private applyCampWalkPenalty(visitor: Visitor, distance: number): void {
    if (visitor.campingPhase !== 'returning' || visitor.needs.energy >= 35) {
      return
    }
    visitor.walkingToCampDistance += distance
    visitor.needs.fun = Math.max(
      0,
      visitor.needs.fun -
        distance *
          SIMULATION_CONFIG.logistics.longCampWalkFunLossPerTile,
    )
    if (
      visitor.walkingToCampDistance >=
      SIMULATION_CONFIG.logistics.longCampWalkComplaintTiles
    ) {
      this.recordComplaint(visitor, 'long-walk-to-camp')
    }
  }

  private arriveOrDecide(visitor: Visitor): void {
    if (this.visitorsAwaitingDecision.has(visitor.id)) return
    if (visitor.state === 'leaving' || visitor.isPanicking || visitor.state === 'panicking') return
    if (visitor.state === 'bus-waiting') {
      visitor.thought = 'Ich warte an der Haltestelle auf den Bus.'
      return
    }

    if (visitor.state === 'socializing') {
      visitor.thought = 'Wir sitzen zusammen, essen, trinken und unterhalten uns.'
      return
    }
    if (
      visitor.state === 'partying' ||
      visitor.state === 'bench-resting' ||
      visitor.state === 'relaxing'
    ) {
      return
    }

    if (visitor.campsite && visitor.state === 'camping') {
      if (visitor.campingPhase === 'seeking') {
        visitor.campingPhase = 'building'
        visitor.interactionRemaining =
          SIMULATION_CONFIG.camping.tentBuildMinutes
        visitor.thought = 'Ich baue mein Zelt auf.'
        return
      }
      if (visitor.campingPhase === 'returning') {
        visitor.campingPhase = 'resting'
        visitor.thought = 'Ich ruhe mich in meinem Zelt aus.'
        return
      }
      if (visitor.campingPhase === 'packing') {
        visitor.interactionRemaining =
          SIMULATION_CONFIG.camping.tentPackMinutes
        visitor.thought = 'Ich packe Zelt und Campingsachen ein.'
        return
      }
    }

    if (visitor.targetId) {
      const target = this.state.buildings.find((building) => building.id === visitor.targetId)
      if (target && isWasteBin(target.kind)) {
        this.depositPendingWaste(visitor, target.id)
        visitor.targetId = null
        if (visitor.campingPhase === 'none' && visitor.hasHandcart) {
          visitor.state = 'leaving'
          visitor.route = []
          this.ensureExitRoute(visitor)
          return
        }
        visitor.state = 'exploring'
        this.decideNextAction(visitor)
        return
      }
      if (target) {
        if (!this.isBuildingCurrentlyActive(target)) {
          visitor.targetId = null
          visitor.state = 'exploring'
          visitor.thought = 'Dieses Angebot hat inzwischen geschlossen.'
          this.decideNextAction(visitor)
          return
        }
        if (this.getBuildingQueueCells(target).length > 0) {
          const queue = this.getFacilityQueue(target.id)
          if (!queue.includes(visitor.id)) queue.push(visitor.id)
          visitor.state = 'queuing'
          visitor.interactionRemaining = 0
          visitor.thought = `Ich stehe bei ${BUILDINGS[target.kind].name} an.`
          return
        }
        this.startFacilityInteraction(visitor, target)
        return
      }
      const coaster = this.getCoaster(visitor.targetId)
      if (
        coaster?.closed &&
        coaster.operationMode === 'open' &&
        this.isOfferCurrentlyActive('rides') &&
        coaster.entrance &&
        coaster.exit
      ) {
        const queueCapacity = this.getCoasterQueueCapacity(coaster.id)
        const hasReservation = coaster.queue.includes(visitor.id)
        if (
          !hasReservation &&
          (queueCapacity === 0 || coaster.queue.length >= queueCapacity)
        ) {
          visitor.avoidedCoasterId = coaster.id
          visitor.avoidanceMinutes =
            SIMULATION_CONFIG.coasters.fullQueueAvoidanceMinutes
          visitor.emotion = 'angry'
          visitor.emotionMinutes = 35
          visitor.targetId = null
          visitor.state = 'exploring'
          visitor.thought = 'Die Warteschlange ist voll. Ich gehe erst einmal weiter.'
          this.decideNextAction(visitor)
          return
        }
        if (!hasReservation) coaster.queue.push(visitor.id)
        visitor.state = 'queuing'
        visitor.thought = `Ich warte bei ${coaster.name}.`
        return
      }
    }
    this.decideNextAction(visitor)
  }

  private decideNextAction(visitor: Visitor): void {
    if (this.processingSimulationStep) {
      if (this.decisionBudget <= 0 || this.decidedThisTick.has(visitor.id) || this.pendingVisitorRouting.has(visitor.id)) {
        this.queueVisitorDecision(visitor)
        return
      }
      this.decisionBudget--
      this.decidedThisTick.add(visitor.id)
      this.visitorsAwaitingDecision.delete(visitor.id)
    }
    const previousDecision = this.activeVisitorDecision
    this.activeVisitorDecision = visitor.id
    try { this.chooseNextVisitorAction(visitor) }
    finally { this.activeVisitorDecision = previousDecision }
  }

  private chooseNextVisitorAction(visitor: Visitor): void {
    if (visitor.streakingMinutes > 0) {
      this.continueStreakingRun(visitor)
      return
    }
    if ((visitor.pendingWaste ?? 0) > 0) {
      this.tryDisposeWaste(visitor)
      if (
        visitor.state === 'seeking' &&
        visitor.pendingWaste > 0 &&
        visitor.route.length > 0
      ) {
        return
      }
    }
    const decisions = SIMULATION_CONFIG.visitors.decisions
    if (visitor.isPanicking || visitor.state === 'panicking') {
      this.ensurePanicFleeRoute(visitor)
      return
    }
    if (
      visitor.concertId &&
      this.availableConcerts().some((show) => show.booking.id === visitor.concertId)
    ) {
      visitor.state = 'partying'
      return
    }
    if (!this.state.parkOpen || visitor.motivation <= 0) {
      this.beginVisitorDeparture(visitor)
      return
    }
    const festivalPhase = getFestivalCycleStatus(
      this.state.dayPlan,
      this.state.day,
    )
    if (festivalPhase.phase === 'break') {
      this.beginVisitorDeparture(visitor)
      visitor.thought = 'Das Festival ist beendet. Ich reise ab.'
      return
    }
    if (
      visitor.ticketType === 'day' &&
      (festivalPhase.phase !== 'festival' ||
        !isDayVisitorAdmissionOpen(this.state.dayPlan, this.state.minute))
    ) {
      this.beginVisitorDeparture(visitor)
      visitor.thought =
        'Meine Zeit als Tagesgast ist vorbei. Ich gehe nach Hause.'
      return
    }
    // Resume unfinished setup in saves made while camping arrivals were misrouted.
    if (visitor.campsite && visitor.campingPhase === 'seeking') {
      const route = this.camping.findRouteToCampsite(visitor, visitor.campsite)
      if (route) {
        visitor.state = 'camping'
        visitor.targetId = null
        visitor.route = route
        return
      }
    }
    if (
      visitor.campsite &&
      visitor.campingPhase === 'ready' &&
      this.isVisitorSleepTime(visitor) &&
      visitor.needs.energy <
        SIMULATION_CONFIG.camping.sleepSchedule
          .scheduledSleepEnergyBelow
    ) {
      const route = this.camping.findRouteToCampsite(
        visitor,
        visitor.campsite,
      )
      if (route) {
        visitor.state = 'camping'
        visitor.campingPhase = 'returning'
        visitor.walkingToCampDistance = 0
        visitor.targetId = null
        if (this.tryBeginBusJourney(visitor, visitor.campsite, route)) return
        visitor.route = route
        visitor.thought = `Es ist Schlafenszeit. Ich gehe zu meinem Zelt.`
        return
      }
    }
    if (
      !visitor.campsite &&
      this.isVisitorSleepTime(visitor) &&
      visitor.needs.energy <
        SIMULATION_CONFIG.camping.sleepSchedule
          .nonCamperDepartureEnergyBelow
    ) {
      this.beginVisitorDeparture(visitor)
      visitor.thought = 'Es ist spät und ich brauche Schlaf. Ich gehe nach Hause.'
      return
    }
    if (
      (visitor.needs.hunger < decisions.seekFoodBelow &&
        getItemQuantity(visitor.inventory, 'food') > 0) ||
      (visitor.alcoholDesire >= decisions.seekAlcoholDesire &&
        getItemQuantity(visitor.inventory, 'alcohol') > 0)
    ) {
      this.beginStationaryBreak(
        visitor,
        'Ich suche mir kurz einen Platz zum Essen oder Trinken.',
      )
      return
    }
    if (
      visitor.needs.energy <
      SIMULATION_CONFIG.atmosphere.benchRestEnergyThreshold
    ) {
      const bench = this.findBenchDestination(visitor)
      if (bench) {
        visitor.state = 'bench-resting'
        visitor.targetId = bench.building.id
        visitor.route = bench.route
        visitor.activityTarget = {
          x: bench.building.x,
          z: bench.building.z,
          elevation: bench.building.elevation,
        }
        visitor.activitySlot = bench.slot
        visitor.activityCapacity =
          SIMULATION_CONFIG.atmosphere.benchCapacity
        this.adjustVisitorOccupancy(visitor, 1)
        visitor.interactionRemaining =
          SIMULATION_CONFIG.atmosphere.benchRestMinutes
        if (
          this.tryBeginBusJourney(
            visitor,
            visitor.activityTarget,
            bench.route,
          )
        ) {
          return
        }
        visitor.thought = 'Ich suche mir eine freie Bank zum Ausruhen.'
        return
      }
    }
    if (visitor.needs.energy < decisions.lowEnergy) {
      if (visitor.campsite && visitor.campingPhase === 'ready') {
        const route = this.camping.findRouteToCampsite(visitor, visitor.campsite)
        if (route) {
          visitor.state = 'camping'
          visitor.campingPhase = 'returning'
          visitor.walkingToCampDistance = 0
          visitor.targetId = null
          if (this.tryBeginBusJourney(visitor, visitor.campsite, route)) return
          visitor.route = route
          visitor.thought = 'Ich gehe zu meinem Zelt und ruhe mich aus.'
          return
        }
      }
      const route = this.findPath(
        { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
        [this.getEntrance()],
      )
      visitor.state = 'leaving'
      visitor.thought = 'Ich bin müde und gehe nach Hause.'
      visitor.targetId = null
      visitor.route = route ?? []
      return
    }

    const desiredKinds: BuildingKind[] = []
    if (visitor.needs.toilet < decisions.seekToiletBelow) desiredKinds.push('toilet')
    if (visitor.needs.hunger < decisions.seekFoodBelow) desiredKinds.push('food')
    if (
      visitor.alcoholDesire >= decisions.seekAlcoholDesire &&
      visitor.alcoholLevel < decisions.maximumAlcoholForPurchase &&
      visitor.needs.energy > decisions.minimumEnergyForAlcohol
    ) {
      desiredKinds.push('alcohol')
    }
    if (visitor.needs.fun < decisions.seekFunBelow) desiredKinds.push('ride')

    const urgentNeed = desiredKinds.some(
      (kind) => kind === 'toilet' || kind === 'food',
    )
    if (!urgentNeed && this.tryVisitConcert(visitor)) return
    const decisionRng = this.visitorDecisionRng(visitor)
    if (
      !urgentNeed &&
      visitor.needs.fun < decisions.seekSouvenirFunBelow &&
      ((visitor.pathSeed + visitor.wanderNonce * 17) >>> 0) % 1000 <
        decisions.seekSouvenirProbability * 1000
    ) {
      if (!visitor.ownedMascot && this.state.buildings.some((building) => building.kind === 'mascot')) {
        desiredKinds.push('mascot')
      }
      if (!visitor.wornShirt && this.state.buildings.some((building) => building.kind === 'shirt')) {
        desiredKinds.push('shirt')
      }
    }
    const searchAtmosphere =
      visitor.wanderNonce %
        SIMULATION_CONFIG.pathfinding.exploreSearchEvery ===
      0
    if (
      !urgentNeed &&
      searchAtmosphere &&
      decisionRng() <
        SIMULATION_CONFIG.atmosphere.partyDecisionProbability *
          (0.45 +
            visitor.partyPreference *
              SIMULATION_CONFIG.atmosphere.partyPreferenceDecisionWeight)
    ) {
      const party = this.findPartyDestination(visitor)
      if (party) {
        this.beginPartyVisit(visitor, party)
        return
      }
    }

    for (const kind of desiredKinds) {
      if (kind === 'ride') {
        const coasterDestination = this.findReachableCoaster(visitor)
        if (coasterDestination) {
          if (!coasterDestination.coaster.queue.includes(visitor.id)) {
            coasterDestination.coaster.queue.push(visitor.id)
          }
          visitor.state = 'seeking'
          visitor.targetId = coasterDestination.coaster.id
          visitor.route = coasterDestination.route
          visitor.thought = `Ich möchte ${coasterDestination.coaster.name} fahren!`
          return
        }
        const fullCoaster = this.state.coasters.find((coaster) => {
          const capacity = this.getCoasterQueueCapacity(coaster.id)
          return (
            coaster.operationMode === 'open' &&
            this.isOfferCurrentlyActive('rides') &&
            coaster.id !== visitor.avoidedCoasterId &&
            capacity > 0 &&
            coaster.queue.length >= capacity
          )
        })
        if (fullCoaster) {
          visitor.avoidedCoasterId = fullCoaster.id
          visitor.avoidanceMinutes =
            SIMULATION_CONFIG.coasters.fullQueueAvoidanceMinutes
          visitor.emotion = 'angry'
          visitor.emotionMinutes = 35
        }
      }
      const destination = this.findReachableFacility(visitor, kind)
      if (destination) {
        visitor.state = 'seeking'
        visitor.targetId = destination.building.id
        if (
          this.tryBeginBusJourney(
            visitor,
            {
              x: destination.building.x,
              z: destination.building.z,
              elevation: destination.building.elevation,
            },
            destination.route,
          )
        ) {
          return
        }
        if (this.getBuildingQueueCells(destination.building).length > 0) {
          const queue = this.getFacilityQueue(destination.building.id)
          if (!queue.includes(visitor.id)) queue.push(visitor.id)
        }
        visitor.route = destination.route
        visitor.thought =
          kind === 'food'
            ? 'Ich habe Hunger.'
            : kind === 'alcohol'
              ? 'Ich hole mir etwas zu trinken.'
            : kind === 'toilet'
              ? 'Ich brauche dringend eine Toilette.'
            : kind === 'mascot' || kind === 'shirt'
              ? souvenirSeekThought(kind)
              : 'Ich möchte etwas Spannendes erleben!'
        return
      }
    }

    if (
      searchAtmosphere &&
      decisionRng() < SIMULATION_CONFIG.atmosphere.partyDecisionProbability
    ) {
      const party = this.findPartyDestination(visitor)
      if (party) {
        this.beginPartyVisit(visitor, party)
        return
      }
    }

    if (
      searchAtmosphere &&
      visitor.needs.fun < decisions.socializingFunBelow &&
      decisionRng() < decisions.socializingProbability
    ) {
      const gathering = this.camping.findRouteToGathering(visitor)
      if (gathering) {
        visitor.state = 'socializing'
        visitor.targetId = null
        if (
          this.tryBeginBusJourney(
            visitor,
            gathering.target,
            gathering.route,
          )
        ) {
          return
        }
        visitor.route = gathering.route
        visitor.interactionRemaining =
          decisions.socializingMinutesMinimum +
          this.rng.next() * decisions.socializingMinutesRandomRange
        visitor.campActivityTarget = gathering.target
        visitor.campActivityKind = gathering.kind
        visitor.campActivitySlot = gathering.slot
        visitor.campActivityCapacity = gathering.capacity
        visitor.campActivity =
          gathering.kind === 'chairs' ? 'sitting' : 'standing'
        visitor.thought =
          gathering.kind === 'pavilion'
            ? 'Ich gehe zu den anderen unter den Pavillon.'
            : gathering.kind === 'musicBox'
              ? 'Ich gehe zur Musikbox am Zeltplatz.'
              : 'Ich setze mich zu den anderen Campern.'
        return
      }
    }

    if (searchAtmosphere) {
      const leisure = this.findLeisureDestination(visitor)
      if (leisure) {
        visitor.state = 'relaxing'
        visitor.targetId = null
        if (this.tryBeginBusJourney(visitor, leisure.cell, leisure.route)) return
        visitor.route = leisure.route
        visitor.activityTarget = leisure.cell
        visitor.activitySlot = leisure.slot
        visitor.activityCapacity = leisure.capacity
        this.adjustVisitorOccupancy(visitor, 1)
        visitor.interactionRemaining =
          SIMULATION_CONFIG.atmosphere.leisureDurationMinimum +
          this.rng.next() *
            SIMULATION_CONFIG.atmosphere.leisureDurationRandomRange
        visitor.isDancing = false
        visitor.thought =
          leisure.party > leisure.beauty
            ? 'Dort ist gute Stimmung. Ich gehe zu den anderen.'
            : 'Dort sieht es schön aus. Da möchte ich mich aufhalten.'
        return
      }
    }

    this.assignDeterministicWander(visitor, decisionRng)
    visitor.thought =
      desiredKinds.length > 0
        ? 'Ich finde hier nicht, was ich brauche.'
        : 'Ich schaue mich ein wenig um.'
  }

  private tryBeginBusJourney(
    visitor: Visitor,
    destination: Cell,
    directRoute?: readonly Cell[],
  ): boolean {
    const routeToDestination =
      directRoute ??
      this.findPath(
        {
          x: visitor.cellX,
          z: visitor.cellZ,
          elevation: visitor.cellElevation,
        },
        [destination],
      )
    if (
      !routeToDestination ||
      routeToDestination.length <
        SIMULATION_CONFIG.logistics.busMinimumJourneyTiles ||
      this.state.logistics.busLines.length === 0
    ) {
      return false
    }
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const choices = this.state.logistics.busLines
      .filter(
        (line) =>
          line.active &&
          line.stopIds.length >= 2 &&
          line.busIds.some((busId) =>
            this.state.logistics.roadVehicles.some(
              (vehicle) => vehicle.id === busId && vehicle.kind === 'bus',
            ),
          ),
      )
      .flatMap((line) =>
        line.stopIds.flatMap((stopId, boardingIndex) => {
          const stop = this.state.logistics.busStops.find(
            (candidate) => candidate.id === stopId,
          )
          if (!stop) return []
          const route = this.findPath(start, [
            { x: stop.x, z: stop.z, elevation: 0 },
          ])
          if (!route) return []
          return Array.from(
            { length: line.stopIds.length - 1 },
            (_, index) => index + 1,
          ).flatMap((rideStops) => {
            const destinationStopId =
              line.stopIds[
                (boardingIndex + rideStops) % line.stopIds.length
              ]
            const destinationStop = this.state.logistics.busStops.find(
              (candidate) => candidate.id === destinationStopId,
            )
            if (!destinationStop) return []
            const finalRoute = this.findPath(
              { x: destinationStop.x, z: destinationStop.z, elevation: 0 },
              [destination],
            )
            if (!finalRoute) return []
            const walkingDistance = route.length + finalRoute.length
            const requiredSaving =
              visitor.needs.energy <=
              SIMULATION_CONFIG.logistics.busPreferenceEnergyThreshold
                ? 0
                : SIMULATION_CONFIG.logistics.busMinimumWalkSavingsTiles
            if (
              walkingDistance + requiredSaving >=
              routeToDestination.length
            ) {
              return []
            }
            return [{
              line,
              stop,
              destinationStop,
              route,
              score:
                walkingDistance +
                rideStops *
                  SIMULATION_CONFIG.logistics.busStopRideCostTiles +
                line.headway /
                  SIMULATION_CONFIG.logistics.busHeadwayCostDivisor,
            }]
          })
        }),
      )
      .sort((left, right) => left.score - right.score)
    const choice = choices[0]
    if (!choice) return false
    visitor.busDestination = { ...destination }
    visitor.busDestinationStopId = choice.destinationStop.id
    visitor.busResumeState = visitor.state
    visitor.busResumeTargetId = visitor.targetId
    visitor.state = 'bus-waiting'
    visitor.busLineId = choice.line.id
    visitor.busWaitMinutes = 0
    visitor.route = choice.route
    visitor.targetId = choice.stop.id
    visitor.thought = `Ich fahre mit ${choice.line.name}, damit ich nicht so weit laufen muss.`
    return true
  }

  private beginPartyVisit(
    visitor: Visitor,
    party: {
      cell: Cell
      route: Cell[]
      slot: number
      capacity: number
      forecourt: boolean
    },
  ): void {
    visitor.state = 'partying'
    visitor.targetId = null
    visitor.route = party.forecourt
      ? this.routeThroughFestivalEntrance(visitor, party.cell, party.route)
      : party.route
    visitor.activityTarget = party.cell
    visitor.activitySlot = party.slot
    visitor.activityCapacity = party.capacity
    this.adjustVisitorOccupancy(visitor, 1)
    const partyKey = this.cellKey(
      party.cell.x,
      party.cell.z,
      party.cell.elevation,
    )
    if (party.route.length === 0) {
      visitor.localAttractiveness =
        this.attractivenessValues.get(partyKey) ?? 0
      visitor.localPartyMood = this.partyMoodValues.get(partyKey) ?? 0
    }
    visitor.interactionRemaining =
      SIMULATION_CONFIG.atmosphere.partyDurationMinimum +
      this.rng.next() * SIMULATION_CONFIG.atmosphere.partyDurationRandomRange
    visitor.isDancing = false
    visitor.isConversing = false
    visitor.thought = party.forecourt
      ? 'Ich gehe zum Bühnenvorplatz!'
      : 'Dort scheint gute Stimmung zu sein!'
    this.tryBeginBusJourney(visitor, party.cell, visitor.route)
  }

  private routeThroughFestivalEntrance(
    visitor: Visitor,
    goal: Cell,
    directRoute: Cell[],
  ): Cell[] {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const directDistance =
      Math.abs(goal.x - start.x) + Math.abs(goal.z - start.z)
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 },
    ]
    const gates = this.state.buildings
      .filter((building) => building.kind === 'securityGate')
      .map((gate) => {
        const direction = directions[gate.rotation % directions.length] ?? directions[0]!
        const startSide =
          (start.x - gate.x) * direction.x + (start.z - gate.z) * direction.z
        const goalSide =
          (goal.x - gate.x) * direction.x + (goal.z - gate.z) * direction.z
        const detour =
          Math.abs(gate.x - start.x) +
          Math.abs(gate.z - start.z) +
          Math.abs(goal.x - gate.x) +
          Math.abs(goal.z - gate.z)
        return {
          gate,
          weight: gate.securityConfig?.flowShare ?? 1,
          eligible:
            startSide < 0 &&
            goalSide > 0 &&
            detour <= directDistance * 2 + 8 &&
            Boolean(this.getPathAt(gate.x, gate.z, gate.elevation)),
        }
      })
      .filter((candidate) => candidate.eligible && candidate.weight > 0)
      .sort((left, right) => left.gate.id.localeCompare(right.gate.id))
    if (gates.length === 0) return directRoute

    const totalWeight = gates.reduce((sum, candidate) => sum + candidate.weight, 0)
    let hash = 2166136261
    for (const character of visitor.id) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    let selection = ((hash >>> 0) / 0x100000000) * totalWeight
    const selected =
      gates.find((candidate) => {
        selection -= candidate.weight
        return selection <= 0
      }) ?? gates[gates.length - 1]
    if (!selected) return directRoute

    const gateCell = {
      x: selected.gate.x,
      z: selected.gate.z,
      elevation: selected.gate.elevation,
    }
    const toGate = this.findPath(start, [gateCell], true)
    const fromGate = this.findPath(
      gateCell,
      [goal],
      true,
      false,
      false,
      false,
      true,
    )
    return toGate && fromGate ? [...toGate, ...fromGate] : directRoute
  }

  private availableConcerts(){
    const key=`${this.state.simTick}:${this.worldRevision}:${this.state.day}:${this.state.minute}`
    if(key!==this.concertChoiceKey){
      this.concertChoiceKey=key
      this.concertChoices=watchableBookings(this.state)
        .filter(b=>!showIssue(this.state,b,Math.max(this.state.minute,b.start)))
        .map(booking=>({booking,band:BANDS.find(b=>b.id===booking.bandId)!,stage:this.state.buildings.find(b=>b.id===booking.stageId)!}))
    }
    return this.concertChoices
  }
  private avoidsConcertAt(visitor:Visitor,cell:{x:number;z:number}){
    if(!this.state.festival.enabled)return false
    const nearby=this.availableConcerts().filter(show=>stageDistance(show.stage,cell)<=8)
    if(!nearby.length)return false
    visitor.musicTaste??=musicTaste(visitor.id,this.state.festival)
    return !nearby.some(show=>musicAppeal(visitor.musicTaste!,show.band.id)>=.3)
  }

  private visitorShouldDance(visitor: Visitor): boolean {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const onDanceFloor = Boolean(
      visitor.concertId ||
        this.getStageForecourtCellAt(visitor.cellX, visitor.cellZ),
    )
    if (onDanceFloor) {
      if (visitor.concertId) {
        return visitor.partyPreference >= atmosphere.danceFloorPreferenceThreshold
      }
      return (
        visitor.localPartyMood >= atmosphere.danceFloorMoodThreshold &&
        visitor.partyPreference >= atmosphere.danceFloorPreferenceThreshold
      )
    }
    return (
      visitor.localPartyMood >= atmosphere.danceMoodThreshold &&
      visitor.partyPreference >= atmosphere.dancePreferenceThreshold
    )
  }

  private stageFocusPoint(stage: {
    x: number
    z: number
    rotation: number
    stageDesign?: StageDesign
  }): { x: number; z: number } {
    const size = stageSize(stage.stageDesign, stage.rotation)
    return {
      x: stage.x + (size.width - 1) / 2,
      z: stage.z + (size.depth - 1) / 2,
    }
  }

  private visitorDanceAngle(visitor: Visitor, stageId: string): number {
    return ((((hashStringSeed(visitor.id) ^ hashStringSeed(stageId)) >>> 8) & 1023) / 1024) * Math.PI * 2
  }

  private angularDelta(
    cell: { x: number; z: number },
    focus: { x: number; z: number },
    want: number,
  ): number {
    const angle = Math.atan2(cell.z - focus.z, cell.x - focus.x)
    return Math.abs(Math.atan2(Math.sin(angle - want), Math.cos(angle - want)))
  }

  private ensureDanceFloorIndex(): void {
    if (this.concertSlotTick === this.state.simTick) return
    this.concertSlotTick = this.state.simTick
    this.concertSlots.clear()
    this.concertForecourtByStage.clear()
    this.concertForecourtStageIds.clear()
    this.danceFloorFocusByStage.clear()
    for (const guest of this.state.visitors) {
      if (!guest.activityTarget || !['partying', 'relaxing'].includes(guest.state)) continue
      const key = this.packCell(guest.activityTarget)
      const slots = this.concertSlots.get(key) ?? new Set<number>()
      slots.add(guest.activitySlot)
      this.concertSlots.set(key, slots)
    }
    const stages = this.state.buildings.filter((building) => building.kind === 'stage')
    for (const stage of stages) {
      this.danceFloorFocusByStage.set(stage.id, this.stageFocusPoint(stage))
    }
    for (const cell of this.state.stageForecourtCells) {
      let nearest: { id: string; distance: number } | undefined
      for (const stage of stages) {
        const linked = cell.stageId
          ? cell.stageId === stage.id
          : stageDistance(stage, cell) <= 8
        if (!linked) continue
        const list = this.concertForecourtByStage.get(stage.id)
        if (list) list.push(cell)
        else this.concertForecourtByStage.set(stage.id, [cell])
        const distance = stageDistance(stage, cell)
        if (!nearest || distance < nearest.distance) nearest = { id: stage.id, distance }
      }
      if (nearest) this.concertForecourtStageIds.set(this.packCell(cell), nearest.id)
    }
  }

  private tryVisitConcert(visitor: Visitor): boolean {
    if (!this.state.festival.enabled) return false
    this.ensureDanceFloorIndex()
    visitor.musicTaste??=musicTaste(visitor.id,this.state.festival)
    const shows = this.availableConcerts()
      .filter(show=>musicAppeal(visitor.musicTaste!,show.band.id)>=.3)
      .sort((a,b)=> (musicAppeal(visitor.musicTaste!,b.band.id)*120+b.band.draw*.25-stageDistance(b.stage,visitor)*.5)-(musicAppeal(visitor.musicTaste!,a.band.id)*120+a.band.draw*.25-stageDistance(a.stage,visitor)*.5))
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const capacity = atmosphere.forecourtCapacityPerCell
    const slotOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7]
    for (const show of shows.slice(0, 2)) {
      if (visitor.audience === 'family' && this.state.minute >= 21 * 60) continue
      const cells = this.concertForecourtByStage.get(show.stage.id) ?? []
      const open = cells.filter((cell) => (this.concertSlots.get(this.packCell(cell))?.size ?? 0) < capacity)
      if (!open.length) continue
      const focus = this.danceFloorFocusByStage.get(show.stage.id) ?? this.stageFocusPoint(show.stage)
      const want = this.visitorDanceAngle(visitor, show.stage.id)
      const goals = open
        .map((cell) => {
          const used = this.concertSlots.get(this.packCell(cell))?.size ?? 0
          const distance =
            Math.abs(cell.x - visitor.cellX) + Math.abs(cell.z - visitor.cellZ)
          return {
            cell,
            score: used * 24 + distance + this.angularDelta(cell, focus, want) * 0.4,
          }
        })
        .sort((left, right) => left.score - right.score)
        .slice(0, atmosphere.concertSpreadGoals)
        .map((entry) => entry.cell)
      const route = this.findPath(
        { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
        goals,
        true,
        true,
        false,
        false,
        true,
      )
      if (!route) continue
      const end = route.at(-1) ?? goals[0]!
      const cell =
        goals.find(
          (goal) =>
            goal.x === end.x &&
            goal.z === end.z &&
            Math.abs(goal.elevation - end.elevation) < 0.01,
        ) ?? goals[0]!
      const key = this.packCell(cell)
      const used = this.concertSlots.get(key) ?? new Set<number>()
      const slot = slotOrder.find((n) => !used.has(n))
      if (slot === undefined) continue
      used.add(slot)
      this.concertSlots.set(key, used)
      this.beginPartyVisit(visitor, { cell, route, slot, capacity, forecourt: true })
      visitor.concertId = show.booking.id
      visitor.interactionRemaining = show.booking.start + show.booking.duration - this.state.minute
      visitor.thought = this.state.minute < show.booking.start
        ? `Ich gehe schon zu ${show.band.name}, damit ich den Anfang nicht verpasse.`
        : `Ich möchte ${show.band.name} sehen!`
      return true
    }
    return false
  }

  private updateConcertAttendance(
    visitor: Visitor,
    minutes: number,
    concert: { booking: Booking; band: (typeof BANDS)[number] },
    consumed: boolean,
  ): void {
    visitor.interactionRemaining = Math.max(
      visitor.interactionRemaining,
      concert.booking.start + concert.booking.duration - this.state.minute,
    )
    if (this.state.minute < concert.booking.start) {
      visitor.toplessMinutes = 0
      if (!consumed) visitor.thought = `Ich warte auf ${concert.band.name}.`
      return
    }
    visitor.motivation = Math.min(
      100,
      visitor.motivation +
        minutes *
          SIMULATION_CONFIG.atmosphere.concertMotivationPerMinute *
          this.showQualityForStage(concert.booking.stageId),
    )
    this.updateConcertTopless(visitor, minutes, concert)
    if (visitor.toplessMinutes > 0) return
    if (visitor.thought === CONCERT_TOPLESS_CROWD_THOUGHT) return
    if (!consumed) {
      visitor.thought = visitor.isDancing
        ? `${concert.band.name} spielen – ich tanze die ganze Show!`
        : `${concert.band.name} spielen live – ich bleibe bis zum Ende.`
    }
  }

  private updateConcertTopless(
    visitor: Visitor,
    minutes: number,
    concert: { booking: Booking },
  ): void {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const remaining = concert.booking.start + concert.booking.duration - this.state.minute
    if (visitor.streakingMinutes > 0 || remaining <= 0) {
      visitor.toplessMinutes = 0
      return
    }
    if (visitor.toplessMinutes > 0) {
      visitor.toplessMinutes = remaining
      visitor.needs.fun = Math.min(
        100,
        visitor.needs.fun + minutes * atmosphere.concertToplessSelfFun,
      )
      visitor.thought = CONCERT_TOPLESS_THOUGHT
      this.spreadConcertToplessFun(visitor, minutes)
      return
    }
    if (visitor.audience === 'family' || this.concertToplessVisitorId !== null) return
    if (this.rng.next() >= Math.min(1, minutes * atmosphere.concertToplessChancePerMinute / Math.max(1, this.state.visitors.length))) return
    this.concertToplessVisitorId = visitor.id
    visitor.toplessMinutes = remaining
    visitor.needs.fun = Math.min(
      100,
      visitor.needs.fun + minutes * atmosphere.concertToplessSelfFun,
    )
    visitor.emotion = 'excited'
    visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 12)
    visitor.thought = CONCERT_TOPLESS_THOUGHT
    this.spreadConcertToplessFun(visitor, minutes)
  }

  private spreadConcertToplessFun(source: Visitor, minutes: number): void {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const radius = atmosphere.concertToplessRadius
    this.state.visitors.forEach((other) => {
      if (other.id === source.id) return
      if (
        other.state === 'sleeping' ||
        other.state === 'riding' ||
        other.state === 'medical' ||
        other.state === 'injured' ||
        other.state === 'vehicle-arrival' ||
        other.state === 'bus-riding'
      ) {
        return
      }
      const distance =
        Math.abs(other.cellX - source.cellX) +
        Math.abs(other.cellZ - source.cellZ)
      if (distance > radius) return
      other.needs.fun = Math.min(
        100,
        other.needs.fun + minutes * atmosphere.concertToplessNearbyFun,
      )
      if (other.emotion !== 'angry' && other.emotion !== 'sad') {
        other.emotion = distance <= 1 ? 'excited' : 'happy'
        other.emotionMinutes = Math.max(other.emotionMinutes, 8)
      }
      if ((other.toplessMinutes ?? 0) <= 0 && other.state !== 'leaving' && other.state !== 'panicking') {
        other.thought = CONCERT_TOPLESS_CROWD_THOUGHT
      }
    })
  }

  private giveWaste(visitor: Visitor, amount: number): void {
    if (amount <= 0) return
    visitor.pendingWaste = (visitor.pendingWaste ?? 0) + amount
    this.tryDisposeWaste(visitor)
  }

  private listVisitorWasteBins(): WasteBinInfo[] {
    if (this.visitorWasteBinTick !== this.state.simTick) {
      this.visitorWasteBinTick = this.state.simTick
      this.visitorWasteBinBuildings = this.state.buildings.filter(
        (building) => isWasteBin(building.kind),
      )
    }
    return this.visitorWasteBinBuildings.map((building) => ({
      id: building.id,
      x: building.x,
      z: building.z,
      elevation: building.elevation,
      stored: building.wasteFill ?? 0,
    }))
  }

  private discardWasteIfCannotUseBin(visitor: Visitor): boolean {
    if ((visitor.pendingWaste ?? 0) <= 0) return false
    if (
      visitor.state === 'vehicle-arrival' ||
      visitor.state === 'bus-riding' ||
      visitor.state === 'riding' ||
      visitor.state === 'medical' ||
      visitor.state === 'medical-transport' ||
      collectSeatedPassengerIds(this.state.logistics.roadVehicles).has(
        visitor.id,
      )
    ) {
      return false
    }
    const config = SIMULATION_CONFIG.waste
    const from = { x: visitor.cellX, z: visitor.cellZ }
    const bins = this.listVisitorWasteBins()
    const nearest = findNearestWasteBinInRange(from, bins, config.binRange)
    const target = visitor.targetId
      ? bins.find((bin) => bin.id === visitor.targetId)
      : undefined
    const nearestFull =
      Boolean(nearest) && !wasteBinHasRoom(nearest!, config.binCapacity)
    const targetFull =
      Boolean(target) && !wasteBinHasRoom(target!, config.binCapacity)
    if (!nearest || (config.visitorDropIfBinFull && (nearestFull || targetFull))) {
      this.dropPendingWaste(visitor)
      return true
    }
    return false
  }

  private tryDisposeWaste(visitor: Visitor): void {
    if (this.discardWasteIfCannotUseBin(visitor)) return
    if ((visitor.pendingWaste ?? 0) <= 0) return
    const config = SIMULATION_CONFIG.waste
    const from = { x: visitor.cellX, z: visitor.cellZ }
    const bin = findNearestWasteBin(
      from,
      this.listVisitorWasteBins(),
      config.binRange,
      config.binCapacity,
    )
    if (!bin) {
      this.dropPendingWaste(visitor)
      return
    }
    const distance = wasteBinManhattan(from, bin)
    if (distance <= 1) {
      this.depositPendingWaste(visitor, bin.id)
      return
    }
    if (
      visitor.targetId === bin.id &&
      visitor.state === 'seeking' &&
      visitor.route.length > 0
    ) {
      return
    }
    this.runVisitorRouting(visitor, 'waste', () =>
      this.routeVisitorToWasteBin(visitor, bin),
    )
  }

  private routeVisitorToWasteBin(visitor: Visitor, bin: { id: string; x: number; z: number; elevation: number }): void {
    const route = this.findPath(
      {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      },
      [{ x: bin.x, z: bin.z, elevation: bin.elevation }],
      false,
      true,
      true,
    )
    if (!route) {
      this.dropPendingWaste(visitor)
      return
    }
    this.clearVisitorActivity(visitor)
    visitor.targetId = bin.id
    visitor.state = 'seeking'
    visitor.route = route
    visitor.thought = 'Ich gehe zum Mülleimer.'
  }

  private depositPendingWaste(visitor: Visitor, binId: string): void {
    const bin = this.state.buildings.find(
      (building) => building.id === binId && isWasteBin(building.kind),
    )
    if (!bin) {
      this.dropPendingWaste(visitor)
      return
    }
    const room = Math.max(
      0,
      SIMULATION_CONFIG.waste.binCapacity - (bin.wasteFill ?? 0),
    )
    const stored = Math.min(visitor.pendingWaste, room)
    bin.wasteFill = (bin.wasteFill ?? 0) + stored
    visitor.pendingWaste -= stored
    visitor.thought =
      stored > 0
        ? 'Ich werfe den Müll in den Eimer.'
        : 'Der Mülleimer ist voll.'
    if (visitor.pendingWaste > 0) this.dropPendingWaste(visitor)
  }

  private dropPendingWaste(visitor: Visitor): void {
    if (visitor.pendingWaste <= 0) return
    this.addGroundIncident(
      'litter',
      this.findLitterDropCell(visitor),
      visitor.pendingWaste,
    )
    visitor.pendingWaste = 0
    if (
      visitor.targetId &&
      this.listVisitorWasteBins().some((bin) => bin.id === visitor.targetId)
    ) {
      visitor.targetId = null
      if (visitor.state === 'seeking') {
        visitor.state = 'exploring'
        visitor.route = []
      }
    }
    visitor.thought = 'Hier liegt jetzt mein Müll. Ein Eimer wäre besser gewesen.'
  }

  private findLitterDropCell(visitor: Visitor): {
    x: number
    z: number
    elevation: number
  } {
    const here = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    if (this.canDropLitterAt(here)) return here
    const neighbor = this.getPedestrianNeighbors(here, {
      allowCamping: Boolean(this.getCampingCellAt(here.x, here.z)),
      allowMedical: Boolean(this.getMedicalCellAt(here.x, here.z)),
      allowFestival: Boolean(this.getStageForecourtCellAt(here.x, here.z)),
      allowQueue:
        this.getPathAt(here.x, here.z, here.elevation)?.pathType === 'queue',
    })[0]
    return neighbor ?? here
  }

  private canDropLitterAt(cell: {
    x: number
    z: number
    elevation: number
  }): boolean {
    return Boolean(
      this.getPathAt(cell.x, cell.z, cell.elevation) ||
        this.getCampingCellAt(cell.x, cell.z) ||
        this.getStageForecourtCellAt(cell.x, cell.z) ||
        this.getMedicalCellAt(cell.x, cell.z),
    )
  }

  private beginStationaryBreak(visitor: Visitor, thought: string): void {
    visitor.state = 'relaxing'
    visitor.targetId = null
    visitor.route = []
    visitor.activityTarget = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    visitor.activityCapacity =
      SIMULATION_CONFIG.atmosphere.leisureCapacityPerPathCell
    visitor.activitySlot = this.getFreeActivitySlot(
      visitor.activityTarget,
      visitor.activityCapacity,
      visitor.id,
    )
    this.adjustVisitorOccupancy(visitor, 1)
    visitor.interactionRemaining =
      SIMULATION_CONFIG.atmosphere.leisureDurationMinimum
    visitor.consumptionCooldown = 0
    visitor.thought = thought
  }

  private consumeWhileStationary(
    visitor: Visitor,
    minutes: number,
  ): boolean {
    visitor.consumptionCooldown = Math.max(
      0,
      visitor.consumptionCooldown - minutes,
    )
    if (visitor.consumptionCooldown > 0) return false
    const config = SIMULATION_CONFIG.needs.stationaryConsumption
    if (
      visitor.needs.hunger < config.foodConsumeBelow &&
      consumeItem(visitor.inventory, 'food')
    ) {
      visitor.needs.hunger = Math.min(
        100,
        visitor.needs.hunger + config.foodGain,
      )
      visitor.needs.toilet = Math.max(
        0,
        visitor.needs.toilet - config.foodToiletCost,
      )
      visitor.consumptionCooldown =
        config.cooldownMinimumMinutes +
        this.rng.next() * config.cooldownRandomMinutes
      visitor.thought = 'Ich bleibe stehen und esse mein gekauftes Essen.'
      this.giveWaste(visitor, 1)
      return true
    }
    if (
      visitor.alcoholDesire >= config.drinkDesireAbove &&
      visitor.alcoholLevel < config.maximumAlcohol &&
      consumeItem(visitor.inventory, 'alcohol')
    ) {
      visitor.alcoholLevel = Math.min(
        100,
        visitor.alcoholLevel + config.alcoholGain,
      )
      visitor.alcoholDesire = 0
      visitor.needs.fun = Math.min(
        100,
        visitor.needs.fun + config.drinkFunGain,
      )
      visitor.needs.energy = Math.max(
        0,
        visitor.needs.energy - config.drinkEnergyCost,
      )
      visitor.needs.toilet = Math.max(
        0,
        visitor.needs.toilet - config.drinkToiletCost,
      )
      this.incidents.addDrinkNausea(visitor)
      visitor.consumptionCooldown =
        config.cooldownMinimumMinutes +
        this.rng.next() * config.cooldownRandomMinutes
      visitor.thought = 'Ich bleibe hier und trinke mein Getränk.'
      this.giveWaste(visitor, 1)
      return true
    }
    return false
  }

  private createPreferredSleepRhythm(): {
    preferredBedtime: number
    preferredWakeTime: number
  } {
    const rhythm = sampleFestivalSleepRhythm(
      this.rng.next(),
      this.rng.next(),
      SIMULATION_CONFIG.camping.sleepSchedule,
      SIMULATION_CONFIG.time.minutesPerDay,
    )
    return {
      preferredBedtime: rhythm.bedtime,
      preferredWakeTime: rhythm.wakeTime,
    }
  }

  private restoreVisitorSleepRhythm(visitor: Visitor): void {
    const schedule = SIMULATION_CONFIG.camping.sleepSchedule
    const minutesPerDay = SIMULATION_CONFIG.time.minutesPerDay
    if (
      visitor.preferredBedtime == null ||
      visitor.preferredWakeTime == null
    ) {
      const rhythm = sleepRhythmFromVisitorId(
        visitor.id,
        schedule,
        minutesPerDay,
      )
      visitor.preferredBedtime = rhythm.bedtime
      visitor.preferredWakeTime = rhythm.wakeTime
      return
    }
    const remapped = remapLegacySleepRhythm(
      visitor,
      schedule,
      minutesPerDay,
    )
    visitor.preferredBedtime = remapped.bedtime
    visitor.preferredWakeTime = remapped.wakeTime
  }

  private samplePoisson(expected: number): number {
    if (expected <= 0) return 0
    const limit = Math.exp(-expected)
    let product = 1
    let count = 0
    do {
      count += 1
      product *= this.rng.next()
    } while (product > limit)
    return count - 1
  }

  private isVisitorSleepTime(visitor: Visitor): boolean {
    return isMinuteInSleepWindow(
      this.state.minute,
      visitor.preferredBedtime,
      visitor.preferredWakeTime,
    )
  }

  private getBuildingDayPlanOffer(
    kind: BuildingKind,
  ): DayPlanOffer | null {
    if (kind === 'food') return 'food'
    if (kind === 'alcohol') return 'drinks'
    if (kind === 'toilet') return 'toilets'
    if (kind === 'mascot' || kind === 'shirt') return 'shops'
    if (kind === 'ride') return 'rides'
    if (
      kind === 'stage' ||
      kind === 'directionalSpeaker' ||
      kind === 'omniSpeaker' ||
      kind === 'delayTower' ||
      kind === 'videoWall' ||
      kind === 'laserShow' ||
      kind === 'fireworkBattery' ||
      kind === 'foh'
    ) {
      return 'stages'
    }
    if (kind === 'lighting' || kind === 'lightBalloon') return 'lights'
    return null
  }

  private adjustVisitorOccupancy(visitor: Visitor, delta: -1 | 1): void {
    if (this.occupancyTick !== this.state.simTick) return
    if (
      (visitor.state === 'relaxing' || visitor.state === 'partying') &&
      visitor.activityTarget
    ) {
      const key = this.cellKey(
        visitor.activityTarget.x,
        visitor.activityTarget.z,
        visitor.activityTarget.elevation,
      )
      const next = Math.max(0, (this.activityHeadcount.get(key) ?? 0) + delta)
      if (next) this.activityHeadcount.set(key, next)
      else this.activityHeadcount.delete(key)
      if (delta > 0) {
        this.activitySlotBits.set(
          key,
          (this.activitySlotBits.get(key) ?? 0) | (1 << (visitor.activitySlot & 31)),
        )
      } else {
        this.activitySlotBits.set(
          key,
          (this.activitySlotBits.get(key) ?? 0) & ~(1 << (visitor.activitySlot & 31)),
        )
      }
    } else if (visitor.state === 'bench-resting' && visitor.targetId) {
      const next = Math.max(0, (this.benchHeadcount.get(visitor.targetId) ?? 0) + delta)
      if (next) this.benchHeadcount.set(visitor.targetId, next)
      else this.benchHeadcount.delete(visitor.targetId)
      if (delta > 0) {
        this.benchSlotBits.set(
          visitor.targetId,
          (this.benchSlotBits.get(visitor.targetId) ?? 0) |
            (1 << (visitor.activitySlot & 31)),
        )
      } else {
        this.benchSlotBits.set(
          visitor.targetId,
          (this.benchSlotBits.get(visitor.targetId) ?? 0) &
            ~(1 << (visitor.activitySlot & 31)),
        )
      }
    }
  }

  private ensureVisitorOccupancy(): void {
    if (this.occupancyTick === this.state.simTick) return
    this.occupancyTick = this.state.simTick
    this.activityHeadcount.clear()
    this.activitySlotBits.clear()
    this.benchHeadcount.clear()
    this.benchSlotBits.clear()
    for (const visitor of this.state.visitors) {
      if (
        (visitor.state === 'relaxing' || visitor.state === 'partying') &&
        visitor.activityTarget
      ) {
        const key = this.cellKey(
          visitor.activityTarget.x,
          visitor.activityTarget.z,
          visitor.activityTarget.elevation,
        )
        this.activityHeadcount.set(key, (this.activityHeadcount.get(key) ?? 0) + 1)
        this.activitySlotBits.set(
          key,
          (this.activitySlotBits.get(key) ?? 0) | (1 << (visitor.activitySlot & 31)),
        )
      } else if (visitor.state === 'bench-resting' && visitor.targetId) {
        this.benchHeadcount.set(
          visitor.targetId,
          (this.benchHeadcount.get(visitor.targetId) ?? 0) + 1,
        )
        this.benchSlotBits.set(
          visitor.targetId,
          (this.benchSlotBits.get(visitor.targetId) ?? 0) | (1 << (visitor.activitySlot & 31)),
        )
      }
    }
  }

  private activityOccupantsAt(cell: Cell, excluded: Visitor): number {
    this.ensureVisitorOccupancy()
    let count =
      this.activityHeadcount.get(this.cellKey(cell.x, cell.z, cell.elevation)) ?? 0
    if (
      (excluded.state === 'relaxing' || excluded.state === 'partying') &&
      excluded.activityTarget?.x === cell.x &&
      excluded.activityTarget.z === cell.z &&
      excluded.activityTarget.elevation === cell.elevation
    ) {
      count -= 1
    }
    return count
  }

  private getFreeActivitySlot(
    cell: Cell,
    capacity: number,
    excludedVisitorId: string,
  ): number {
    this.ensureVisitorOccupancy()
    const key = this.cellKey(cell.x, cell.z, cell.elevation)
    let used = this.activitySlotBits.get(key) ?? 0
    const excluded = this.getVisitor(excludedVisitorId)
    if (
      excluded &&
      (excluded.state === 'relaxing' || excluded.state === 'partying') &&
      excluded.activityTarget?.x === cell.x &&
      excluded.activityTarget.z === cell.z &&
      excluded.activityTarget.elevation === cell.elevation
    ) {
      used &= ~(1 << (excluded.activitySlot & 31))
    }
    const order = [4, 0, 2, 6, 8, 1, 3, 5, 7].slice(0, capacity)
    return order.find((slot) => (used & (1 << slot)) === 0) ?? 4
  }

  private findLeisureDestination(visitor: Visitor): {
    cell: Cell
    route: Cell[]
    slot: number
    capacity: number
    beauty: number
    party: number
  } | null {
    const config = SIMULATION_CONFIG.atmosphere
    const candidates = new Map<string, Cell>()
    ;[...this.state.attractiveness.cells, ...this.state.partyMood.cells].forEach(
      (cell) => {
        if (
          !this.getPathAt(cell.x, cell.z, cell.elevation) ||
          (this.attractivenessValues.get(
            this.cellKey(cell.x, cell.z, cell.elevation),
          ) ?? 0) < config.leisureMinimumFieldValue &&
            (this.partyMoodValues.get(
              this.cellKey(cell.x, cell.z, cell.elevation),
            ) ?? 0) < config.leisureMinimumFieldValue
        ) {
          return
        }
        candidates.set(
          this.cellKey(cell.x, cell.z, cell.elevation),
          { x: cell.x, z: cell.z, elevation: cell.elevation },
        )
      },
    )
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const scored = [...candidates.values()]
      .filter(cell=>!this.avoidsConcertAt(visitor,cell))
      .map((cell) => {
        const cellKey = this.cellKey(cell.x, cell.z, cell.elevation)
        const beauty = this.attractivenessValues.get(cellKey) ?? 0
        const party = this.partyMoodValues.get(cellKey) ?? 0
        const occupantCount = this.activityOccupantsAt(cell, visitor)
        if (occupantCount >= config.leisureCapacityPerPathCell) return null
        const distance =
          Math.abs(cell.x - visitor.cellX) +
          Math.abs(cell.z - visitor.cellZ)
        return {
          cell,
          beauty,
          party,
          occupants: occupantCount,
          score:
            beauty * visitor.beautyPreference +
            party * visitor.partyPreference -
            occupantCount * config.occupancyScorePenalty -
            distance * config.leisureDecisionDistancePenalty -
            (this.crowdingCosts.get(cellKey) ?? 0) *
              config.crowdingScorePenalty,
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxScoredPathChecks)
    for (const candidate of scored) {
      const route = this.findPath(start, [candidate.cell])
      if (!route) continue
      return {
        cell: candidate.cell,
        route,
        slot: this.getFreeActivitySlot(
          candidate.cell,
          config.leisureCapacityPerPathCell,
          visitor.id,
        ),
        capacity: config.leisureCapacityPerPathCell,
        beauty: candidate.beauty,
        party: candidate.party,
      }
    }
    return null
  }

  private enforceDayPlan(): void {
    const festivalPhase = getFestivalCycleStatus(
      this.state.dayPlan,
      this.state.day,
    )
    const dayVisitorsAllowed =
      festivalPhase.phase === 'festival' &&
      isDayVisitorAdmissionOpen(this.state.dayPlan, this.state.minute)
    const ridesActive = this.isOfferCurrentlyActive('rides')
    const stagesActive = this.isOfferCurrentlyActive('stages')
    const seated = collectSeatedPassengerIds(this.state.logistics.roadVehicles)
    this.state.visitors.forEach((visitor) => {
      if (this.isVisitorSeatedInVehicle(visitor, seated)) return
      if (
        festivalPhase.phase === 'break' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'riding' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.campingPhase !== 'packing'
      ) {
        this.beginVisitorDeparture(visitor)
        visitor.thought =
          'Das Festival ist vorbei. Jetzt beginnt die Veranstaltungspause.'
        return
      }
      if (
        visitor.ticketType === 'day' &&
        !dayVisitorsAllowed &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'riding' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.campingPhase !== 'packing'
      ) {
        this.beginVisitorDeparture(visitor)
        visitor.thought =
          'Die Besuchszeit für Tagesgäste ist vorbei. Ich gehe nach Hause.'
        return
      }
      if (visitor.state === 'queuing' && !ridesActive) {
        const target = visitor.targetId
          ? this.state.buildings.find((building) => building.id === visitor.targetId)
          : undefined
        if (target?.kind === 'ride' || (visitor.targetId && this.getCoaster(visitor.targetId))) {
          this.leaveQueueOnFoot(visitor, 'Die Fahrgeschäfte schließen für heute.')
        }
        return
      }
      if (
        visitor.state === 'partying' &&
        !stagesActive &&
        visitor.activityTarget &&
        this.getStageForecourtCellAt(
          visitor.activityTarget.x,
          visitor.activityTarget.z,
        )
      ) {
        this.clearVisitorActivity(visitor)
        visitor.state = 'exploring'
        visitor.thought = 'Das Bühnenprogramm ist für heute beendet.'
        this.decideNextAction(visitor)
        return
      }
      if (visitor.state !== 'seeking' || !visitor.targetId) return
      const targetBuilding = this.state.buildings.find(
        (building) => building.id === visitor.targetId,
      )
      const targetCoaster = this.getCoaster(visitor.targetId)
      const targetActive = targetBuilding
        ? this.isBuildingCurrentlyActive(targetBuilding)
        : targetCoaster
          ? ridesActive
          : true
      if (targetActive) return
      this.removeVisitorFromCoasterQueues(visitor.id)
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.route = []
      visitor.thought = 'Dieses Angebot ist gerade geschlossen.'
      this.decideNextAction(visitor)
    })
  }

  private findBenchDestination(visitor: Visitor): {
    building: PlacedBuilding
    route: Cell[]
    slot: number
  } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.state.buildings
      .filter((building) => building.kind === 'bench')
      .map((building) => {
        this.ensureVisitorOccupancy()
        let occupantCount = this.benchHeadcount.get(building.id) ?? 0
        let usedBits = this.benchSlotBits.get(building.id) ?? 0
        if (visitor.state === 'bench-resting' && visitor.targetId === building.id) {
          occupantCount -= 1
          usedBits &= ~(1 << (visitor.activitySlot & 31))
        }
        if (occupantCount >= SIMULATION_CONFIG.atmosphere.benchCapacity) {
          return null
        }
        const slot =
          Array.from(
            { length: SIMULATION_CONFIG.atmosphere.benchCapacity },
            (_, index) => index,
          ).find((index) => (usedBits & (1 << index)) === 0) ?? 0
        return {
          building,
          slot,
          access: {
            x: building.x,
            z: building.z,
            elevation: building.elevation,
          },
          distance:
            Math.abs(building.x - start.x) + Math.abs(building.z - start.z),
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.findPath(
      start,
      candidates.map((candidate) => candidate.access),
    )
    if (!route) return null
    const end = route.at(-1) ?? start
    const match =
      candidates.find(
        (candidate) =>
          candidate.access.x === end.x &&
          candidate.access.z === end.z &&
          Math.abs(candidate.access.elevation - end.elevation) < 0.01,
      ) ?? candidates[0]
    return match
      ? { building: match.building, route, slot: match.slot }
      : null
  }

  private findPartyDestination(visitor: Visitor): {
    cell: Cell
    route: Cell[]
    slot: number
    capacity: number
    forecourt: boolean
  } | null {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = [
      ...this.state.stageForecourtCells
        .filter(
          (cell) =>
            this.isOfferCurrentlyActive('stages') &&
            (this.partyMoodValues.get(
              this.cellKey(cell.x, cell.z, cell.elevation),
            ) ?? 0) >= atmosphere.partyDestinationMinimumMood,
        )
        .map((cell) => ({
          cell,
          capacity: atmosphere.forecourtCapacityPerCell,
          forecourt: true,
        })),
      ...this.state.partyMood.cells
        .filter(
          (cell) =>
            cell.value >= atmosphere.partyDestinationMinimumMood &&
            Boolean(this.getPathAt(cell.x, cell.z, cell.elevation)),
        )
        .map((cell) => ({
          cell,
          capacity: atmosphere.hotspotCapacity,
          forecourt: false,
        })),
    ]
    this.ensureDanceFloorIndex()
    const danceAngleByStage = new Map<string, number>()
    const scored = candidates
      .filter(candidate=>!this.avoidsConcertAt(visitor,candidate.cell))
      .map((candidate) => {
        const occupantCount = this.activityOccupantsAt(candidate.cell, visitor)
        if (occupantCount >= candidate.capacity) return null
        const cellKey = this.cellKey(
          candidate.cell.x,
          candidate.cell.z,
          candidate.cell.elevation,
        )
        const beauty = this.attractivenessValues.get(cellKey) ?? 0
        const party = this.partyMoodValues.get(cellKey) ?? 0
        const distance =
          Math.abs(candidate.cell.x - visitor.cellX) +
          Math.abs(candidate.cell.z - visitor.cellZ)
        const crowding = this.crowdingCosts.get(cellKey) ?? 0
        const stageId = candidate.forecourt
          ? this.concertForecourtStageIds.get(this.packCell(candidate.cell))
          : undefined
        const focus = stageId ? this.danceFloorFocusByStage.get(stageId) : undefined
        let angle = 0
        if (stageId && focus) {
          let want = danceAngleByStage.get(stageId)
          if (want === undefined) {
            want = this.visitorDanceAngle(visitor, stageId)
            danceAngleByStage.set(stageId, want)
          }
          angle = this.angularDelta(candidate.cell, focus, want)
        }
        return {
          ...candidate,
          occupantCount,
          score:
            beauty * visitor.beautyPreference +
            party * visitor.partyPreference -
            occupantCount * atmosphere.occupancyScorePenalty -
            distance * atmosphere.distanceScorePenalty -
            crowding * atmosphere.crowdingScorePenalty -
            angle * atmosphere.danceFloorAnglePenalty +
            (candidate.forecourt ? atmosphere.forecourtScoreBonus : 0),
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxScoredPathChecks)
    for (const candidate of scored) {
      const route = this.findPath(
        start,
        [candidate.cell],
        true,
        false,
        false,
        false,
        candidate.forecourt,
      )
      if (!route) continue
      const slot = this.getFreeActivitySlot(
        candidate.cell,
        candidate.capacity,
        visitor.id,
      )
      return {
        cell: { ...candidate.cell },
        route,
        slot,
        capacity: candidate.capacity,
        forecourt: candidate.forecourt,
      }
    }
    return null
  }

  private clearVisitorActivity(visitor: Visitor): void {
    this.adjustVisitorOccupancy(visitor, -1)
    visitor.concertId = null
    visitor.activityTarget = null
    visitor.activitySlot = 0
    visitor.activityCapacity = 1
    visitor.isDancing = false
    visitor.toplessMinutes = 0
    visitor.bungeeNude = false
    if (visitor.state === 'bench-resting') visitor.targetId = null
  }

  private findReachableFacility(
    visitor: Visitor,
    kind: BuildingKind,
  ): { building: PlacedBuilding; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.state.buildings
      .filter(
        (building) =>
          building.kind === kind && this.isBuildingCurrentlyActive(building) &&
          (!isShopServiceKind(kind) || localStock(this.state, building.id, shopSupplyKind(kind) ?? 'goods') >= 1),
      )
      .map((building) => {
        const queueCells = this.getBuildingQueueCells(building)
        const accessCells =
          building.kind === 'ride' && queueCells[0]
            ? [queueCells[0]]
            : this.getFacilityAccessCells(building)
        const queueLength =
          queueCells.length > 0 ? this.getFacilityQueue(building.id).length : 0
        const goals =
          queueCells.length > 0
            ? [
                queueCells[
                  Math.min(
                    queueCells.length - 1,
                    Math.floor(
                      queueLength / SIMULATION_CONFIG.coasters.queueSlotsPerCell,
                    ),
                  )
                ]!,
              ]
            : accessCells
        const distance = goals.reduce((minimum, goal) => {
          const next = Math.abs(goal.x - start.x) + Math.abs(goal.z - start.z)
          return next < minimum ? next : minimum
        }, Number.POSITIVE_INFINITY)
        return {
          building,
          goals,
          queueCells,
          queueLength,
          distance,
        }
      })
      .filter(
        (candidate) =>
          candidate.goals.some((goal) => this.isWalkableServiceCell(goal)) &&
          (candidate.queueCells.length === 0 ||
            candidate.queueLength <
              candidate.queueCells.length *
                SIMULATION_CONFIG.coasters.queueSlotsPerCell),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.findPath(
      start,
      candidates.flatMap((candidate) => candidate.goals),
      true,
    )
    if (!route) return null
    const end = route.at(-1) ?? start
    const match =
      candidates.find((candidate) =>
        candidate.goals.some(
          (goal) =>
            goal.x === end.x &&
            goal.z === end.z &&
            Math.abs(goal.elevation - end.elevation) < 0.01,
        ),
      ) ?? candidates[0]
    return match ? { building: match.building, route } : null
  }

  private findReachableCoaster(
    visitor: Visitor,
  ): { coaster: Coaster; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.state.coasters
      .filter(
        (coaster) =>
          coaster.closed &&
          this.isOfferCurrentlyActive('rides') &&
          coaster.operationMode === 'open' &&
          coaster.entrance &&
          coaster.exit &&
          coaster.id !== visitor.avoidedCoasterId &&
          this.getCoasterQueueCapacity(coaster.id) > coaster.queue.length &&
          this.getAccessPathNeighbors(coaster.exit).some(
            (cell) =>
              this.getPathAt(cell.x, cell.z, cell.elevation)?.pathType !== 'queue',
          ),
      )
      .map((coaster) => {
        const queueEntrance = this.getCoasterQueueCells(coaster).at(-1)
        return queueEntrance
          ? {
              coaster,
              queueEntrance,
              distance:
                Math.abs(queueEntrance.x - start.x) +
                Math.abs(queueEntrance.z - start.z),
            }
          : null
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.findPath(
      start,
      candidates.map((candidate) => candidate.queueEntrance),
      true,
    )
    if (!route) return null
    const end = route.at(-1) ?? start
    const match =
      candidates.find(
        (candidate) =>
          candidate.queueEntrance.x === end.x &&
          candidate.queueEntrance.z === end.z &&
          Math.abs(candidate.queueEntrance.elevation - end.elevation) < 0.01,
      ) ?? candidates[0]
    return match ? { coaster: match.coaster, route } : null
  }

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
    if (goals.length === 0) return null
    this.ensurePedestrianNav(this.lastNavRevision !== this.worldRevision)
    const startOnCamping = Boolean(this.getCampingCellAt(start.x, start.z))
    const startOnMedical = Boolean(this.getMedicalCellAt(start.x, start.z))
    const startOnFestival = Boolean(this.getStageForecourtCellAt(start.x, start.z))
    const startOnBackstageOverlay =
      this.activeBackstagePacked.has(this.packXZ(start.x, start.z)) &&
      !this.getPathAt(start.x, start.z, start.elevation)
    const campingAllowed = allowCamping || startOnCamping
    const medicalAllowed = allowMedical || startOnMedical
    const festivalAllowed = allowFestival || startOnFestival
    const backstageAllowed = allowBackstage || allowStaff || startOnBackstageOverlay
    const cacheKey = this.getPedestrianPathCacheKey(start, goals, {
      allowQueue,
      allowCamping: campingAllowed,
      allowMedical: medicalAllowed,
      allowFestival: festivalAllowed,
      ignoreDirectionalRestrictions,
    })
    const accessCacheKey = `${cacheKey}:${allowStaff ? 'staff' : 'guest'}:${backstageAllowed ? 'back' : 'noback'}`
    const cached = this.pedestrianPathCache.get(accessCacheKey)
    if (cached && cached.expires > this.state.simTick) return this.clonePedestrianPath(cached.path)
    if (cached) this.pedestrianPathCache.delete(accessCacheKey)
    const goalKeys = new Set(goals.map((cell) => this.packCell(cell)))
    // A forbidden destination cannot be reached from any predecessor. Avoid
    // traversing the whole map (twice) to prove this for e.g. staff-only bins.
    // Keep all original goals in the heuristic so valid routes retain tie order.
    const canEnterGoal = (campingAccess: boolean) =>
      goalKeys.has(this.packCell(start)) || goals.some(goal => {
      const node = this.pedestrianNav.get(this.packCell(goal))
      if (!node || (node.flags & NAV_SOLID) !== 0) return false
      if (node.path?.staffOnly && !allowStaff) return false
      if ((node.flags & NAV_WATER) !== 0 && (node.flags & NAV_PATH) === 0) return false
      if (!campingAccess && (node.flags & NAV_CAMPING) !== 0) return false
      if (!medicalAllowed && (node.flags & NAV_MEDICAL) !== 0) return false
      if (!festivalAllowed && (node.flags & NAV_FORECOURT) !== 0 && (node.flags & NAV_PATH) === 0) return false
      if (
        !backstageAllowed &&
        (node.flags & NAV_BACKSTAGE) !== 0 &&
        (node.flags & NAV_PATH) === 0
      ) {
        return false
      }
      return true
    })
    const movementCost = (_from: Cell, to: Cell): number => {
      const key = this.packCell(to)
      const surface = this.pedestrianNav.get(key)?.cost ?? this.getPedestrianSurfaceCost(to)
      return surface * (1 + (this.pedestrianCongestionCosts.get(key) ?? 0)) + Math.min(1, (this.crowdingCostPacked.get(key) ?? 0) / 100) *
        SIMULATION_CONFIG.pathfinding.crowdingCostWeight
    }
    const heuristic =
      goals.length === 1
        ? (cell: Cell) =>
            Math.abs(goals[0]!.x - cell.x) + Math.abs(goals[0]!.z - cell.z)
        : (cell: Cell) => {
            let minimum = Number.POSITIVE_INFINITY
            for (const goal of goals) {
              const distance =
                Math.abs(goal.x - cell.x) + Math.abs(goal.z - cell.z)
              if (distance < minimum) minimum = distance
            }
            return minimum
          }
    let nearestGoal = Number.POSITIVE_INFINITY
    for (const goal of goals) {
      const distance =
        Math.abs(goal.x - start.x) + Math.abs(goal.z - start.z)
      if (distance < nearestGoal) nearestGoal = distance
    }
    const search = (
      allowGrass: boolean,
      campingAccess: boolean,
      maxCost?: number,
    ) =>
      findWeightedPath(
        {
          start,
          key: (cell) => this.packCell(cell),
          isGoal: (cell) => goalKeys.has(this.packCell(cell)),
          neighbors: (cell) =>
            this.getPedestrianNeighbors(cell, {
              allowQueue,
              allowCamping: campingAccess,
              allowMedical: medicalAllowed,
              allowFestival: festivalAllowed,
              ignoreDirectionalRestrictions,
              allowGrass,
              allowStaff,
              allowBackstage: backstageAllowed,
            }),
          movementCost,
          maxVisited,
          heuristic,
          maxCost,
        },
        this.pedestrianPathScratch,
      )
    let result = canEnterGoal(campingAllowed)
      ? search(false, campingAllowed)
      : null
    if (maxVisited === undefined && !result && !campingAllowed) {
      // A camping designation is ground, not a wall. Keep the normal
      // path-only pass first, then permit camping as a deterministic fallback
      // for visitors enclosed by designated cells.
      result = canEnterGoal(true) ? search(false, true) : null
    }
    if (maxVisited === undefined && !result && canEnterGoal(true)) {
      result = search(
        true,
        true,
        nearestGoal * SIMULATION_CONFIG.pathfinding.grassCostMultiplier * 1.6 +
          24,
      )
    }
    if (
      this.pedestrianPathCache.size >=
      SIMULATION_CONFIG.pathfinding.pathCacheLimit
    ) {
      // Evict one entry, not every route used by the crowd.
      this.pedestrianPathCache.delete(this.pedestrianPathCache.keys().next().value!)
    }
    // A budget-limited miss says nothing about reachability; never cache it.
    if (maxVisited === undefined || result) this.pedestrianPathCache.set(
      accessCacheKey,
      {
        path: result ? result.map((cell) => ({ ...cell })) : null,
        expires: this.state.simTick + SIMULATION_CONFIG.pathfinding.pathCacheLifetimeTicks +
          (this.packCell(start) % SIMULATION_CONFIG.pathfinding.pathCacheLifetimeTicks),
      },
    )
    return this.clonePedestrianPath(result)
  }

  private getPedestrianPathCacheKey(
    start: Cell,
    goals: readonly Cell[],
    flags: {
      allowQueue: boolean
      allowCamping: boolean
      allowMedical: boolean
      allowFestival: boolean
      ignoreDirectionalRestrictions: boolean
    },
  ): string {
    const packedGoals = goals
      .map((cell) => this.packCell(cell))
      .sort((left, right) => left - right)
    const flagBits =
      (flags.allowQueue ? 1 : 0) |
      (flags.allowCamping ? 2 : 0) |
      (flags.allowMedical ? 4 : 0) |
      (flags.allowFestival ? 8 : 0) |
      (flags.ignoreDirectionalRestrictions ? 16 : 0)
    return `${this.packCell(start)}:${packedGoals.join(',')}:${flagBits}:${this.accessSignalRevision}`
  }

  private clonePedestrianPath(path: readonly Cell[] | null): Cell[] | null {
    return path ? path.map((cell) => ({ ...cell })) : null
  }

  private visitorDecisionRng(visitor: Visitor): () => number {
    return createSeededRng(
      (visitor.pathSeed + visitor.wanderNonce * 0x9e3779b9) >>> 0,
    )
  }

  private assignDeterministicWander(
    visitor: Visitor,
    rng = this.visitorDecisionRng(visitor),
  ): void {
    const config = SIMULATION_CONFIG.pathfinding
    const span = config.wanderMaxSteps - config.wanderMinSteps + 1
    const steps = config.wanderMinSteps + Math.floor(rng() * span)
    const wanderFrom = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const wanderOptions = {
      allowCamping: Boolean(this.getCampingCellAt(visitor.cellX, visitor.cellZ)),
      allowMedical: Boolean(this.getMedicalCellAt(visitor.cellX, visitor.cellZ)),
      allowFestival: Boolean(
        this.getStageForecourtCellAt(visitor.cellX, visitor.cellZ),
      ),
      allowQueue:
        this.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)?.pathType ===
        'queue',
    }
    visitor.route = this.pickSeededWalk(wanderFrom, steps, rng, wanderOptions)
    if (visitor.route.length === 0) {
      visitor.route = this.pickSeededWalk(wanderFrom, steps, rng, {
        ...wanderOptions,
        allowQueue: true,
      })
    }
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.wanderNonce += 1
  }

  private pickSeededWalk(
    start: Cell,
    steps: number,
    rng: () => number,
    options: {
      allowCamping?: boolean
      allowMedical?: boolean
      allowFestival?: boolean
      allowQueue?: boolean
    },
    previous: Cell | null = null,
  ): Cell[] {
    const route: Cell[] = []
    let current: Cell = { ...start }
    let last = previous ? { ...previous } : null
    for (let step = 0; step < steps; step += 1) {
      const neighbors = this.getPedestrianNeighbors(current, {
        allowCamping:
          options.allowCamping ??
          Boolean(this.getCampingCellAt(current.x, current.z)),
        allowMedical: options.allowMedical ?? false,
        allowFestival:
          options.allowFestival ??
          Boolean(this.getStageForecourtCellAt(current.x, current.z)),
        allowQueue: options.allowQueue ?? false,
      })
      if (neighbors.length === 0) break
      const forward = last
        ? neighbors.filter(
            (cell) => cell.x !== last!.x || cell.z !== last!.z,
          )
        : neighbors
      const choices = forward.length > 0 ? forward : neighbors
      const next = choices[Math.floor(rng() * choices.length)]
      if (!next) break
      const copied = {
        x: next.x,
        z: next.z,
        elevation: next.elevation,
      }
      route.push(copied)
      last = current
      current = copied
    }
    return route
  }

  private finishInteraction(visitor: Visitor): void {
    const target = this.state.buildings.find((building) => building.id === visitor.targetId)
    if (target && isShopServiceKind(target.kind) && !this.isVisitorAtShopCounter(visitor, target)) {
      this.leaveQueueOnFoot(visitor, 'Ich gehe zur Vorderseite des Ladens.')
      return
    }
    const rideExitPath = target?.kind === 'ride' && target.rideExit
      ? this.getAccessPathNeighbors(target.rideExit).find(c=>this.getPathAt(c.x,c.z,c.elevation)?.pathType !== 'queue') : undefined
    if (target?.kind === 'ride' && !rideExitPath) {
      visitor.thought = 'Ich warte, bis der Ausgang wieder mit einem Gehweg verbunden ist.'
      return
    }
    const supply = target ? shopSupplyKind(target.kind) : null
    const shopSupply = supply && supply !== 'water' ? supply : null
    const available = !shopSupply || !!target && localStock(this.state, target.id, shopSupply) >= 1
    if (!available) this.state.festival.metrics.stockouts++
    const paid =
      target && available &&
      this.chargeVisitor(visitor, target.price, {
        x: target.x + 0.5,
        y: target.elevation + BUILDINGS[target.kind].height,
        z: target.z + 0.5,
      })
    if (paid && shopSupply && target) consumeLocal(this.state, target.id, shopSupply)
    if (target?.kind === 'food' && paid) {
      addItem(visitor.inventory, 'food')
      visitor.thought = 'Ich habe Essen gekauft und suche einen Platz zum Essen.'
    } else if (target?.kind === 'toilet' && paid) {
      visitor.needs.toilet = SIMULATION_CONFIG.needs.toilet.toilet
      visitor.thought = 'Das war dringend nötig.'
    } else if (target?.kind === 'ride' && paid) {
      visitor.needs.fun = SIMULATION_CONFIG.needs.ride.fun
      visitor.needs.energy = Math.max(
        0,
        visitor.needs.energy - SIMULATION_CONFIG.needs.ride.energyCost,
      )
      this.incidents.addRideNausea(
        visitor,
        SIMULATION_CONFIG.nausea.carouselIntensity,
      )
      visitor.thought = target.rideType === 'bungee' ? 'Was für ein Bungeesprung!' : 'Das Karussell war großartig!'
      visitor.bungeeNude = false
      delete target.bungeeVisitorId
    } else if (target?.kind === 'alcohol' && paid) {
      addItem(visitor.inventory, 'alcohol')
      visitor.thought = 'Ich habe ein Getränk gekauft und trinke es gleich in Ruhe.'
    } else if (target?.kind === 'mascot' && paid) {
      visitor.ownedMascot = true
      visitor.heldMascot = this.rng.next() < SIMULATION_CONFIG.souvenirs.holdMascotChance
      visitor.needs.fun = Math.min(100, visitor.needs.fun + SIMULATION_CONFIG.souvenirs.funGain)
      visitor.thought = souvenirPurchaseThought('mascot', Boolean(visitor.heldMascot))
    } else if (target?.kind === 'shirt' && paid) {
      const shirt = defaultShirtSettings()
      visitor.wornShirt = {
        color: normalizeShirtColor(target.shirtColor ?? shirt.color),
        style: normalizeShirtStyle(target.shirtStyle ?? shirt.style),
      }
      visitor.needs.fun = Math.min(100, visitor.needs.fun + SIMULATION_CONFIG.souvenirs.funGain)
      visitor.thought = souvenirPurchaseThought('shirt', false)
    } else if (target && !paid) {
      visitor.thought = available ? 'Dafür reicht mein Budget nicht.' : 'Ausverkauft! Hier fehlt Nachschub.'
      visitor.emotion = 'sad'
      visitor.emotionMinutes = 45
    }

    const purchasedConsumable =
      Boolean(paid) &&
      (target?.kind === 'food' || target?.kind === 'alcohol')
    visitor.targetId = null
    if (target?.kind === 'ride' && target.rideExit && rideExitPath) {
      visitor.x=target.rideExit.x+.5; visitor.y=target.rideExit.y; visitor.z=target.rideExit.z+.5
      visitor.cellX=target.rideExit.x; visitor.cellZ=target.rideExit.z; visitor.cellElevation=target.rideExit.y
      visitor.state='exiting'; visitor.route=[rideExitPath]; visitor.interactionRemaining=0
      delete target.bungeeVisitorId
      return
    }
    const queueExit =
      target && isStallQueueKind(target.kind)
        ? this.buildQueueExitRoute(
            { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
            this.getBuildingQueueCells(target),
          )
        : []
    if (queueExit.length > 0) {
      this.clearVisitorActivity(visitor)
      visitor.state = 'exploring'
      visitor.route = queueExit
      visitor.interactionRemaining = 0
      this.beginStallQueueReturn(visitor, queueExit[0])
      if (purchasedConsumable) {
        visitor.thought = 'Ich gehe die Schlange zurück und suche einen Platz zum Essen oder Trinken.'
      }
      return
    }
    if (purchasedConsumable) {
      // Clear the counter before eating or drinking; avoid occupying the service tile.
      const route: Cell[] = []
      let cell = { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation }
      const visited = new Set([this.packCell(cell)])
      for (let step = 0; step < 4; step++) {
        const candidates = [...this.getPedestrianNeighbors(cell, { allowGrass: false })]
          .filter(next => !visited.has(this.packCell(next)))
          .sort((a, b) => (this.movementOccupancy.get(this.packCell(a)) ?? 0) - (this.movementOccupancy.get(this.packCell(b)) ?? 0))
        if (!candidates.length) break
        cell = { ...candidates[0]! }; route.push(cell); visited.add(this.packCell(cell))
      }
      if (route.length) {
        this.clearVisitorActivity(visitor)
        visitor.state = 'exploring'; visitor.route = route
        visitor.thought = 'Ich mache den Stand frei und suche einen Platz zum Essen oder Trinken.'
      } else this.beginStationaryBreak(visitor, visitor.thought)
      return
    }
    visitor.state = 'exploring'
    visitor.interactionRemaining = 0
    if (target?.kind === 'ride' && paid) {
      this.queueVisitorDecision(visitor)
      return
    }
    this.decideNextAction(visitor)
  }

  private decayNeeds(visitor: Visitor, minutes: number): void {
    const config = SIMULATION_CONFIG.needs
    visitor.needs.hunger = Math.max(
      0,
      visitor.needs.hunger - minutes * config.hungerDecayPerMinute,
    )
    visitor.needs.toilet = Math.max(
      0,
      visitor.needs.toilet - minutes * config.toiletDecayPerMinute,
    )
    visitor.needs.fun = Math.max(
      0,
      visitor.needs.fun - minutes * config.funDecayPerMinute,
    )
    const alcoholEnergyDrain =
      (visitor.alcoholLevel / 100) * config.alcoholEnergyDecayPerMinute
    const circadian = circadianEnergyDecayMultiplier(
      this.state.minute,
      visitor.preferredBedtime,
      visitor.preferredWakeTime,
      SIMULATION_CONFIG.camping.sleepSchedule,
    )
    visitor.needs.energy = Math.max(
      0,
      visitor.needs.energy -
        minutes *
          (config.baseEnergyDecayPerMinute * circadian + alcoholEnergyDrain),
    )
  }

  private canBeginStreaking(visitor: Visitor): boolean {
    const config = SIMULATION_CONFIG.alcohol.streaking
    if (visitor.streakingMinutes > 0 || visitor.streakingCooldownMinutes > 0) {
      return false
    }
    if (visitor.concertId) return false
    if (
      visitor.alcoholLevel < config.minimumAlcohol ||
      visitor.alcoholLevel > config.maximumAlcohol ||
      visitor.needs.energy < config.minimumEnergy
    ) {
      return false
    }
    if (visitor.hasHandcart) return false
    return (
      visitor.state === 'exploring' ||
      visitor.state === 'seeking' ||
      visitor.state === 'partying' ||
      visitor.state === 'socializing' ||
      visitor.state === 'relaxing' ||
      visitor.state === 'bench-resting' ||
      visitor.state === 'entering'
    )
  }

  private updateStreaking(visitor: Visitor, minutes: number): void {
    const config = SIMULATION_CONFIG.alcohol.streaking
    visitor.streakingCooldownMinutes = Math.max(
      0,
      visitor.streakingCooldownMinutes - minutes,
    )
    if (visitor.streakingMinutes > 0) {
      visitor.streakingMinutes = Math.max(0, visitor.streakingMinutes - minutes)
      visitor.emotion = 'excited'
      visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 6)
      visitor.needs.fun = Math.min(
        100,
        visitor.needs.fun + minutes * config.selfFunPerMinute,
      )
      visitor.thought = 'Nackt durchs Festival! Wer macht mit?'
      this.spreadStreakingFun(visitor, minutes)
      if (visitor.streakingMinutes <= 0) {
        visitor.streakingCooldownMinutes = config.cooldownMinutes
        visitor.emotion = 'happy'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 18)
        visitor.thought = 'Okay, das war vielleicht etwas zu viel.'
      }
      return
    }
    if (!this.canBeginStreaking(visitor)) return
    if (this.rng.next() >= Math.min(1, minutes * config.chancePerMinute)) return
    this.beginStreaking(visitor)
  }

  private beginStreaking(visitor: Visitor): void {
    const config = SIMULATION_CONFIG.alcohol.streaking
    this.removeVisitorFromCoasterQueues(visitor.id)
    this.clearVisitorActivity(visitor)
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.isConversing = false
    visitor.streakingMinutes =
      config.durationMinimum + this.rng.next() * config.durationRandomRange
    visitor.emotion = 'excited'
    visitor.emotionMinutes = visitor.streakingMinutes + 8
    visitor.thought = 'Nackt durchs Festival! Wer macht mit?'
    this.continueStreakingRun(visitor)
  }

  private continueStreakingRun(visitor: Visitor): void {
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.isDancing = false
    visitor.route = this.pickStreakingRoute(visitor)
  }

  private pickStreakingRoute(visitor: Visitor): Cell[] {
    const rng = this.visitorDecisionRng(visitor)
    visitor.wanderNonce += 1
    return this.pickSeededWalk(
      {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      },
      6 + Math.floor(rng() * 5),
      rng,
      {
        allowCamping: Boolean(this.getCampingCellAt(visitor.cellX, visitor.cellZ)),
        allowMedical: false,
        allowFestival: true,
      },
      visitor.route[0] ?? null,
    )
  }

  private spreadStreakingFun(source: Visitor, minutes: number): void {
    const config = SIMULATION_CONFIG.alcohol.streaking
    this.state.visitors.forEach((other) => {
      if (other.id === source.id) return
      if (
        other.state === 'sleeping' ||
        other.state === 'riding' ||
        other.state === 'medical' ||
        other.state === 'injured' ||
        other.state === 'vehicle-arrival' ||
        other.state === 'bus-riding'
      ) {
        return
      }
      const distance =
        Math.abs(other.cellX - source.cellX) +
        Math.abs(other.cellZ - source.cellZ)
      if (distance > config.auraRadius) return
      other.needs.fun = Math.min(
        100,
        other.needs.fun + minutes * config.nearbyFunPerMinute,
      )
      if (other.emotion !== 'angry' && other.emotion !== 'sad') {
        other.emotion = distance <= 1 ? 'excited' : 'happy'
        other.emotionMinutes = Math.max(other.emotionMinutes, 8)
      }
    })
  }

  private updateAlcoholBehavior(visitor: Visitor): boolean {
    const config = SIMULATION_CONFIG.alcohol
    if (
      visitor.alcoholLevel >= config.passOutThreshold &&
      visitor.needs.energy <= config.passOutEnergyThreshold &&
      !visitor.campsite &&
      visitor.state !== 'riding' &&
      visitor.state !== 'camping'
    ) {
      this.removeVisitorFromCoasterQueues(visitor.id)
      visitor.streakingMinutes = 0
      visitor.toplessMinutes = 0
      visitor.state = 'sleeping'
      visitor.route = []
      visitor.targetId = null
      visitor.thought = 'Ich muss mich kurz hinlegen …'
      visitor.emotion = 'sad'
      visitor.emotionMinutes = 60
      return true
    }
    if (
      visitor.alcoholLevel < config.drunkBehaviorThreshold ||
      visitor.state === 'riding'
    ) {
      return false
    }
    if (visitor.alcoholDisposition === 'aggressive') {
      visitor.emotion = 'angry'
      visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 12)
      if (visitor.alcoholLevel >= config.veryDrunkBehaviorThreshold) {
        visitor.thought = 'Lasst mich durch!'
      }
    } else {
      visitor.emotion =
        visitor.alcoholLevel >= config.veryDrunkBehaviorThreshold
          ? 'excited'
          : 'happy'
      visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 12)
      if (visitor.alcoholLevel >= config.veryDrunkBehaviorThreshold) {
        visitor.thought = 'Was für ein großartiges Festival!'
      }
    }
    return false
  }

  private updateVisitorEmotion(visitor: Visitor, minutes: number): void {
    if (visitor.emotionMinutes > 0) {
      visitor.emotionMinutes = Math.max(0, visitor.emotionMinutes - minutes)
      return
    }
    const values = Object.values(visitor.needs)
    const minimum = Math.min(...values)
    const average = values.reduce((total, value) => total + value, 0) / values.length
    const emotions = SIMULATION_CONFIG.visitors.emotions
    visitor.emotion =
      minimum < emotions.angryNeedBelow
        ? 'angry'
        : average < emotions.sadAverageBelow
          ? 'sad'
          : average > emotions.happyAverageAbove
            ? 'happy'
            : 'neutral'
  }

  /**
   * What an hour of simply existing costs the park: the upkeep of everything standing
   * on it, the wages of everyone employed, the generator when it runs. The economy
   * tick charges this, and the forecast column multiplies it out to a day, so both
   * read from the same calculation.
   */
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
    options: {
      allowQueue?: boolean
      allowCamping?: boolean
      allowMedical?: boolean
      allowFestival?: boolean
      ignoreDirectionalRestrictions?: boolean
      allowGrass?: boolean
      allowStaff?: boolean
      allowBackstage?: boolean
    } = {},
  ): Cell[] {
    const node = this.getPedestrianNavNode(cell)
    const neighbors = this.neighborScratch
    neighbors.length = 0
    if (!node) return neighbors
    const allowQueue = options.allowQueue ?? false
    const allowCamping = Boolean(options.allowCamping)
    const allowMedical = Boolean(options.allowMedical)
    const allowFestival = Boolean(options.allowFestival)
    const allowBackstage = Boolean(options.allowBackstage || options.allowStaff)
    const allowGrass = options.allowGrass ?? true
    const ignoreDirectional = options.ignoreDirectionalRestrictions ?? false
    const campingHere = (node.flags & NAV_CAMPING) !== 0
    const seen = this.neighborSeen
    seen.clear()
    for (let index = 0; index < node.links.length; index += 1) {
      const link = node.links[index]!
      const dest = link.node
      if (dest.path?.staffOnly && !options.allowStaff) continue
      if ((dest.flags & NAV_SOLID) !== 0) continue
      if (
        (dest.flags & NAV_PARKING) !== 0 &&
        (dest.flags & NAV_PATH) === 0
      ) {
        continue
      }
      if ((dest.flags & NAV_WATER) !== 0 && (dest.flags & NAV_PATH) === 0) continue
      if (!allowCamping && (dest.flags & NAV_CAMPING) !== 0) continue
      if (!allowMedical && (dest.flags & NAV_MEDICAL) !== 0) continue
      if (
        !allowFestival &&
        (dest.flags & NAV_FORECOURT) !== 0 &&
        (dest.flags & NAV_PATH) === 0
      ) {
        continue
      }
      if (
        !allowBackstage &&
        (dest.flags & NAV_BACKSTAGE) !== 0 &&
        (dest.flags & NAV_PATH) === 0
      ) {
        continue
      }
      if (!allowGrass && (dest.flags & NAV_PAVED) === 0) continue
      if (campingHere && Math.abs(dest.cell.elevation - node.cell.elevation) >= 0.01) {
        continue
      }
      const toPath = link.toPath ?? dest.path
      if (toPath) {
        if (
          !this.canTraversePath(
            node.path,
            toPath,
            node.cell.x,
            node.cell.z,
            allowQueue,
            ignoreDirectional,
          )
        ) {
          continue
        }
      } else if (node.path?.pathType === 'queue') {
        const leaveDirection = this.getDirectionIndex(
          dest.cell.x - node.cell.x,
          dest.cell.z - node.cell.z,
        )
        if (node.path.queueEntryDirection !== (leaveDirection + 2) % 4) continue
      }
      if (
        !ignoreDirectional &&
        this.closedPathEdges.has(
          accessEdgeKey(
            node.cell.x,
            node.cell.z,
            this.getDirectionIndex(dest.cell.x - node.cell.x, dest.cell.z - node.cell.z) as Direction,
          ),
        )
      ) {
        continue
      }
      if (this.isCachedEdgeBlocked(node, dest)) continue
      if (seen.has(dest.packed)) continue
      seen.add(dest.packed)
      neighbors.push(dest.cell)
    }
    return neighbors
  }

  private isCachedEdgeBlocked(
    from: PedestrianNavNode,
    to: PedestrianNavNode,
  ): boolean {
    const direction = this.getDirectionIndex(
      to.cell.x - from.cell.x,
      to.cell.z - from.cell.z,
    )
    if (direction < 0) return false
    const bit = directionBit(direction as Direction)
    const opposite = directionBit(oppositeDirection(direction as Direction))
    if ((from.flags & NAV_GROUND) !== 0 && (from.roadBlocked & bit) !== 0) {
      return true
    }
    if ((to.flags & NAV_GROUND) !== 0 && (to.roadBlocked & opposite) !== 0) {
      return true
    }
    return (from.fenceMask & bit) !== 0 || (to.fenceMask & opposite) !== 0
  }

  private getPedestrianNavNode(cell: Cell): PedestrianNavNode | undefined {
    this.ensurePedestrianNav(false)
    return this.pedestrianNav.get(this.packCell(cell))
  }

  private getPedestrianNavKey(): string {
    let structure = 0
    for (const building of this.state.buildings) {
      if (
        building.kind !== 'path' &&
        building.kind !== 'fence' &&
        !PEDESTRIAN_SOLID_KINDS.has(building.kind)
      ) {
        continue
      }
      structure =
        (structure +
          this.packXZ(building.x, building.z) +
          building.rotation +
          Math.round(building.elevation * 8) +
          (building.pathType === 'queue' ? 5 : 1) +
          (building.pathSlope ?? 0) * 11) |
        0
    }
    for (const road of this.state.logistics.roadCells) {
      structure =
        (structure +
          road.x * 13 +
          road.z * 17 +
          road.blockedEdges +
          Math.round((road.elevation ?? 0) * 2) +
          Math.round((road.roadSlope ?? 0) * 2) * 7 +
          (road.roadSlopeDirection ?? 0)) |
        0
    }
    return [
      this.state.buildings.length,
      this.state.logistics.roadCells.length,
      this.state.logistics.parkingCells.length,
      this.state.campingCells.length,
      this.state.medicalCells.length,
      this.state.stageForecourtCells.length,
      this.cachedWorldSize,
      this.terrainHeights?.byteLength ?? 0,
      structure,
    ].join(':')
  }

  private ensurePedestrianNav(revalidate: boolean): void {
    if (revalidate) {
      const key = `${this.worldRevision}:${this.getPedestrianNavKey()}`
      if (key === this.pedestrianNavKey && this.pedestrianNav.size > 0) return
      this.pedestrianNavKey = key
      this.rebuildPedestrianNav()
      this.lastNavRevision = this.worldRevision
      return
    }
    if (this.pedestrianNav.size === 0) this.rebuildPedestrianNav()
  }

  private rebuildPedestrianNav(): void {
    this.refreshBandSupplyGraph()
    this.ensureSpatialIndexes()
    this.pedestrianNav.clear()
    this.pedestrianPathCache.clear()
    const size = this.getWorldSize()
    const half = size / 2
    const addNode = (x: number, z: number, elevation: number): void => {
      const packed = this.packCell({ x, z, elevation })
      if (this.pedestrianNav.has(packed)) return
      const path = this.getPathAt(x, z, elevation)
      const height = this.getTerrainHeight(x, z)
      const ground = Math.abs(elevation - height) < WAY_LEVEL_MATCH
      const road = ground ? this.getRoadCellAt(x, z) : undefined
      const camping = this.getCampingCellAt(x, z)
      const medical = this.getMedicalCellAt(x, z)
      const forecourt = this.getStageForecourtCellAt(x, z)
      const parking = this.hasParkingAt(x, z)
      const backstage = this.activeBackstagePacked.has(this.packXZ(x, z))
      const water = isWaterHeight(height) && !path
      let flags = 0
      if (path) flags |= NAV_PATH
      if (road) flags |= NAV_ROAD
      if (camping) flags |= NAV_CAMPING
      if (medical) flags |= NAV_MEDICAL
      if (forecourt) flags |= NAV_FORECOURT
      if (parking) flags |= NAV_PARKING
      if (backstage) flags |= NAV_BACKSTAGE
      if (water) flags |= NAV_WATER
      if (ground) flags |= NAV_GROUND
      if (this.isPedestrianSolidAt(x, z, elevation)) flags |= NAV_SOLID
      if (path || road || camping || medical || forecourt || parking || backstage) flags |= NAV_PAVED
      let fenceMask = 0
      for (const building of this.getBuildingsAtCell(x, z)) {
        if (
          building.kind === 'fence' &&
          Math.abs(building.elevation - elevation) < WAY_LEVEL_MATCH
        ) {
          fenceMask |= directionBit(building.rotation as Direction)
        }
      }
      this.pedestrianNav.set(packed, {
        cell: { x, z, elevation },
        packed,
        flags,
        cost: this.getPedestrianSurfaceCost({ x, z, elevation }),
        fenceMask,
        roadBlocked: road ? road.blockedEdges : 0,
        path,
        links: [],
      })
    }
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) {
        addNode(x, z, this.getTerrainHeight(x, z))
      }
    }
    this.state.buildings.forEach((building) => {
      if (building.kind === 'path') addNode(building.x, building.z, building.elevation)
    })
    this.pedestrianNav.forEach((node) => {
      for (const [dx, dz] of PEDESTRIAN_OFFSETS) {
        const nx = node.cell.x + dx
        const nz = node.cell.z + dz
        for (const building of this.getBuildingsAtCell(nx, nz)) {
          if (building.kind !== 'path') continue
          if (Math.abs(building.elevation - node.cell.elevation) > 1) continue
          const dest = this.pedestrianNav.get(
            this.packCell({
              x: building.x,
              z: building.z,
              elevation: building.elevation,
            }),
          )
          if (!dest) continue
          node.links.push({ node: dest, toPath: building })
        }
        if ((node.flags & NAV_GROUND) === 0) continue
        const neighborGround = this.getTerrainHeight(nx, nz)
        if (Math.abs(neighborGround - node.cell.elevation) > 1) continue
        const dest = this.pedestrianNav.get(
          this.packCell({ x: nx, z: nz, elevation: neighborGround }),
        )
        if (!dest) continue
        node.links.push({ node: dest })
      }
    })
  }

  private isPedestrianSolidAt(x: number, z: number, elevation: number): boolean {
    if (this.getRideAccessAt(x,z,elevation)) return true
    if (this.state.festival.infrastructure.depots.some(d => d.x === x && d.z === z) && elevation < this.getTerrainHeight(x, z) + 1) return true
    for (const building of this.getBuildingsAtCell(x, z)) {
      if (
        PEDESTRIAN_SOLID_KINDS.has(building.kind) &&
        (building.decorationSlot === undefined || building.decorationSlot === 4) &&
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
        building.kind === 'fence' &&
        building.rotation === direction &&
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
    if (isWaterHeight(height) && !path) return Number.POSITIVE_INFINITY
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
    if (
      !canTraverseWayElevation(
        from?.elevation ?? to.elevation,
        from?.pathSlope ?? 0,
        from?.pathSlopeDirection,
        to.elevation,
        to.pathSlope ?? 0,
        to.pathSlopeDirection,
        direction,
      )
    ) {
      return false
    }
    return true
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
    this.visitorsAwaitingDecision.delete(visitor.id)
    this.chooseNextVisitorAction(visitor)
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
        heights[(z + half) * size + (x + half)] = readTerrainHeight(
          this.state.terrain,
          x,
          z,
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

  private getPathSurfaceElevation(path: PlacedBuilding | undefined): number {
    if (!path) return 0
    return path.elevation - (path.pathSlope ?? 0) / 2
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

