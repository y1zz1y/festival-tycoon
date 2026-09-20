import { isWasteBin } from './decorationWalls';
import { isSealedWasteContainer } from './waste';
import { musicTaste, musicAppeal } from './musicTaste';
import { stageDistance, stageFrontRank, stageSize, type StageDesign } from './stageDesign';
import { wayInfo } from './wayTypes';
import { localStock, consumeLocal } from './supplyChain';
import { isShopServiceKind } from './shopAccess';
import { defaultShirtSettings, normalizeShirtColor, normalizeShirtStyle, shopSupplyKind, souvenirPurchaseThought, souvenirSeekThought } from './shopGoods';
import { isStallQueueKind } from './queueLanes';
import { buildingEfficiency } from './ground';
import { BUILDINGS } from './catalog';
import { type FinanceCategory } from './finance';
import { grantAttractionFun } from './attractionFun';
import { watchableBookings, showIssue, BANDS } from './festivalManagement';
import type { Booking } from './festivalManagement';
import type { BuildingKind } from './catalog';
import type { Coaster } from './coasters';
import type { Attraction } from './attractions/types';
import { courseCapacityFor, courseEntrance, isCourseSwimCell, validateCourse, type CourseAttraction } from './courseAttractions';
import { CampingSystem } from './camping';
import type { CampingCell } from './camping';
import { addItem, consumeItem, getItemQuantity, INVENTORY_ITEMS } from './inventory';
import { CONCERT_TOPLESS_CROWD_THOUGHT, CONCERT_TOPLESS_THOUGHT } from './visitorThoughts';
import { createSeededRng } from './pathfinding';
import { PEDESTRIAN_NAV_FLAGS, PedestrianNavigation, type PedestrianNeighborOptions } from './pedestrianNavigation';
import { DeterministicRng, hashStringSeed } from './rng';
import { MedicalSystem } from './medical';
import type { MedicalCell } from './medical';
import { IncidentSystem } from './incidents';
import type { GroundIncidentKind } from './incidents';
import { DEFAULT_SECURITY_CONFIG, SecuritySystem } from './security';
import { SIMULATION_CONFIG } from './simulationConfig';
import { circadianEnergyDecayMultiplier, isMinuteInSleepWindow, remapLegacySleepRhythm, sampleFestivalSleepRhythm, sleepRhythmFromVisitorId } from './visitorSleep';
import type { StageForecourtCell } from './festivalAreas';
import { findNearestVisitorWasteTarget, wasteBinHasRoom, wasteBinManhattan } from './waste';
import type { VisitorWasteTarget, WasteDumpCell } from './waste';
import { getFestivalCycleStatus, isDayVisitorAdmissionOpen } from './dayPlan';
import type { DayPlanOffer } from './dayPlan';
import type { ComplaintTopic } from './complaints';
import { collectSeatedPassengerIds } from './logistics';
import { VisitorSimulation } from './visitorSimulation';
import type { ArrivalGroup, Direction, RoadCell, RoadVehicle } from './logistics';
import { staffGateBlocksVisitor } from './accessControl';
import { isSwimmableHeight } from './terrain';
import type { Cell, PlacedBuilding, Visitor } from './types/entities';
import type { GameSnapshot } from './types/snapshot';

const {
  camping: NAV_CAMPING,
  medical: NAV_MEDICAL,
  forecourt: NAV_FORECOURT,
} = PEDESTRIAN_NAV_FLAGS

export type VisitorBehaviorContext = {
  state: GameSnapshot
  medical: MedicalSystem
  incidents: IncidentSystem
  visitorSimulation: VisitorSimulation
  camping: CampingSystem
  rng: DeterministicRng
  indexedVisitorCount: number
  stallQueueReturnIds: Set<string>
  pedestrianNavigation: PedestrianNavigation
  lastNavRevision: number
  worldRevision: number
  attractivenessValues: Map<string, number>
  partyMoodValues: Map<string, number>
  security: SecuritySystem
  crowdingCosts: Map<string, number>
  getWorldSize(): number;
  getEntrance(): Cell;
  getTerrainHeight(x: number, z: number): number;
  getWaterLevel(): number;
  isWaterTerrain(x: number, z: number): boolean;
  isSwimmableTerrain(x: number, z: number): boolean;
  isMudTerrain(x: number, z: number): boolean;
  isVisitorSeatedInVehicle(visitor: Pick<Visitor, 'id' | 'state'>, seated: ReadonlySet<string>): boolean;
  beginVisitorDeparture(visitor: Visitor): void;
  ensureExitRoute(visitor: Visitor): void;
  getVisitorArrivalCar(visitor: Visitor): RoadVehicle | undefined;
  shouldReturnToArrivalCar(visitor: Visitor): boolean;
  tryBoardDepartureCar(visitor: Visitor): boolean;
  getMedicalCellAt(x: number, z: number): MedicalCell | undefined;
  getWasteDumpAt(x: number, z: number): WasteDumpCell | undefined;
  getStageForecourtCellAt(x: number, z: number): StageForecourtCell | undefined;
  showQualityForStage(stageId: string): number;
  getPathAt(x: number, z: number, elevation?: number): PlacedBuilding | undefined;
  getSecurityGateAt(x: number, z: number, elevation?: number): PlacedBuilding | undefined;
  getCampingCellAt(x: number, z: number): CampingCell | undefined;
  getVisitor(id: string): Visitor | undefined;
  getCoaster(id: string): Coaster | undefined;
  getCoasterQueueCapacity(coasterId: string): number;
  getRoadCellAt(x: number, z: number, elevation?: number): RoadCell | undefined;
  isOfferCurrentlyActive(offer: DayPlanOffer): boolean;
  isBuildingCurrentlyActive(building: PlacedBuilding): boolean;
  normalizeCarManifest(group: ArrivalGroup): void;
  addGroundIncident(kind: GroundIncidentKind, cell: {
    x: number;
    z: number;
    elevation: number;
}, severity?: number): void;
  leaveVisitorCampBehind(visitor: Visitor): void;
  ensurePanicFleeRoute(visitor: Visitor): void;
  queueVisitorDecision(visitor: Visitor): void;
  runVisitorRouting(visitor: Visitor, kind: 'departure' | 'exit' | 'waste', action: () => void): boolean;
  flushVisitorDecisions(limit?: number): void;
  getCoasterQueueCells(coaster: Coaster): Cell[];
  getCourseQueueCells(course: CourseAttraction): Cell[];
  getAttractionQueueCells(attraction: Attraction): Cell[];
  getBuildingQueueCells(building: PlacedBuilding): Cell[];
  getFacilityQueue(buildingId: string): string[];
  startFacilityInteraction(visitor: Visitor, target: PlacedBuilding): void;
  findPath(start: Cell, goals: Cell[], allowQueue?: boolean, allowCamping?: boolean, allowMedical?: boolean, ignoreDirectionalRestrictions?: boolean, allowFestival?: boolean, maxVisited?: number, allowStaff?: boolean, allowBackstage?: boolean): Cell[] | null;
  getPedestrianNeighbors(cell: Cell, options?: PedestrianNeighborOptions): Cell[];
  ensurePedestrianNav(revalidate: boolean): void;
  isPedestrianSolidAt(x: number, z: number, elevation: number): boolean;
  isPedestrianEdgeBlocked(from: Cell, to: Cell): boolean;
  getDirectionIndex(deltaX: number, deltaZ: number): number;
  getAccessPathNeighbors(access: {
    x: number;
    y: number;
    z: number;
}): Cell[];
  removeVisitorFromCoasterQueues(visitorId: string): void;
  buildQueueExitRoute(from: Cell, queueCells: readonly Cell[]): Cell[];
  leaveQueueOnFoot(visitor: Visitor, thought: string): void;
  getFacilityAccessCells(building: PlacedBuilding): Cell[];
  isVisitorAtShopCounter(visitor: Visitor, building: PlacedBuilding): boolean;
  isWalkableServiceCell(cell: Cell): boolean;
  isAtParkExit(visitor: Visitor): boolean;
  packCell(cell: {
    x: number;
    z: number;
    elevation: number;
}): number;
  occupancyKeyForCell(cell: {
    x: number;
    z: number;
    elevation: number;
}, path: PlacedBuilding | undefined, localX: number, localZ: number): number;
  visitorOccupancyKey(visitor: Visitor): number;
  beginStallQueueReturn(visitor: Visitor, next: {
    x: number;
    z: number;
    elevation: number;
} | undefined): void;
  continueAfterStallQueueReturn(visitor: Visitor): void;
  applyQueueLaneOffset(visitor: Visitor, next: {
    x: number;
    z: number;
    elevation: number;
} | undefined): void;
  isInWorld(x: number, z: number): boolean;
  cellKey(x: number, z: number, elevation: number): string;
  samplePedestrianSurfaceY(x: number, z: number, path: PlacedBuilding | undefined, fallback: number): number;
  recordComplaint(visitor: Visitor, topic: ComplaintTopic): void;
  refundEntryFee(visitor: Visitor): void;
  chargeVisitor(visitor: Visitor, amount: number, position: {
    x: number;
    y: number;
    z: number;
}, category?: FinanceCategory): boolean;
}

