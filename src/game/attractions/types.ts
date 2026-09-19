import type { CampInstallation } from '../camping'
import type {
  Coaster,
  CoasterOperationMode,
  CoasterTelemetry,
  CoasterTrain,
  CoasterTypeId,
  DispatchMode,
  TrackAnchor,
  TrackPiece,
} from '../coasters'
import type {
  CourseAttraction,
  CourseAreaCell,
  CourseKind,
  PaintballMatch,
  CoursePiece,
  CourseRider,
} from '../courseAttractions'

export type AttractionLayoutKind = 'track' | 'area' | 'scripted'
export type AttractionAccessMode = 'free' | 'entranceExit' | 'queuedEntrance'
export type TrackTopology = 'closedLoop' | 'shuttle' | 'startEnd' | 'openExit'
export type TrackAgentKind = 'vehicle' | 'pedestrian' | 'slider'
export type AttractionOperationMode = 'closed' | 'open' | 'test'

export type AttractionAccess = {
  mode: AttractionAccessMode
  entrance: AttractionPoint | null
  exit: AttractionPoint | null
}

export type AttractionPoint = {
  x: number
  z: number
  elevation: number
  heading?: number
}

export type TrackNode = {
  id: string
  anchor: TrackAnchor
}

export type TrackEdge = {
  id: string
  kind: string
  fromNodeId: string
  toNodeId: string
  points: AttractionPoint[]
  cost: number
  metadata?: Record<string, unknown>
}

export type TrackGraph = {
  nodes: TrackNode[]
  edges: TrackEdge[]
  startNodeId: string | null
  terminalNodeId: string | null
}

export type AreaCell = {
  x: number
  z: number
  elevation: number
}

export type AreaReference = {
  id: string
  kind: string
  x: number
  z: number
  elevation: number
  rotation: 0 | 1 | 2 | 3
  metadata?: Record<string, unknown>
}

export type TrackLayout = {
  kind: 'track'
  topology: TrackTopology
  agentKind: TrackAgentKind
  graph: TrackGraph
  selectedOpenNodeId: string | null
}

export type AreaLayout = {
  kind: 'area'
  accessMode: AttractionAccessMode
  cells: AreaCell[]
  references: AreaReference[]
  visitorInstallations: CampInstallation[]
}

export type ScriptedLayout = {
  kind: 'scripted'
  anchor: AttractionPoint
  rotation: 0 | 1 | 2 | 3
  segments: Array<{ id: string; kind: string; level: number }>
}

export type AttractionLayout = TrackLayout | AreaLayout | ScriptedLayout

export type CoasterRuntime = {
  kind: 'coaster'
  typeId: CoasterTypeId
  settings: {
    dispatchMode: DispatchMode
    dispatchIntervalMinutes: number
  }
  train: CoasterTrain
  telemetry: CoasterTelemetry
}

export type CourseRuntime = {
  kind: 'course'
  courseKind: CourseKind
  riders: CourseRider[]
  teamSize?: number
  match?: PaintballMatch
}

export type CampingRuntime = {
  kind: 'camping'
}

export type PartyRuntime = {
  kind: 'party'
  stageId?: string
}

export type ScriptedRideRuntime = {
  kind: 'scriptedRide'
  rideKind: 'carousel' | 'bungee'
  phase: number
  remainingMinutes: number
  occupantIds: string[]
  towerHeight?: number
}

export type AttractionRuntime =
  | CoasterRuntime
  | CourseRuntime
  | CampingRuntime
  | PartyRuntime
  | ScriptedRideRuntime

export type Attraction = {
  id: string
  definitionId: string
  name: string
  layout: AttractionLayout
  access: AttractionAccess
  operationMode: AttractionOperationMode
  price: number
  queue: string[]
  runtime: AttractionRuntime
}

/**
 * Transitional input shapes are accepted only by the v30→v31 loader. They
 * never appear as top-level runtime snapshot arrays after migration.
 */
export type LegacyAttractionInput = {
  coasters?: Coaster[]
  courses?: CourseAttraction[]
  campingCells?: Array<{ x: number; z: number; elevation: number }>
  campInstallations?: CampInstallation[]
  stageForecourtCells?: Array<{ x: number; z: number; elevation: number; stageId?: string }>
}

export type MigratedAttractionResult = {
  attractions: Attraction[]
  removedIds: string[]
}

export type TrackEdgePayload = TrackPiece | CoursePiece
export type AreaReferencePayload = CourseAreaCell

export type LegacyCoasterOperationMode = CoasterOperationMode
