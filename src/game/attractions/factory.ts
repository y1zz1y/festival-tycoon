import { createCoasterTelemetry, getCoasterType, type CoasterTypeId } from '../coasters'
import { COURSE_SPECS, type CourseKind } from '../courseAttractions'
import { SIMULATION_CONFIG } from '../simulationConfig'
import { getAttractionDefinition } from './definitions'
import { emptyTrackGraph } from './trackGraph'
import type { Attraction } from './types'

export function createAttraction(
  id: string,
  definitionId: string,
  x: number,
  z: number,
  elevation: number,
  rotation: 0 | 1 | 2 | 3,
): Attraction | null {
  const definition = getAttractionDefinition(definitionId)
  if (!definition) return null
  const access = {
    mode: definition.accessMode,
    entrance: null,
    exit: null,
  } as Attraction['access']
  const base = {
    id,
    definitionId,
    name: `${definition.name}`,
    access,
    operationMode: 'closed' as const,
    price: defaultAttractionPrice(definitionId),
    queue: [],
  }
  if (definition.layoutKind === 'track') {
    const graph = emptyTrackGraph()
    if (definitionId.startsWith('coaster:')) {
      const typeId = definitionId.slice('coaster:'.length) as CoasterTypeId
      const coasterType = getCoasterType(typeId)
      return {
        ...base,
        layout: {
          kind: 'track',
          topology: definition.topology!,
          agentKind: definition.agentKind!,
          graph,
          selectedOpenNodeId: null,
        },
        runtime: {
          kind: 'coaster',
          typeId,
          settings: {
            dispatchMode: 'full-or-timed',
            dispatchIntervalMinutes: SIMULATION_CONFIG.coasters.defaultDispatchIntervalMinutes,
          },
          train: {
            state: 'boarding',
            cars: 1,
            passengers: 0,
            passengerIds: [],
            capacity: coasterType.carCapacity,
            waitMinutes: 0,
            boardingProgress: 0,
            progress: 0,
            distance: 0,
            speed: 0,
            x,
            y: elevation,
            z,
          },
          telemetry: createCoasterTelemetry(),
        },
      }
    }
    const courseKind = definitionId === 'waterSlide'
      ? 'waterSlide'
      : definitionId.slice('course:'.length) as CourseKind
    return {
      ...base,
      layout: {
        kind: 'track',
        topology: definition.topology!,
        agentKind: definition.agentKind!,
        graph,
        selectedOpenNodeId: null,
      },
      runtime: { kind: 'course', courseKind, riders: [] },
    }
  }
  if (definition.layoutKind === 'area') {
    const runtime = definitionId === 'paintball' || definitionId === 'swimArea'
      ? {
          kind: 'course' as const,
          courseKind: definitionId === 'paintball' ? 'paintball' as const : 'pool' as const,
          riders: [],
          ...(definitionId === 'paintball' ? { teamSize: 4 } : {}),
        }
      : definitionId === 'camping'
        ? { kind: 'camping' as const }
        : { kind: 'party' as const }
    return {
      ...base,
      operationMode: definition.accessMode === 'free' ? 'open' : 'closed',
      layout: {
        kind: 'area',
        accessMode: definition.accessMode,
        cells: [],
        references: [],
        visitorInstallations: [],
      },
      runtime,
    }
  }
  const rideKind = definitionId === 'bungee' ? 'bungee' : 'carousel'
  return {
    ...base,
    layout: {
      kind: 'scripted',
      anchor: { x, z, elevation, heading: rotation * Math.PI / 2 },
      rotation,
      segments: [{
        id: `${id}-base`,
        kind: 'base',
        level: 0,
      }],
    },
    runtime: {
      kind: 'scriptedRide',
      rideKind,
      phase: 0,
      remainingMinutes: 0,
      occupantIds: [],
      towerHeight: rideKind === 'bungee' ? 4 : undefined,
    },
  }
}

function defaultAttractionPrice(definitionId: string): number {
  if (definitionId.startsWith('coaster:')) {
    return getCoasterType(definitionId.slice('coaster:'.length) as CoasterTypeId).defaultTicketPrice
  }
  if (definitionId.startsWith('course:')) {
    return COURSE_SPECS[definitionId.slice('course:'.length) as CourseKind]?.price ?? 0
  }
  if (definitionId === 'paintball') return COURSE_SPECS.paintball.price
  if (definitionId === 'swimArea') return COURSE_SPECS.pool.price
  if (definitionId === 'waterSlide') return COURSE_SPECS.waterSlide.price
  return 0
}
