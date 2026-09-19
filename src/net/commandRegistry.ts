import type { FestivalAction } from '../game/festivalManagement'
import type { GameCommand } from './protocol'

export type GameCommandType = GameCommand['type']

export type CommandMetadata = {
  /** Client may apply this command before the host acknowledges it. */
  optimistic: boolean
}

const optimisticFestivalActions = new Set<FestivalAction['type']>([
  'ground',
  'groundArea',
  'depot',
  'removeDepot',
  'staffGate',
  'wayArea',
  'stageDesign',
])

/**
 * Exhaustive command policy registry. Adding a GameCommand variant without
 * classifying it fails type checking here.
 */
export const COMMAND_METADATA = {
  startAttraction: { optimistic: true },
  constructAttraction: { optimistic: true },
  removeAttraction: { optimistic: true },
  setAttractionOperation: { optimistic: false },
  setAttractionPrice: { optimistic: false },
  configureAttraction: { optimistic: false },
  setRideAccess: { optimistic: true },
  placeBungee: { optimistic: true },
  setBungeeHeight: { optimistic: true },
  festival: { optimistic: false },
  loan: { optimistic: false },
  place: { optimistic: true },
  stampBlueprint: { optimistic: true },
  placePath: { optimistic: true },
  placeRoad: { optimistic: true },
  undoRoad: { optimistic: true },
  undoPath: { optimistic: true },
  bulldoze: { optimistic: true },
  bulldozeArea: { optimistic: true },
  editTerrain: { optimistic: true },
  editTerrainArea: { optimistic: true },
  designateRoad: { optimistic: true },
  designateParking: { optimistic: true },
  designateCampingCell: { optimistic: true },
  designateCampingArea: { optimistic: true },
  designateMedicalArea: { optimistic: true },
  designateWasteDump: { optimistic: true },
  designateStageForecourt: { optimistic: true },
  designateBackstageArea: { optimistic: true },
  designatePowerCable: { optimistic: true },
  designatePowerCableArea: { optimistic: true },
  setRoadDirection: { optimistic: true },
  clearRoadDirection: { optimistic: true },
  placeTrafficLight: { optimistic: true },
  placePathBarrier: { optimistic: true },
  configureAccessControl: { optimistic: true },
  toggleAccessControlArea: { optimistic: true },
  clearAccessControlArea: { optimistic: true },
  toggleRoadSeparator: { optimistic: true },
  toggleCrosswalk: { optimistic: true },
  setRoadSpeed: { optimistic: true },
  setPathFlow: { optimistic: true },
  setParkOpen: { optimistic: false },
  setSpeed: { optimistic: false },
  hireStaff: { optimistic: false },
  fireStaff: { optimistic: false },
  fireStaffMember: { optimistic: false },
  toggleStaffZone: { optimistic: false },
  setStaffZone: { optimistic: false },
  buyAmbulance: { optimistic: false },
  buyFireTruck: { optimistic: false },
  sellAmbulance: { optimistic: false },
  sellAmbulanceVehicle: { optimistic: false },
  buyBus: { optimistic: false },
  sellBus: { optimistic: false },
  buyGarbageTruck: { optimistic: false },
  sellGarbageTruck: { optimistic: false },
  buySweeper: { optimistic: false },
  sellSweeper: { optimistic: false },
  createBusLine: { optimistic: false },
  addBusToLine: { optimistic: false },
  setBusLineStops: { optimistic: false },
  deleteBusLine: { optimistic: false },
  startCourse: { optimistic: true },
  startCourseArea: { optimistic: true },
  addCourseAreaCell: { optimistic: true },
  addCourseAreaCells: { optimistic: true },
  removeCourseAreaCells: { optimistic: true },
  addCoursePiece: { optimistic: true },
  undoCoursePiece: { optimistic: true },
  setCourseOperating: { optimistic: false },
  setCoursePrice: { optimistic: false },
  setCourseTeamSize: { optimistic: false },
  removeCourse: { optimistic: true },
  startCoaster: { optimistic: true },
  appendCoasterPiece: { optimistic: true },
  undoCoasterPiece: { optimistic: true },
  deleteCoasterPiece: { optimistic: true },
  removeCoaster: { optimistic: true },
  setCoasterAccess: { optimistic: true },
  updateCoasterSettings: { optimistic: false },
  updateCoasterPrice: { optimistic: false },
  setCoasterOperationMode: { optimistic: false },
  recallCoasterTrain: { optimistic: false },
  updateBuildingPrice: { optimistic: false },
  configureShirtStall: { optimistic: false },
  updateEntryPrice: { optimistic: false },
  updateCampingTicketPrice: { optimistic: false },
  updateSecurityGate: { optimistic: false },
  setDayPlanHour: { optimistic: false },
  updateDayVisitorWindow: { optimistic: false },
  updateCampingCapacityBuffer: { optimistic: false },
  updateFestivalCycle: { optimistic: false },
  addDebugMoney: { optimistic: false },
  clearWasteForDebug: { optimistic: false },
  placeSceneryLine: { optimistic: true },
  removeVisitorCars: { optimistic: false },
} as const satisfies Record<GameCommandType, CommandMetadata>

export const GAME_COMMAND_TYPES = Object.freeze(
  Object.keys(COMMAND_METADATA) as GameCommandType[],
)

export function isOptimisticCommand(command: GameCommand): boolean {
  if (command.type === 'festival') {
    return optimisticFestivalActions.has(command.action.type)
  }
  return COMMAND_METADATA[command.type].optimistic
}