/** Applies purchase side-effects after a finished stall/ride interaction. */
function applyPurchaseOutcome(
  visitor: Visitor,
  target: PlacedBuilding | undefined,
  paid: boolean,
  available: boolean,
  holdMascotRoll: () => number,
): void {
  if (target?.kind === 'food' && paid) {
    addItem(visitor.inventory, 'food')
    visitor.thought = 'Ich habe Essen gekauft und suche einen Platz zum Essen.'
    return
  }
  if (target?.kind === 'toilet' && paid) {
    visitor.needs.toilet = SIMULATION_CONFIG.needs.toilet.toilet
    visitor.thought = 'Das war dringend nötig.'
    return
  }
  if (target?.kind === 'ride' && paid) {
    grantAttractionFun(visitor, SIMULATION_CONFIG.needs.ride.funGain)
    visitor.needs.energy = Math.max(
      0,
      visitor.needs.energy - SIMULATION_CONFIG.needs.ride.energyCost,
    )
    visitor.thought = target.rideType === 'bungee' ? 'Was für ein Bungeesprung!' : 'Das Karussell war großartig!'
    visitor.bungeeNude = false
    return
  }
  if (target?.kind === 'alcohol' && paid) {
    addItem(visitor.inventory, 'alcohol')
    visitor.thought = 'Ich habe ein Getränk gekauft und trinke es gleich in Ruhe.'
    return
  }
  if (target?.kind === 'mascot' && paid) {
    visitor.ownedMascot = true
    visitor.heldMascot = holdMascotRoll() < SIMULATION_CONFIG.souvenirs.holdMascotChance
    visitor.needs.fun = Math.min(100, visitor.needs.fun + SIMULATION_CONFIG.souvenirs.funGain)
    visitor.thought = souvenirPurchaseThought('mascot', Boolean(visitor.heldMascot))
    return
  }
  if (target?.kind === 'shirt' && paid) {
    const shirt = defaultShirtSettings()
    visitor.wornShirt = {
      color: normalizeShirtColor(target.shirtColor ?? shirt.color),
      style: normalizeShirtStyle(target.shirtStyle ?? shirt.style),
    }
    visitor.needs.fun = Math.min(100, visitor.needs.fun + SIMULATION_CONFIG.souvenirs.funGain)
    visitor.thought = souvenirPurchaseThought('shirt', false)
    return
  }
  if (target && !paid) {
    visitor.thought = available ? 'Dafür reicht mein Budget nicht.' : 'Ausverkauft! Hier fehlt Nachschub.'
    visitor.emotion = 'sad'
    visitor.emotionMinutes = 45
  }
}

/**
 * Detailed visitor movement, destination, interaction, and needs behavior.
 * Runtime-only caches live here; authoritative data remains in GameSnapshot.
 */
export class VisitorBehaviorService {
  private readonly context: VisitorBehaviorContext
  private concertToplessVisitorId: string | null = null
  private visitorWasteBinTick = -1
  private visitorWasteBinBuildings: PlacedBuilding[] = []
  private occupancyTick = -1
  private activityHeadcount = new Map<string, number>()
  private activitySlotBits = new Map<string, number>()
  private benchHeadcount = new Map<string, number>()
  private benchSlotBits = new Map<string, number>()
  private concertChoiceKey = ''
  private concertChoices:Array<{booking:Booking;band:(typeof BANDS)[number];stage:GameSnapshot['buildings'][number]}>=[]
  private concertSlotTick = -1
  private concertSlots = new Map<number, Set<number>>()
  private concertForecourtByStage = new Map<string, StageForecourtCell[]>()
  private concertForecourtStageIds = new Map<number, string>()
  private concertStagesById = new Map<string, GameSnapshot['buildings'][number]>()
  private danceFloorFocusByStage = new Map<string, { x: number; z: number }>()
  private swimGoalCells: Cell[] | null = null
  private swimGoalRevision = -1
  readonly movementOccupancy = new Map<number, number>()

  constructor(context: VisitorBehaviorContext) {
    this.context = context
  }

