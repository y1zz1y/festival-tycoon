import { createCoasterTelemetry, type Coaster, type TrackPiece } from '../coasters'
import type { CampInstallation } from '../camping'
import type {
  CourseAttraction,
  CoursePiece,
} from '../courseAttractions'
import type { StageForecourtCell } from '../festivalAreas'
import type { Attraction } from './types'
import type { GameSnapshot } from '../types/snapshot'

export function refreshAttractionProjections(state: GameSnapshot): void {
  state.coasters = projectCoasters(state.attractions)
  state.courses = projectCourses(state.attractions)
  if (state.attractions.some((attraction) => attraction.definitionId === 'camping')) {
    const camping = projectCamping(state.attractions)
    state.campingCells = camping.cells
    state.campInstallations = camping.installations
  }
  if (state.attractions.some((attraction) => attraction.definitionId === 'partyArea')) {
    state.stageForecourtCells = projectPartyAreas(state.attractions)
  }
}

export function projectCoasters(attractions: readonly Attraction[]): Coaster[] {
  return attractions.flatMap((attraction) => {
    if (
      attraction.runtime.kind !== 'coaster' ||
      attraction.layout.kind !== 'track'
    ) return []
    const pieces: TrackPiece[] = attraction.layout.graph.edges.map((edge) => {
      const from = attraction.layout.kind === 'track'
        ? attraction.layout.graph.nodes.find((node) => node.id === edge.fromNodeId)
        : undefined
      const to = attraction.layout.kind === 'track'
        ? attraction.layout.graph.nodes.find((node) => node.id === edge.toNodeId)
        : undefined
      return {
        id: edge.id,
        kind: edge.kind as TrackPiece['kind'],
        start: from?.anchor ?? {
          x: edge.points[0]?.x ?? 0,
          z: edge.points[0]?.z ?? 0,
          elevation: edge.points[0]?.elevation ?? 0,
          heading: edge.points[0]?.heading ?? 0,
          pitch: 0,
          bank: 0,
        },
        end: to?.anchor ?? {
          x: edge.points.at(-1)?.x ?? 0,
          z: edge.points.at(-1)?.z ?? 0,
          elevation: edge.points.at(-1)?.elevation ?? 0,
          heading: edge.points.at(-1)?.heading ?? 0,
          pitch: 0,
          bank: 0,
        },
        points: edge.points.map((point) => ({
          x: point.x,
          y: point.elevation,
          z: point.z,
          frameHeading: point.heading,
        })),
        chainLift: edge.metadata?.chainLift === true,
        transition:
          edge.metadata?.transition === 'pitch' || edge.metadata?.transition === 'bank'
            ? edge.metadata.transition
            : undefined,
      }
    })
    const projected: Coaster = {
      id: attraction.id,
      typeId: attraction.runtime.typeId,
      name: attraction.name,
      pieces,
      entrance: attraction.access.entrance
        ? {
            x: attraction.access.entrance.x,
            y: attraction.access.entrance.elevation,
            z: attraction.access.entrance.z,
          }
        : null,
      exit: attraction.access.exit
        ? {
            x: attraction.access.exit.x,
            y: attraction.access.exit.elevation,
            z: attraction.access.exit.z,
          }
        : null,
      settings: attraction.runtime.settings,
      operationMode: attraction.operationMode,
      ticketPrice: attraction.price,
      train: attraction.runtime.train,
      telemetry: attraction.runtime.telemetry ?? createCoasterTelemetry(),
      queue: attraction.queue,
      closed: attraction.layout.graph.startNodeId !== null &&
        attraction.layout.graph.terminalNodeId === attraction.layout.graph.startNodeId,
    }
    return [projected]
  })
}

