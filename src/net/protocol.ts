import type { FlatRideType } from '../game/flatRides'
import type { WayType } from '../game/wayTypes'
import type { AttractionConstructionRequest } from '../game/attractions/construction'
import type { AttractionOperationMode } from '../game/attractions/types'
import type { BuildingKind, Tool } from '../game/catalog'
import type { ActionResult, PlacedBuilding } from '../game/GameState'
import type { TerrainEditMode } from '../game/terrain'
import type { GroundCover } from '../game/ground'
import type { Direction, RoadCell, RoadPosition, SpeedLimit } from '../game/logistics'
import type {
  AccessControlMode,
  AccessPolarity,
  AccessScheduleTime,
  BarrierPassage,
  PathSensorKind,
  TrafficSensorKind,
} from '../game/accessControl'
import type { CoasterOperationMode, CoasterTypeId, DispatchMode, TrackBuildOptions, TrackPieceKind } from '../game/coasters'
import type { CourseAreaCell, CourseKind, CoursePieceKind } from '../game/courseAttractions'
import type { StaffRole } from '../game/staff'
import type { DayPlanOffer, FestivalPhase } from '../game/dayPlan'
import type { SecurityGateConfig } from '../game/security'
import type { CashEffect, GameSnapshot, Visitor } from '../game/GameState'
import type { StaffMember } from '../game/staff'
import type { RoadVehicle } from '../game/logistics'
import type { GroundIncident } from '../game/incidents'
import type { TicketDemandTuning } from '../game/demandTuning'
import type { FireworkEffect } from '../game/fireworks'
import type { FestivalAction } from '../game/festivalManagement'
import type { ShirtStyle } from '../game/shopGoods'
import type { BlueprintItem } from '../game/blueprints'
import type { ChatPing } from './chatProtocol'

export type { ChatPing }

export type CellRef = { x: number; z: number }

export type GameCommand = GameCommandAction & {
  context?: { buildElevation: number; buildRotation: number }
  clientCommandId?: string
  originPlayerId?: string
}

