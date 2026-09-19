import { COASTER_TYPE_IDS, TRACK_PIECE_KINDS } from '../coasters'
import {
  COURSE_PIECE_CATALOG,
  COURSE_SPECS,
  type CourseKind,
} from '../courseAttractions'
import type {
  AttractionAccessMode,
  AttractionLayoutKind,
  TrackAgentKind,
  TrackTopology,
} from './types'

export type AttractionDefinition = {
  id: string
  name: string
  layoutKind: AttractionLayoutKind
  accessMode: AttractionAccessMode
  topology?: TrackTopology
  agentKind?: TrackAgentKind
  pieceKinds: readonly string[]
  requiresConnectedArea?: boolean
  allowedReferences?: readonly string[]
  visitorInstallationKinds?: readonly string[]
}

const coasterDefinitions = Object.fromEntries(
  COASTER_TYPE_IDS.map((typeId) => [
    `coaster:${typeId}`,
    {
      id: `coaster:${typeId}`,
      name: typeId,
      layoutKind: 'track',
      accessMode: 'queuedEntrance',
      topology: typeId === 'lsmLaunched' || typeId === 'limLaunched' ? 'shuttle' : 'closedLoop',
      agentKind: 'vehicle',
      pieceKinds: TRACK_PIECE_KINDS,
    } satisfies AttractionDefinition,
  ]),
) as Record<string, AttractionDefinition>

const courseTrackDefinition = (
  kind: Extract<CourseKind, 'mudmasters' | 'treeToTree'>,
): AttractionDefinition => ({
  id: `course:${kind}`,
  name: COURSE_SPECS[kind].name,
  layoutKind: 'track',
  accessMode: 'queuedEntrance',
  topology: 'startEnd',
  agentKind: 'pedestrian',
  pieceKinds: COURSE_PIECE_CATALOG[kind],
})

export const ATTRACTION_DEFINITIONS: Record<string, AttractionDefinition> = {
  ...coasterDefinitions,
  'course:mudmasters': courseTrackDefinition('mudmasters'),
  'course:treeToTree': courseTrackDefinition('treeToTree'),
  waterSlide: {
    id: 'waterSlide',
    name: 'Wasserrutsche',
    layoutKind: 'track',
    accessMode: 'queuedEntrance',
    topology: 'openExit',
    agentKind: 'slider',
    pieceKinds: ['entrance', 'waterSlide', 'ladder'],
  },
  paintball: {
    id: 'paintball',
    name: COURSE_SPECS.paintball.name,
    layoutKind: 'area',
    accessMode: 'queuedEntrance',
    pieceKinds: [],
    requiresConnectedArea: true,
    allowedReferences: ['entrance', 'exit', 'cover', 'teamStartA', 'teamStartB'],
  },
  swimArea: {
    id: 'swimArea',
    name: 'Schwimmfläche',
    layoutKind: 'area',
    accessMode: 'entranceExit',
    pieceKinds: [],
    requiresConnectedArea: true,
    allowedReferences: ['water', 'deck', 'ladder', 'entrance', 'exit'],
  },
  camping: {
    id: 'camping',
    name: 'Campingfläche',
    layoutKind: 'area',
    accessMode: 'free',
    pieceKinds: [],
    requiresConnectedArea: false,
    allowedReferences: ['campingReception', 'campingLight', 'campingWater'],
    visitorInstallationKinds: ['tent', 'chairs', 'pavilion', 'musicBox'],
  },
  partyArea: {
    id: 'partyArea',
    name: 'Partyfläche',
    layoutKind: 'area',
    accessMode: 'free',
    pieceKinds: [],
    requiresConnectedArea: false,
    allowedReferences: ['stageReference', 'partyLight', 'speakerReference', 'barReference'],
  },
  carousel: {
    id: 'carousel',
    name: 'Karussell',
    layoutKind: 'scripted',
    accessMode: 'queuedEntrance',
    pieceKinds: ['base'],
  },
  bungee: {
    id: 'bungee',
    name: 'Bungee-Turm',
    layoutKind: 'scripted',
    accessMode: 'queuedEntrance',
    pieceKinds: ['base', 'towerSegment'],
  },
}

export function getAttractionDefinition(id: string): AttractionDefinition | undefined {
  return ATTRACTION_DEFINITIONS[id]
}

export function isAttractionDefinitionId(id: string): boolean {
  return Boolean(getAttractionDefinition(id))
}
