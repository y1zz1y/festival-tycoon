import { normalizeAccessControls } from './accessControl'
import { normalizeBackstageCell, emptyBandSupplySnapshot, type BackstageCell } from './bandSupply'
import { normalizeBandActor, type BandActor } from './bandActors'
import type { CampSetupKind } from './camping'
import { BUILDING_KINDS, BUILDINGS } from './catalog'
import { createCoasterTelemetry, getCoasterType, migrateTrackPiece, resolveCoasterTypeId, sampleCoasterTrack, type Coaster } from './coasters'
import { normalizeCourses } from './courseAttractions'
import { normalizeComplaintSnapshot } from './complaints'
import { normalizeDayPlan } from './dayPlan'
import { createFinanceState } from './finance'
import { createFestivalInventory, getItemQuantity, normalizeInventory } from './inventory'
import { normalizeLogisticsSnapshot } from './logistics'
import { clampWasteDumpStored, clampSealedContainerStored, isSealedWasteContainer } from './waste'
import { normalizePower } from './power'
import { hashStringSeed, visitorLooksFemale, type DeterministicRng } from './rng'
import { normalizeScenarioSettings } from './scenario'
import { createScenarioProgress } from './scenarioGoals'
import { DEFAULT_SECURITY_CONFIG } from './security'
import { SIMULATION_CONFIG } from './simulationConfig'
import { defaultShirtSettings, normalizeShirtColor, normalizeShirtStyle, normalizeWornShirt } from './shopGoods'
import { isWasteBin } from './decorationWalls'
import { syncStageAudience } from './stageAudience'
import { normalizeTerrain, normalizeWaterLevel } from './terrain'
import type { Cell, Visitor } from './types/entities'
import type { GameSnapshot } from './types/snapshot'
import { normalizeStaffGateDirection } from './accessControl'
import { snapWayElevation } from './wayElevation'
import {
  FEMALE_VISITOR_NAMES,
  MALE_VISITOR_NAMES,
  visitorGivenName,
} from './visitorSpawning'

export type SnapshotRepairContext = {
  state: GameSnapshot
  rng: DeterministicRng
  mergeIncidentStacks: (incidents: GameSnapshot['incidents']) => GameSnapshot['incidents']
  rebuildTerrainCache: () => void
  recalculateCoasterTrackState: (coaster: Coaster) => void
  getAt: (x: number, z: number) => { elevation: number } | undefined
  getPathAt: (x: number, z: number, elevation?: number) => { elevation: number } | undefined
  restoreVisitorSleepRhythm: (visitor: Visitor) => void
  repairDesignatedOccupancyReservations: () => void
  ensureEntrancePath: () => void
  ensureRoadIngress: () => void
  migrateWayElevations: () => void
  migrateLegacyBusStopsToRoadside: () => void
  recalculateQueueDirections: () => void
  refreshPower: () => void
  refreshBandSupplyGraph: () => void
  evaluateAccessSignals: () => void
}

export function normalizeSnapshotForRuntime(context: SnapshotRepairContext): void {
  const { state, rng } = context
  state.simTick ??= 0
  state.rngState ??= hashStringSeed('festival')
  rng.setState(state.rngState)
  state.entryPrice ??= SIMULATION_CONFIG.economy.defaultEntryPrice
  state.campingTicketPrice ??=
    state.entryPrice ?? SIMULATION_CONFIG.economy.defaultCampingTicketPrice
  state.parkOpen ??= true
  state.campingCells ??= []
  state.campInstallations ??= []
  state.campInstallations.forEach((installation) => {
    installation.decay ??= 0
    installation.contributorIds ??= installation.ownerId ? [installation.ownerId] : []
  })
  state.staff ??= []
  state.medicalCells ??= []
  state.wasteDumpCells = (state.wasteDumpCells ?? []).map((cell) =>
    clampWasteDumpStored({ ...cell }),
  )
  state.incidents ??= []
  state.incidents = context.mergeIncidentStacks(state.incidents)
  state.stageForecourtCells ??= []
  state.backstageCells = (state.backstageCells ?? [])
    .map(normalizeBackstageCell)
    .filter((cell): cell is BackstageCell => cell !== null)
  state.bandActors = (state.bandActors ?? [])
    .map(normalizeBandActor)
    .filter((actor): actor is BandActor => actor !== null)
  state.bandSupply ??= emptyBandSupplySnapshot()
  state.version = 31
  state.waterLevel = normalizeWaterLevel(state.waterLevel)
  syncStageAudience(state)
  state.attractiveness ??= { average: 0, maximum: 0, minimum: 0, cells: [] }
  state.partyMood ??= { average: 0, maximum: 0, minimum: 0, cells: [] }
  state.dayPlan = normalizeDayPlan(state.dayPlan)
  state.complaints = normalizeComplaintSnapshot(state.complaints)
  state.logistics = normalizeLogisticsSnapshot(state.logistics)
  state.logistics.wasteDepots ??= []
  state.logistics.specialDepots ??= []
}