export type GameCommandAction =
  | { type: 'startAttraction'; definitionId: string; x: number; z: number; rotation: number }
  | { type: 'constructAttraction'; request: AttractionConstructionRequest }
  | { type: 'removeAttraction'; attractionId: string }
  | { type: 'setAttractionOperation'; attractionId: string; mode: AttractionOperationMode }
  | { type: 'setAttractionPrice'; attractionId: string; price: number }
  | {
      type: 'configureAttraction'
      attractionId: string
      teamSize?: number
      dispatchMode?: DispatchMode
      dispatchIntervalMinutes?: number
    }
  | { type: 'setRideAccess'; buildingId: string; accessType: 'entrance' | 'exit'; x: number; z: number }
  | { type: 'placeBungee'; x: number; z: number; height: number }
  | { type: 'placeRide'; rideType: FlatRideType; x: number; z: number }
  | { type: 'setBungeeHeight'; id: string; height: number }
  | { type: 'festival'; action: FestivalAction }
  | { type: 'loan'; action: { type: 'borrow' | 'repay'; amount: number } }
  | { type: 'place'; kind: BuildingKind; x: number; z: number; decorationSlot?: number }
  | { type: 'stampBlueprint'; originX: number; originZ: number; rotation: number; items: BlueprintItem[] }
  | {
      type: 'placePath'
      x: number
      z: number
      elevation: number
      wayType?: WayType
      pathType: 'normal' | 'queue'
      queueDirection: number
      slope: number
    }
  | {
      type: 'placeRoad'
      x: number
      z: number
      elevation: number
      slope: number
      slopeDirection: number
      wayType?: WayType
    }
  | {
      type: 'undoRoad'
      x: number
      z: number
      previousRoad?: RoadCell
      elevation?: number
    }
  | {
      type: 'undoPath'
      x: number
      z: number
      elevation: number
      previousPath?: PlacedBuilding
    }
  | { type: 'bulldoze'; x: number; z: number; buildingId?: string }
  | { type: 'bulldozeArea'; cells: CellRef[] }
  | { type: 'editTerrain'; x: number; z: number; mode: TerrainEditMode; corner?: number; originHeight?: number }
  | { type: 'editTerrainArea'; cells: CellRef[]; mode: TerrainEditMode; originHeight?: number }
  | { type: 'paintGroundCover'; x: number; z: number; cover: GroundCover }
  | { type: 'paintGroundCoverArea'; cells: CellRef[]; cover: GroundCover }
  | { type: 'designateRoad'; cells: RoadPosition[] }
  | { type: 'designateParking'; cells: RoadPosition[] }
  | { type: 'designateCampingCell'; x: number; z: number; enabled: boolean }
  | { type: 'designateCampingArea'; cells: CellRef[] }
  | { type: 'designateMedicalArea'; cells: CellRef[] }
  | { type: 'designateWasteDump'; cells: CellRef[] }
  | { type: 'designateStageForecourt'; cells: CellRef[] }
  | { type: 'designateBackstageArea'; cells: CellRef[]; enabled?: boolean }
  | { type: 'designatePowerCable'; x: number; z: number; enabled: boolean }
  | { type: 'designatePowerCableArea'; cells: CellRef[] }
  | { type: 'setRoadDirection'; x: number; z: number; direction: Direction }
  | { type: 'clearRoadDirection'; x: number; z: number }
  | { type: 'placeTrafficLight'; x: number; z: number; direction: Direction }
  | {
      type: 'placePathBarrier'
      x: number
      z: number
      elevation: number
      direction: Direction
    }
  | {
      type: 'configureAccessControl'
      id: string
      mode?: AccessControlMode
      openSlots?: boolean[]
      polarity?: AccessPolarity
      sensorKind?: TrafficSensorKind | PathSensorKind
      sensorThreshold?: number
      passage?: BarrierPassage
      openInEmergency?: boolean
      scheduleTime?: AccessScheduleTime
      scheduleHours?: boolean[]
      scheduleOffer?: DayPlanOffer
      schedulePhases?: FestivalPhase[]
    }
  | { type: 'toggleAccessControlArea'; id: string; from: CellRef; to: CellRef }
  | { type: 'clearAccessControlArea'; id: string }
  | { type: 'toggleRoadSeparator'; x: number; z: number; direction: Direction }
  | { type: 'toggleCrosswalk'; x: number; z: number }
  | { type: 'setRoadSpeed'; x: number; z: number; speedLimit: SpeedLimit }
  | { type: 'setPathFlow'; x: number; z: number; elevation: number; direction: number | null }
  | { type: 'setParkOpen'; open: boolean }
  | { type: 'undoLastBuild' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'hireStaff'; role: StaffRole }
  | { type: 'fireStaff'; role: StaffRole }
  | { type: 'fireStaffMember'; staffId: string }
  | { type: 'toggleStaffZone'; staffId: string; key: string }
  | { type: 'setStaffZone'; staffId: string; key: string; active: boolean }
  | { type: 'buyAmbulance'; garageId: string }
  | { type: 'buyFireTruck'; stationId: string }
  | { type: 'startCourse'; kind: CourseKind; x: number; z: number }
  | { type: 'startCourseArea'; kind: CourseKind; cells: CourseAreaCell[] }
  | { type: 'addCourseAreaCell'; courseId: string; x: number; z: number }
  | { type: 'addCourseAreaCells'; courseId: string; cells: CourseAreaCell[] }
  | { type: 'removeCourseAreaCells'; courseId: string; cells: CourseAreaCell[] }
  | { type: 'addCoursePiece'; courseId: string; kind: CoursePieceKind; x: number; z: number; elevation?: number }
  | { type: 'undoCoursePiece'; courseId: string }
  | { type: 'setCourseOperating'; courseId: string; operating: boolean }
  | { type: 'setCoursePrice'; courseId: string; price: number }
  | { type: 'setCourseTeamSize'; courseId: string; teamSize: number }
  | { type: 'removeCourse'; courseId: string }
  | { type: 'sellAmbulance'; garageId: string }
  | { type: 'sellAmbulanceVehicle'; vehicleId: string }
  | { type: 'buyBus'; depotId: string }
  | { type: 'sellBus'; depotId: string }
  | { type: 'buyGarbageTruck'; depotId: string }
  | { type: 'sellGarbageTruck'; depotId: string }
  | { type: 'buySweeper'; depotId: string }
  | { type: 'sellSweeper'; depotId: string }
  | {
      type: 'createBusLine'
      name: string
      depotId: string
      stopIds: string[]
      busCount: number
      headway: number
    }
  | { type: 'addBusToLine'; lineId: string }
  | { type: 'setBusLineStops'; lineId: string; stopIds: string[] }
  | { type: 'deleteBusLine'; lineId: string }
  | { type: 'startCoaster'; typeId: CoasterTypeId; x: number; z: number }
  | {
      type: 'appendCoasterPiece'
      coasterId: string
      kind: TrackPieceKind
      chainLift: boolean
      afterPieceIndex?: number
      options: TrackBuildOptions
    }
  | { type: 'undoCoasterPiece'; coasterId: string }
  | { type: 'deleteCoasterPiece'; coasterId: string; pieceIndex: number }
  | { type: 'removeCoaster'; coasterId: string }
  | {
      type: 'setCoasterAccess'
      coasterId: string
      accessType: 'entrance' | 'exit'
      x: number
      z: number
    }
  | { type: 'updateCoasterSettings'; coasterId: string; dispatchMode: DispatchMode; intervalMinutes: number }
  | { type: 'updateCoasterPrice'; coasterId: string; price: number }
  | { type: 'setCoasterOperationMode'; coasterId: string; mode: CoasterOperationMode }
  | { type: 'recallCoasterTrain'; coasterId: string }
  | { type: 'updateBuildingPrice'; buildingId: string; price: number; allOfKind?: boolean }
  | { type: 'configureShirtStall'; buildingId: string; color?: number; style?: ShirtStyle }
  | { type: 'updateEntryPrice'; price: number }
  | { type: 'updateCampingTicketPrice'; price: number }
  | { type: 'updateDemandTuning'; tuning: TicketDemandTuning }
  | { type: 'updateSecurityGate'; id: string; config: Partial<SecurityGateConfig> }
  | { type: 'setDayPlanHour'; offer: DayPlanOffer; hour: number; active: boolean }
  | { type: 'updateDayVisitorWindow'; entryHour: number; exitHour: number }
  | { type: 'updateCampingCapacityBuffer'; percent: number }
  | { type: 'updateFestivalCycle'; leadDays: number; festivalDays: number; breakDays: number }
  | { type: 'addDebugMoney' }
  | { type: 'clearWasteForDebug' }
  | { type: 'placeSceneryLine'; kind: BuildingKind; cells: Array<{ x: number; z: number }>; slot: number; rotation?: number }
  | { type: 'removeVisitorCars' }