export function projectCourses(attractions: readonly Attraction[]): CourseAttraction[] {
  return attractions.flatMap((attraction) => {
    if (attraction.runtime.kind !== 'course') return []
    const pieces: CoursePiece[] = []
    if (attraction.layout.kind === 'track') {
      attraction.layout.graph.edges.forEach((edge) => {
        const from = attraction.layout.kind === 'track'
          ? attraction.layout.graph.nodes.find((node) => node.id === edge.fromNodeId)
          : undefined
        const to = attraction.layout.kind === 'track'
          ? attraction.layout.graph.nodes.find((node) => node.id === edge.toNodeId)
          : undefined
        if (!from || !to) return
        pieces.push({
          id: edge.id,
          kind: edge.kind as CoursePiece['kind'],
          x: from.anchor.x,
          z: from.anchor.z,
          elevation: from.anchor.elevation,
          rotation: headingRotation(from.anchor.heading),
          endX: to.anchor.x,
          endZ: to.anchor.z,
          endElevation: to.anchor.elevation,
        })
      })
    } else if (attraction.layout.kind === 'area') {
      attraction.layout.references.forEach((reference) => {
        pieces.push({
          id: reference.id,
          kind: (reference.kind === 'water' ? 'poolBasin' : reference.kind) as CoursePiece['kind'],
          x: reference.x,
          z: reference.z,
          elevation: reference.elevation,
          rotation: reference.rotation,
        })
      })
    }
    if (attraction.access.entrance) {
      pieces.push({
        id: `${attraction.id}-entrance`,
        kind: 'entrance',
        x: attraction.access.entrance.x,
        z: attraction.access.entrance.z,
        elevation: attraction.access.entrance.elevation,
        rotation: headingRotation(attraction.access.entrance.heading ?? 0),
      })
    }
    if (attraction.access.exit) {
      pieces.push({
        id: `${attraction.id}-exit`,
        kind: 'exit',
        x: attraction.access.exit.x,
        z: attraction.access.exit.z,
        elevation: attraction.access.exit.elevation,
        rotation: headingRotation(attraction.access.exit.heading ?? 0),
      })
    }
    const projected: CourseAttraction = {
      id: attraction.id,
      kind: attraction.runtime.courseKind,
      name: attraction.name,
      operating: attraction.operationMode === 'open',
      price: attraction.price,
      pieces,
      riders: attraction.runtime.riders,
      queue: attraction.queue,
      areaCells: attraction.layout.kind === 'area'
        ? attraction.layout.cells.map(({ x, z }) => ({ x, z }))
        : [],
      teamSize: attraction.runtime.teamSize,
    }
    Object.defineProperty(projected, 'match', {
      enumerable: true,
      configurable: true,
      get: () => attraction.runtime.kind === 'course' ? attraction.runtime.match : undefined,
      set: (value) => {
        if (attraction.runtime.kind === 'course') attraction.runtime.match = value
      },
    })
    return [projected]
  })
}

export function projectCamping(attractions: readonly Attraction[]): {
  cells: Array<{ x: number; z: number; elevation: number }>
  installations: CampInstallation[]
} {
  const camping = attractions.filter((attraction) =>
    attraction.definitionId === 'camping' && attraction.layout.kind === 'area'
  )
  return {
    cells: camping.flatMap((attraction) =>
      attraction.layout.kind === 'area' ? attraction.layout.cells : [],
    ),
    installations: camping.flatMap((attraction) =>
      attraction.layout.kind === 'area' ? attraction.layout.visitorInstallations : [],
    ),
  }
}

export function projectPartyAreas(attractions: readonly Attraction[]): StageForecourtCell[] {
  return attractions.flatMap((attraction) => {
    if (attraction.definitionId !== 'partyArea' || attraction.layout.kind !== 'area') return []
    const stageId = attraction.runtime.kind === 'party' ? attraction.runtime.stageId : undefined
    return attraction.layout.cells.map((cell) => ({ ...cell, stageId }))
  })
}

function headingRotation(heading: number): 0 | 1 | 2 | 3 {
  return (((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4) as 0 | 1 | 2 | 3
}