export function repairSnapshotEntities(context: SnapshotRepairContext): number {
  const { state } = context
  state.accessControls = normalizeAccessControls(state.accessControls)
  state.finance ??= createFinanceState()
  state.finance.periods ??= []
  state.finance.today ??= {}
  state.finance.previousDay ??= {}
  state.scenario = normalizeScenarioSettings(state.scenario)
  state.scenarioProgress ??= createScenarioProgress(state.scenario.goals)
  state.terrain = normalizeTerrain(state.terrain)
  state.power = normalizePower(state.power)
  context.rebuildTerrainCache()
  state.coasters ??= []
  state.courses = normalizeCourses(state.courses)
  state.attractions ??= []
  state.cashEffects = []
  state.fireworkEffects = []
  state.crowding = { average: 0, maximum: 0, cells: [] }
  state.coasters.forEach((coaster) => repairCoaster(coaster, context))
  state.buildElevation ??= 0
  state.buildRotation ??= 0
  state.buildings = state.buildings.filter((building) =>
    (BUILDING_KINDS as readonly string[]).includes(building.kind),
  )
  state.buildings.forEach((building) => {
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
      const names = ['Neon Echo', 'Festival Riot', 'Moonlight Avenue', 'Bassgarten']
      building.bandName ??= names[Math.abs(building.x + building.z) % names.length]
    }
    if (isWasteBin(building.kind)) building.wasteFill ??= 0
    if (isSealedWasteContainer(building.kind)) {
      building.wasteFill = clampSealedContainerStored(building.wasteFill ?? 0)
    }
    if (building.kind === 'shirt') {
      const fallback = defaultShirtSettings()
      building.shirtColor = normalizeShirtColor(building.shirtColor ?? fallback.color)
      building.shirtStyle = normalizeShirtStyle(building.shirtStyle ?? fallback.style)
    }
  })
  migrateLegacyCampInstallations(state)
  state.visitors.forEach((visitor) => repairVisitor(visitor, context))
  state.staff.forEach((member) => {
    member.route ??= []
    member.targetId ??= null
    member.assignedBuildingId ??= null
    member.medicalCell ??= null
    member.medicalSlot ??= null
    member.workMinutes ??= 0
    member.carryingWaste ??= 0
  })
  context.repairDesignatedOccupancyReservations()
  context.ensureEntrancePath()
  context.ensureRoadIngress()
  context.migrateWayElevations()
  context.migrateLegacyBusStopsToRoadside()
  context.recalculateQueueDirections()
  context.refreshPower()
  context.refreshBandSupplyGraph()
  state.guests = state.visitors.length
  const idCounter =
    state.buildings.length +
    state.visitors.length +
    state.campInstallations.length +
    state.accessControls.trafficLights.length +
    state.accessControls.pathBarriers.length +
    state.coasters.reduce((total, coaster) => total + coaster.pieces.length + 1, 0)
  context.evaluateAccessSignals()
  return idCounter
}

function repairCoaster(coaster: Coaster, context: SnapshotRepairContext): void {
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
  context.recalculateCoasterTrackState(coaster)
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
}

function migrateLegacyCampInstallations(state: GameSnapshot): void {
  if (state.campInstallations.length !== 0) return
  const legacyVisitors = state.visitors as Array<
    Visitor & { campSetup?: Array<{ cell: Cell; kind: CampSetupKind }> }
  >
  legacyVisitors.forEach((visitor) => {
    visitor.campSetup?.forEach((setup, index) => {
      const sharedChairs = state.campInstallations.find(
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
      state.campInstallations.push({
        id: `legacy-camp-installation-${visitor.id}-${index}`,
        cell: { ...setup.cell },
        kind: setup.kind,
        ownerId: visitor.id,
        contributorIds: [visitor.id],
      })
    })
  })
}

function repairVisitor(visitor: Visitor, context: SnapshotRepairContext): void {
  const { rng } = context
  visitor.y ??= context.getAt(visitor.cellX, visitor.cellZ)?.elevation ?? 0
  visitor.cellElevation ??= visitor.y
  visitor.walkSpeed ??=
    SIMULATION_CONFIG.visitors.walkSpeedMinimum +
    rng.next() * SIMULATION_CONFIG.visitors.walkSpeedRandomRange
  visitor.movementBoostMinutes ??= 0
  visitor.avoidedCoasterId ??= null
  visitor.avoidanceMinutes ??= 0
  visitor.facing ??= 0
  visitor.emotion ??= 'neutral'
  visitor.emotionMinutes ??= 0
  visitor.budget ??= SIMULATION_CONFIG.visitors.budget
  visitor.alcoholLevel ??= 0
  visitor.alcoholDisposition ??=
    rng.next() < SIMULATION_CONFIG.visitors.aggressiveProbability ? 'aggressive' : 'calm'
  visitor.alcoholDesire ??= 25 + rng.next() * 60
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
    : normalizeInventory(createFestivalInventory(rng), Boolean(visitor.campsite))
  visitor.motivation ??= 100
  visitor.crowding ??= 0
  visitor.crowdStress ??= 0
  visitor.isPanicking ??= false
  visitor.panicRecoverMinutes ??= 0
  visitor.tileOffsetX ??= 0.1 + rng.next() * 0.8
  visitor.tileOffsetZ ??= 0.1 + rng.next() * 0.8
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
    rng.next() * SIMULATION_CONFIG.atmosphere.preferenceRandomRange
  visitor.partyPreference ??=
    SIMULATION_CONFIG.atmosphere.preferenceMinimum +
    rng.next() * SIMULATION_CONFIG.atmosphere.preferenceRandomRange
  visitor.localAttractiveness ??= 0
  visitor.localPartyMood ??= 0
  visitor.activityTarget ??= null
  visitor.activitySlot ??= 0
  visitor.activityCapacity ??= 1
  visitor.isDancing ??= false
  context.restoreVisitorSleepRhythm(visitor)
  visitor.ticketType ??=
    getItemQuantity(visitor.inventory, 'tent') > 0 ? 'camping' : 'day'
  visitor.consumptionCooldown ??= 0
  visitor.isConversing ??= false
  visitor.campingWaitMinutes ??= 0
  visitor.campingWaitRetryMinutes ??= 0
  visitor.entryFeePaid ??= context.state.entryPrice
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
  visitor.route = (visitor.route ?? []).map((cell) => ({
    ...cell,
    elevation:
      cell.elevation ??
      context.getPathAt(cell.x, cell.z)?.elevation ??
      visitor.cellElevation,
  }))
}