export type NetPlayer = {
  id: string
  name: string
  role: 'host' | 'client'
}

/** A room that has put itself on the list. Private rooms are never in here. */
export type NetLobby = {
  code: string
  host: string
  players: number
  /** True while the host is away and the room is waiting for them. */
  hostAway: boolean
}

export type PackedVisitor = Pick<
  Visitor,
  | 'id'
  | 'name'
  | 'x'
  | 'y'
  | 'z'
  | 'cellX'
  | 'cellZ'
  | 'cellElevation'
  | 'color'
  | 'state'
  | 'thought'
  | 'facing'
  | 'emotion'
  | 'alcoholLevel'
  | 'streakingMinutes'
  | 'toplessMinutes'
  | 'bungeeNude'
  | 'ownedMascot'
  | 'heldMascot'
  | 'wornShirt'
  | 'tileOffsetX'
  | 'tileOffsetZ'
  | 'isDancing'
  | 'isConversing'
  | 'hasHandcart'
  | 'campActivity'
  | 'campActivityTarget'
  | 'campActivitySlot'
  | 'campActivityCapacity'
  | 'activityTarget'
  | 'activitySlot'
  | 'activityCapacity'
  | 'targetId'
  | 'campingPhase'
  | 'needs'
  | 'nausea'
  | 'motivation'
  | 'crowding'
  | 'localAttractiveness'
  | 'localPartyMood'
  | 'ticketType'
  | 'musicTaste'
  | 'alcoholDisposition'
> & {
  moving: boolean
  nextX: number
  nextZ: number
}

export type SimSnapshot = {
  money: number
  guests: number
  reputation: number
  day: number
  minute: number
  speed: number
  parkOpen: boolean
  entryPrice: number
  campingTicketPrice: number
  visitors: PackedVisitor[]
  staff: StaffMember[]
  vehicles: RoadVehicle[]
  incidents: GroundIncident[]
  cashEffects: CashEffect[]
  fireworkEffects: FireworkEffect[]
}