  updateVisitors(minutes: number): void {
    // Rebuild once per pass, also repairing older saves with mass events.
    this.concertToplessVisitorId = null
    for (const visitor of this.context.state.visitors) {
      if (visitor.toplessMinutes <= 0) continue
      if (this.concertToplessVisitorId === null) this.concertToplessVisitorId = visitor.id
      else visitor.toplessMinutes = 0
    }
    this.context.flushVisitorDecisions(SIMULATION_CONFIG.pathfinding.decisionsPerTick)
    const leavingIds = new Set<string>()
    const seatedPassengers = collectSeatedPassengerIds(
      this.context.state.logistics.roadVehicles,
    )

    this.context.state.visitors.forEach((visitor) => {
      if (this.context.isVisitorSeatedInVehicle(visitor, seatedPassengers)) return
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
        !this.context.state.parkOpen &&
        visitor.state !== 'riding' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding'
      ) {
        if (visitor.state === 'leaving') {
          this.context.ensureExitRoute(visitor)
        } else if (
          visitor.state !== 'camping' ||
          visitor.campingPhase !== 'packing'
        ) {
          this.context.beginVisitorDeparture(visitor)
        }
      }
      if (visitor.state === 'leaving') {
        this.context.ensureExitRoute(visitor)
      }
      if (visitor.state === 'leaving' && this.context.tryBoardDepartureCar(visitor)) {
        return
      }
      if (
        (visitor.state === 'leaving' || visitor.isPanicking || visitor.state === 'panicking') &&
        !(visitor.state === 'leaving' && ((visitor.campsite && visitor.campingPhase !== 'none') || visitor.pendingWaste > 0)) &&
        this.context.isAtParkExit(visitor) &&
        !this.context.getVisitorArrivalCar(visitor)
      ) {
        leavingIds.add(visitor.id)
        return
      }
      if (visitor.isPanicking || visitor.state === 'panicking') {
        if (visitor.state !== 'leaving') visitor.state = 'panicking'
        if (visitor.route.length === 0) this.context.ensurePanicFleeRoute(visitor)
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
          this.context.medical.releaseBed(this.context.state.medicalCells, visitor.id)
          visitor.medicalCell = null
          visitor.medicalSlot = null
          visitor.thought = 'Mir geht es wieder besser.'
          if (this.context.shouldReturnToArrivalCar(visitor)) {
            visitor.state = 'leaving'
            this.context.ensureExitRoute(visitor)
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
      if (this.context.state.parkOpen && this.context.incidents.updateNausea(visitor, minutes)) {
        const path = this.context.getPathAt(
          visitor.cellX,
          visitor.cellZ,
          visitor.cellElevation,
        )
        if (path) {
          this.context.addGroundIncident('vomit', {
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
      if (this.context.state.parkOpen && this.updateAlcoholBehavior(visitor)) return
      if (this.context.state.parkOpen) this.updateStreaking(visitor, minutes)
      if (
        this.context.state.parkOpen &&
        visitor.campsite &&
        visitor.campingPhase === 'ready' &&
        visitor.needs.energy <=
          SIMULATION_CONFIG.visitors.decisions.exhaustedEnergy &&
        visitor.state !== 'riding' &&
        visitor.state !== 'camping' &&
        visitor.state !== 'bench-resting' &&
        !visitor.concertId &&
        !this.context.visitorSimulation.isAwaiting(visitor.id)
      ) {
        this.context.removeVisitorFromCoasterQueues(visitor.id)
        visitor.targetId = null
        visitor.route = []
        this.decideNextAction(visitor)
      } else if (
        this.context.state.parkOpen &&
        !visitor.campsite &&
        visitor.needs.energy <=
          SIMULATION_CONFIG.visitors.decisions.exhaustedEnergy &&
        visitor.state !== 'riding' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'bench-resting' &&
        !visitor.concertId &&
        !this.context.visitorSimulation.isAwaiting(visitor.id)
      ) {
        this.context.removeVisitorFromCoasterQueues(visitor.id)
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
          if (this.context.camping.assignCampsite(visitor)) {
            visitor.thought =
              'Endlich ist ein Campingplatz frei geworden!'
            return
          }
        }
        if (
          visitor.campingWaitMinutes >=
          SIMULATION_CONFIG.camping.unplacedWaitMaximumMinutes
        ) {
          this.context.refundEntryFee(visitor)
          this.context.recordComplaint(visitor, 'no-campsite')
          this.context.beginVisitorDeparture(visitor)
          visitor.thought =
            'Ich habe einen Tag vergeblich gewartet. Ich verlange mein Geld zurück!'
          return
        }
        visitor.thought = `Ich warte seit ${Math.floor(visitor.campingWaitMinutes / 60)} Stunden auf einen Campingplatz.`
        return
      }

      if (visitor.state === 'camping' && visitor.route.length === 0) {
        if (visitor.campingPhase === 'seeking' || visitor.campingPhase === 'returning') {
          this.context.visitorSimulation.clearAwaiting(visitor.id)
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
              this.context.camping.createCampSetup(visitor)
              visitor.hasHandcart = false
              visitor.state = 'exploring'
              visitor.emotion = 'happy'
              visitor.emotionMinutes = 40
              visitor.thought = 'Mein Zelt steht – jetzt kann das Festival beginnen!'
              this.decideNextAction(visitor)
            } else {
              this.context.camping.removeVisitorInstallations(visitor.id)
              visitor.campsite = null
              visitor.campingPhase = 'none'
              visitor.hasHandcart = true
              if (this.context.rng.next() < SIMULATION_CONFIG.waste.tentPackLitterChance) {
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
              this.context.ensureExitRoute(visitor)
            }
          }
          return
        }
        if (visitor.campingPhase === 'resting') {
          this.consumeWhileStationary(visitor, minutes)
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

      if (visitor.state === 'swimming' && visitor.route.length === 0) {
        visitor.interactionRemaining -= minutes
        const consumed = this.consumeWhileStationary(visitor, minutes)
        if (visitor.pendingWaste > 0 && visitor.route.length > 0) return
        visitor.needs.fun = Math.min(
          100,
          visitor.needs.fun + minutes * SIMULATION_CONFIG.terrain.swimFunPerMinute,
        )
        visitor.emotion = 'happy'
        visitor.emotionMinutes = Math.max(visitor.emotionMinutes, 10)
        if (!consumed) {
          visitor.thought = 'Das Wasser ist herrlich. Ich bleibe noch ein bisschen.'
        }
        if (
          visitor.interactionRemaining <= 0 ||
          visitor.needs.energy <
            SIMULATION_CONFIG.visitors.decisions.lowEnergy ||
          !this.context.isSwimmableTerrain(visitor.cellX, visitor.cellZ)
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
        const facility = visitor.targetId ? this.context.state.buildings.find(b => b.id === visitor.targetId) : null
        visitor.interactionRemaining -= minutes * (facility ? buildingEfficiency(this.context.state, facility.x, facility.z) : 1)
        if (visitor.interactionRemaining <= 0) this.finishInteraction(visitor)
        return
      }
      if (visitor.state === 'bus-waiting') {
        visitor.busWaitMinutes += minutes
        if (
          visitor.busWaitMinutes >=
          SIMULATION_CONFIG.logistics.busMaximumWaitMinutes
        ) {
          this.context.recordComplaint(visitor, 'bus-wait')
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
        this.context.tryBoardDepartureCar(visitor)
      ) {
        return
      }
      if (
        (visitor.state === 'leaving' || visitor.isPanicking || visitor.state === 'panicking') &&
        this.context.isAtParkExit(visitor) &&
        !this.context.getVisitorArrivalCar(visitor)
      ) {
        if (!(visitor.state === 'leaving' && ((visitor.campsite && visitor.campingPhase !== 'none') || visitor.pendingWaste > 0))) {
          leavingIds.add(visitor.id)
        }
      } else if (visitor.targetId) {
        this.arriveOrDecide(visitor)
      } else {
        this.context.queueVisitorDecision(visitor)
      }
    })

    if (leavingIds.size > 0) {
      this.context.state.visitors.forEach((visitor) => {
        if (leavingIds.has(visitor.id)) this.context.leaveVisitorCampBehind(visitor)
      })
      this.context.state.visitors = this.context.state.visitors.filter((visitor) => !leavingIds.has(visitor.id))
      this.context.indexedVisitorCount = -1
      this.context.state.guests = this.context.state.visitors.length
      this.context.state.logistics.arrivalGroups.forEach((group) => {
        this.context.normalizeCarManifest(group)
      })
    }
  }

  visitorTravelSpeed(visitor: Visitor): number {
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
      ((this.context.isWaterTerrain(visitor.cellX, visitor.cellZ) ||
        isCourseSwimCell(this.context.state.courses, visitor.cellX, visitor.cellZ)) &&
      !this.context.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)
        ? SIMULATION_CONFIG.terrain.swimMoveMultiplier
        : this.context.isMudTerrain(visitor.cellX, visitor.cellZ)
          ? SIMULATION_CONFIG.terrain.mudMoveMultiplier
          : 1)
    const ground = wayInfo(this.context.state, visitor.cellX, visitor.cellZ, 'foot', this.context.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)?.wayType)
    const surface = visitor.cellElevation > this.context.getTerrainHeight(visitor.cellX, visitor.cellZ) ? 1 : ground.speed
    const returningOnStallQueue = this.context.stallQueueReturnIds.has(visitor.id)
    const crowdSlowdown = returningOnStallQueue
      ? 1
      : visitor.isPanicking
        ? 1 + Math.max(0, visitor.crowding - 50) / 90
        : 1 + Math.max(0, visitor.crowding - 35) / 55
    return visitor.walkSpeed * speedMultiplier * (visitor.isPanicking ? SIMULATION_CONFIG.crowding.panicFleeBoost : 1) * surface / crowdSlowdown
  }

  refreshPedestrianCongestion(): void {
    const costs = new Map<number, number>()
    const visited = new Set<number>()
    const consider = (x: number, z: number, elevation: number): void => {
      const key = this.context.packCell({ x, z, elevation })
      if (visited.has(key)) return
      visited.add(key)
      const count = this.movementOccupancy.get(key) ?? 0
      const capacity = wayInfo(this.context.state, x, z, 'foot', this.context.getPathAt(x, z, elevation)?.wayType).capacity
      const density = count / capacity
      const penalty = Math.min(24, Math.floor(7 * Math.pow(Math.max(0, density - 0.5) * 2, 2)))
      if (penalty > 0) costs.set(key, penalty)
    }
    for (const visitor of this.context.state.visitors) {
      consider(visitor.cellX, visitor.cellZ, visitor.cellElevation)
    }
    for (const route of this.context.state.festival.infrastructure.routes) {
      consider(route.position.x, route.position.z, route.position.elevation)
    }
    this.context.pedestrianNavigation.setCongestionCosts(costs)
  }

  reviewVisitorRoutes(): void {
    const visitors = this.context.state.visitors
    const period = Math.max(100, Math.ceil(visitors.length / 4))
    const first = (this.context.state.simTick % period) * 4
    for (let index = first; index < Math.min(first + 4, visitors.length); index++) {
      const visitor = visitors[index]!
      if (this.context.stallQueueReturnIds.has(visitor.id)) continue
      if (visitor.route.length < 3 || ['security-check', 'vomiting', 'using', 'queuing', 'riding', 'bus-riding', 'vehicle-arrival', 'injured'].includes(visitor.state)) continue
      const next = visitor.route[0]!
      const goal = visitor.route.at(-1)!
      const atCellCenter = Math.hypot(visitor.x - visitor.cellX - visitor.tileOffsetX, visitor.z - visitor.cellZ - visitor.tileOffsetZ) < 0.001
      const start = atCellCenter ? { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation } : next
      this.context.ensurePedestrianNav(this.context.lastNavRevision !== this.context.worldRevision)
      let access = 0, allowQueue = false
      for (const cell of visitor.route) {
        access |= this.context.pedestrianNavigation.flagsAt(cell)
        if (!allowQueue) allowQueue = this.context.getPathAt(cell.x, cell.z, cell.elevation)?.pathType === 'queue'
      }
      // Reuse indexed navigation flags rather than searching every area four times per route.
      const route = this.context.findPath(start, [goal],
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

  walkVisitors(minutes: number): void {
    if (minutes <= 0) return
    this.movementOccupancy.clear()
    const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
    for (const v of this.context.state.visitors) {
      if (
        this.context.isVisitorSeatedInVehicle(v, seated) ||
        v.state === 'riding'
      ) {
        continue
      }
      const key = this.context.visitorOccupancyKey(v)
      this.movementOccupancy.set(key, (this.movementOccupancy.get(key) ?? 0) + 1)
    }
    for (const route of this.context.state.festival.infrastructure.routes) {
      if (route.phase === 'idle' && !route.path.length) continue
      const key = this.context.packCell(route.position)
      this.movementOccupancy.set(key, (this.movementOccupancy.get(key) ?? 0) + (route.cargo > 0 ? 3 : 2))
    }
    // Occupancy for movement stays live; route costs update once per simulated second.
    // Keep the shared A* cache useful between updates instead of flushing every step.
    if (this.context.state.simTick % 10 === 0) this.refreshPedestrianCongestion()
    this.reviewVisitorRoutes()
    this.context.state.visitors.forEach((visitor) => {
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

  moveVisitor(
    visitor: Visitor,
    distance: number,
    decideOnArrival = true,
  ): void {
    while (distance > 0 && visitor.route.length > 0) {
      const next = visitor.route[0]
      const oldKey = this.context.visitorOccupancyKey(visitor)
      const nextPath = this.context.getPathAt(next.x, next.z, next.elevation)
      this.context.applyQueueLaneOffset(visitor, next)
      const nextKey = this.context.occupancyKeyForCell(next, nextPath, visitor.tileOffsetX, visitor.tileOffsetZ)
      const capacity = wayInfo(this.context.state, next.x, next.z, 'foot', nextPath?.wayType).capacity
      const density = Math.max(0, (this.movementOccupancy.get(nextKey) ?? 0) - (nextKey === oldKey ? 1 : 0)) / capacity
      // Destination occupancy controls flow: leaving a packed tile for a free one must stay easy.
      // At capacity retain 12.5% speed, and at least 4% even in extreme crowds.
      // Stall return lanes keep normal walking speed — only the inbound wait lane crawls.
      const returningOnStallQueue = this.context.stallQueueReturnIds.has(visitor.id)
      const crowdSpeed = returningOnStallQueue
        ? 1
        : Math.max(0.04, 1 / (1 + 7 * Math.pow(Math.max(0, density - 0.5) * 2, 2)))
      if (!returningOnStallQueue && density >= 1) visitor.thought = 'Hier ist es eng – ich komme nur langsam voran.'
      const nextCampingCell = this.context.getCampingCellAt(next.x, next.z)
      const nextMedicalCell = this.context.getMedicalCellAt(next.x, next.z)
      const nextFestivalCell = this.context.getStageForecourtCellAt(next.x, next.z)
      const currentCell = {
        x: visitor.cellX,
        z: visitor.cellZ,
        elevation: visitor.cellElevation,
      }
      const travel = this.context.getDirectionIndex(next.x - currentCell.x, next.z - currentCell.z)
      const currentPath = this.context.getPathAt(currentCell.x, currentCell.z, currentCell.elevation)
      if (
        (travel >= 0 &&
          staffGateBlocksVisitor(currentPath, nextPath, travel as Direction)) ||
        !this.context.isInWorld(next.x, next.z) ||
        this.context.isPedestrianSolidAt(next.x, next.z, next.elevation) ||
        this.context.isPedestrianEdgeBlocked(currentCell, next)
      ) {
        this.context.removeVisitorFromCoasterQueues(visitor.id)
        visitor.route = []
        visitor.targetId = null
        visitor.state = 'exploring'
        visitor.thought = 'Der Weg ist versperrt.'
        return
      }

      const targetX = next.x + visitor.tileOffsetX
      const targetZ = next.z + visitor.tileOffsetZ
      const fallbackY =
        nextCampingCell?.elevation ??
        nextMedicalCell?.elevation ??
        nextFestivalCell?.elevation ??
        next.elevation
      const deltaX = targetX - visitor.x
      const deltaZ = targetZ - visitor.z
      const remaining = Math.hypot(deltaX, deltaZ)
      visitor.facing = Math.atan2(deltaX, deltaZ)

      if (remaining <= distance * crowdSpeed) {
        visitor.x = targetX
        visitor.z = targetZ
        visitor.y = this.context.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          nextPath,
          fallbackY,
        )
        if (nextKey !== oldKey) {
          this.movementOccupancy.set(oldKey, Math.max(0, (this.movementOccupancy.get(oldKey) ?? 0) - 1))
          this.movementOccupancy.set(nextKey, (this.movementOccupancy.get(nextKey) ?? 0) + 1)
        }
        visitor.cellX = next.x
        visitor.cellZ = next.z
        visitor.cellElevation = next.elevation
        const atmosphereKey = this.context.cellKey(next.x, next.z, next.elevation)
        visitor.localAttractiveness =
          this.context.attractivenessValues.get(atmosphereKey) ?? 0
        visitor.localPartyMood =
          this.context.partyMoodValues.get(atmosphereKey) ?? 0
        visitor.route.shift()
        distance -= remaining / crowdSpeed
        this.applyCampWalkPenalty(visitor, remaining)
        const gate = this.context.getSecurityGateAt(next.x, next.z, next.elevation)
        if (!gate) visitor.securityGateId = null
        const staffed =
          gate &&
          this.context.state.staff.some(
            (member) =>
              member.role === 'security' && member.assignedBuildingId === gate.id,
          )
        if (gate && staffed && visitor.securityGateId !== gate.id) {
          const inspection = this.context.security.inspect(
            visitor.inventory,
            gate.securityConfig ?? DEFAULT_SECURITY_CONFIG,
            this.context.rng,
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
            this.context.recordComplaint(visitor, 'security-confiscation')
          }
          return
        }
      } else {
        distance *= crowdSpeed
        visitor.x += (deltaX / remaining) * distance
        visitor.z += (deltaZ / remaining) * distance
        const steppedX = Math.floor(visitor.x)
        const steppedZ = Math.floor(visitor.z)
        const onNext = steppedX === next.x && steppedZ === next.z
        visitor.y = this.context.samplePedestrianSurfaceY(
          visitor.x,
          visitor.z,
          onNext ? nextPath : currentPath ?? nextPath,
          onNext ? fallbackY : visitor.cellElevation,
        )
        this.applyCampWalkPenalty(visitor, distance)
        distance = 0
      }
    }

    if (visitor.route.length === 0) {
      if (this.context.stallQueueReturnIds.has(visitor.id)) {
        this.context.continueAfterStallQueueReturn(visitor)
        return
      }
      if (decideOnArrival) this.arriveOrDecide(visitor)
    }
  }

  applyCampWalkPenalty(visitor: Visitor, distance: number): void {
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
      this.context.recordComplaint(visitor, 'long-walk-to-camp')
    }
  }

  arriveOrDecide(visitor: Visitor): void {
    if (this.context.visitorSimulation.isAwaiting(visitor.id)) return
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
      visitor.state === 'relaxing' ||
      visitor.state === 'swimming'
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
      const target = this.context.state.buildings.find((building) => building.id === visitor.targetId)
      if (target && (isWasteBin(target.kind) || isSealedWasteContainer(target.kind))) {
        this.depositPendingWaste(visitor, target.id)
        visitor.targetId = null
        if (visitor.campingPhase === 'none' && visitor.hasHandcart) {
          visitor.state = 'leaving'
          visitor.route = []
          this.context.ensureExitRoute(visitor)
          return
        }
        visitor.state = 'exploring'
        this.decideNextAction(visitor)
        return
      }
      if (target) {
        if (!this.context.isBuildingCurrentlyActive(target)) {
          visitor.targetId = null
          visitor.state = 'exploring'
          visitor.thought = 'Dieses Angebot hat inzwischen geschlossen.'
          this.decideNextAction(visitor)
          return
        }
        if (this.context.getBuildingQueueCells(target).length > 0) {
          const queue = this.context.getFacilityQueue(target.id)
          if (!queue.includes(visitor.id)) queue.push(visitor.id)
          visitor.state = 'queuing'
          visitor.interactionRemaining = 0
          visitor.thought = `Ich stehe bei ${BUILDINGS[target.kind].name} an.`
          return
        }
        this.context.startFacilityInteraction(visitor, target)
        return
      }
      const coaster = this.context.getCoaster(visitor.targetId)
      if (
        coaster?.closed &&
        coaster.operationMode === 'open' &&
        this.context.isOfferCurrentlyActive('rides') &&
        coaster.entrance &&
        coaster.exit
      ) {
        const queueCapacity = this.context.getCoasterQueueCapacity(coaster.id)
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
      const course = (this.context.state.courses ?? []).find((entry) => entry.id === visitor.targetId)
      if (course?.operating) {
        if (!course.queue.includes(visitor.id)) course.queue.push(visitor.id)
        visitor.state = 'queuing'
        visitor.thought = `Ich warte bei ${course.name}.`
        return
      }
    }
    this.decideNextAction(visitor)
  }

  decideNextAction(visitor: Visitor): void {
    this.context.visitorSimulation.decideNext(visitor)
  }

  chooseNextVisitorAction(visitor: Visitor): void {
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
      this.context.ensurePanicFleeRoute(visitor)
      return
    }
    if (
      visitor.concertId &&
      this.availableConcerts().some((show) => show.booking.id === visitor.concertId)
    ) {
      visitor.state = 'partying'
      return
    }
    if (!this.context.state.parkOpen || visitor.motivation <= 0) {
      this.context.beginVisitorDeparture(visitor)
      return
    }
    const festivalPhase = getFestivalCycleStatus(
      this.context.state.dayPlan,
      this.context.state.day,
    )
    if (festivalPhase.phase === 'break') {
      this.context.beginVisitorDeparture(visitor)
      visitor.thought = 'Das Festival ist beendet. Ich reise ab.'
      return
    }
    if (
      visitor.ticketType === 'day' &&
      (festivalPhase.phase !== 'festival' ||
        !isDayVisitorAdmissionOpen(this.context.state.dayPlan, this.context.state.minute))
    ) {
      this.context.beginVisitorDeparture(visitor)
      visitor.thought =
        'Meine Zeit als Tagesgast ist vorbei. Ich gehe nach Hause.'
      return
    }
    // Resume unfinished setup in saves made while camping arrivals were misrouted.
    if (visitor.campsite && visitor.campingPhase === 'seeking') {
      const route = this.context.camping.findRouteToCampsite(visitor, visitor.campsite)
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
      const route = this.context.camping.findRouteToCampsite(
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
      this.context.beginVisitorDeparture(visitor)
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
        const route = this.context.camping.findRouteToCampsite(visitor, visitor.campsite)
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
      const route = this.context.findPath(
        { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
        [this.context.getEntrance()],
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
      if (!visitor.ownedMascot && this.context.state.buildings.some((building) => building.kind === 'mascot')) {
        desiredKinds.push('mascot')
      }
      if (!visitor.wornShirt && this.context.state.buildings.some((building) => building.kind === 'shirt')) {
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
        const attractionDestination = this.findReachableAttraction(visitor)
        if (attractionDestination) {
          if (!attractionDestination.attraction.queue.includes(visitor.id)) {
            attractionDestination.attraction.queue.push(visitor.id)
          }
          visitor.state = 'seeking'
          visitor.targetId = attractionDestination.attraction.id
          visitor.route = attractionDestination.route
          visitor.thought = `Ich möchte ${attractionDestination.attraction.name} ausprobieren!`
          return
        }
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
        const courseDestination = this.findReachableCourse(visitor)
        if (courseDestination) {
          if (!courseDestination.course.queue.includes(visitor.id)) {
            courseDestination.course.queue.push(visitor.id)
          }
          visitor.state = 'seeking'
          visitor.targetId = courseDestination.course.id
          visitor.route = courseDestination.route
          visitor.thought = `Ich möchte ${courseDestination.course.name} ausprobieren!`
          return
        }
        const fullCoaster = this.context.state.coasters.find((coaster) => {
          const capacity = this.context.getCoasterQueueCapacity(coaster.id)
          return (
            coaster.operationMode === 'open' &&
            this.context.isOfferCurrentlyActive('rides') &&
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
        if (this.context.getBuildingQueueCells(destination.building).length > 0) {
          const queue = this.context.getFacilityQueue(destination.building.id)
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
      const gathering = this.context.camping.findRouteToGathering(visitor)
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
          this.context.rng.next() * decisions.socializingMinutesRandomRange
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

    if (
      !urgentNeed &&
      visitor.needs.fun < decisions.seekFunBelow
    ) {
      const swim = this.findSwimDestination(visitor)
      if (swim) {
        visitor.state = 'swimming'
        visitor.targetId = null
        visitor.route = swim.route
        visitor.activityTarget = swim.cell
        visitor.activitySlot = swim.slot
        visitor.activityCapacity = swim.capacity
        this.adjustVisitorOccupancy(visitor, 1)
        visitor.interactionRemaining =
          SIMULATION_CONFIG.terrain.swimDurationMinimum +
          this.context.rng.next() * SIMULATION_CONFIG.terrain.swimDurationRandomRange
        visitor.isDancing = false
        visitor.thought =
          swim.route.length > 1
            ? 'Ich gehe baden – das wird Spaß machen.'
            : 'Ich springe ins Wasser.'
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
          this.context.rng.next() *
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

  tryBeginBusJourney(
    visitor: Visitor,
    destination: Cell,
    directRoute?: readonly Cell[],
  ): boolean {
    const routeToDestination =
      directRoute ??
      this.context.findPath(
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
      this.context.state.logistics.busLines.length === 0
    ) {
      return false
    }
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const choices = this.context.state.logistics.busLines
      .filter(
        (line) =>
          line.active &&
          line.stopIds.length >= 2 &&
          line.busIds.some((busId) =>
            this.context.state.logistics.roadVehicles.some(
              (vehicle) => vehicle.id === busId && vehicle.kind === 'bus',
            ),
          ),
      )
      .flatMap((line) =>
        line.stopIds.flatMap((stopId, boardingIndex) => {
          const stop = this.context.state.logistics.busStops.find(
            (candidate) => candidate.id === stopId,
          )
          if (!stop) return []
          const route = this.context.findPath(start, [
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
            const destinationStop = this.context.state.logistics.busStops.find(
              (candidate) => candidate.id === destinationStopId,
            )
            if (!destinationStop) return []
            const finalRoute = this.context.findPath(
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

  beginPartyVisit(
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
    const partyKey = this.context.cellKey(
      party.cell.x,
      party.cell.z,
      party.cell.elevation,
    )
    if (party.route.length === 0) {
      visitor.localAttractiveness =
        this.context.attractivenessValues.get(partyKey) ?? 0
      visitor.localPartyMood = this.context.partyMoodValues.get(partyKey) ?? 0
    }
    visitor.interactionRemaining =
      SIMULATION_CONFIG.atmosphere.partyDurationMinimum +
      this.context.rng.next() * SIMULATION_CONFIG.atmosphere.partyDurationRandomRange
    visitor.isDancing = false
    visitor.isConversing = false
    visitor.thought = party.forecourt
      ? 'Ich gehe zum Bühnenvorplatz!'
      : 'Dort scheint gute Stimmung zu sein!'
    this.tryBeginBusJourney(visitor, party.cell, visitor.route)
  }

  routeThroughFestivalEntrance(
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
    const gates = this.context.state.buildings
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
            Boolean(this.context.getPathAt(gate.x, gate.z, gate.elevation)),
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
    const toGate = this.context.findPath(start, [gateCell], true)
    const fromGate = this.context.findPath(
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

  availableConcerts(){
    const key=`${this.context.state.simTick}:${this.context.worldRevision}:${this.context.state.day}:${this.context.state.minute}`
    if(key!==this.concertChoiceKey){
      this.concertChoiceKey=key
      this.concertChoices=watchableBookings(this.context.state)
        .filter(b=>!showIssue(this.context.state,b,Math.max(this.context.state.minute,b.start)))
        .map(booking=>({booking,band:BANDS.find(b=>b.id===booking.bandId)!,stage:this.context.state.buildings.find(b=>b.id===booking.stageId)!}))
    }
    return this.concertChoices
  }

  avoidsConcertAt(visitor:Visitor,cell:{x:number;z:number}){
    if(!this.context.state.festival.enabled)return false
    const nearby=this.availableConcerts().filter(show=>stageDistance(show.stage,cell)<=8)
    if(!nearby.length)return false
    visitor.musicTaste??=musicTaste(visitor.id,this.context.state.festival)
    return !nearby.some(show=>musicAppeal(visitor.musicTaste!,show.band.id)>=.3)
  }

  visitorShouldDance(visitor: Visitor): boolean {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const onDanceFloor = Boolean(
      visitor.concertId ||
        this.context.getStageForecourtCellAt(visitor.cellX, visitor.cellZ),
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

  stageFocusPoint(stage: {
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

  visitorDanceAngle(visitor: Visitor, stageId: string): number {
    return ((((hashStringSeed(visitor.id) ^ hashStringSeed(stageId)) >>> 8) & 1023) / 1024) * Math.PI * 2
  }

  angularDelta(
    cell: { x: number; z: number },
    focus: { x: number; z: number },
    want: number,
  ): number {
    const angle = Math.atan2(cell.z - focus.z, cell.x - focus.x)
    return Math.abs(Math.atan2(Math.sin(angle - want), Math.cos(angle - want)))
  }

  ensureDanceFloorIndex(): void {
    if (this.concertSlotTick === this.context.state.simTick) return
    this.concertSlotTick = this.context.state.simTick
    this.concertSlots.clear()
    this.concertForecourtByStage.clear()
    this.concertForecourtStageIds.clear()
    this.concertStagesById.clear()
    this.danceFloorFocusByStage.clear()
    for (const guest of this.context.state.visitors) {
      if (!guest.activityTarget || !['partying', 'relaxing'].includes(guest.state)) continue
      const key = this.context.packCell(guest.activityTarget)
      const slots = this.concertSlots.get(key) ?? new Set<number>()
      slots.add(guest.activitySlot)
      this.concertSlots.set(key, slots)
    }
    const stages = this.context.state.buildings.filter((building) => building.kind === 'stage')
    for (const stage of stages) {
      this.concertStagesById.set(stage.id, stage)
      this.danceFloorFocusByStage.set(stage.id, this.stageFocusPoint(stage))
    }
    for (const cell of this.context.state.stageForecourtCells) {
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
      if (nearest) this.concertForecourtStageIds.set(this.context.packCell(cell), nearest.id)
    }
  }

  tryVisitConcert(visitor: Visitor): boolean {
    if (!this.context.state.festival.enabled) return false
    this.ensureDanceFloorIndex()
    visitor.musicTaste??=musicTaste(visitor.id,this.context.state.festival)
    const shows = this.availableConcerts()
      .filter(show=>musicAppeal(visitor.musicTaste!,show.band.id)>=.3)
      .sort((a,b)=> (musicAppeal(visitor.musicTaste!,b.band.id)*120+b.band.draw*.25-stageDistance(b.stage,visitor)*.5)-(musicAppeal(visitor.musicTaste!,a.band.id)*120+a.band.draw*.25-stageDistance(a.stage,visitor)*.5))
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const capacity = atmosphere.forecourtCapacityPerCell
    const slotOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7]
    for (const show of shows.slice(0, 2)) {
      if (visitor.audience === 'family' && this.context.state.minute >= 21 * 60) continue
      if (this.tryReserveConcertForecourt(visitor, show, capacity, slotOrder)) return true
    }
    return false
  }

  tryReserveConcertForecourt(
    visitor: Visitor,
    show: { booking: Booking; band: (typeof BANDS)[number]; stage: GameSnapshot['buildings'][number] },
    capacity: number,
    slotOrder: number[],
  ): boolean {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const cells = this.concertForecourtByStage.get(show.stage.id) ?? []
    const open = cells.filter((cell) => (this.concertSlots.get(this.context.packCell(cell))?.size ?? 0) < capacity)
    if (!open.length) return false
    const focus = this.danceFloorFocusByStage.get(show.stage.id) ?? this.stageFocusPoint(show.stage)
    const want = this.visitorDanceAngle(visitor, show.stage.id)
    const ranked = open
      .map((cell) => {
        const used = this.concertSlots.get(this.context.packCell(cell))?.size ?? 0
        const front = stageFrontRank(show.stage, cell)
        const distance = Math.abs(cell.x - visitor.cellX) + Math.abs(cell.z - visitor.cellZ)
        return {
          cell,
          row: front.row,
          score:
            front.row * 1000 +
            used * 24 +
            front.lateral * 2 +
            distance * 0.15 +
            this.angularDelta(cell, focus, want) * 0.4,
        }
      })
      .sort((left, right) => left.score - right.score)
    let cursor = 0
    let attempts = 0
    while (cursor < ranked.length && attempts < atmosphere.concertFrontGoalAttempts) {
      const row = ranked[cursor]!.row
      let end = cursor + 1
      while (end < ranked.length && ranked[end]!.row === row) end++
      const goals = ranked.slice(cursor, end).slice(0, atmosphere.concertSpreadGoals).map((entry) => entry.cell)
      cursor = end
      attempts++
      const reserved = this.reserveConcertGoals(visitor, show, goals, capacity, slotOrder)
      if (reserved) return true
    }
    return false
  }

  reserveConcertGoals(
    visitor: Visitor,
    show: { booking: Booking; band: (typeof BANDS)[number] },
    goals: StageForecourtCell[],
    capacity: number,
    slotOrder: number[],
  ): boolean {
    if (!goals.length) return false
    const route = this.context.findPath(
      { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
      goals,
      true,
      true,
      false,
      false,
      true,
    )
    if (!route) return false
    const end = route.at(-1) ?? goals[0]!
    const cell =
      goals.find(
        (goal) =>
          goal.x === end.x &&
          goal.z === end.z &&
          Math.abs(goal.elevation - end.elevation) < 0.01,
      ) ?? goals[0]!
    const key = this.context.packCell(cell)
    const used = this.concertSlots.get(key) ?? new Set<number>()
    const slot = slotOrder.find((n) => !used.has(n))
    if (slot === undefined) return false
    used.add(slot)
    this.concertSlots.set(key, used)
    this.beginPartyVisit(visitor, { cell, route, slot, capacity, forecourt: true })
    visitor.concertId = show.booking.id
    visitor.interactionRemaining = show.booking.start + show.booking.duration - this.context.state.minute
    visitor.thought = this.context.state.minute < show.booking.start
      ? `Ich gehe schon zu ${show.band.name}, damit ich den Anfang nicht verpasse.`
      : `Ich möchte ${show.band.name} sehen!`
    return true
  }

  updateConcertAttendance(
    visitor: Visitor,
    minutes: number,
    concert: { booking: Booking; band: (typeof BANDS)[number] },
    consumed: boolean,
  ): void {
    visitor.interactionRemaining = Math.max(
      visitor.interactionRemaining,
      concert.booking.start + concert.booking.duration - this.context.state.minute,
    )
    if (this.context.state.minute < concert.booking.start) {
      visitor.toplessMinutes = 0
      if (!consumed) visitor.thought = `Ich warte auf ${concert.band.name}.`
      return
    }
    visitor.motivation = Math.min(
      100,
      visitor.motivation +
        minutes *
          SIMULATION_CONFIG.atmosphere.concertMotivationPerMinute *
          this.context.showQualityForStage(concert.booking.stageId),
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

  updateConcertTopless(
    visitor: Visitor,
    minutes: number,
    concert: { booking: Booking },
  ): void {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const remaining = concert.booking.start + concert.booking.duration - this.context.state.minute
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
    if (this.context.rng.next() >= Math.min(1, minutes * atmosphere.concertToplessChancePerMinute / Math.max(1, this.context.state.visitors.length))) return
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

  spreadConcertToplessFun(source: Visitor, minutes: number): void {
    const atmosphere = SIMULATION_CONFIG.atmosphere
    const radius = atmosphere.concertToplessRadius
    this.context.state.visitors.forEach((other) => {
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

  giveWaste(visitor: Visitor, amount: number): void {
    if (amount <= 0) return
    visitor.pendingWaste = (visitor.pendingWaste ?? 0) + amount
    this.tryDisposeWaste(visitor)
  }

  listVisitorWasteBins(): VisitorWasteTarget[] {
    if (this.visitorWasteBinTick !== this.context.state.simTick) {
      this.visitorWasteBinTick = this.context.state.simTick
      this.visitorWasteBinBuildings = this.context.state.buildings.filter(
        (building) =>
          isWasteBin(building.kind) || isSealedWasteContainer(building.kind),
      )
    }
    return this.visitorWasteBinBuildings.map((building) => {
      const sealed = isSealedWasteContainer(building.kind)
      return {
        id: building.id,
        x: building.x,
        z: building.z,
        elevation: building.elevation,
        stored: building.wasteFill ?? 0,
        kind: sealed ? 'sealed' as const : 'bin' as const,
        capacity: sealed
          ? SIMULATION_CONFIG.waste.sealedContainerCapacity
          : SIMULATION_CONFIG.waste.binCapacity,
      }
    })
  }

  discardWasteIfCannotUseBin(visitor: Visitor): boolean {
    if ((visitor.pendingWaste ?? 0) <= 0) return false
    if (
      visitor.state === 'vehicle-arrival' ||
      visitor.state === 'bus-riding' ||
      visitor.state === 'riding' ||
      visitor.state === 'medical' ||
      visitor.state === 'medical-transport' ||
      collectSeatedPassengerIds(this.context.state.logistics.roadVehicles).has(
        visitor.id,
      )
    ) {
      return false
    }
    const config = SIMULATION_CONFIG.waste
    const from = { x: visitor.cellX, z: visitor.cellZ }
    const bins = this.listVisitorWasteBins()
    const nearest = findNearestVisitorWasteTarget(from, bins, false)
    const target = visitor.targetId
      ? bins.find((bin) => bin.id === visitor.targetId)
      : undefined
    const nearestFull =
      Boolean(nearest) && !wasteBinHasRoom(nearest!, nearest!.capacity)
    const targetFull =
      Boolean(target) && !wasteBinHasRoom(target!, target!.capacity)
    if (!nearest || (config.visitorDropIfBinFull && (nearestFull || targetFull))) {
      this.dropPendingWaste(visitor)
      return true
    }
    return false
  }

  tryDisposeWaste(visitor: Visitor): void {
    if (this.discardWasteIfCannotUseBin(visitor)) return
    if ((visitor.pendingWaste ?? 0) <= 0) return
    const from = { x: visitor.cellX, z: visitor.cellZ }
    const bin = findNearestVisitorWasteTarget(from, this.listVisitorWasteBins())
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
    this.context.runVisitorRouting(visitor, 'waste', () =>
      this.routeVisitorToWasteBin(visitor, bin),
    )
  }

  routeVisitorToWasteBin(visitor: Visitor, bin: { id: string; x: number; z: number; elevation: number }): void {
    const route = this.context.findPath(
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
    visitor.thought =
      this.listVisitorWasteBins().find((entry) => entry.id === bin.id)?.kind === 'sealed'
        ? 'Ich gehe zum verschlossenen Mülleimer.'
        : 'Ich gehe zum Mülleimer.'
  }

  depositPendingWaste(visitor: Visitor, binId: string): void {
    const bin = this.context.state.buildings.find(
      (building) =>
        building.id === binId &&
        (isWasteBin(building.kind) || isSealedWasteContainer(building.kind)),
    )
    if (!bin) {
      this.dropPendingWaste(visitor)
      return
    }
    const capacity = isSealedWasteContainer(bin.kind)
      ? SIMULATION_CONFIG.waste.sealedContainerCapacity
      : SIMULATION_CONFIG.waste.binCapacity
    const room = Math.max(0, capacity - (bin.wasteFill ?? 0))
    const stored = Math.min(visitor.pendingWaste, room)
    bin.wasteFill = (bin.wasteFill ?? 0) + stored
    visitor.pendingWaste -= stored
    visitor.thought =
      stored > 0
        ? 'Ich werfe den Müll in den Eimer.'
        : 'Der Mülleimer ist voll.'
    if (visitor.pendingWaste > 0) this.dropPendingWaste(visitor)
  }

  dropPendingWaste(visitor: Visitor): void {
    if (visitor.pendingWaste <= 0) return
    // Rubbish is only ever put down where it may lie: a footpath, the camping field,
    // the forecourt, the medical area. Standing anywhere else — a road, bare ground,
    // a building's own tile — the visitor carries it off the site instead.
    const cell = this.findLitterDropCell(visitor)
    if (cell) this.context.addGroundIncident('litter', cell, visitor.pendingWaste)
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
    visitor.thought = cell
      ? 'Hier liegt jetzt mein Müll. Ein Eimer wäre besser gewesen.'
      : 'Hier kann ich den Müll nicht lassen, ich nehme ihn mit.'
  }

  findLitterDropCell(visitor: Visitor): {
    x: number
    z: number
    elevation: number
  } | null {
    const here = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    if (this.canDropLitterAt(here)) return here
    const neighbor = this.context.getPedestrianNeighbors(here, {
      allowCamping: Boolean(this.context.getCampingCellAt(here.x, here.z)),
      allowMedical: Boolean(this.context.getMedicalCellAt(here.x, here.z)),
      allowFestival: Boolean(this.context.getStageForecourtCellAt(here.x, here.z)),
      allowQueue:
        this.context.getPathAt(here.x, here.z, here.elevation)?.pathType === 'queue',
    })[0]
    return neighbor && this.canDropLitterAt(neighbor) ? neighbor : null
  }

  canDropLitterAt(cell: {
    x: number
    z: number
    elevation: number
  }): boolean {
    return Boolean(
      this.context.getPathAt(cell.x, cell.z, cell.elevation) ||
        this.context.getCampingCellAt(cell.x, cell.z) ||
        this.context.getStageForecourtCellAt(cell.x, cell.z) ||
        this.context.getMedicalCellAt(cell.x, cell.z),
    )
  }

  beginStationaryBreak(visitor: Visitor, thought: string): void {
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

  consumeWhileStationary(
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
        this.context.rng.next() * config.cooldownRandomMinutes
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
      this.context.incidents.addDrinkNausea(visitor)
      visitor.consumptionCooldown =
        config.cooldownMinimumMinutes +
        this.context.rng.next() * config.cooldownRandomMinutes
      visitor.thought = 'Ich bleibe hier und trinke mein Getränk.'
      this.giveWaste(visitor, 1)
      return true
    }
    return false
  }

  createPreferredSleepRhythm(): {
    preferredBedtime: number
    preferredWakeTime: number
  } {
    const rhythm = sampleFestivalSleepRhythm(
      this.context.rng.next(),
      this.context.rng.next(),
      SIMULATION_CONFIG.camping.sleepSchedule,
      SIMULATION_CONFIG.time.minutesPerDay,
    )
    return {
      preferredBedtime: rhythm.bedtime,
      preferredWakeTime: rhythm.wakeTime,
    }
  }

  restoreVisitorSleepRhythm(visitor: Visitor): void {
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

  samplePoisson(expected: number): number {
    if (expected <= 0) return 0
    const limit = Math.exp(-expected)
    let product = 1
    let count = 0
    do {
      count += 1
      product *= this.context.rng.next()
    } while (product > limit)
    return count - 1
  }

  isVisitorSleepTime(visitor: Visitor): boolean {
    return isMinuteInSleepWindow(
      this.context.state.minute,
      visitor.preferredBedtime,
      visitor.preferredWakeTime,
    )
  }

  getBuildingDayPlanOffer(
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

  adjustVisitorOccupancy(visitor: Visitor, delta: -1 | 1): void {
    if (this.occupancyTick !== this.context.state.simTick) return
    if (
      (visitor.state === 'relaxing' ||
        visitor.state === 'partying' ||
        visitor.state === 'swimming') &&
      visitor.activityTarget
    ) {
      const key = this.context.cellKey(
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

  ensureVisitorOccupancy(): void {
    if (this.occupancyTick === this.context.state.simTick) return
    this.occupancyTick = this.context.state.simTick
    this.activityHeadcount.clear()
    this.activitySlotBits.clear()
    this.benchHeadcount.clear()
    this.benchSlotBits.clear()
    for (const visitor of this.context.state.visitors) {
      if (
        (visitor.state === 'relaxing' ||
          visitor.state === 'partying' ||
          visitor.state === 'swimming') &&
        visitor.activityTarget
      ) {
        const key = this.context.cellKey(
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

  activityOccupantsAt(cell: Cell, excluded: Visitor): number {
    this.ensureVisitorOccupancy()
    let count =
      this.activityHeadcount.get(this.context.cellKey(cell.x, cell.z, cell.elevation)) ?? 0
    if (
      (excluded.state === 'relaxing' ||
        excluded.state === 'partying' ||
        excluded.state === 'swimming') &&
      excluded.activityTarget?.x === cell.x &&
      excluded.activityTarget.z === cell.z &&
      excluded.activityTarget.elevation === cell.elevation
    ) {
      count -= 1
    }
    return count
  }

  getFreeActivitySlot(
    cell: Cell,
    capacity: number,
    excludedVisitorId: string,
  ): number {
    this.ensureVisitorOccupancy()
    const key = this.context.cellKey(cell.x, cell.z, cell.elevation)
    let used = this.activitySlotBits.get(key) ?? 0
    const excluded = this.context.getVisitor(excludedVisitorId)
    if (
      excluded &&
      (excluded.state === 'relaxing' ||
        excluded.state === 'partying' ||
        excluded.state === 'swimming') &&
      excluded.activityTarget?.x === cell.x &&
      excluded.activityTarget.z === cell.z &&
      excluded.activityTarget.elevation === cell.elevation
    ) {
      used &= ~(1 << (excluded.activitySlot & 31))
    }
    const order = [4, 0, 2, 6, 8, 1, 3, 5, 7].slice(0, capacity)
    return order.find((slot) => (used & (1 << slot)) === 0) ?? 4
  }

  findLeisureDestination(visitor: Visitor): {
    cell: Cell
    route: Cell[]
    slot: number
    capacity: number
    beauty: number
    party: number
  } | null {
    const config = SIMULATION_CONFIG.atmosphere
    const candidates = new Map<string, Cell>()
    ;[...this.context.state.attractiveness.cells, ...this.context.state.partyMood.cells].forEach(
      (cell) => {
        if (
          !this.context.getPathAt(cell.x, cell.z, cell.elevation) ||
          (this.context.attractivenessValues.get(
            this.context.cellKey(cell.x, cell.z, cell.elevation),
          ) ?? 0) < config.leisureMinimumFieldValue &&
            (this.context.partyMoodValues.get(
              this.context.cellKey(cell.x, cell.z, cell.elevation),
            ) ?? 0) < config.leisureMinimumFieldValue
        ) {
          return
        }
        candidates.set(
          this.context.cellKey(cell.x, cell.z, cell.elevation),
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
        const cellKey = this.context.cellKey(cell.x, cell.z, cell.elevation)
        const beauty = this.context.attractivenessValues.get(cellKey) ?? 0
        const party = this.context.partyMoodValues.get(cellKey) ?? 0
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
            (this.context.crowdingCosts.get(cellKey) ?? 0) *
              config.crowdingScorePenalty,
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxScoredPathChecks)
    for (const candidate of scored) {
      const route = this.context.findPath(start, [candidate.cell])
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

  ensureSwimGoals(): Cell[] {
    if (this.swimGoalRevision === this.context.worldRevision && this.swimGoalCells) {
      return this.swimGoalCells
    }
    this.swimGoalRevision = this.context.worldRevision
    const cells: Cell[] = []
    const size = this.context.getWorldSize()
    const half = size / 2
    const waterLevel = this.context.getWaterLevel()
    for (let z = -half; z < half; z += 1) {
      for (let x = -half; x < half; x += 1) {
        const height = this.context.getTerrainHeight(x, z)
        if (!isSwimmableHeight(height, waterLevel)) continue
        if (this.context.getPathAt(x, z, height)) continue
        if (this.context.isPedestrianSolidAt(x, z, height)) continue
        if (this.context.getCampingCellAt(x, z)) continue
        if (this.context.getRoadCellAt(x, z)) continue
        if (this.context.getMedicalCellAt(x, z)) continue
        if (this.context.getWasteDumpAt(x, z)) continue
        if (this.context.getStageForecourtCellAt(x, z)) continue
        cells.push({ x, z, elevation: height })
      }
    }
    for (const course of this.context.state.courses ?? []) {
      for (const piece of course.pieces) {
        if (piece.kind !== 'poolBasin') continue
        cells.push({ x: piece.x, z: piece.z, elevation: this.context.getTerrainHeight(piece.x, piece.z) })
      }
    }
    this.swimGoalCells = cells
    return cells
  }

  findSwimDestination(visitor: Visitor): {
    cell: Cell
    route: Cell[]
    slot: number
    capacity: number
  } | null {
    const goals = this.ensureSwimGoals()
    if (goals.length === 0) return null
    const capacity = SIMULATION_CONFIG.terrain.swimCapacityPerCell
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const open = goals
      .map((cell) => {
        const occupants = this.activityOccupantsAt(cell, visitor)
        if (occupants >= capacity) return null
        const distance =
          Math.abs(cell.x - visitor.cellX) + Math.abs(cell.z - visitor.cellZ)
        return { cell, occupants, distance }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          left.occupants - right.occupants ||
          left.cell.x - right.cell.x ||
          left.cell.z - right.cell.z,
      )
      .slice(0, SIMULATION_CONFIG.pathfinding.maxScoredPathChecks)
    if (open.length === 0) return null
    const route = this.context.findPath(
      start,
      open.map((candidate) => candidate.cell),
    )
    if (!route) return null
    const end = route.at(-1) ?? start
    const match =
      open.find(
        (candidate) =>
          candidate.cell.x === end.x &&
          candidate.cell.z === end.z &&
          Math.abs(candidate.cell.elevation - end.elevation) < 0.01,
      ) ?? open[0]
    if (!match) return null
    return {
      cell: match.cell,
      route,
      slot: this.getFreeActivitySlot(match.cell, capacity, visitor.id),
      capacity,
    }
  }

  enforceDayPlan(): void {
    const festivalPhase = getFestivalCycleStatus(
      this.context.state.dayPlan,
      this.context.state.day,
    )
    const dayVisitorsAllowed =
      festivalPhase.phase === 'festival' &&
      isDayVisitorAdmissionOpen(this.context.state.dayPlan, this.context.state.minute)
    const ridesActive = this.context.isOfferCurrentlyActive('rides')
    const stagesActive = this.context.isOfferCurrentlyActive('stages')
    const seated = collectSeatedPassengerIds(this.context.state.logistics.roadVehicles)
    this.context.state.visitors.forEach((visitor) => {
      if (this.context.isVisitorSeatedInVehicle(visitor, seated)) return
      if (
        festivalPhase.phase === 'break' &&
        visitor.state !== 'leaving' &&
        visitor.state !== 'riding' &&
        visitor.state !== 'vehicle-arrival' &&
        visitor.state !== 'bus-riding' &&
        visitor.campingPhase !== 'packing'
      ) {
        this.context.beginVisitorDeparture(visitor)
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
        this.context.beginVisitorDeparture(visitor)
        visitor.thought =
          'Die Besuchszeit für Tagesgäste ist vorbei. Ich gehe nach Hause.'
        return
      }
      if (visitor.state === 'queuing' && !ridesActive) {
        const target = visitor.targetId
          ? this.context.state.buildings.find((building) => building.id === visitor.targetId)
          : undefined
        if (target?.kind === 'ride' || (visitor.targetId && this.context.getCoaster(visitor.targetId))) {
          this.context.leaveQueueOnFoot(visitor, 'Die Fahrgeschäfte schließen für heute.')
        }
        return
      }
      if (
        visitor.state === 'partying' &&
        !stagesActive &&
        visitor.activityTarget &&
        this.context.getStageForecourtCellAt(
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
      const targetBuilding = this.context.state.buildings.find(
        (building) => building.id === visitor.targetId,
      )
      const targetCoaster = this.context.getCoaster(visitor.targetId)
      const targetActive = targetBuilding
        ? this.context.isBuildingCurrentlyActive(targetBuilding)
        : targetCoaster
          ? ridesActive
          : true
      if (targetActive) return
      this.context.removeVisitorFromCoasterQueues(visitor.id)
      visitor.state = 'exploring'
      visitor.targetId = null
      visitor.route = []
      visitor.thought = 'Dieses Angebot ist gerade geschlossen.'
      this.decideNextAction(visitor)
    })
  }

  findBenchDestination(visitor: Visitor): {
    building: PlacedBuilding
    route: Cell[]
    slot: number
  } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.context.state.buildings
      .filter((building) => building.kind === 'bench' || building.kind === 'table')
      .map((building) => {
        this.ensureVisitorOccupancy()
        let occupantCount = this.benchHeadcount.get(building.id) ?? 0
        let usedBits = this.benchSlotBits.get(building.id) ?? 0
        if (visitor.state === 'bench-resting' && visitor.targetId === building.id) {
          occupantCount -= 1
          usedBits &= ~(1 << (visitor.activitySlot & 31))
        }
        const capacity =
          building.kind === 'table'
            ? BUILDINGS.table.capacity
            : SIMULATION_CONFIG.atmosphere.benchCapacity
        if (occupantCount >= capacity) {
          return null
        }
        const slot =
          Array.from(
            { length: capacity },
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
    const route = this.context.findPath(
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

  findPartyDestination(visitor: Visitor): {
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
      ...this.context.state.stageForecourtCells
        .filter(
          (cell) =>
            this.context.isOfferCurrentlyActive('stages') &&
            (this.context.partyMoodValues.get(
              this.context.cellKey(cell.x, cell.z, cell.elevation),
            ) ?? 0) >= atmosphere.partyDestinationMinimumMood,
        )
        .map((cell) => ({
          cell,
          capacity: atmosphere.forecourtCapacityPerCell,
          forecourt: true,
        })),
      ...this.context.state.partyMood.cells
        .filter(
          (cell) =>
            cell.value >= atmosphere.partyDestinationMinimumMood &&
            Boolean(this.context.getPathAt(cell.x, cell.z, cell.elevation)),
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
        const cellKey = this.context.cellKey(
          candidate.cell.x,
          candidate.cell.z,
          candidate.cell.elevation,
        )
        const beauty = this.context.attractivenessValues.get(cellKey) ?? 0
        const party = this.context.partyMoodValues.get(cellKey) ?? 0
        const distance =
          Math.abs(candidate.cell.x - visitor.cellX) +
          Math.abs(candidate.cell.z - visitor.cellZ)
        const crowding = this.context.crowdingCosts.get(cellKey) ?? 0
        const stageId = candidate.forecourt
          ? this.concertForecourtStageIds.get(this.context.packCell(candidate.cell))
          : undefined
        const stage = stageId ? this.concertStagesById.get(stageId) : undefined
        const focus = stageId ? this.danceFloorFocusByStage.get(stageId) : undefined
        const front = stage ? stageFrontRank(stage, candidate.cell) : { row: 0, lateral: 0 }
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
            angle * atmosphere.danceFloorAnglePenalty -
            front.row * atmosphere.concertFrontRowPenalty -
            front.lateral * 2 +
            (candidate.forecourt ? atmosphere.forecourtScoreBonus : 0),
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxScoredPathChecks)
    for (const candidate of scored) {
      const route = this.context.findPath(
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

  clearVisitorActivity(visitor: Visitor): void {
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

  findReachableFacility(
    visitor: Visitor,
    kind: BuildingKind,
  ): { building: PlacedBuilding; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.context.state.buildings
      .filter(
        (building) =>
          building.kind === kind && this.context.isBuildingCurrentlyActive(building) &&
          (!isShopServiceKind(kind) || localStock(this.context.state, building.id, shopSupplyKind(kind) ?? 'goods') >= 1),
      )
      .map((building) => {
        const queueCells = this.context.getBuildingQueueCells(building)
        const accessCells =
          building.kind === 'ride' && queueCells[0]
            ? [queueCells[0]]
            : this.context.getFacilityAccessCells(building)
        const queueLength =
          queueCells.length > 0 ? this.context.getFacilityQueue(building.id).length : 0
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
          candidate.goals.some((goal) => this.context.isWalkableServiceCell(goal)) &&
          (candidate.queueCells.length === 0 ||
            candidate.queueLength <
              candidate.queueCells.length *
                SIMULATION_CONFIG.coasters.queueSlotsPerCell),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.context.findPath(
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

  findReachableAttraction(
    visitor: Visitor,
  ): { attraction: Attraction; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    // Coasters, courses and rides keep their own finders, which know the ride
    // offer, queue capacity and the coaster a guest is avoiding. Their canonical
    // records must not be offered a second time here.
    const legacyIds = new Set<string>([
      ...(this.context.state.coasters ?? []).map((coaster) => coaster.id),
      ...(this.context.state.courses ?? []).map((course) => course.id),
      ...this.context.state.buildings
        .filter((building) => building.kind === 'ride')
        .map((building) => building.id),
    ])
    const candidates = this.context.state.attractions
      .filter((attraction) =>
        !legacyIds.has(attraction.id) &&
        attraction.operationMode === 'open' &&
        attraction.access.mode === 'queuedEntrance' &&
        Boolean(attraction.access.entrance) &&
        this.context.isOfferCurrentlyActive('rides') &&
        attraction.queue.length < attractionCapacity(attraction),
      )
      .map((attraction) => {
        const queueEntrance = this.context.getAttractionQueueCells(attraction).at(-1)
        return queueEntrance
          ? {
              attraction,
              queueEntrance,
              distance:
                Math.abs(queueEntrance.x - start.x) +
                Math.abs(queueEntrance.z - start.z),
            }
          : null
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.context.findPath(
      start,
      candidates.map((candidate) => candidate.queueEntrance),
      true,
    )
    if (!route) return null
    const end = route.at(-1) ?? start
    const match = candidates.find((candidate) =>
      candidate.queueEntrance.x === end.x &&
      candidate.queueEntrance.z === end.z &&
      Math.abs(candidate.queueEntrance.elevation - end.elevation) < 0.01
    ) ?? candidates[0]
    return match ? { attraction: match.attraction, route } : null
  }

  findReachableCoaster(
    visitor: Visitor,
  ): { coaster: Coaster; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = this.context.state.coasters
      .filter(
        (coaster) =>
          coaster.closed &&
          this.context.isOfferCurrentlyActive('rides') &&
          coaster.operationMode === 'open' &&
          coaster.entrance &&
          coaster.exit &&
          coaster.id !== visitor.avoidedCoasterId &&
          this.context.getCoasterQueueCapacity(coaster.id) > coaster.queue.length &&
          this.context.getAccessPathNeighbors(coaster.exit).some(
            (cell) =>
              this.context.getPathAt(cell.x, cell.z, cell.elevation)?.pathType !== 'queue',
          ),
      )
      .map((coaster) => {
        const queueEntrance = this.context.getCoasterQueueCells(coaster).at(-1)
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
    const route = this.context.findPath(
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

  findReachableCourse(
    visitor: Visitor,
  ): { course: CourseAttraction; route: Cell[] } | null {
    const start = {
      x: visitor.cellX,
      z: visitor.cellZ,
      elevation: visitor.cellElevation,
    }
    const candidates = (this.context.state.courses ?? [])
      .filter((course) => {
        const entrance = courseEntrance(course)
        return (
          course.operating &&
          !validateCourse(course) &&
          this.context.isOfferCurrentlyActive('rides') &&
          entrance &&
          course.queue.length < courseCapacityFor(course)
        )
      })
      .map((course) => {
        const queueEntrance = this.context.getCourseQueueCells(course).at(-1)
        return queueEntrance
          ? {
              course,
              queueEntrance,
              distance:
                Math.abs(queueEntrance.x - start.x) +
                Math.abs(queueEntrance.z - start.z),
            }
          : null
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, SIMULATION_CONFIG.pathfinding.maxFacilityCandidates)
    if (candidates.length === 0) return null
    const route = this.context.findPath(
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
    return match ? { course: match.course, route } : null
  }

  visitorDecisionRng(visitor: Visitor): () => number {
    return createSeededRng(
      (visitor.pathSeed + visitor.wanderNonce * 0x9e3779b9) >>> 0,
    )
  }

  assignDeterministicWander(
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
      allowCamping: Boolean(this.context.getCampingCellAt(visitor.cellX, visitor.cellZ)),
      allowMedical: Boolean(this.context.getMedicalCellAt(visitor.cellX, visitor.cellZ)),
      allowFestival: Boolean(
        this.context.getStageForecourtCellAt(visitor.cellX, visitor.cellZ),
      ),
      allowQueue:
        this.context.getPathAt(visitor.cellX, visitor.cellZ, visitor.cellElevation)?.pathType ===
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

  pickSeededWalk(
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
      const neighbors = this.context.getPedestrianNeighbors(current, {
        allowCamping:
          options.allowCamping ??
          Boolean(this.context.getCampingCellAt(current.x, current.z)),
        allowMedical: options.allowMedical ?? false,
        allowFestival:
          options.allowFestival ??
          Boolean(this.context.getStageForecourtCellAt(current.x, current.z)),
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

  finishInteraction(visitor: Visitor): void {
    const target = this.context.state.buildings.find((building) => building.id === visitor.targetId)
    if (target && isShopServiceKind(target.kind) && !this.context.isVisitorAtShopCounter(visitor, target)) {
      this.context.leaveQueueOnFoot(visitor, 'Ich gehe zur Vorderseite des Ladens.')
      return
    }
    const rideExitPath = target?.kind === 'ride' && target.rideExit
      ? this.context.getAccessPathNeighbors(target.rideExit).find(c=>this.context.getPathAt(c.x,c.z,c.elevation)?.pathType !== 'queue') : undefined
    if (target?.kind === 'ride' && !rideExitPath) {
      visitor.thought = 'Ich warte, bis der Ausgang wieder mit einem Gehweg verbunden ist.'
      return
    }
    const supply = target ? shopSupplyKind(target.kind) : null
    const shopSupply = supply && supply !== 'water' ? supply : null
    const available = !shopSupply || !!target && localStock(this.context.state, target.id, shopSupply) >= 1
    if (!available) this.context.state.festival.metrics.stockouts++
    const paid =
      target && available &&
      this.context.chargeVisitor(visitor, target.price, {
        x: target.x + 0.5,
        y: target.elevation + BUILDINGS[target.kind].height,
        z: target.z + 0.5,
      })
    if (paid && shopSupply && target) consumeLocal(this.context.state, target.id, shopSupply)
    applyPurchaseOutcome(visitor, target, Boolean(paid), available, () => this.context.rng.next())
    if (target?.kind === 'ride' && paid) {
      this.context.incidents.addRideNausea(
        visitor,
        SIMULATION_CONFIG.nausea.carouselIntensity,
      )
      delete target.bungeeVisitorId
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
        ? this.context.buildQueueExitRoute(
            { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation },
            this.context.getBuildingQueueCells(target),
          )
        : []
    if (queueExit.length > 0) {
      this.clearVisitorActivity(visitor)
      visitor.state = 'exploring'
      visitor.route = queueExit
      visitor.interactionRemaining = 0
      this.context.beginStallQueueReturn(visitor, queueExit[0])
      if (purchasedConsumable) {
        visitor.thought = 'Ich gehe die Schlange zurück und suche einen Platz zum Essen oder Trinken.'
      }
      return
    }
    if (purchasedConsumable) {
      // Clear the counter before eating or drinking; avoid occupying the service tile.
      const route: Cell[] = []
      let cell = { x: visitor.cellX, z: visitor.cellZ, elevation: visitor.cellElevation }
      const visited = new Set([this.context.packCell(cell)])
      for (let step = 0; step < 4; step++) {
        const candidates = [...this.context.getPedestrianNeighbors(cell, { allowGrass: false })]
          .filter(next => !visited.has(this.context.packCell(next)))
          .sort((a, b) => (this.movementOccupancy.get(this.context.packCell(a)) ?? 0) - (this.movementOccupancy.get(this.context.packCell(b)) ?? 0))
        if (!candidates.length) break
        cell = { ...candidates[0]! }; route.push(cell); visited.add(this.context.packCell(cell))
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
      this.context.queueVisitorDecision(visitor)
      return
    }
    this.decideNextAction(visitor)
  }

  decayNeeds(visitor: Visitor, minutes: number): void {
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
      this.context.state.minute,
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

  canBeginStreaking(visitor: Visitor): boolean {
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

  updateStreaking(visitor: Visitor, minutes: number): void {
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
    if (this.context.rng.next() >= Math.min(1, minutes * config.chancePerMinute)) return
    this.beginStreaking(visitor)
  }

  beginStreaking(visitor: Visitor): void {
    const config = SIMULATION_CONFIG.alcohol.streaking
    this.context.removeVisitorFromCoasterQueues(visitor.id)
    this.clearVisitorActivity(visitor)
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.isConversing = false
    visitor.streakingMinutes =
      config.durationMinimum + this.context.rng.next() * config.durationRandomRange
    visitor.emotion = 'excited'
    visitor.emotionMinutes = visitor.streakingMinutes + 8
    visitor.thought = 'Nackt durchs Festival! Wer macht mit?'
    this.continueStreakingRun(visitor)
  }

  continueStreakingRun(visitor: Visitor): void {
    visitor.state = 'exploring'
    visitor.targetId = null
    visitor.isDancing = false
    visitor.route = this.pickStreakingRoute(visitor)
  }

  pickStreakingRoute(visitor: Visitor): Cell[] {
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
        allowCamping: Boolean(this.context.getCampingCellAt(visitor.cellX, visitor.cellZ)),
        allowMedical: false,
        allowFestival: true,
      },
      visitor.route[0] ?? null,
    )
  }

  spreadStreakingFun(source: Visitor, minutes: number): void {
    const config = SIMULATION_CONFIG.alcohol.streaking
    this.context.state.visitors.forEach((other) => {
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

  updateAlcoholBehavior(visitor: Visitor): boolean {
    const config = SIMULATION_CONFIG.alcohol
    if (
      visitor.alcoholLevel >= config.passOutThreshold &&
      visitor.needs.energy <= config.passOutEnergyThreshold &&
      !visitor.campsite &&
      visitor.state !== 'riding' &&
      visitor.state !== 'camping'
    ) {
      this.context.removeVisitorFromCoasterQueues(visitor.id)
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

  updateVisitorEmotion(visitor: Visitor, minutes: number): void {
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
}

function attractionCapacity(attraction: Attraction): number {
  if (attraction.runtime.kind === 'coaster') return attraction.runtime.train.capacity
  if (attraction.runtime.kind === 'scriptedRide') {
    return attraction.runtime.rideKind === 'bungee' ? 1 : 8
  }
  if (attraction.runtime.kind === 'course') {
    if (attraction.runtime.courseKind === 'paintball') {
      return Math.max(2, (attraction.runtime.teamSize ?? 4) * 2)
    }
    return SIMULATION_CONFIG.courses.capacity[attraction.runtime.courseKind]
  }
  return 0
}
