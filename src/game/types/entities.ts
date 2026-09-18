import type { Audience } from '../festivalManagement'
import type { CampingPhase, CampSetupKind } from '../camping'
import type { Direction } from '../logistics'
import type { InventoryItem } from '../inventory'
import type { BuildingKind } from '../catalog'
import type { MusicGenre } from '../musicTaste'
import type { SecurityGateConfig } from '../security'
import type { ShirtStyle, WornShirt } from '../shopGoods'
import type { StageDesign } from '../stageDesign'
import type { ComplaintTopic } from '../complaints'
import type { WayType } from '../wayTypes'

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
  | 'swimming'
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