export type WorldSnapshot = Omit<
  GameSnapshot,
  'selectedTool' | 'buildElevation' | 'buildRotation' | 'multiplayerCode'
>

export type WorldUpdate = {
  t: 'state'
  world: Partial<WorldSnapshot>
  visitors: Array<{ id: string; changes: Partial<Visitor> }>
  removed: string[]
}

export type ClientMessage =
  | WorldUpdate
  | { t: 'host'; name: string; code?: string; public?: boolean }
  | { t: 'lobbies' }
  | { t: 'join'; code: string; name: string }
  | { t: 'resume'; code: string; playerId: string; name: string }
  | { t: 'command'; cmd: GameCommand }
  | { t: 'commandResult'; to: string; commandId: string; result: ActionResult }
  /**
   * Leaving ends the room for everyone — unless the host hands it over: then a
   * guest (preferably `to`) is promoted at once and the world carries on there.
   */
  | { t: 'leave'; handOver?: boolean; to?: string }
  /** A promoted guest could not build the world it was handed; the server asks the next one. */
  | { t: 'takeoverFailed' }
  | { t: 'world'; rev: number; world: WorldSnapshot }
  | { t: 'sim'; sim: SimSnapshot }
  | { t: 'result'; ok: boolean; message: string }
  | { t: 'apply'; cmd: GameCommand; sim: SimSnapshot }
  | {
      t: 'turn'
      tick: number
      commands: GameCommand[]
      step: boolean
      hash: number
    }
  | { t: 'sync'; world: WorldSnapshot }
  | { t: 'resync' }
  /** Ephemeral chat / map ping — not a simulation command. */
  | { t: 'chat'; text: string; ping?: ChatPing }

export type ServerMessage =
  | WorldUpdate
  | { t: 'hosted'; code: string; playerId: string; joinUrl: string; players: NetPlayer[] }
  | {
      t: 'joined'
      code: string
      playerId: string
      role: 'host' | 'client'
      players: NetPlayer[]
      /** The host's seat is empty right now; see `players`. */
      hostAway?: boolean
      takeoverInMs?: number
      /** This seat was host once and lost the room to a takeover while it was gone. */
      demoted?: boolean
      /** Who holds the room now, for the demoted player's notice. */
      hostName?: string
    }
  | {
      t: 'players'
      players: NetPlayer[]
      /** Always set: true while the host's seat is empty, false once it is taken again. */
      hostAway: boolean
      /** Milliseconds until the server hands the room to a guest; absent when none is planned. */
      takeoverInMs?: number
    }
  /** To the guest the server chose to carry the room on (host takeover). */
  | {
      t: 'promoted'
      code: string
      playerId: string
      joinUrl: string
      players: NetPlayer[]
      /** Counts takeovers in this room. */
      epoch: number
      public: boolean
      /** The server's last authoritative world; absent when it keeps none (too big). */
      world?: WorldSnapshot
      /** How old that world is, by the server's clock. */
      worldAgeMs?: number
    }
  /** To everyone else in the room after a takeover. */
  | { t: 'hostChanged'; hostId: string; hostName: string; players: NetPlayer[]; epoch: number }
  | { t: 'lobbies'; lobbies: NetLobby[] }
  | { t: 'command'; cmd: GameCommand; from: string }
  | { t: 'commandResult'; commandId: string; result: ActionResult }
  | { t: 'result'; ok: boolean; message: string; extra?: ActionResult }
  | { t: 'world'; rev: number; world: WorldSnapshot }
  | { t: 'sim'; sim: SimSnapshot }
  | { t: 'apply'; cmd: GameCommand; sim: SimSnapshot }
  | {
      t: 'turn'
      tick: number
      commands: GameCommand[]
      step: boolean
      hash: number
    }
  | { t: 'sync'; world: WorldSnapshot }
  | { t: 'resync' }
  | { t: 'error'; message: string }
  | { t: 'closed'; message: string }
  /** Relayed chat / map ping for every seat in the room. */
  | { t: 'chat'; id: string; from: string; name: string; text: string; ping?: ChatPing }

export type { Tool }
